"""
OpenAI Data Extraction Module
Handles intelligent data extraction using OpenAI GPT models
"""

import re
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from openai import OpenAI

from config import config

logger = logging.getLogger(__name__)


class DocumentCategory(Enum):
    """Document category types"""
    EOB = 1
    FACESHEET = 2
    INVOICE = 3


@dataclass
class ExtractionResult:
    """Result of OpenAI extraction"""
    data: Dict
    records: List[Dict]
    input_tokens: int
    output_tokens: int
    total_tokens: int
    model_used: str
    validation_passed: bool
    confidence_score: float


class OpenAIExtractor:
    """OpenAI-based data extraction"""

    # Chunking thresholds
    MAX_CHARS_PER_CHUNK = 80000  # ~20K tokens per chunk
    MAX_PAGES_FOR_SINGLE_CALL = 30  # Process up to 30 pages in single call

    def __init__(self):
        self.client = OpenAI(api_key=config.openai.api_key)
        self.model = config.openai.model
        self.max_tokens = config.openai.max_tokens
        self.temperature = config.openai.temperature

    def extract_data(self, raw_data: Dict, doc_category: DocumentCategory,
                     filename: str, custom_prompt: str = None) -> ExtractionResult:
        """Extract structured data based on document category"""
        text = raw_data.get('text', '')
        total_pages = raw_data.get('pages', 1)
        page_details = raw_data.get('page_details', [])

        # Store custom prompt for use in prompt generation
        self._custom_prompt = custom_prompt

        # Check if chunking is needed
        needs_chunking = (
            len(text) > self.MAX_CHARS_PER_CHUNK or
            total_pages > self.MAX_PAGES_FOR_SINGLE_CALL
        )

        if needs_chunking:
            logger.info(f"Large document detected ({total_pages} pages, {len(text)} chars). Using chunked processing...")
            return self._extract_with_chunking(raw_data, doc_category, filename)
        else:
            return self._extract_single(raw_data, doc_category, filename)

    def _extract_single(self, raw_data: Dict, doc_category: DocumentCategory,
                        filename: str) -> ExtractionResult:
        """Extract from a single document (no chunking)"""
        text = raw_data.get('text', '')
        total_pages = raw_data.get('pages', 1)

        # Pre-process data
        processed_data = self._preprocess_data(text, total_pages)

        # Get appropriate prompts
        system_prompt, user_prompt = self._get_prompts(
            doc_category, processed_data, filename, total_pages
        )

        # Call OpenAI API
        response = self._call_openai(system_prompt, user_prompt)

        # Parse response
        extracted_data, records = self._parse_response(response, doc_category)

        # Validate extraction
        validation_result = self._validate_extraction(records, doc_category)

        return ExtractionResult(
            data=extracted_data,
            records=records,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            model_used=self.model,
            validation_passed=validation_result['passed'],
            confidence_score=validation_result['average_confidence']
        )

    def _extract_with_chunking(self, raw_data: Dict, doc_category: DocumentCategory,
                               filename: str) -> ExtractionResult:
        """Extract from large document using chunking"""
        text = raw_data.get('text', '')
        total_pages = raw_data.get('pages', 1)

        # Split document into chunks
        chunks = self._split_into_chunks(text, total_pages)
        logger.info(f"Split document into {len(chunks)} chunks")

        all_records = []
        total_input_tokens = 0
        total_output_tokens = 0

        for i, chunk in enumerate(chunks, 1):
            logger.info(f"Processing chunk {i}/{len(chunks)} ({chunk['pages']} pages, {len(chunk['text'])} chars)...")

            try:
                # Pre-process chunk data
                processed_data = self._preprocess_data(chunk['text'], chunk['pages'])

                # Get prompts for this chunk
                system_prompt, user_prompt = self._get_chunk_prompts(
                    doc_category, processed_data, filename, chunk, i, len(chunks)
                )

                # Call OpenAI API
                response = self._call_openai(system_prompt, user_prompt)

                # Parse response
                extracted_data, records = self._parse_response(response, doc_category)

                # Add page offset to records
                for record in records:
                    if 'Page_no' in record and record['Page_no']:
                        try:
                            page_num = int(record['Page_no'])
                            record['Page_no'] = str(page_num + chunk['start_page'] - 1)
                        except (ValueError, TypeError):
                            pass

                all_records.extend(records)
                total_input_tokens += response.usage.prompt_tokens
                total_output_tokens += response.usage.completion_tokens

                logger.info(f"Chunk {i}: Extracted {len(records)} records")

            except Exception as e:
                logger.error(f"Error processing chunk {i}: {e}")
                continue

        # Consolidate and deduplicate records
        consolidated_records = self._consolidate_records(all_records, doc_category)
        logger.info(f"Consolidated {len(all_records)} records into {len(consolidated_records)} unique records")

        # Validate extraction
        validation_result = self._validate_extraction(consolidated_records, doc_category)

        return ExtractionResult(
            data={"data": consolidated_records, "chunked_processing": True, "total_chunks": len(chunks)},
            records=consolidated_records,
            input_tokens=total_input_tokens,
            output_tokens=total_output_tokens,
            total_tokens=total_input_tokens + total_output_tokens,
            model_used=self.model,
            validation_passed=validation_result['passed'],
            confidence_score=validation_result['average_confidence']
        )

    def _split_into_chunks(self, text: str, total_pages: int) -> List[Dict]:
        """Split document text into manageable chunks"""
        chunks = []

        # Try to split by page markers if available
        # Look for common page break patterns
        page_patterns = [
            r'\n\s*Page\s+\d+\s*(?:of\s+\d+)?\s*\n',
            r'\f',  # Form feed character
            r'\n-{10,}\n',  # Dashed line separators
        ]

        # Estimate pages per chunk
        pages_per_chunk = self.MAX_PAGES_FOR_SINGLE_CALL
        chars_per_page = len(text) // max(total_pages, 1)

        if total_pages <= pages_per_chunk:
            # Small enough for single chunk
            return [{'text': text, 'pages': total_pages, 'start_page': 1, 'end_page': total_pages}]

        # Split by character count, trying to respect page boundaries
        chunk_size = pages_per_chunk * chars_per_page
        current_pos = 0
        current_page = 1

        while current_pos < len(text):
            end_pos = min(current_pos + chunk_size, len(text))

            # Try to find a good break point (paragraph or sentence end)
            if end_pos < len(text):
                # Look for paragraph break
                break_pos = text.rfind('\n\n', current_pos + chunk_size // 2, end_pos + 1000)
                if break_pos == -1:
                    # Look for sentence end
                    break_pos = text.rfind('. ', current_pos + chunk_size // 2, end_pos + 500)
                if break_pos != -1:
                    end_pos = break_pos + 1

            chunk_text = text[current_pos:end_pos]
            chunk_pages = max(1, int(len(chunk_text) / chars_per_page))

            chunks.append({
                'text': chunk_text,
                'pages': chunk_pages,
                'start_page': current_page,
                'end_page': current_page + chunk_pages - 1
            })

            current_pos = end_pos
            current_page += chunk_pages

        return chunks

    def _get_chunk_prompts(self, doc_category: DocumentCategory, processed_data: Dict,
                          filename: str, chunk: Dict, chunk_num: int, total_chunks: int) -> Tuple[str, str]:
        """Get prompts for chunked processing"""
        if doc_category == DocumentCategory.EOB:
            return self._get_eob_chunk_prompts(processed_data, filename, chunk, chunk_num, total_chunks)
        else:
            # For other categories, use standard prompts with chunk info
            return self._get_prompts(doc_category, processed_data, filename, chunk['pages'])

    def _get_eob_chunk_prompts(self, data: Dict, filename: str, chunk: Dict,
                               chunk_num: int, total_chunks: int) -> Tuple[str, str]:
        """Get EOB extraction prompts for a chunk"""
        system_prompt = """You are an expert EOB data extractor. Your job is to extract EVERY patient/claim record from this section of the document.

CRITICAL RULES:
1. This is chunk {chunk_num} of {total_chunks} from a larger document
2. Extract ALL patient account numbers you find in this chunk
3. Do NOT stop until you have processed every patient account in this chunk
4. If you can't find details for an account, still include it with empty fields
5. Return accurate JSON with zero hallucinations""".format(chunk_num=chunk_num, total_chunks=total_chunks)

        accounts_str = ', '.join(data['unique_patient_accounts'][:100])

        user_prompt = f"""TASK: Extract ALL EOB records from this CHUNK of a larger document.

CHUNK INFO: This is chunk {chunk_num} of {total_chunks}
PAGES IN THIS CHUNK: {chunk['start_page']} to {chunk['end_page']}
PATIENT ACCOUNTS FOUND IN THIS CHUNK: {len(data['unique_patient_accounts'])}
{accounts_str}

DOCUMENT TEXT (CHUNK {chunk_num}):
{data['text'][:100000]}

FILENAME: {filename}

For EACH patient account found in this chunk, extract these fields (return "" if not found):
- Page_no: Page number where record appears in the original PDF file 
- patient_acct: The patient account number (XXXXXX-XXXXXXX format)
- Patient_ID: First 6 digits (before hyphen)
- Claim_ID: Remaining digits (after hyphen)
- Patient Name: Full name in "LAST, FIRST" format
- First_Name: First name only
- Last Name: Last name only
- member_number: Insurance member/subscriber ID
- service_date: Date of service (MM/DD/YY)
- allowed_amount: Allowed amount (number only)
- interest_amount: Interest amount (number only)
- paid_amount: Amount paid (number only)
- insurance_co: Insurance company name
- billed_amount: Billed amount (number only)
- cpt_hcpcs: CPT/HCPCS procedure code
- adj_co45: CO45 adjustment amount
- adj_co144: CO144 adjustment amount
- adj_co253: CO253 adjustment amount
- check_number: Check/payment number
- account_number: Account number if different
- patient_responsibility: Patient's liability amount
- claim_summary: Brief claim description
- action_required: "No Action" or what's needed
- reason_code_comments: Reason codes and explanations
- Confidence_Score: Your confidence (0-100)

OUTPUT FORMAT:
{{
  "chunk": {chunk_num},
  "total_chunks": {total_chunks},
  "accounts_in_chunk": {len(data['unique_patient_accounts'])},
  "data": [
    {{ ... record for each patient account ... }}
  ]
}}

Extract ALL records you find in this chunk."""

        return system_prompt, user_prompt

    def _consolidate_records(self, records: List[Dict], doc_category: DocumentCategory) -> List[Dict]:
        """Consolidate and deduplicate records from multiple chunks"""
        if not records:
            return []

        if doc_category == DocumentCategory.EOB:
            # Deduplicate by patient_acct + service_date
            seen = {}
            for record in records:
                key = (
                    record.get('patient_acct', ''),
                    record.get('service_date', ''),
                    record.get('paid_amount', '')
                )
                if key not in seen or key == ('', '', ''):
                    seen[key] = record
                else:
                    # Merge records - keep non-empty values
                    existing = seen[key]
                    for k, v in record.items():
                        if v and (not existing.get(k) or existing.get(k) == ''):
                            existing[k] = v
            return list(seen.values())
        else:
            # For other categories, just return all records
            return records

    def _preprocess_data(self, text: str, total_pages: int) -> Dict:
        """Pre-process document text to identify patterns"""
        # Find patient account patterns (for EOB documents)
        patient_acct_pattern = r'(\d{5,7}-\d{5,7})'
        patient_matches = list(re.findall(patient_acct_pattern, text))
        unique_accounts = list(set(patient_matches))

        # Find insurance company patterns
        insurance_patterns = [
            r'BlueCross\s*BlueShield', r'Blue\s*Cross\s*Blue\s*Shield',
            r'TRICARE', r'Cigna', r'Aetna', r'UnitedHealth',
            r'Humana', r'Medicare', r'Medicaid', r'Medico\s*Insurance',
            r'PROVIDER\s*VOUCHER', r'EXPLANATION\s*OF\s*(BENEFITS|PAYMENT)',
            r'Remittance\s*Advice'
        ]

        section_count = 0
        for pattern in insurance_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            section_count += len(matches)

        return {
            'text': text,
            'total_pages': total_pages,
            'estimated_records': len(patient_matches),
            'unique_patient_accounts': unique_accounts,
            'estimated_sections': section_count
        }

    def _get_prompts(self, doc_category: DocumentCategory, processed_data: Dict,
                     filename: str, total_pages: int) -> Tuple[str, str]:
        """Get system and user prompts based on document category"""

        if doc_category == DocumentCategory.EOB:
            system_prompt, user_prompt = self._get_eob_prompts(processed_data, filename, total_pages)
        elif doc_category == DocumentCategory.FACESHEET:
            system_prompt, user_prompt = self._get_facesheet_prompts(processed_data, filename, total_pages)
        elif doc_category == DocumentCategory.INVOICE:
            system_prompt, user_prompt = self._get_invoice_prompts(processed_data, filename, total_pages)
        else:
            raise ValueError(f"Unknown document category: {doc_category}")

        # Apply custom extraction prompt if provided (from output profile)
        if hasattr(self, '_custom_prompt') and self._custom_prompt:
            logger.info("Applying custom extraction prompt from output profile")
            # Prepend custom instructions to the user prompt
            user_prompt = f"""CUSTOM EXTRACTION INSTRUCTIONS:
{self._custom_prompt}

---

{user_prompt}"""

        return system_prompt, user_prompt

    def _get_eob_prompts(self, data: Dict, filename: str, total_pages: int) -> Tuple[str, str]:
        """Get EOB extraction prompts"""
        system_prompt = """You are an expert EOB data extractor. Your job is to extract EVERY patient/claim record from the document.

CRITICAL RULES:
1. The document contains multiple EOBs from different insurance companies
2. You will be given a list of patient account numbers found in the document - you MUST extract a record for EACH one
3. Do NOT stop until you have processed every patient account
4. If you can't find details for an account, still include it with empty fields
5. Return accurate JSON with zero hallucinations"""

        accounts_str = ', '.join(data['unique_patient_accounts'][:50])  # Limit to first 50

        user_prompt = f"""TASK: Extract ALL EOB records from this document.

IMPORTANT: This document contains {data['estimated_records']} patient account numbers.
You MUST extract a record for EACH of these accounts:
{accounts_str}

DOCUMENT TEXT:
{data['text'][:100000]}

FILENAME: {filename}
TOTAL PAGES: {total_pages}

For EACH patient account listed above, extract these fields (return "" if not found):
- Page_no: Page number where record appears in the original PDF file 
- Patient_acct: The patient account number (XXXXXX-XXXXXXX format)
- Patient_ID: First 6 digits (before hyphen)
- Claim_ID: Remaining digits (after hyphen)
- Patient Name: Full name in "LAST, FIRST" format
- First_Name: First name only
- Last Name: Last name only
- member_number: Insurance member/subscriber ID
- service_date: Date of service (MM/DD/YY)
- allowed_amount: Allowed amount (number only)
- interest_amount: Interest amount (number only)
- paid_amount: Amount paid (number only)
- insurance_co: Insurance company name
- billed_amount: Billed amount (number only)
- cpt_hcpcs: CPT/HCPCS procedure code
- adj_co45: CO45 adjustment amount
- adj_co144: CO144 adjustment amount
- adj_co253: CO253 adjustment amount
- check_number: Check/payment number
- account_number: Account number if different
- patient_responsibility: Patient's liability amount
- claim_summary: Brief claim description
- action_required: "No Action" or what's needed
- reason_code_comments: Reason codes and explanations
- Confidence_Score: Your confidence (0-100)

CRITICAL: You MUST return {len(data['unique_patient_accounts'])} records - one for each patient account listed above.

OUTPUT FORMAT:
{{
  "total_accounts_provided": {len(data['unique_patient_accounts'])},
  "total_extracted": <your count>,
  "data": [
    {{ ... record for each patient account ... }}
  ]
}}

Do NOT stop until you have a record for EVERY patient account. Missing accounts is a failure."""

        return system_prompt, user_prompt

    def _get_facesheet_prompts(self, data: Dict, filename: str, total_pages: int) -> Tuple[str, str]:
        """Get Facesheet extraction prompts"""
        system_prompt = """You are a medical document data extraction expert specializing in patient demographic information from hospital facesheet documents. Your job is to return accurate structured, machine-readable data with quality controls and zero hallucinations with 100% confidence."""

        user_prompt = f"""Extract ALL patient demographic and medical information from the input data.
INPUT: {data['text'][:100000]}

With your highly intelligent judgement with deep knowledge of Facesheet data, make sure all Facesheet records are processed without any data loss.
At the end provide a summary of validations/corrections.
Begin with a concise checklist (3-7 bullet points) outlining the main sub-tasks for extraction. This checklist must be included as a separate top-level array field named "checklist" in the final output JSON.

For EACH patient record, prioritize extracting all available patient information from the provided INPUT with the highest accuracy. The INPUT might have multiple patient records and typically includes a variety of detailed patient data.
Extract all relevant details, including (but not limited to):

- Patient demographics (name, date of birth [DOB], gender, address, phone number)
- Insurance information (primary/secondary insurance, policy numbers, member IDs)
- Medical record numbers and patient IDs
- Provider details (doctors, facilities, contact information)
- Admission and discharge dates and locations
- Emergency contacts and responsible parties
- Any other pertinent medical or administrative details present

Before starting extraction, briefly summarize any ambiguities or document issues if encountered, and describe your planned use of nulls, verbatim entries, or notes for problematic data.

Structure your output as a comprehensive JSON object using these rules:

- Checklist: Provide the checklist (see above) as a top-level field named "checklist", with sub-tasks as string array items.
- Patients: List each patient as an object inside a top-level "patients" array.
- Use nested objects for complex fields (insurance, provider, emergency contacts, responsible parties).
- For insurance, use a "type" field set to "primary", "secondary", or, if specified, a consistent custom label from the document.

- Dates must be formatted as MM/DD/YYYY.
- Use null for missing or ambiguous values and provide an explanation in the patient's 'notes' field as needed.

- For malformed data, include it verbatim and document the anomaly in the patient's 'notes'.
- Preserve the specified field order within each patient object and the order of patients as found in the document.

- Add a 'notes' field for each patient to record extraction ambiguities, observations, or unclear items.
- Include a top-level 'notes' string field to capture extraction-level uncertainties, errors.

- Use the 'other_information' field for extra, unclassified, or patient-specific data not captured in other fields.

After all steps, review and validate the JSON output to ensure completeness, schema adherence, and clear documentation of issues.
- Confidence_Score: Your confidence in the accuracy of this extraction (0-100)

IMPORTANT RULES:
- Return "" (empty string) for any field not found, NOT "N/A"
- Return amounts as plain numbers without $ or commas
- Return dates in MM/DD/YY format

Return ONLY valid JSON with 'data' array."""

        return system_prompt, user_prompt

    def _get_invoice_prompts(self, data: Dict, filename: str, total_pages: int) -> Tuple[str, str]:
        """Get Invoice extraction prompts"""
        system_prompt = """You are an invoice data extraction expert. Extract accurate billing and line item information from invoices. Your job is to return accurate structured, machine-readable data with quality controls and zero hallucinations with 100% confidence."""

        user_prompt = f"""Extract ALL EOB (Explanation of Benefits) records from the input data.
INPUT: {data['text'][:100000]}

With your highly intelligent judgement with deep knowledge of Invoice data, make sure all accurate billing and line item information from invoices are processed without any data loss.
At the end provide a summary of validations/corrections.

For EACH invoice, extract:
- invoice_number, invoice_date (MM/DD/YYYY)
- vendor_name, vendor_address, vendor_tax_id
- customer_name, customer_address, billing_address
- po_number, due_date (MM/DD/YYYY)
- line_items (array with: item_description, quantity, unit_price, line_total)
- subtotal, tax_amount, tax_rate, shipping_cost
- total_amount, amount_due
- payment_terms, payment_method
- currency, notes
- Confidence_Score (0-100)

Return ONLY valid JSON with 'data' array containing invoice header and line items.
- Confidence_Score: Your confidence in the accuracy of this extraction (0-100)

IMPORTANT RULES:
- Return "" (empty string) for any field not found, NOT "N/A"
- Return amounts as plain numbers without $ or commas
- Return dates in MM/DD/YY format

Return ONLY valid JSON with 'data' array."""

        return system_prompt, user_prompt

    def _call_openai(self, system_prompt: str, user_prompt: str) -> Any:
        """Call OpenAI API with retry logic"""
        max_retries = 3

        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    response_format={"type": "json_object"}
                )
                logger.info(f"OpenAI API call successful (attempt {attempt + 1})")
                return response
            except Exception as e:
                logger.error(f"OpenAI API error (attempt {attempt + 1}): {str(e)}")
                if attempt == max_retries - 1:
                    raise
                import time
                time.sleep(2 ** attempt)  # Exponential backoff

    def _parse_response(self, response: Any, doc_category: DocumentCategory) -> Tuple[Dict, List[Dict]]:
        """Parse OpenAI response into structured data"""
        content = response.choices[0].message.content

        try:
            extracted_data = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            # Try to recover partial data from truncated JSON
            extracted_data = self._try_recover_truncated_json(content)
            if not extracted_data:
                extracted_data = {"data": [], "error": str(e)}

        # Get records array
        records = []
        if doc_category == DocumentCategory.FACESHEET and 'patients' in extracted_data:
            records = extracted_data['patients']
        elif 'data' in extracted_data and isinstance(extracted_data['data'], list):
            records = extracted_data['data']
        elif isinstance(extracted_data, list):
            records = extracted_data

        return extracted_data, records

    def _try_recover_truncated_json(self, content: str) -> Optional[Dict]:
        """Try to recover data from truncated JSON response"""
        logger.info("Attempting to recover data from truncated JSON...")

        # Try to find the data array and extract complete records
        try:
            # Find "data": [ pattern
            data_start = content.find('"data"')
            if data_start == -1:
                return None

            # Find the opening bracket of the array
            bracket_start = content.find('[', data_start)
            if bracket_start == -1:
                return None

            # Try to extract complete JSON objects from the array
            records = []
            current_pos = bracket_start + 1
            brace_count = 0
            object_start = -1

            for i, char in enumerate(content[current_pos:], current_pos):
                if char == '{':
                    if brace_count == 0:
                        object_start = i
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0 and object_start != -1:
                        # Found a complete object
                        try:
                            obj_str = content[object_start:i+1]
                            obj = json.loads(obj_str)
                            records.append(obj)
                            object_start = -1
                        except json.JSONDecodeError:
                            pass

            if records:
                logger.info(f"Recovered {len(records)} complete records from truncated JSON")
                return {"data": records, "recovered": True, "total_extracted": len(records)}

        except Exception as e:
            logger.error(f"Failed to recover truncated JSON: {e}")

        return None

    def _validate_extraction(self, records: List[Dict], doc_category: DocumentCategory) -> Dict:
        """Validate extraction quality"""
        if not records:
            return {
                'passed': False,
                'average_confidence': 0,
                'valid_records': 0,
                'invalid_records': 0,
                'issues': ['No records extracted']
            }

        # Get required fields based on document type
        if doc_category == DocumentCategory.EOB:
            required_fields = ['patient_acct', 'service_date']
        elif doc_category == DocumentCategory.FACESHEET:
            required_fields = ['patient_name', 'date_of_birth', 'medical_record_number']
        elif doc_category == DocumentCategory.INVOICE:
            required_fields = ['invoice_number', 'invoice_date', 'vendor_name', 'total_amount']
        else:
            required_fields = []

        valid_records = 0
        total_confidence = 0
        issues = []

        for idx, record in enumerate(records):
            is_valid = True

            # Check required fields
            for field in required_fields:
                # Handle both naming conventions
                value = record.get(field) or record.get(field.replace('_', ' ').title())
                if not value or value == '':
                    is_valid = False
                    issues.append(f"Record {idx}: Missing {field}")

            # Get confidence score
            confidence = float(
                record.get('Confidence_Score') or
                record.get('confidence_score') or
                record.get('Confidence Score') or
                100
            )
            total_confidence += confidence

            if confidence < 70:
                issues.append(f"Record {idx}: Low confidence {confidence}%")

            if is_valid:
                valid_records += 1

        avg_confidence = total_confidence / len(records) if records else 0
        valid_percent = (valid_records / len(records)) * 100 if records else 0

        passed = valid_percent >= 80 and avg_confidence >= 70

        return {
            'passed': passed,
            'average_confidence': avg_confidence,
            'valid_records': valid_records,
            'invalid_records': len(records) - valid_records,
            'issues': issues[:10]  # Limit to first 10 issues
        }


class PMGDirectExtractor:
    """Direct extraction for PMG/DN Facesheet documents without using LLM"""

    def extract_pmg_facesheet(self, raw_data: Dict, filename: str) -> ExtractionResult:
        """Extract data directly from PMG/DN facesheet using patterns"""
        text = raw_data.get('text', '')

        extracted_data = {
            'resident_name': self._find_value(text, ['Resident Name', 'RESIDENT NAME', 'Name']),
            'preferred_name': self._find_value(text, ['Preferred Name']),
            'unit': self._find_value(text, ['Unit']),
            'room_bed': self._find_value(text, ['Room / Bed', 'Room/Bed', 'Room']),
            'admission_date': self._find_date(text, ['Admission Date']),
            'init_adm_date': self._find_date(text, ['Init. Adm. Date', 'Initial Admission Date']),
            'orig_adm_date': self._find_date(text, ['Orig.Adm.Date', 'Orig. Adm. Date']),
            'resident_number': self._find_value(text, ['Resident #', 'Resident Number']),
            'previous_address': self._find_value(text, ['Previous address', 'Previous Address']),
            'previous_phone': self._find_value(text, ['Previous Phone #', 'Previous Phone']),
            'legal_mailing_address': self._find_value(text, ['Legal Mailing address']),
            'sex': self._find_value(text, ['Sex']),
            'birthdate': self._find_date(text, ['Birthdate', 'Birth Date', 'DOB']),
            'age': self._find_value(text, ['Age']),
            'marital_status': self._find_value(text, ['Marital Status']),
            'religion': self._find_value(text, ['Religion']),
            'race': self._find_value(text, ['Race']),
            'occupation': self._find_value(text, ['Occupation(s)', 'Occupation']),
            'primary_language': self._find_value(text, ['Primary Lang.', 'Primary Language']),
            'admitted_from': self._find_value(text, ['Admitted From']),
            'social_security_number': self._find_value(text, ['Social Security #', 'SS #', 'SSN']),
            'medicare_beneficiary_id': self._find_value(text, ['Medicare Beneficiary ID', 'Medicare #']),
            'medi_cal_number': self._find_value(text, ['Medi-Cal #', 'Medicaid #']),
            'medical_record_number': self._find_value(text, ['Medical Record #', 'MRN']),
            'primary_payer': self._find_value(text, ['Primary Payer']),
            'primary_policy_number': self._find_value(text, ['Policy #', 'Policy Number']),
            'primary_group_number': self._find_value(text, ['Group #', 'Group Number']),
            'primary_insurance_company': self._find_value(text, ['Ins. Company', 'Insurance Company']),
            'extraction_method': 'PMG_DN_Direct',
            'confidence_score': 95,
            'llm_bypassed': True,
            'source_filename': filename,
            'total_pages': raw_data.get('pages', 1)
        }

        records = [extracted_data]

        return ExtractionResult(
            data={'patients': records},
            records=records,
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            model_used='Direct Extraction (No LLM)',
            validation_passed=True,
            confidence_score=95
        )

    def _find_value(self, text: str, labels: List[str], default: str = '') -> str:
        """Find value by label in text"""
        for label in labels:
            escaped_label = re.escape(label)
            patterns = [
                re.compile(escaped_label + r'[:\s]+([^\n]+)', re.IGNORECASE),
                re.compile(escaped_label + r'\s+([A-Za-z0-9\-\/\s,\.]+)', re.IGNORECASE),
            ]
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    return match.group(1).strip()
        return default

    def _find_date(self, text: str, labels: List[str]) -> str:
        """Find and normalize date value"""
        value = self._find_value(text, labels)
        if not value:
            return ''

        date_patterns = [
            r'(\d{1,2}\/\d{1,2}\/\d{4})',
            r'(\d{1,2}\/\d{1,2}\/\d{2})',
            r'(\d{4}-\d{2}-\d{2})'
        ]

        for pattern in date_patterns:
            match = re.search(pattern, value)
            if match:
                return match.group(1)
        return value
