"""
Document AI Processor Module
Handles OCR and text extraction using Google Cloud Document AI
"""

import os
import sys
import time
import json
import uuid
import shutil
import logging
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple, Optional, Any

from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions
from PyPDF2 import PdfReader, PdfWriter

from config import config

logger = logging.getLogger(__name__)


class DocumentAIProcessor:
    """Google Cloud Document AI processor for OCR"""

    def __init__(self):
        opts = ClientOptions(api_endpoint=f"{config.google_cloud.location}-documentai.googleapis.com")
        self.client = documentai.DocumentProcessorServiceClient(client_options=opts)
        self.processor_name = self.client.processor_path(
            config.google_cloud.project_id,
            config.google_cloud.location,
            config.google_cloud.processor_id
        )

    def process_document(self, file_path: str, processing_id: str = "") -> Tuple[Any, float]:
        """Process a single PDF document with Document AI"""
        start_time = time.time()

        with open(file_path, "rb") as document:
            document_content = document.read()

        raw_document = documentai.RawDocument(
            content=document_content,
            mime_type="application/pdf"
        )

        process_options = documentai.ProcessOptions(
            ocr_config=documentai.OcrConfig(
                enable_image_quality_scores=False,
                enable_native_pdf_parsing=True,
                enable_symbol=False
            )
        )

        request = documentai.ProcessRequest(
            name=self.processor_name,
            raw_document=raw_document,
            process_options=process_options
        )

        result = self.client.process_document(request=request)
        processing_time = time.time() - start_time

        logger.info(f"Document AI processed in {processing_time:.2f}s")
        return result.document, processing_time

    def extract_raw_data(self, document) -> Dict:
        """Extract raw data from Document AI response"""
        raw_data = {
            'text': document.text,
            'pages': len(document.pages),
            'mime_type': 'application/pdf',
            'page_details': []
        }

        for page_num, page in enumerate(document.pages, 1):
            page_info = {
                'page_number': page_num,
                'tables_count': len(page.tables),
                'tables': []
            }

            for table_idx, table in enumerate(page.tables):
                table_info = {
                    'table_index': table_idx,
                    'headers': [],
                    'rows': []
                }

                for header_row in table.header_rows:
                    headers = []
                    for cell in header_row.cells:
                        cell_text = self._get_text_from_layout(cell.layout, document.text)
                        headers.append(cell_text)
                    table_info['headers'].append(headers)

                for row in table.body_rows:
                    row_data = []
                    for cell in row.cells:
                        cell_text = self._get_text_from_layout(cell.layout, document.text)
                        row_data.append(cell_text)
                    table_info['rows'].append(row_data)

                page_info['tables'].append(table_info)

            raw_data['page_details'].append(page_info)

        return raw_data

    def _get_text_from_layout(self, layout, text: str) -> str:
        """Extract text from layout object"""
        response = ""
        for segment in layout.text_anchor.text_segments:
            start_index = int(segment.start_index) if segment.start_index else 0
            end_index = int(segment.end_index)
            response += text[start_index:end_index]
        return response.strip()


class PDFSplitter:
    """Utility class for splitting large PDFs"""

    @staticmethod
    def split_pdf(input_path: str, max_pages: int = None) -> List[Tuple[str, int, int]]:
        """Split PDF into chunks if it exceeds max pages"""
        if max_pages is None:
            max_pages = config.processing.max_pages_per_split

        reader = PdfReader(input_path)
        total_pages = len(reader.pages)

        if total_pages <= max_pages:
            return [(input_path, 1, total_pages)]

        base_name = Path(input_path).stem
        temp_dir = Path("temp_splits")
        temp_dir.mkdir(exist_ok=True)

        split_files = []
        chunk_num = 1

        for start_page in range(0, total_pages, max_pages):
            end_page = min(start_page + max_pages, total_pages)

            writer = PdfWriter()
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            split_filename = temp_dir / f"{base_name}_part{chunk_num}.pdf"
            with open(split_filename, 'wb') as output_file:
                writer.write(output_file)

            split_files.append((str(split_filename), start_page + 1, end_page))
            chunk_num += 1

        return split_files


