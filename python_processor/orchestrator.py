"""
Document Processing Orchestrator
Main workflow orchestrator that replaces n8n workflow
"""

import os
import json
import logging
import csv
import io
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict

import requests

from config import config, get_dynamic_config
from cost_tracker import CostTracker, CostBreakdown

# Lazy imports - only import what's needed based on provider config
def get_eob_processor():
    """Get EOBProcessor (Google Document AI) - lazy import"""
    from document_ai_processor import EOBProcessor
    return EOBProcessor()

def get_openai_extractor():
    """Get OpenAI extractor - lazy import"""
    from openai_extractor import OpenAIExtractor
    return OpenAIExtractor()

def get_pmg_extractor():
    """Get PMG direct extractor - lazy import"""
    from openai_extractor import PMGDirectExtractor
    return PMGDirectExtractor()

def get_mistral_processor():
    """Get Mistral processor - lazy import"""
    from mistral_processor import MistralProcessor
    return MistralProcessor()

def get_document_category():
    """Get DocumentCategory enum - lazy import"""
    from openai_extractor import DocumentCategory
    return DocumentCategory

def get_google_drive_service():
    """Get Google Drive service - lazy import"""
    from google_drive_service import GoogleDriveService
    return GoogleDriveService()

logger = logging.getLogger(__name__)

# Predefined column order for each document category
EOB_COLUMN_ORDER = [
    'Page_no',
    'Patient_acct',
    'Patient_ID',
    'Claim_ID',
    'Patient Name',
    'First_Name',
    'Last Name',
    'member_number',
    'account_number',
    'check_number',
    'service_date',
    'billed_amount',
    'allowed_amount',
    'paid_amount',
    'interest_amount',
    'adj_co45',
    'adj_co253',
    'adj_co144',
    'cpt_hcpcs',
    'insurance_co',
    'claim_summary',
    'action_required',
    'patient_responsibility',
    'reason_code_comments',
    'Confidence_Score'
]

# Column orders by category (1=EOB, 2=Facesheet, 3=Invoice)
COLUMN_ORDERS = {
    1: EOB_COLUMN_ORDER,
    # Add other category column orders as needed
}


@dataclass
class ProcessRequest:
    """Process request data structure"""
    process_id: str
    filename: str
    original_filename: str
    drive_file_id: Optional[str] = None
    local_file_path: Optional[str] = None  # For direct file uploads
    user_id: Optional[str] = None
    client_id: Optional[str] = None
    session_id: Optional[str] = None
    model_id: int = 2
    doc_category: int = 1  # 1=EOB, 2=Facesheet, 3=Invoice
    extraction_prompt: Optional[str] = None  # Custom extraction prompt from output profile

    @classmethod
    def from_dict(cls, data: dict) -> 'ProcessRequest':
        """Create ProcessRequest from dictionary"""
        return cls(
            process_id=data.get('processId', ''),
            filename=data.get('filename', ''),
            original_filename=data.get('originalFilename', data.get('filename', '')),
            drive_file_id=data.get('driveFileId'),
            local_file_path=data.get('localFilePath'),
            user_id=data.get('userid'),
            client_id=data.get('clientId'),
            session_id=data.get('sessionId'),
            model_id=int(data.get('modelId', 2)),
            doc_category=int(data.get('docCategory', 1)),
            extraction_prompt=data.get('extractionPrompt')
        )


@dataclass
class ProcessResult:
    """Process result data structure"""
    process_id: str
    status: str
    json_drive_url: Optional[str] = None
    csv_drive_url: Optional[str] = None
    json_drive_id: Optional[str] = None
    csv_drive_id: Optional[str] = None
    processing_time_seconds: float = 0
    document_ai_cost: float = 0
    openai_cost: float = 0
    total_cost: float = 0
    total_records: int = 0
    no_of_pages: int = 0
    error_message: Optional[str] = None


