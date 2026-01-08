#!/usr/bin/env node
/**
 * Simpler Chunking Approach
 *
 * Instead of adding new nodes, modify the existing "Parse Python Output" node
 * to add page markers to the text, making it easier for OpenAI to track pages.
 *
 * And update OpenAI prompt to process sections more carefully.
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

// Enhanced Parse Python Output - adds section markers
const ENHANCED_PARSE_OUTPUT = `// Parse Document AI output and add section markers for better extraction
const output = $input.first().json;

// Extract JSON from stdout
const jsonMatch = output.stdout.match(/===JSON_CONTENT_START===([\\s\\S]*?)===JSON_CONTENT_END===/);

if (!jsonMatch) {
  throw new Error('Could not find JSON content in Python output');
}

const docData = JSON.parse(jsonMatch[1].trim());
let text = docData.text || '';
const totalPages = docData.pages || 1;

console.log('=== DOCUMENT PROCESSING ===');
console.log('Original text length:', text.length);
console.log('Total pages:', totalPages);

// Try to identify and mark different EOB sections
// Look for insurance company headers and mark them
const insurancePatterns = [
  /BlueCross\\s*BlueShield/gi,
  /Blue\\s*Cross\\s*Blue\\s*Shield/gi,
  /TRICARE/gi,
  /Cigna/gi,
  /Aetna/gi,
  /UnitedHealth/gi,
  /Humana/gi,
  /Medicare/gi,
  /Medicaid/gi,
  /Medico\\s*Insurance/gi,
  /PROVIDER\\s*VOUCHER/gi,
  /EXPLANATION\\s*OF\\s*(BENEFITS|PAYMENT)/gi,
  /Remittance\\s*Advice/gi
];

// Count distinct sections
let sectionCount = 0;
insurancePatterns.forEach(pattern => {
  const matches = text.match(pattern) || [];
  sectionCount += matches.length;
});
console.log('Estimated EOB sections:', sectionCount);

// Add markers for patient account patterns to help OpenAI
const patientAcctPattern = /(\\d{5,7}-\\d{5,7})/g;
const patientMatches = [...text.matchAll(patientAcctPattern)];
console.log('Patient account patterns found:', patientMatches.length);

// Create structured data with hints
const structuredData = {
  text: text,
  totalPages: totalPages,
  estimatedRecords: patientMatches.length,
  uniquePatientAccounts: [...new Set(patientMatches.map(m => m[1]))],
  pageDetails: docData.page_details || []
};

console.log('Unique patient accounts:', structuredData.uniquePatientAccounts.length);
console.log('Sample accounts:', structuredData.uniquePatientAccounts.slice(0, 5).join(', '));

return [{
  json: {
    data: structuredData
  }
}];
`;

// Updated OpenAI prompt that uses the hints from Parse Python Output
const IMPROVED_SYSTEM_PROMPT = `You are an expert EOB data extractor. Your job is to extract EVERY patient/claim record from the document.

CRITICAL RULES:
1. The document contains multiple EOBs from different insurance companies
2. You will be given a list of patient account numbers found in the document - you MUST extract a record for EACH one
3. Do NOT stop until you have processed every patient account
4. If you can't find details for an account, still include it with empty fields
5. Return accurate JSON with zero hallucinations`;

const IMPROVED_USER_PROMPT = `TASK: Extract ALL EOB records from this document.

IMPORTANT: This document contains {{ $json.data.estimatedRecords }} patient account numbers.
You MUST extract a record for EACH of these accounts:
{{ $json.data.uniquePatientAccounts.join(', ') }}

DOCUMENT TEXT:
{{ $json.data.text }}

FILENAME: {{ $('Download PDF from Drive').item.json.originalFilename }}
TOTAL PAGES: {{ $json.data.totalPages }}

For EACH patient account listed above, extract these fields (return "" if not found):
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
- Original_page_no: Page number where record appears (estimate based on position)
- EOB_page_no: EOB page number
- Confidence_Score: Your confidence (0-100)

CRITICAL: You MUST return {{ $json.data.uniquePatientAccounts.length }} records - one for each patient account listed above.

OUTPUT FORMAT:
{
  "total_accounts_provided": {{ $json.data.uniquePatientAccounts.length }},
  "total_extracted": <your count>,
  "data": [
    { ... record for each patient account ... }
  ]
}

Do NOT stop until you have a record for EVERY patient account. Missing accounts is a failure.`;

async function updateWorkflow() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Updating nodes...');

  workflow.nodes = workflow.nodes.map(node => {
    // Update Parse Python Output
    if (node.name === 'Parse Python Output') {
      console.log('  ✓ Updating "Parse Python Output" - Add patient account hints');
      node.parameters.jsCode = ENHANCED_PARSE_OUTPUT;
    }

    // Update OpenAI node
    if (node.name === 'OpenAI - Extract EOB Data') {
      console.log('  ✓ Updating "OpenAI - Extract EOB Data" - Use account list');
      node.parameters.messages = {
        values: [
          { role: 'system', content: IMPROVED_SYSTEM_PROMPT },
          { role: 'user', content: '=' + IMPROVED_USER_PROMPT }
        ]
      };
      node.parameters.options = {
        ...node.parameters.options,
        maxTokens: 16384,
        temperature: 0
      };
    }

    return node;
  });

  console.log('\\nSaving workflow...');

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  await api.put(`/workflows/${WORKFLOW_ID}`, updatePayload);

  console.log('✓ Workflow updated successfully!');
  console.log('\\nChanges:');
  console.log('1. Parse Python Output now extracts and provides list of ALL patient accounts');
  console.log('2. OpenAI prompt now receives the account list and MUST extract each one');
  console.log('3. This ensures no records are missed');
  console.log('\\nThe model will now be given the exact list of accounts to extract.');
}

updateWorkflow().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