class EOBProcessor:
    """Main EOB document processor"""

    def __init__(self):
        self.doc_ai_processor = DocumentAIProcessor()

        # Ensure folders exist
        Path(config.folders.upload_folder).mkdir(parents=True, exist_ok=True)
        Path(config.folders.results_folder).mkdir(parents=True, exist_ok=True)
        Path(config.folders.raw_data_folder).mkdir(parents=True, exist_ok=True)

    def process_file(self, file_path: str) -> Optional[Dict]:
        """Process a single PDF file"""
        filename = os.path.basename(file_path)

        if filename.startswith("Processed_"):
            logger.info(f"Skipping already processed file: {filename}")
            return None

        processing_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        reader = PdfReader(file_path)
        total_pages = len(reader.pages)

        logger.info(f"Processing {filename} ({total_pages} pages)")

        try:
            split_files = PDFSplitter.split_pdf(file_path)

            all_raw_data = []
            total_processing_time = 0

            if len(split_files) == 1:
                document, proc_time = self.doc_ai_processor.process_document(file_path, processing_id)
                raw_data = self.doc_ai_processor.extract_raw_data(document)
                all_raw_data.append(raw_data)
                total_processing_time = proc_time
            else:
                all_raw_data, total_processing_time = self._process_parallel(split_files, processing_id)

            consolidated_data = self._consolidate_raw_data(all_raw_data, processing_id, filename, timestamp)

            # Save raw data to file
            base_filename = Path(filename).stem
            output_filename = f"Raw_data_{base_filename}_{timestamp}.json"
            output_path = Path(config.folders.raw_data_folder) / output_filename

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(consolidated_data, f, indent=2, ensure_ascii=False)

            # Move processed file
            self._move_processed_file(file_path, filename, timestamp)
            self._cleanup_temp_files()

            return {
                'processing_id': processing_id,
                'filename': filename,
                'timestamp': timestamp,
                'total_pages': total_pages,
                'processing_time_seconds': round(total_processing_time, 2),
                'raw_data_file': output_filename,
                'raw_data_path': str(output_path),
                'raw_data': consolidated_data,
                'status': 'success'
            }

        except Exception as e:
            logger.error(f"Error processing {filename}: {str(e)}")
            return {
                'processing_id': processing_id,
                'filename': filename,
                'timestamp': timestamp,
                'status': 'error',
                'error': str(e)
            }

    def _process_parallel(self, split_files: List[Tuple], processing_id: str) -> Tuple[List[Dict], float]:
        """Process multiple PDF chunks in parallel"""
        all_raw_data = []
        total_processing_time = 0

        with ThreadPoolExecutor(max_workers=config.processing.max_parallel_workers) as executor:
            future_to_part = {
                executor.submit(self._process_part, file_path, processing_id): part_num
                for part_num, (file_path, start_page, end_page) in enumerate(split_files, 1)
            }

            for future in as_completed(future_to_part):
                try:
                    result = future.result()
                    all_raw_data.append(result['raw_data'])
                    total_processing_time += result['processing_time']
                except Exception as e:
                    logger.error(f"Error in parallel processing: {str(e)}")

        return all_raw_data, total_processing_time

    def _process_part(self, file_path: str, processing_id: str) -> Dict:
        """Process a single part of a split PDF"""
        document, proc_time = self.doc_ai_processor.process_document(file_path, processing_id)
        raw_data = self.doc_ai_processor.extract_raw_data(document)
        return {'raw_data': raw_data, 'processing_time': proc_time}

    def _consolidate_raw_data(self, all_raw_data: List[Dict], processing_id: str,
                              filename: str, timestamp: str) -> Dict:
        """Consolidate data from multiple PDF parts"""
        if len(all_raw_data) == 1:
            consolidated = all_raw_data[0]
        else:
            consolidated = {
                'text': '',
                'pages': 0,
                'mime_type': 'application/pdf',
                'page_details': []
            }

            page_offset = 0
            for part_data in all_raw_data:
                consolidated['text'] += part_data['text'] + '\n'
                consolidated['pages'] += part_data['pages']

                for page_info in part_data['page_details']:
                    page_info['page_number'] += page_offset
                    consolidated['page_details'].append(page_info)

                page_offset += part_data['pages']

        consolidated['metadata'] = {
            'processing_id': processing_id,
            'original_filename': filename,
            'timestamp': timestamp,
            'total_pages': consolidated['pages']
        }

        return consolidated

    def _move_processed_file(self, file_path: str, filename: str, timestamp: str):
        """Move processed file to results folder"""
        base_name = Path(filename).stem
        extension = Path(filename).suffix
        new_filename = f"Processed_{base_name}_{timestamp}{extension}"
        new_path = Path(config.folders.results_folder) / new_filename
        shutil.move(file_path, new_path)
        logger.info(f"Moved processed file to: {new_path}")

    def _cleanup_temp_files(self):
        """Clean up temporary split files"""
        import gc
        gc.collect()

        temp_dir = Path("temp_splits")
        if temp_dir.exists():
            for attempt in range(3):
                try:
                    shutil.rmtree(temp_dir)
                    break
                except (PermissionError, OSError):
                    if attempt < 2:
                        time.sleep(0.5)
                    else:
                        shutil.rmtree(temp_dir, ignore_errors=True)
