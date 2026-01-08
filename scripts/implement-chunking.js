#!/usr/bin/env node
/**
 * Implement Document Chunking for Complete EOB Extraction
 *
 * Strategy:
 * 1. Add "Split into Chunks" node after Parse Python Output
 * 2. Process each chunk with OpenAI (using SplitInBatches)
 * 3. Add "Merge Results" node to combine and deduplicate
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

// Code for splitting document into chunks
const SPLIT_CHUNKS_CODE = `// Split document into manageable chunks for complete extraction
const pythonOutput = $input.first().json;
const processData = $('Extract Process Data').first().json;
const fullText = pythonOutput.data?.text || '';
const pageDetails = pythonOutput.data?.page_details || [];
const totalPages = pythonOutput.data?.pages || 1;

console.log('=== DOCUMENT CHUNKING ===');
console.log('Total text length:', fullText.length, 'characters');
console.log('Total pages:', totalPages);

// Configuration
const CHUNK_SIZE = 20000;  // ~5000 tokens per chunk
const OVERLAP = 2000;       // Overlap to avoid cutting records

// Split into chunks
const chunks = [];
let startPos = 0;
let chunkNum = 1;

while (startPos < fullText.length) {
  let endPos = Math.min(startPos + CHUNK_SIZE, fullText.length);

  // Try to end at a natural boundary (double newline or period)
  if (endPos < fullText.length) {
    // Look for good break point within last 500 chars
    const searchStart = Math.max(endPos - 500, startPos);
    const searchText = fullText.substring(searchStart, endPos);

    // Prefer breaking at double newlines (paragraph boundaries)
    const lastParagraph = searchText.lastIndexOf('\\n\\n');
    if (lastParagraph > 0) {
      endPos = searchStart + lastParagraph + 2;
    } else {
      // Fall back to sentence boundary
      const lastPeriod = searchText.lastIndexOf('. ');
      if (lastPeriod > 0) {
        endPos = searchStart + lastPeriod + 2;
      }
    }
  }

  const chunkText = fullText.substring(startPos, endPos);

  // Estimate which pages this chunk covers
  const charRatio = startPos / fullText.length;
  const endRatio = endPos / fullText.length;
  const estStartPage = Math.floor(charRatio * totalPages) + 1;
  const estEndPage = Math.ceil(endRatio * totalPages);

  chunks.push({
    chunkNumber: chunkNum,
    totalChunks: 0,  // Will update after loop
    text: chunkText,
    charStart: startPos,
    charEnd: endPos,
    estimatedPages: estStartPage + '-' + estEndPage,
    processId: processData.processId,
    originalFilename: processData.originalFilename,
    clientId: processData.clientId,
    modelId: processData.modelId
  });

  // Move to next chunk with overlap
  startPos = endPos - OVERLAP;
  if (startPos >= fullText.length - OVERLAP) break;
  chunkNum++;
}

// Update total chunks count
chunks.forEach(c => c.totalChunks = chunks.length);

console.log('Created', chunks.length, 'chunks');
chunks.forEach(c => {
  console.log('Chunk', c.chunkNumber + ':', c.text.length, 'chars, pages', c.estimatedPages);
});

// Return array of chunks for batch processing
return chunks.map(chunk => ({ json: chunk }));
`;

// Updated OpenAI prompt for chunk processing
const CHUNK_SYSTEM_PROMPT = `You are an EOB data extraction expert. Extract ALL patient/claim records from the given text chunk.
CRITICAL: Extract EVERY record you find. Do not skip any.
Return accurate JSON with zero hallucinations.`;

const CHUNK_USER_PROMPT = `Extract ALL EOB records from this document chunk.

CHUNK INFO:
- Chunk {{ $json.chunkNumber }} of {{ $json.totalChunks }}
- Estimated pages: {{ $json.estimatedPages }}
- Filename: {{ $json.originalFilename }}

DOCUMENT TEXT:
{{ $json.text }}

For EACH patient/claim record found, extract:
- patient_acct: Patient account (format XXXXXX-XXXXXXX)
- Patient_ID: First part before hyphen
- Claim_ID: Part after hyphen
- Patient Name: "LAST, FIRST" format
- First_Name, Last Name
- member_number: Member/subscriber ID
- service_date: MM/DD/YY format
- allowed_amount, paid_amount, billed_amount: Numbers only
- insurance_co: Insurance company name
- cpt_hcpcs: Procedure code
- check_number: Check/payment number
- patient_responsibility: Amount patient owes
- Original_page_no: {{ $json.estimatedPages.split('-')[0] }}
- EOB_page_no: Best estimate from context
- Confidence_Score: 0-100

Return "" for missing fields. Numbers without $ or commas.

OUTPUT FORMAT:
{
  "chunk": {{ $json.chunkNumber }},
  "records_found": <count>,
  "data": [ {...}, {...} ]
}

Extract EVERY record in this chunk. Do not stop early.`;

// Code for merging chunk results
const MERGE_RESULTS_CODE = `// Merge and deduplicate results from all chunks
const allResults = $input.all();
const processData = $('Extract Process Data').first().json;

console.log('=== MERGING CHUNK RESULTS ===');
console.log('Total chunks processed:', allResults.length);

const allRecords = [];
const seenAccounts = new Set();

allResults.forEach((item, idx) => {
  const chunkData = item.json;

  // Handle different response formats
  let records = [];

  if (chunkData.message?.content?.data) {
    records = chunkData.message.content.data;
  } else if (chunkData.data) {
    records = Array.isArray(chunkData.data) ? chunkData.data : [chunkData.data];
  } else if (chunkData.choices?.[0]?.message?.content) {
    const content = chunkData.choices[0].message.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    records = parsed.data || [];
  }

  console.log('Chunk', idx + 1, ':', records.length, 'records');

  records.forEach(record => {
    // Deduplicate by patient_acct
    const key = record.patient_acct || '';
    if (key && !seenAccounts.has(key)) {
      seenAccounts.add(key);
      allRecords.push(record);
    } else if (!key) {
      // Keep records without patient_acct but warn
      console.warn('Record without patient_acct:', record['Patient Name'] || 'unknown');
      allRecords.push(record);
    }
  });
});

console.log('\\nTotal unique records:', allRecords.length);
console.log('Duplicates removed:', allResults.reduce((sum, r) => {
  const data = r.json.message?.content?.data || r.json.data || [];
  return sum + (Array.isArray(data) ? data.length : 0);
}, 0) - allRecords.length);

// Create merged response in expected format
return [{
  json: {
    message: {
      role: 'assistant',
      content: {
        data: allRecords
      }
    },
    finish_reason: 'stop',
    merged: true,
    totalChunks: allResults.length,
    totalRecords: allRecords.length
  }
}];
`;

async function implementChunking() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(\`/workflows/\${WORKFLOW_ID}\`);

  console.log('Current nodes:', workflow.nodes.length);

  // Find key nodes and their positions
  const parseOutputNode = workflow.nodes.find(n => n.name === 'Parse Python Output');
  const openAiNode = workflow.nodes.find(n => n.name === 'OpenAI - Extract EOB Data');
  const validateNode = workflow.nodes.find(n => n.name === 'Validate EOB Extraction');

  if (!parseOutputNode || !openAiNode) {
    throw new Error('Required nodes not found');
  }

  console.log('\\nModifying workflow for chunking...');

  // 1. Add "Split into Chunks" node after Parse Python Output
  const splitChunksNode = {
    id: 'split-chunks-' + Date.now(),
    name: 'Split into Chunks',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [parseOutputNode.position[0] + 200, parseOutputNode.position[1]],
    parameters: {
      jsCode: SPLIT_CHUNKS_CODE
    }
  };

  // 2. Add SplitInBatches node to process chunks one at a time
  const splitBatchesNode = {
    id: 'batch-chunks-' + Date.now(),
    name: 'Process Chunks',
    type: 'n8n-nodes-base.splitInBatches',
    typeVersion: 3,
    position: [splitChunksNode.position[0] + 200, splitChunksNode.position[1]],
    parameters: {
      batchSize: 1,
      options: {}
    }
  };

  // 3. Update OpenAI node with chunk-specific prompt
  openAiNode.position = [splitBatchesNode.position[0] + 200, splitBatchesNode.position[1]];
  openAiNode.parameters.messages = {
    values: [
      { role: 'system', content: CHUNK_SYSTEM_PROMPT },
      { role: 'user', content: '=' + CHUNK_USER_PROMPT }
    ]
  };
  openAiNode.parameters.options = {
    ...openAiNode.parameters.options,
    maxTokens: 8192,
    temperature: 0
  };

  // 4. Add Merge Results node
  const mergeResultsNode = {
    id: 'merge-results-' + Date.now(),
    name: 'Merge Chunk Results',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [openAiNode.position[0] + 200, openAiNode.position[1]],
    parameters: {
      jsCode: MERGE_RESULTS_CODE
    }
  };

  // Add new nodes to workflow
  workflow.nodes.push(splitChunksNode);
  workflow.nodes.push(splitBatchesNode);
  workflow.nodes.push(mergeResultsNode);

  // Update connections
  // Find and update connection from Parse Python Output
  const parseOutputId = parseOutputNode.id;
  const openAiId = openAiNode.id;

  // New connection chain:
  // Parse Python Output -> Split into Chunks -> Process Chunks -> OpenAI -> Merge -> (continue to Validate)

  // Remove old connection from Parse Python Output to OpenAI
  if (workflow.connections['Parse Python Output']) {
    delete workflow.connections['Parse Python Output'];
  }

  // Add new connections
  workflow.connections['Parse Python Output'] = {
    main: [[{ node: 'Split into Chunks', type: 'main', index: 0 }]]
  };

  workflow.connections['Split into Chunks'] = {
    main: [[{ node: 'Process Chunks', type: 'main', index: 0 }]]
  };

  workflow.connections['Process Chunks'] = {
    main: [[{ node: 'OpenAI - Extract EOB Data', type: 'main', index: 0 }]]
  };

  // Connect OpenAI back to batch node (for loop) and to merge
  workflow.connections['OpenAI - Extract EOB Data'] = {
    main: [[
      { node: 'Merge Chunk Results', type: 'main', index: 0 },
      { node: 'Process Chunks', type: 'main', index: 0 }
    ]]
  };

  workflow.connections['Merge Chunk Results'] = {
    main: [[{ node: 'Validate EOB Extraction', type: 'main', index: 0 }]]
  };

  console.log('Saving workflow...');

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  await api.put(\`/workflows/\${WORKFLOW_ID}\`, updatePayload);

  console.log('✓ Chunking implemented successfully!');
  console.log('\\nNew workflow structure:');
  console.log('  Parse Python Output');
  console.log('    ↓');
  console.log('  Split into Chunks (new)');
  console.log('    ↓');
  console.log('  Process Chunks [SplitInBatches] (new)');
  console.log('    ↓ (loop)');
  console.log('  OpenAI - Extract EOB Data (per chunk)');
  console.log('    ↓');
  console.log('  Merge Chunk Results (new)');
  console.log('    ↓');
  console.log('  Validate EOB Extraction');
  console.log('    ↓');
  console.log('  ... rest of workflow');
}

implementChunking().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
