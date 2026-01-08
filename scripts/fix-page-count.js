#!/usr/bin/env node
/**
 * Fix Page Count Issue
 * The Calculate Document AI Cost node needs to look for totalPages
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

const FIXED_DOC_AI_COST = `// Calculate Document AI cost dynamically
const pythonOutput = $input.first().json;
const docAiConfig = $('Get Document AI Cost Config').first().json.data;

// Extract number of pages from python output
// Check multiple locations for pages count
let pages = 0;

// Location 1: Direct pages field
if (pythonOutput.pages) {
  pages = pythonOutput.pages;
}
// Location 2: data.pages
else if (pythonOutput.data && pythonOutput.data.pages) {
  pages = pythonOutput.data.pages;
}
// Location 3: data.totalPages (from enhanced Parse Python Output)
else if (pythonOutput.data && pythonOutput.data.totalPages) {
  pages = pythonOutput.data.totalPages;
}
// Location 4: totalPages at root
else if (pythonOutput.totalPages) {
  pages = pythonOutput.totalPages;
}

console.log('Pages found:', pages);
console.log('Python output keys:', Object.keys(pythonOutput));
if (pythonOutput.data) {
  console.log('Python output.data keys:', Object.keys(pythonOutput.data));
}

const costPerPage = parseFloat(docAiConfig.value || 0.015);
const documentAiCost = pages * costPerPage;

console.log('Document AI Cost: ' + pages + ' pages × $' + costPerPage + ' = $' + documentAiCost.toFixed(4));

return [{
  json: {
    documentAiCost: parseFloat(documentAiCost.toFixed(4)),
    pages: pages,
    costPerPage: costPerPage
  }
}];
`;

async function fixPageCount() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Updating nodes...');

  workflow.nodes = workflow.nodes.map(node => {
    if (node.name === 'Calculate Document AI Cost') {
      console.log('  ✓ Updating "Calculate Document AI Cost" - Now checks totalPages');
      node.parameters.jsCode = FIXED_DOC_AI_COST;
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

  console.log('✓ Fixed! Page count will now be captured correctly.');
  console.log('\nThe node now checks for pages in:');
  console.log('  1. pythonOutput.pages');
  console.log('  2. pythonOutput.data.pages');
  console.log('  3. pythonOutput.data.totalPages');
  console.log('  4. pythonOutput.totalPages');
}

fixPageCount().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