class DocumentOrchestrator:
    """Main orchestrator for document processing workflow"""

    def __init__(self):
        # Lazy initialization - processors are created on first use
        self._eob_processor = None
        self._openai_extractor = None
        self._pmg_extractor = None
        self._mistral_processor = None
        self._drive_service = None
        self.cost_tracker = CostTracker()

    @property
    def eob_processor(self):
        if self._eob_processor is None:
            self._eob_processor = get_eob_processor()
        return self._eob_processor

    @property
    def openai_extractor(self):
        if self._openai_extractor is None:
            self._openai_extractor = get_openai_extractor()
        return self._openai_extractor

    @property
    def pmg_extractor(self):
        if self._pmg_extractor is None:
            self._pmg_extractor = get_pmg_extractor()
        return self._pmg_extractor

    @property
    def mistral_processor(self):
        if self._mistral_processor is None:
            self._mistral_processor = get_mistral_processor()
        return self._mistral_processor

    @property
    def drive_service(self):
        if self._drive_service is None:
            self._drive_service = get_google_drive_service()
        return self._drive_service

    def process_document(self, request: ProcessRequest) -> ProcessResult:
        """Main document processing workflow"""
        logger.info(f"=== Starting document processing ===")
        logger.info(f"Process ID: {request.process_id}")
        logger.info(f"Filename: {request.filename}")
        logger.info(f"Document Category: {request.doc_category}")

        # Load dynamic config for this document category (API config > .env fallback)
        dynamic_config = get_dynamic_config(request.doc_category)
        logger.info(f"Dynamic config loaded - OCR: {dynamic_config.ocr_provider}, LLM: {dynamic_config.llm_provider}")

        self.cost_tracker.start_tracking()
        start_time = datetime.now()

        try:
            # Step 1: Validate input
            validation_errors = self._validate_input(request)
            if validation_errors:
                return ProcessResult(
                    process_id=request.process_id,
                    status='Error',
                    error_message=f"Validation failed: {', '.join(validation_errors)}"
                )

            # Step 2: Download PDF from Google Drive
            local_pdf_path = self._download_pdf(request)
            if not local_pdf_path:
                return ProcessResult(
                    process_id=request.process_id,
                    status='Error',
                    error_message='Failed to download PDF from Google Drive'
                )

            # Step 3: Process with Document AI
            docai_result = self.eob_processor.process_file(local_pdf_path)
            if not docai_result or docai_result.get('status') == 'error':
                return ProcessResult(
                    process_id=request.process_id,
                    status='Error',
                    error_message=f"Document AI processing failed: {docai_result.get('error', 'Unknown error')}"
                )

            # Step 4: Extract data with OpenAI (or direct extraction for PMG/DN)
            extraction_result = self._extract_data(
                docai_result['raw_data'],
                request.doc_category,
                request.filename,
                request.extraction_prompt
            )

            # Step 5: Calculate costs
            cost_breakdown = self.cost_tracker.calculate_total_cost(
                pages=docai_result['total_pages'],
                input_tokens=extraction_result.input_tokens,
                output_tokens=extraction_result.output_tokens,
                model_used=extraction_result.model_used
            )

            # Step 6: Prepare JSON output
            json_output = self._prepare_json_output(
                extraction_result.data,
                extraction_result.records,
                request,
                cost_breakdown
            )

            # Step 7: Prepare CSV output with predefined column order
            csv_content = self._prepare_csv_output(extraction_result.records, request.doc_category)

            # Step 8: Save results locally and/or upload to Google Drive
            json_file_name = f"extracted_{Path(request.original_filename).stem}.json"
            csv_file_name = f"extracted_{Path(request.original_filename).stem}.csv"
            xlsx_file_name = f"extracted_{Path(request.original_filename).stem}.xlsx"

            local_json_path = None
            local_csv_path = None
            local_xlsx_path = None

            # Always save files locally (for backend access and as fallback when Drive upload fails)
            if True:  # Always save locally
                results_dir = Path(config.folders.results_folder)
                results_dir.mkdir(parents=True, exist_ok=True)

                # Save JSON
                local_json_path = str(results_dir / f"{request.process_id}.json")
                with open(local_json_path, 'w', encoding='utf-8') as f:
                    json.dump(json_output, f, indent=2, ensure_ascii=False)
                logger.info(f"JSON saved to: {local_json_path}")

                # Save CSV
                local_csv_path = str(results_dir / f"{request.process_id}.csv")
                with open(local_csv_path, 'w', encoding='utf-8', newline='') as f:
                    f.write(csv_content)
                logger.info(f"CSV saved to: {local_csv_path}")

                # Save XLSX
                try:
                    import openpyxl
                    from openpyxl import Workbook
                    wb = Workbook()
                    ws = wb.active
                    csv_reader = csv.reader(io.StringIO(csv_content))
                    for row in csv_reader:
                        ws.append(row)
                    local_xlsx_path = str(results_dir / f"{request.process_id}.xlsx")
                    wb.save(local_xlsx_path)
                    logger.info(f"XLSX saved to: {local_xlsx_path}")
                except ImportError:
                    logger.warning("openpyxl not installed - XLSX export skipped")
                except Exception as e:
                    logger.warning(f"Failed to create XLSX: {e}")

            # Google Drive upload disabled - using local storage only
            json_upload = None
            csv_upload = None

            # Step 9: Prepare result
            result = ProcessResult(
                process_id=request.process_id,
                status='Processed',
                json_drive_url=json_upload.get('webViewLink') if json_upload else None,
                csv_drive_url=csv_upload.get('webViewLink') if csv_upload else None,
                json_drive_id=json_upload.get('id') if json_upload else None,
                csv_drive_id=csv_upload.get('id') if csv_upload else None,
                processing_time_seconds=cost_breakdown.processing_time_seconds,
                document_ai_cost=cost_breakdown.document_ai_cost,
                openai_cost=cost_breakdown.openai_cost,
                total_cost=cost_breakdown.total_cost,
                total_records=len(extraction_result.records),
                no_of_pages=cost_breakdown.pages
            )

            # Step 10: Send results to backend with local file paths
            self._send_results_to_backend(result, local_json_path, local_csv_path, local_xlsx_path)

            logger.info(f"=== Processing completed successfully ===")
            logger.info(f"Total Records: {result.total_records}")
            logger.info(f"Total Cost: ${result.total_cost}")
            logger.info(f"Processing Time: {result.processing_time_seconds}s")

            return result

        except Exception as e:
            logger.error(f"Processing failed with error: {str(e)}", exc_info=True)
            return ProcessResult(
                process_id=request.process_id,
                status='Error',
                error_message=str(e)
            )

    def _validate_input(self, request: ProcessRequest) -> list:
        """Validate input data"""
        errors = []

        if not request.process_id:
            errors.append("Missing processId")
        if not request.filename:
            errors.append("Missing filename")
        # Either drive_file_id or local_file_path must be provided
        if not request.drive_file_id and not request.local_file_path:
            errors.append("Missing driveFileId or localFilePath")
        if request.doc_category not in [1, 2, 3]:
            errors.append(f"Invalid docCategory: {request.doc_category}")

        if not request.filename.lower().endswith('.pdf'):
            logger.warning(f"Filename doesn't end with .pdf: {request.filename}")

        return errors

    def _download_pdf(self, request: ProcessRequest) -> Optional[str]:
        """Download PDF from Google Drive or use local file"""
        # If local file path is provided, use it directly
        if request.local_file_path:
            if os.path.exists(request.local_file_path):
                logger.info(f"Using local file: {request.local_file_path}")
                return request.local_file_path
            else:
                logger.error(f"Local file not found: {request.local_file_path}")
                return None

        local_path = Path(config.folders.upload_folder) / request.filename

        # Check if file already exists locally (uploaded by backend)
        if local_path.exists():
            logger.info(f"Using existing local file: {local_path}")
            return str(local_path)

        # Otherwise download from Google Drive
        logger.info(f"Downloading PDF from Google Drive: {request.filename}")

        # Wait for file to be available
        time.sleep(2)

        if self.drive_service.download_file(request.drive_file_id, str(local_path)):
            return str(local_path)

        # Fallback: check local folder one more time
        if local_path.exists():
            logger.info(f"Using local file after Drive download failed: {local_path}")
            return str(local_path)

        return None

    def _extract_data(self, raw_data: Dict, doc_category: int, filename: str, extraction_prompt: Optional[str] = None):
        """Extract data based on document category"""
        # Check if this is a PMG/DN facesheet (bypass LLM)
        if doc_category == 2 and (filename.startswith('PMG_') or filename.startswith('DN_')):
            logger.info("Using direct extraction for PMG/DN facesheet")
            return self.pmg_extractor.extract_pmg_facesheet(raw_data, filename)

        # Get DocumentCategory enum via lazy import
        DocumentCategory = get_document_category()

        # Map category to enum
        category_map = {
            1: DocumentCategory.EOB,
            2: DocumentCategory.FACESHEET,
            3: DocumentCategory.INVOICE
        }
        category = category_map.get(doc_category, DocumentCategory.EOB)

        logger.info(f"Extracting data using OpenAI for {category.name}")
        if extraction_prompt:
            logger.info("Using custom extraction prompt from output profile")
        return self.openai_extractor.extract_data(raw_data, category, filename, extraction_prompt)

    def _sort_records_by_page(self, records: list) -> list:
        """Sort records by Page_no in ascending order"""
        def get_page_no(record):
            if isinstance(record, dict):
                page_no = record.get('Page_no', record.get('Original_page_no', '0'))
                try:
                    return int(page_no) if page_no else 0
                except (ValueError, TypeError):
                    return 0
            return 0

        return sorted(records, key=get_page_no)

    def _order_record_fields(self, record: dict, doc_category: int) -> dict:
        """Order fields in a record according to predefined column order"""
        predefined_order = COLUMN_ORDERS.get(doc_category, [])
        if not predefined_order:
            return record

        ordered = {}
        # Add fields in predefined order
        for key in predefined_order:
            if key in record:
                ordered[key] = record[key]
        # Add any extra fields alphabetically
        for key in sorted(record.keys()):
            if key not in ordered:
                ordered[key] = record[key]
        return ordered

    def _prepare_json_output(self, extracted_data: Dict, records: list,
                             request: ProcessRequest, cost_breakdown: CostBreakdown) -> Dict:
        """Prepare JSON output with metadata"""
        # Sort records by Page_no
        sorted_records = self._sort_records_by_page(records)
        # Order fields in each record
        ordered_records = [self._order_record_fields(r, request.doc_category) for r in sorted_records if isinstance(r, dict)]
        return {
            'data': ordered_records,
            'metadata': {
                'original_pdf': request.original_filename,
                'process_id': request.process_id,
                'processed_at': datetime.now().isoformat(),
                'source': 'Document AI + OpenAI',
                'model_used': cost_breakdown.model_used,
                'total_records': len(records),
                'pages': cost_breakdown.pages,
                'processing_time_seconds': cost_breakdown.processing_time_seconds,
                'costs': {
                    'document_ai': cost_breakdown.document_ai_cost,
                    'openai': cost_breakdown.openai_cost,
                    'total': cost_breakdown.total_cost
                },
                'tokens': {
                    'input': cost_breakdown.input_tokens,
                    'output': cost_breakdown.output_tokens
                },
                'summary': extracted_data.get('summary', {})
            }
        }

    def _prepare_csv_output(self, records: list, doc_category: int = 1) -> str:
        """Prepare CSV output from records with predefined column order"""
        if not records:
            return ""

        # Sort records by Page_no
        sorted_records = self._sort_records_by_page(records)

        # Get predefined column order for this category, or collect all keys
        predefined_order = COLUMN_ORDERS.get(doc_category, [])

        # Get all unique keys from all records
        all_keys = set()
        for record in sorted_records:
            if isinstance(record, dict):
                all_keys.update(record.keys())

        # Build ordered headers: predefined columns first, then any extra columns alphabetically
        if predefined_order:
            headers = [col for col in predefined_order if col in all_keys]
            extra_cols = sorted([col for col in all_keys if col not in predefined_order])
            headers.extend(extra_cols)
        else:
            headers = sorted(list(all_keys))

        # Build CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers, extrasaction='ignore')
        writer.writeheader()

        for record in sorted_records:
            if isinstance(record, dict):
                # Clean values for CSV
                clean_record = {}
                for key, value in record.items():
                    if isinstance(value, (list, dict)):
                        clean_record[key] = json.dumps(value)
                    else:
                        clean_record[key] = value
                writer.writerow(clean_record)

        return output.getvalue()

    def _send_results_to_backend(self, result: ProcessResult, local_json_path: str = None, local_csv_path: str = None, local_xlsx_path: str = None) -> bool:
        """Send results to backend API with retry logic"""
        max_retries = 10
        retry_delay = 60  # seconds

        payload = {
            'processId': result.process_id,
            'status': result.status,
            'jsonDriveUrl': result.json_drive_url,
            'csvDriveUrl': result.csv_drive_url,
            'jsonDriveId': result.json_drive_id,
            'csvDriveId': result.csv_drive_id,
            'processingTimeSeconds': result.processing_time_seconds,
            'documentAiCost': result.document_ai_cost,
            'openAiCost': result.openai_cost,
            'totalCost': result.total_cost,
            'totalRecords': result.total_records,
            'noOfPages': result.no_of_pages,
            'localJsonPath': local_json_path,
            'localCsvPath': local_csv_path,
            'localXlsxPath': local_xlsx_path
        }

        logger.info(f"Sending results to backend for process {result.process_id}")

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    f"{config.server.backend_url}/api/documents/{result.process_id}/processing-results",
                    json=payload,
                    timeout=10
                )
                if response.status_code == 200:
                    logger.info("Results sent successfully to backend")
                    return True
                else:
                    logger.warning(f"Backend returned status {response.status_code}: {response.text}")
            except Exception as e:
                logger.warning(f"Failed to send results (attempt {attempt + 1}): {e}")

            if attempt < max_retries - 1:
                delay = retry_delay * (2 if attempt > 2 else 1) * (4 if attempt > 5 else 1)
                logger.info(f"Retrying after {delay}s...")
                time.sleep(delay)

        logger.error(f"Failed to send results after {max_retries} attempts")
        return False


def process_document_request(data: dict) -> dict:
    """Main entry point for processing a document"""
    request = ProcessRequest.from_dict(data)
    orchestrator = DocumentOrchestrator()
    result = orchestrator.process_document(request)
    return asdict(result)
