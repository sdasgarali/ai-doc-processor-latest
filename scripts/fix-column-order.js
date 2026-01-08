#!/usr/bin/env node
/**
 * Fix Column Order - Put page numbers first
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

// Updated Prepare CSV with fixed column order
const FIXED_PREPARE_CSV = `// Prepare CSV output with fixed column order (page numbers first)
const jsonData = $('Prepare JSON').first().json;
const processData = $('Extract Process Data').first().json;

const records = jsonData.extractedRecords || [];

if (records.length === 0) {
  return [{
    json: {
      csvFilename: '',
      csvContent: '',
      error: 'No records to convert to CSV'
    }
  }];
}

// FIXED COLUMN ORDER - Page numbers first, then patient info, then financial
const orderedColumns = [
  // Page info first
  'Original_page_no',
  'EOB_page_no',
  // Patient identification
  'patient_acct',
  'Patient_ID',
  'Claim_ID',
  'Patient Name',
  'First_Name',
  'Last Name',
  'member_number',
  // Service info
  'service_date',
  'insurance_co',
  'cpt_hcpcs',
  // Financial
  'billed_amount',
  'allowed_amount',
  'paid_amount',
  'patient_responsibility',
  'interest_amount',
  // Adjustments
  'adj_co45',
  'adj_co144',
  'adj_co253',
  // Payment info
  'check_number',
  'account_number',
  // Summary
  'claim_summary',
  'action_required',
  'reason_code_comments',
  'Confidence_Score'
];

// Get all unique keys from records
const allKeys = new Set();
records.forEach(record => {
  if (record && typeof record === 'object') {
    Object.keys(record).forEach(key => allKeys.add(key));
  }
});

// Build final headers: ordered columns first, then any extra columns
const headers = [];
orderedColumns.forEach(col => {
  if (allKeys.has(col)) {
    headers.push(col);
    allKeys.delete(col);
  }
});
// Add any remaining columns not in our ordered list
allKeys.forEach(col => headers.push(col));

console.log('CSV columns:', headers.join(', '));

// Build CSV
const csvRows = [];
csvRows.push(headers.join(','));

records.forEach(record => {
  const row = headers.map(header => {
    const value = record[header] !== undefined ? record[header] : '';
    // Escape values with commas, quotes, or newlines
    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\\n'))) {
      return \`"\${value.replace(/"/g, '""')}"\`;
    }
    return value;
  });
  csvRows.push(row.join(','));
});

const csvContent = csvRows.join('\\n');
const baseFilename = processData.originalFilename.replace('.pdf', '');
const csvFilename = \`extracted_\${baseFilename}.csv\`;

return [{
  json: {
    csvFilename: csvFilename,
    csvContent: csvContent
  }
}];
`;

// Updated Prepare JSON with fixed field order
const FIXED_PREPARE_JSON = `// Prepare JSON output with fixed field order (page numbers first)
const aiResponse = $('OpenAI - Extract EOB Data').first().json;
const processData = $('Extract Process Data').first().json;
const costData = $('Calculate Total Cost & Time').first().json;

console.log('=== PREPARE JSON DEBUG ===');
console.log('AI Response structure:', Object.keys(aiResponse));

let extractedData;

// Handle different OpenAI response formats
if (aiResponse.message) {
  const content = aiResponse.message.content || aiResponse.message;
  if (typeof content === 'string') {
    extractedData = JSON.parse(content);
  } else {
    extractedData = content;
  }
} else if (aiResponse.choices && aiResponse.choices[0]) {
  const content = aiResponse.choices[0].message.content;
  extractedData = typeof content === 'string' ? JSON.parse(content) : content;
} else if (typeof aiResponse === 'string') {
  extractedData = JSON.parse(aiResponse);
} else if (aiResponse.data) {
  extractedData = aiResponse;
} else {
  extractedData = aiResponse;
}

// Get records array
let records = extractedData.data || extractedData;
if (!Array.isArray(records)) {
  records = [records];
}

// REORDER FIELDS - page numbers first
const orderedFields = [
  'Original_page_no',
  'EOB_page_no',
  'patient_acct',
  'Patient_ID',
  'Claim_ID',
  'Patient Name',
  'First_Name',
  'Last Name',
  'member_number',
  'service_date',
  'insurance_co',
  'cpt_hcpcs',
  'billed_amount',
  'allowed_amount',
  'paid_amount',
  'patient_responsibility',
  'interest_amount',
  'adj_co45',
  'adj_co144',
  'adj_co253',
  'check_number',
  'account_number',
  'claim_summary',
  'action_required',
  'reason_code_comments',
  'Confidence_Score'
];

// Reorder each record
const orderedRecords = records.map(record => {
  const ordered = {};
  // Add fields in specified order
  orderedFields.forEach(field => {
    if (record.hasOwnProperty(field)) {
      ordered[field] = record[field];
    }
  });
  // Add any extra fields not in our list
  Object.keys(record).forEach(key => {
    if (!ordered.hasOwnProperty(key)) {
      ordered[key] = record[key];
    }
  });
  return ordered;
});

const baseFilename = processData.originalFilename.replace('.pdf', '');
const jsonFilename = \`extracted_\${baseFilename}.json\`;

const jsonOutput = {
  data: orderedRecords,
  metadata: {
    original_pdf: processData.originalFilename,
    process_id: processData.processId,
    processed_at: new Date().toISOString(),
    source: 'Document AI + OpenAI',
    model_used: costData.modelUsed,
    total_records: orderedRecords.length,
    pages: costData.pages,
    processing_time_seconds: costData.processingTimeSeconds,
    costs: {
      document_ai: costData.documentAiCost,
      openai: costData.openAiCost,
      total: costData.totalCost
    },
    tokens: {
      input: costData.inputTokens,
      output: costData.outputTokens
    }
  }
};

console.log('Total records:', orderedRecords.length);
console.log('First record fields:', Object.keys(orderedRecords[0] || {}).slice(0, 5).join(', '));

return [{
  json: {
    jsonOutput: jsonOutput,
    jsonFilename: jsonFilename,
    extractedRecords: orderedRecords,
    totalRecords: orderedRecords.length
  }
}];
`;

async function updateWorkflow() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Updating column order...');

  workflow.nodes = workflow.nodes.map(node => {
    if (node.name === 'Prepare CSV') {
      console.log('  ✓ Updating "Prepare CSV" - Fixed column order');
      node.parameters.jsCode = FIXED_PREPARE_CSV;
    }

    if (node.name === 'Prepare JSON') {
      console.log('  ✓ Updating "Prepare JSON" - Fixed field order');
      node.parameters.jsCode = FIXED_PREPARE_JSON;
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
  console.log('\nColumn order is now:');
  console.log('1. Original_page_no');
  console.log('2. EOB_page_no');
  console.log('3. patient_acct');
  console.log('4. Patient_ID');
  console.log('5. Claim_ID');
  console.log('6. Patient Name');
  console.log('... (rest of fields)');
}

updateWorkflow().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
