"""
Mistral AI Processor Module
Handles both OCR and structured data extraction using Pixtral models
Supports both synchronous and batch processing for large documents
"""

import base64
import json
import logging
import re
import time
import tempfile
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from enum import Enum

from config import config

logger = logging.getLogger(__name__)


class DocumentCategory(Enum):
    """Document categories for extraction"""
    EOB = 1
    FACESHEET = 2
    INVOICE = 3


@dataclass
class MistralExtractionResult:
    """Result from Mistral extraction"""
    data: Dict[str, Any]
    records: List[Dict[str, Any]]
    raw_text: str
    input_tokens: int
    output_tokens: int
    model: str


class MistralProcessor:
    """
    Unified processor using Mistral AI for both OCR and extraction.
    Uses Pixtral models which can process images/PDFs and extract structured data.
    Supports batch processing for large documents (50% cost savings).
    """

    # Chunking configuration
    MAX_PAGES_PER_CHUNK = 30

    # Batch processing configuration
    BATCH_POLL_INTERVAL = 10  # seconds between status checks
    BATCH_MAX_WAIT_TIME = 3600  # max 1 hour wait for batch completion

    def __init__(self, use_batch: bool = True):
        """
        Initialize Mistral processor.

        Args:
            use_batch: If True, use batch API for chunked documents (50% cheaper)
        """
        self.api_key = config.mistral.api_key
        self.model = config.mistral.model
        self.use_batch = use_batch

        if not self.api_key or self.api_key == 'your_mistral_api_key_here':
            logger.warning("Mistral API key not configured")

    def _get_system_prompt(self, category: DocumentCategory) -> str:
        """Get the system prompt for the document category"""

        if category == DocumentCategory.EOB:
            return """You are an expert medical billing analyst specializing in Explanation of Benefits (EOB) document processing. Your task is to extract structured data from EOB documents with exceptional accuracy.

CRITICAL EXTRACTION RULES:
1. Extract EVERY claim/line item from the document - do not miss any
2. For multi-page documents, track the original page number for each record
3. Maintain data integrity - only extract what is explicitly stated
4. Use null/empty for missing fields rather than guessing
5. Parse all monetary values as numbers (remove $ and commas)
6. Dates should be in consistent format (YYYY-MM-DD preferred)

OUTPUT FORMAT:
Return a JSON object with this structure:
{
    "document_summary": {
        "insurance_company": "string",
        "check_number": "string",
        "check_date": "string",
        "total_paid": number,
        "total_claims": number
    },
    "claims": [
        {
            "Original_page_no": number,
            "EOB_page_no": number,
            "patient_acct": "string",
            "Patient_ID": "string",
            "Claim_ID": "string",
            "Patient Name": "string",
            "First_Name": "string",
            "Last Name": "string",
            "member_number": "string",
            "service_date": "string",
            "allowed_amount": number,
            "interest_amount": number,
            "paid_amount": number,
            "insurance_co": "string",
            "billed_amount": number,
            "cpt_hcpcs": "string",
            "adj_co45": number,
            "adj_co144": number,
            "adj_co253": number,
            "check_number": "string",
            "account_number": "string",
            "patient_responsibility": number,
            "claim_summary": "string",
            "action_required": "string",
            "reason_code_comments": "string",
            "Confidence_Score": number
        }
    ]
}

IMPORTANT: The output must be valid JSON only, no additional text or markdown formatting."""

        elif category == DocumentCategory.FACESHEET:
            return """You are an expert medical records analyst specializing in patient facesheet/admission document processing.

Extract all patient demographic and admission information including:
- Patient name, DOB, SSN, address, phone
- Insurance information
- Admission/discharge dates
- Diagnosis codes
- Attending physician
- Emergency contacts

Return as structured JSON with a "patient_info" object and any "additional_data" array."""

        elif category == DocumentCategory.INVOICE:
            return """You are an expert accounts payable analyst specializing in medical invoice processing.

Extract all invoice details including:
- Vendor information
- Invoice number and date
- Line items with descriptions, quantities, unit prices
- Tax amounts
- Total amounts
- Payment terms

Return as structured JSON with "invoice_header" and "line_items" array."""

        return "Extract all structured data from this document as JSON."

    def _encode_pdf_to_base64(self, pdf_path: str) -> str:
        """Encode PDF file to base64"""
        with open(pdf_path, 'rb') as f:
            return base64.standard_b64encode(f.read()).decode('utf-8')

    def _call_mistral_api(self, messages: List[Dict], max_tokens: int = 16384, retries: int = 3) -> Dict:
        """Call Mistral API with messages (synchronous) with retry logic"""
        import requests

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': self.model,
            'messages': messages,
            'max_tokens': max_tokens,
            'temperature': 0
        }

        last_error = None
        for attempt in range(retries):
            try:
                response = requests.post(
                    'https://api.mistral.ai/v1/chat/completions',
                    headers=headers,
                    json=payload,
                    timeout=600  # 10 minutes timeout for large documents
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:  # Rate limit
                    wait_time = 30 * (attempt + 1)
                    logger.warning(f"Rate limited, waiting {wait_time}s before retry {attempt + 1}/{retries}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Mistral API error: {response.status_code} - {response.text}")
                    raise Exception(f"Mistral API error: {response.status_code}")

            except requests.exceptions.Timeout as e:
                last_error = e
                logger.warning(f"Timeout on attempt {attempt + 1}/{retries}, retrying...")
                time.sleep(10)
                continue
            except requests.exceptions.RequestException as e:
                last_error = e
                logger.warning(f"Request error on attempt {attempt + 1}/{retries}: {e}")
                time.sleep(10)
                continue

        raise Exception(f"Failed after {retries} attempts: {last_error}")

    def _create_batch_job(self, requests_data: List[Dict]) -> str:
        """
        Create a batch job with multiple requests.

        Args:
            requests_data: List of request objects with custom_id and messages

        Returns:
            Batch job ID
        """
        import requests

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        # Create JSONL content for batch
        jsonl_content = ""
        for req in requests_data:
            batch_request = {
                "custom_id": req['custom_id'],
                "body": {
                    "model": self.model,
                    "messages": req['messages'],
                    "max_tokens": 16384,
                    "temperature": 0
                }
            }
            jsonl_content += json.dumps(batch_request) + "\n"

        # Upload the batch file
        files = {
            'file': ('batch_requests.jsonl', jsonl_content, 'application/jsonl'),
            'purpose': (None, 'batch')
        }

        upload_response = requests.post(
            'https://api.mistral.ai/v1/files',
            headers={'Authorization': f'Bearer {self.api_key}'},
            files=files,
            timeout=60
        )

        if upload_response.status_code != 200:
            logger.error(f"Failed to upload batch file: {upload_response.text}")
            raise Exception(f"Batch file upload failed: {upload_response.status_code}")

        file_id = upload_response.json()['id']
        logger.info(f"Uploaded batch file: {file_id}")

        # Create batch job
        batch_payload = {
            "input_files": [file_id],
            "endpoint": "/v1/chat/completions",
            "model": self.model
        }

        batch_response = requests.post(
            'https://api.mistral.ai/v1/batch/jobs',
            headers=headers,
            json=batch_payload,
            timeout=60
        )

        if batch_response.status_code not in [200, 201]:
            logger.error(f"Failed to create batch job: {batch_response.text}")
            raise Exception(f"Batch job creation failed: {batch_response.status_code}")

        job_id = batch_response.json()['id']
        logger.info(f"Created batch job: {job_id}")
        return job_id

    def _get_batch_status(self, job_id: str) -> Dict:
        """Get status of a batch job"""
        import requests

        headers = {'Authorization': f'Bearer {self.api_key}'}

        response = requests.get(
            f'https://api.mistral.ai/v1/batch/jobs/{job_id}',
            headers=headers,
            timeout=30
        )

        if response.status_code != 200:
            raise Exception(f"Failed to get batch status: {response.status_code}")

        return response.json()

    def _wait_for_batch_completion(self, job_id: str) -> Dict:
        """Wait for batch job to complete"""
        start_time = time.time()

        while time.time() - start_time < self.BATCH_MAX_WAIT_TIME:
            status = self._get_batch_status(job_id)
            job_status = status.get('status', '')

            logger.info(f"Batch job {job_id} status: {job_status}")

            if job_status == 'SUCCESS':
                return status
            elif job_status in ['FAILED', 'CANCELLED', 'EXPIRED']:
                raise Exception(f"Batch job failed with status: {job_status}")

            time.sleep(self.BATCH_POLL_INTERVAL)

        raise Exception(f"Batch job timed out after {self.BATCH_MAX_WAIT_TIME} seconds")

    def _get_batch_results(self, job_id: str) -> List[Dict]:
        """Get results from completed batch job"""
        import requests

        # Get job details to find output file
        status = self._get_batch_status(job_id)
        output_file_id = status.get('output_file')

        if not output_file_id:
            raise Exception("No output file found for batch job")

        # Download results
        headers = {'Authorization': f'Bearer {self.api_key}'}

        response = requests.get(
            f'https://api.mistral.ai/v1/files/{output_file_id}/content',
            headers=headers,
            timeout=120
        )

        if response.status_code != 200:
            raise Exception(f"Failed to download batch results: {response.status_code}")

        # Parse JSONL results
        results = []
        for line in response.text.strip().split('\n'):
            if line:
                results.append(json.loads(line))

        return results

    def _try_recover_truncated_json(self, text: str) -> Optional[Dict]:
        """Attempt to recover data from truncated JSON response"""
        logger.warning("Attempting to recover truncated JSON...")

        # Try to find and extract claims array
        claims_match = re.search(r'"claims"\s*:\s*\[', text)
        if claims_match:
            # Find all complete claim objects
            claims = []
            # Match complete JSON objects within the claims array
            pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'

            claims_section = text[claims_match.end():]
            for match in re.finditer(pattern, claims_section):
                try:
                    claim = json.loads(match.group())
                    if any(key in claim for key in ['Patient Name', 'patient_acct', 'Claim_ID', 'paid_amount']):
                        claims.append(claim)
                except json.JSONDecodeError:
                    continue

            if claims:
                logger.info(f"Recovered {len(claims)} claims from truncated response")
                return {
                    'document_summary': {'note': 'Recovered from truncated response'},
                    'claims': claims
                }

        return None

    def process_pdf(
        self,
        pdf_path: str,
        category: DocumentCategory,
        filename: str = None
    ) -> MistralExtractionResult:
        """
        Process a PDF document using Mistral Pixtral for OCR + extraction in one step.

        Args:
            pdf_path: Path to the PDF file
            category: Document category for extraction
            filename: Original filename for reference

        Returns:
            MistralExtractionResult with extracted data
        """
        if not self.api_key or self.api_key == 'your_mistral_api_key_here':
            raise ValueError("Mistral API key not configured. Get one at https://console.mistral.ai/api-keys/")

        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        filename = filename or pdf_path.name
        logger.info(f"Processing PDF with Mistral: {filename}")

        # Check if we need to chunk the document
        from PyPDF2 import PdfReader
        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        logger.info(f"Document has {total_pages} pages")

        if total_pages > self.MAX_PAGES_PER_CHUNK:
            return self._process_with_chunking(pdf_path, category, filename, total_pages)
        else:
            return self._process_single(pdf_path, category, filename)

    def _process_single(
        self,
        pdf_path: Path,
        category: DocumentCategory,
        filename: str
    ) -> MistralExtractionResult:
        """Process a single PDF (or chunk) with Mistral"""

        # Encode PDF to base64
        pdf_base64 = self._encode_pdf_to_base64(str(pdf_path))

        system_prompt = self._get_system_prompt(category)

        # Build messages with PDF as document
        messages = [
            {
                'role': 'system',
                'content': system_prompt
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': f'Please analyze this document ({filename}) and extract all structured data as JSON.'
                    },
                    {
                        'type': 'document_url',
                        'document_url': f'data:application/pdf;base64,{pdf_base64}'
                    }
                ]
            }
        ]

        # Call Mistral API
        response = self._call_mistral_api(messages)

        # Parse response
        content = response['choices'][0]['message']['content']
        usage = response.get('usage', {})

        input_tokens = usage.get('prompt_tokens', 0)
        output_tokens = usage.get('completion_tokens', 0)

        # Parse JSON from response
        data = self._parse_json_response(content)

        # Extract records based on category
        records = self._extract_records(data, category)

        return MistralExtractionResult(
            data=data,
            records=records,
            raw_text=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=self.model
        )

    def _process_with_chunking(
        self,
        pdf_path: Path,
        category: DocumentCategory,
        filename: str,
        total_pages: int
    ) -> MistralExtractionResult:
        """Process large PDF by splitting into chunks - uses batch API for 50% cost savings"""
        from PyPDF2 import PdfReader, PdfWriter

        logger.info(f"Document too large ({total_pages} pages), using chunking strategy")
        logger.info(f"Batch processing enabled: {self.use_batch}")

        reader = PdfReader(str(pdf_path))

        # Calculate chunks
        num_chunks = (total_pages + self.MAX_PAGES_PER_CHUNK - 1) // self.MAX_PAGES_PER_CHUNK
        logger.info(f"Splitting into {num_chunks} chunks of up to {self.MAX_PAGES_PER_CHUNK} pages each")

        # Use batch processing if enabled and we have multiple chunks
        if self.use_batch and num_chunks > 1:
            logger.info(">>> Using BATCH processing for chunks (50% cost savings)")
            try:
                return self._process_chunks_batch(reader, category, filename, total_pages, num_chunks)
            except Exception as e:
                logger.warning(f"Batch processing failed: {e}, falling back to sequential")
                # Re-read the PDF since batch may have consumed the reader
                reader = PdfReader(str(pdf_path))
                return self._process_chunks_sequential(reader, category, filename, total_pages, num_chunks)
        else:
            logger.info(">>> Using SEQUENTIAL processing for chunks")
            return self._process_chunks_sequential(reader, category, filename, total_pages, num_chunks)

    def _process_chunks_sequential(
        self,
        reader,
        category: DocumentCategory,
        filename: str,
        total_pages: int,
        num_chunks: int
    ) -> MistralExtractionResult:
        """Process chunks sequentially (fallback mode)"""
        from PyPDF2 import PdfWriter

        all_records = []
        all_data = {'chunks': [], 'processing_mode': 'sequential'}
        total_input_tokens = 0
        total_output_tokens = 0

        for chunk_idx in range(num_chunks):
            start_page = chunk_idx * self.MAX_PAGES_PER_CHUNK
            end_page = min(start_page + self.MAX_PAGES_PER_CHUNK, total_pages)

            logger.info(f"Processing chunk {chunk_idx + 1}/{num_chunks} (pages {start_page + 1}-{end_page})")

            # Create temporary PDF for this chunk
            writer = PdfWriter()
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            # Write chunk to temp file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                writer.write(tmp_file)
                tmp_path = tmp_file.name

            try:
                # Process chunk
                chunk_result = self._process_single(
                    Path(tmp_path),
                    category,
                    f"{filename}_chunk{chunk_idx + 1}"
                )

                # Adjust page numbers in records
                for record in chunk_result.records:
                    if 'Original_page_no' in record:
                        original = record.get('Original_page_no', 1)
                        if isinstance(original, int):
                            record['Original_page_no'] = start_page + original
                    else:
                        record['Original_page_no'] = start_page + 1

                all_records.extend(chunk_result.records)
                all_data['chunks'].append({
                    'chunk': chunk_idx + 1,
                    'pages': f"{start_page + 1}-{end_page}",
                    'data': chunk_result.data
                })
                total_input_tokens += chunk_result.input_tokens
                total_output_tokens += chunk_result.output_tokens

                logger.info(f"Chunk {chunk_idx + 1}: extracted {len(chunk_result.records)} records")

            finally:
                os.unlink(tmp_path)

        # Deduplicate records
        unique_records = self._deduplicate_records(all_records)
        logger.info(f"Total records after deduplication: {len(unique_records)} (from {len(all_records)})")

        return MistralExtractionResult(
            data=all_data,
            records=unique_records,
            raw_text=f"Processed {num_chunks} chunks sequentially, {total_pages} total pages",
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            model=self.model
        )

    def _process_chunks_batch(
        self,
        reader,
        category: DocumentCategory,
        filename: str,
        total_pages: int,
        num_chunks: int
    ) -> MistralExtractionResult:
        """Process all chunks in a single batch job (50% cost savings)"""
        from PyPDF2 import PdfWriter

        logger.info(f"Preparing batch job for {num_chunks} chunks...")

        system_prompt = self._get_system_prompt(category)
        batch_requests = []
        chunk_info = []  # Store chunk metadata for later

        # Prepare all chunks and build batch requests
        for chunk_idx in range(num_chunks):
            start_page = chunk_idx * self.MAX_PAGES_PER_CHUNK
            end_page = min(start_page + self.MAX_PAGES_PER_CHUNK, total_pages)

            logger.info(f"Preparing chunk {chunk_idx + 1}/{num_chunks} (pages {start_page + 1}-{end_page})")

            # Create temporary PDF for this chunk
            writer = PdfWriter()
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            # Write chunk to temp file and encode
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                writer.write(tmp_file)
                tmp_path = tmp_file.name

            try:
                pdf_base64 = self._encode_pdf_to_base64(tmp_path)
            finally:
                os.unlink(tmp_path)

            # Build messages for this chunk
            messages = [
                {
                    'role': 'system',
                    'content': system_prompt
                },
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': f'Please analyze this document ({filename} - pages {start_page + 1} to {end_page}) and extract all structured data as JSON.'
                        },
                        {
                            'type': 'document_url',
                            'document_url': f'data:application/pdf;base64,{pdf_base64}'
                        }
                    ]
                }
            ]

            batch_requests.append({
                'custom_id': f'chunk_{chunk_idx}',
                'messages': messages
            })

            chunk_info.append({
                'chunk_idx': chunk_idx,
                'start_page': start_page,
                'end_page': end_page
            })

        # Submit batch job
        logger.info(f"Submitting batch job with {len(batch_requests)} requests...")
        job_id = self._create_batch_job(batch_requests)

        # Wait for completion
        logger.info(f"Waiting for batch job {job_id} to complete...")
        self._wait_for_batch_completion(job_id)

        # Get results
        logger.info("Retrieving batch results...")
        batch_results = self._get_batch_results(job_id)

        # Process results
        all_records = []
        all_data = {'chunks': [], 'processing_mode': 'batch', 'batch_job_id': job_id}
        total_input_tokens = 0
        total_output_tokens = 0

        # Sort results by custom_id to maintain order
        results_map = {r['custom_id']: r for r in batch_results}

        for info in chunk_info:
            chunk_idx = info['chunk_idx']
            start_page = info['start_page']
            end_page = info['end_page']
            custom_id = f'chunk_{chunk_idx}'

            result = results_map.get(custom_id)
            if not result:
                logger.warning(f"Missing result for {custom_id}")
                continue

            # Extract response
            response_body = result.get('response', {}).get('body', {})
            choices = response_body.get('choices', [])

            if not choices:
                logger.warning(f"No choices in result for {custom_id}")
                continue

            content = choices[0].get('message', {}).get('content', '')
            usage = response_body.get('usage', {})

            input_tokens = usage.get('prompt_tokens', 0)
            output_tokens = usage.get('completion_tokens', 0)
            total_input_tokens += input_tokens
            total_output_tokens += output_tokens

            # Parse JSON
            data = self._parse_json_response(content)
            records = self._extract_records(data, category)

            # Adjust page numbers
            for record in records:
                if 'Original_page_no' in record:
                    original = record.get('Original_page_no', 1)
                    if isinstance(original, int):
                        record['Original_page_no'] = start_page + original
                else:
                    record['Original_page_no'] = start_page + 1

            all_records.extend(records)
            all_data['chunks'].append({
                'chunk': chunk_idx + 1,
                'pages': f"{start_page + 1}-{end_page}",
                'records_count': len(records),
                'data': data
            })

            logger.info(f"Chunk {chunk_idx + 1}: extracted {len(records)} records")

        # Deduplicate records
        unique_records = self._deduplicate_records(all_records)
        logger.info(f"Total records after deduplication: {len(unique_records)} (from {len(all_records)})")

        return MistralExtractionResult(
            data=all_data,
            records=unique_records,
            raw_text=f"Batch processed {num_chunks} chunks, {total_pages} total pages (50% cost savings)",
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            model=self.model
        )

    def _parse_json_response(self, content: str) -> Dict:
        """Parse JSON from Mistral response"""
        # Remove markdown code blocks if present
        content = content.strip()
        if content.startswith('```'):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}")
            # Try to recover truncated JSON
            recovered = self._try_recover_truncated_json(content)
            if recovered:
                return recovered

            # Return raw content wrapped
            return {'raw_response': content, 'parse_error': str(e)}

    def _extract_records(self, data: Dict, category: DocumentCategory) -> List[Dict]:
        """Extract records array from parsed data based on category"""
        if category == DocumentCategory.EOB:
            return data.get('claims', [])
        elif category == DocumentCategory.FACESHEET:
            patient_info = data.get('patient_info', {})
            if patient_info:
                return [patient_info]
            return data.get('additional_data', [])
        elif category == DocumentCategory.INVOICE:
            return data.get('line_items', [])
        return []

    def _deduplicate_records(self, records: List[Dict]) -> List[Dict]:
        """Remove duplicate records based on key fields"""
        seen = set()
        unique = []

        for record in records:
            # Create a key from important fields
            key_fields = []
            for field in ['Claim_ID', 'patient_acct', 'Patient Name', 'service_date', 'paid_amount']:
                val = record.get(field, '')
                if val:
                    key_fields.append(str(val))

            key = '|'.join(key_fields)

            if key and key not in seen:
                seen.add(key)
                unique.append(record)
            elif not key:
                # If no key fields, include the record
                unique.append(record)

        return unique

    def get_raw_text(self, pdf_path: str) -> str:
        """
        Extract raw text from PDF using Mistral (OCR only mode).
        Useful when you want to use a different LLM for extraction.
        """
        if not self.api_key or self.api_key == 'your_mistral_api_key_here':
            raise ValueError("Mistral API key not configured")

        pdf_base64 = self._encode_pdf_to_base64(pdf_path)

        messages = [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': 'Please extract all text from this document. Return the raw text content only, preserving the structure and formatting as much as possible.'
                    },
                    {
                        'type': 'document_url',
                        'document_url': f'data:application/pdf;base64,{pdf_base64}'
                    }
                ]
            }
        ]

        response = self._call_mistral_api(messages)
        return response['choices'][0]['message']['content']
