#!/usr/bin/env node
/**
 * Fix OpenAI Prompt to Extract ALL Records
 *
 * Problem: Model only extracts 3 records from 39+ in document
 * Solution: Strengthen prompt with explicit counting and completeness checks
 */

require('dotenv').config();
const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'Y6eWdKJoHaeWZgMX';

const api = axios.create({
  baseURL: N8N_BASE_URL + '/api/v1',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

// New system prompt - emphasize completeness
const NEW_SYSTEM_PROMPT = `You are a document EOB data-extraction expert. Your CRITICAL job is to extract EVERY SINGLE EOB record from the document with ZERO omissions.

MANDATORY RULES:
1. You MUST scan the ENTIRE document from start to end
2. You MUST extract EVERY patient/claim record - missing even ONE is a failure
3. Count all records FIRST, then extract each one
4. Documents often contain 20-50+ records - extract ALL of them
5. Return accurate structured JSON with zero hallucinations`;

// New user prompt - with counting requirement
const NEW_USER_PROMPT = `TASK: Extract ALL EOB (Explanation of Benefits) records from this document.

STEP 1 - COUNT FIRST:
Before extracting, scan the ENTIRE document and count:
- How many distinct patient account numbers (format: XXXXXX-XXXXXXX)?
- How many distinct claim entries?
You MUST extract ALL of these.

STEP 2 - EXTRACT ALL RECORDS:
For EACH patient/claim in the document, extract these fields (return "" if not found):

INPUT DOCUMENT:
{{ $json.data.text }}

FILENAME: {{ $('Download PDF from Drive').item.json.originalFilename }}

FIELDS TO EXTRACT FOR EACH RECORD:
- Original_page_no: First digits before second "_" in filename, or page number near the record
- EOB_page_no: Digits between first and second "_" in filename
- patient_acct: Patient account number (format XXXXXX-XXXXXXX). Look for "Patient Account", "Patient Acct", "Patient #". NOT from Claim# field.
- Patient_ID: First 6 digits of patient_acct (before the hyphen)
- Claim_ID: Digits after the hyphen in patient_acct
- Patient Name: Full name in "LAST, FIRST" format
- First_Name: Patient's first name
- Last Name: Patient's last name
- member_number: Insurance member/subscriber ID
- service_date: Date of service (MM/DD/YY)
- allowed_amount: Allowed amount (number only, no $ or commas)
- interest_amount: Interest amount (number only)
- paid_amount: Amount paid (number only)
- insurance_co: Insurance company name
- billed_amount: Billed amount (number only)
- cpt_hcpcs: CPT/HCPCS procedure code
- adj_co45: CO45 adjustment (number only)
- adj_co144: CO144 adjustment (number only)
- adj_co253: CO253 adjustment (number only)
- check_number: Check/payment number
- account_number: Account number if different from patient_acct
- patient_responsibility: Amount patient owes (number only)
- claim_summary: Brief summary of the claim
- action_required: Action needed (e.g., "No Action", "Payment Required")
- reason_code_comments: Reason codes with explanations
- Confidence_Score: Your confidence 0-100

IMPORTANT:
- Return "" (empty string) for missing fields, NOT "N/A"
- Amounts as plain numbers without $ or commas
- Dates in MM/DD/YY format
- Patient Name in "LAST, FIRST" format
- DO NOT STOP until you have extracted EVERY record in the document

OUTPUT FORMAT:
{
  "record_count": <number of records found>,
  "data": [
    { ...record 1... },
    { ...record 2... },
    ... ALL records ...
  ],
  "summary": {
    "total_extracted": <count>,
    "insurance_companies_found": ["list of insurers"],
    "extraction_complete": true
  }
}

REMINDER: This document contains MANY records (likely 20-40+). You MUST extract ALL of them. Do not stop early.`;

async function updateWorkflow() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Updating OpenAI prompts...');

  workflow.nodes = workflow.nodes.map(node => {
    if (node.name === 'OpenAI - Extract EOB Data') {
      console.log('  ✓ Updating "OpenAI - Extract EOB Data" prompt');

      // Update system message
      node.parameters.messages.values = node.parameters.messages.values.map(msg => {
        if (msg.role === 'system') {
          return { ...msg, content: NEW_SYSTEM_PROMPT };
        }
        return msg;
      });

      // Update user message
      node.parameters.messages.values = node.parameters.messages.values.map(msg => {
        if (msg.role !== 'system') {
          return { ...msg, content: '=' + NEW_USER_PROMPT };
        }
        return msg;
      });

      // Ensure high token limit and temperature 0
      node.parameters.options = {
        ...node.parameters.options,
        maxTokens: 16384,
        temperature: 0
      };
    }
    return node;
  });

  console.log('Saving workflow...');

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  await api.put(`/workflows/${WORKFLOW_ID}`, updatePayload);

  console.log('✓ Workflow updated successfully!');
  console.log('\nChanges:');
  console.log('1. System prompt now emphasizes extracting EVERY record');
  console.log('2. User prompt requires counting records first');
  console.log('3. Added summary section to verify completeness');
  console.log('\nTest with a new document to verify more records are extracted.');
}

updateWorkflow().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
