#!/usr/bin/env node
/**
 * Fix n8n Workflow Issues:
 * 1. Token usage not captured (OpenAI Cost = 0)
 * 2. max_tokens too low (only 3 records extracted)
 * 3. Validation field name mismatch (patient_name vs Patient Name)
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

// Fix 1: Updated Calculate OpenAI Cost code to handle Langchain response format
const FIXED_CALCULATE_OPENAI_COST = `// Calculate OpenAI cost dynamically
// FIXED: Handle Langchain OpenAI node response format
const aiResponse = $input.first().json;
const modelPricing = $('Get Model Pricing').first().json.data;

// Try multiple locations for token usage (different API/node versions)
let inputTokens = 0;
let outputTokens = 0;

// Location 1: Direct usage field (standard OpenAI API)
if (aiResponse.usage) {
  inputTokens = aiResponse.usage.prompt_tokens || 0;
  outputTokens = aiResponse.usage.completion_tokens || 0;
}
// Location 2: Response wrapper (some n8n versions)
else if (aiResponse.response?.usage) {
  inputTokens = aiResponse.response.usage.prompt_tokens || 0;
  outputTokens = aiResponse.response.usage.completion_tokens || 0;
}
// Location 3: Get from the OpenAI node directly
else {
  const openAiNode = $('OpenAI - Extract EOB Data').first().json;
  if (openAiNode.usage) {
    inputTokens = openAiNode.usage.prompt_tokens || 0;
    outputTokens = openAiNode.usage.completion_tokens || 0;
  } else if (openAiNode.response?.usage) {
    inputTokens = openAiNode.response.usage.prompt_tokens || 0;
    outputTokens = openAiNode.response.usage.completion_tokens || 0;
  }
}

// If still no tokens, estimate based on content length
if (inputTokens === 0 && outputTokens === 0) {
  // Get input text length for estimation
  const pythonOutput = $('Parse Python Output').first().json;
  const inputText = pythonOutput?.data?.text || '';

  // Get output content
  let outputContent = '';
  if (aiResponse.message?.content) {
    outputContent = typeof aiResponse.message.content === 'string'
      ? aiResponse.message.content
      : JSON.stringify(aiResponse.message.content);
  }

  // Rough estimation: ~4 chars per token
  inputTokens = Math.ceil(inputText.length / 4);
  outputTokens = Math.ceil(outputContent.length / 4);

  console.warn('⚠ Token usage not found in API response, using estimation');
  console.log('Estimated from content lengths:', inputText.length, 'input chars,', outputContent.length, 'output chars');
}

const inputCostPer1k = parseFloat(modelPricing.input_cost_per_1k || 0.00015);
const outputCostPer1k = parseFloat(modelPricing.output_cost_per_1k || 0.0006);

const openAiCost = (inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k);

console.log(\`OpenAI Cost: \${inputTokens} input + \${outputTokens} output tokens = $\${openAiCost.toFixed(4)}\`);
console.log(\`Model: \${modelPricing.model_name} (\${modelPricing.model_code})\`);

return [{
  json: {
    openAiCost: parseFloat(openAiCost.toFixed(4)),
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
    modelName: modelPricing.model_name,
    modelCode: modelPricing.model_code,
    inputCostPer1k: inputCostPer1k,
    outputCostPer1k: outputCostPer1k
  }
}];`;

// Fix 3: Updated Validate EOB Extraction code to use correct field names
const FIXED_VALIDATE_EOB = `// ========================================
// VALIDATE EOB EXTRACTION QUALITY
// Purpose: Validates EOB extraction quality and determines if self-correction is needed
// Position: After "OpenAI - Extract EOB Data", Before "Calculate OpenAI Cost"
// Threshold: 70% confidence, 80% valid records
// FIXED: Use correct field names matching OpenAI prompt output
// ========================================

const aiResponse = $input.first().json;
const processData = $('Extract Process Data').first().json;

console.log('=== EOB EXTRACTION VALIDATION ===');
console.log('AI Response structure:', Object.keys(aiResponse));

let extractedData;
let records = [];

// Parse AI response (handle different formats)
try {
  if (aiResponse.choices && Array.isArray(aiResponse.choices) && aiResponse.choices.length > 0) {
    const content = aiResponse.choices[0].message.content;
    extractedData = typeof content === 'string' ? JSON.parse(content) : content;
  } else if (aiResponse.message) {
    const content = aiResponse.message.content || aiResponse.message;
    extractedData = typeof content === 'string' ? JSON.parse(content) : content;
  } else if (aiResponse.output) {
    extractedData = typeof aiResponse.output === 'string' ? JSON.parse(aiResponse.output) : aiResponse.output;
  } else if (aiResponse.data) {
    extractedData = aiResponse;
  } else {
    extractedData = aiResponse;
  }

  // Get records array
  if (extractedData.data && Array.isArray(extractedData.data)) {
    records = extractedData.data;
  } else if (Array.isArray(extractedData)) {
    records = extractedData;
  } else if (extractedData && typeof extractedData === 'object') {
    records = [extractedData];
  }

  console.log('Parsed records count:', records.length);
} catch (parseError) {
  console.error('Failed to parse AI response:', parseError.message);
  throw new Error(\`AI response parsing failed: \${parseError.message}\`);
}

// Validation checks
const validationResults = {
  totalRecords: records.length,
  validRecords: 0,
  invalidRecords: 0,
  missingFields: [],
  lowConfidenceRecords: [],
  averageConfidence: 0,
  passed: false
};

// FIXED: EOB Required fields - use actual field names from OpenAI prompt
// Support both formats: "Patient Name" (space) and "patient_name" (underscore)
const requiredFieldMappings = [
  { check: ['patient_acct'], name: 'patient_acct' },
  { check: ['service_date'], name: 'service_date' },
  { check: ['Patient Name', 'patient_name', 'PatientName'], name: 'Patient Name' }
];

let totalConfidence = 0;

records.forEach((record, index) => {
  const recordIssues = [];

  // Check required fields with flexible naming
  requiredFieldMappings.forEach(mapping => {
    const hasField = mapping.check.some(fieldName =>
      record[fieldName] && record[fieldName] !== ''
    );

    if (!hasField) {
      recordIssues.push(\`Missing \${mapping.name}\`);
      validationResults.missingFields.push({record: index, field: mapping.name});
    }
  });

  // Check confidence score (support both naming conventions)
  const confidence = parseFloat(
    record.Confidence_Score ||
    record.confidence_score ||
    record['Confidence Score'] ||
    100
  );
  totalConfidence += confidence;

  if (confidence < 70) {
    recordIssues.push(\`Low confidence: \${confidence}%\`);
    validationResults.lowConfidenceRecords.push({record: index, confidence: confidence});
  }

  if (recordIssues.length === 0) {
    validationResults.validRecords++;
  } else {
    validationResults.invalidRecords++;
    console.warn(\`Record \${index} issues:\`, recordIssues.join(', '));
  }
});

validationResults.averageConfidence = records.length > 0 ? totalConfidence / records.length : 0;

// Determine if validation passed (80% valid records, 70% avg confidence)
const validRecordPercent = records.length > 0 ? (validationResults.validRecords / records.length) * 100 : 0;
validationResults.passed = validRecordPercent >= 80 && validationResults.averageConfidence >= 70;

console.log('Validation Results:');
console.log('- Total Records:', validationResults.totalRecords);
console.log('- Valid Records:', validationResults.validRecords, \`(\${validRecordPercent.toFixed(1)}%)\`);
console.log('- Invalid Records:', validationResults.invalidRecords);
console.log('- Average Confidence:', validationResults.averageConfidence.toFixed(2) + '%');
console.log('- Validation Passed:', validationResults.passed ? '✓' : '✗');

if (!validationResults.passed) {
  console.warn('⚠ Extraction quality below threshold - may need self-correction');
}

// Output decision
return [{
  json: {
    originalResponse: aiResponse,
    extractedData: extractedData,
    records: records,
    validation: validationResults,
    needsCorrection: !validationResults.passed,
    correctionAttempt: 0,
    processId: processData.processId
  }
}];
`;

async function updateWorkflow() {
  console.log('Fetching workflow...');
  const { data: workflow } = await api.get(`/workflows/${WORKFLOW_ID}`);

  console.log('Workflow:', workflow.name);
  console.log('Nodes to update:');

  let updated = false;

  workflow.nodes = workflow.nodes.map(node => {
    // Fix 1: Calculate OpenAI Cost
    if (node.name === 'Calculate OpenAI Cost') {
      console.log('  ✓ Updating "Calculate OpenAI Cost" - Fix token usage capture');
      node.parameters.jsCode = FIXED_CALCULATE_OPENAI_COST;
      updated = true;
    }

    // Fix 1b: Calculate OpenAI Cost1 (for Facesheet)
    if (node.name === 'Calculate OpenAI Cost1') {
      console.log('  ✓ Updating "Calculate OpenAI Cost1" - Fix token usage capture');
      node.parameters.jsCode = FIXED_CALCULATE_OPENAI_COST.replace(
        "Get Model Pricing", "Get Model Pricing1"
      ).replace(
        "OpenAI - Extract EOB Data", "OpenAI - Extract Facesheet Data"
      );
      updated = true;
    }

    // Fix 1c: Calculate OpenAI Cost2 (for Invoice)
    if (node.name === 'Calculate OpenAI Cost2') {
      console.log('  ✓ Updating "Calculate OpenAI Cost2" - Fix token usage capture');
      node.parameters.jsCode = FIXED_CALCULATE_OPENAI_COST.replace(
        "Get Model Pricing", "Get Model Pricing2"
      ).replace(
        "OpenAI - Extract EOB Data", "OpenAI - Extract Invoice Data"
      ).replace(
        "Parse Python Output", "Parse Python Output2"
      );
      updated = true;
    }

    // Fix 2: OpenAI - Extract EOB Data - Increase max_tokens
    if (node.name === 'OpenAI - Extract EOB Data') {
      console.log('  ✓ Updating "OpenAI - Extract EOB Data" - Increase max_tokens from 4096 to 16384');
      if (!node.parameters.options) {
        node.parameters.options = {};
      }
      node.parameters.options.maxTokens = 16384;
      updated = true;
    }

    // Fix 3: Validate EOB Extraction
    if (node.name === 'Validate EOB Extraction') {
      console.log('  ✓ Updating "Validate EOB Extraction" - Fix field name matching');
      node.parameters.jsCode = FIXED_VALIDATE_EOB;
      updated = true;
    }

    return node;
  });

  if (!updated) {
    console.log('No nodes found to update!');
    return;
  }

  console.log('\nSaving workflow...');

  // Update the workflow - only send required fields
  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  await api.put(`/workflows/${WORKFLOW_ID}`, updatePayload);

  console.log('✓ Workflow updated successfully!');
  console.log('\nChanges made:');
  console.log('1. Calculate OpenAI Cost nodes now handle Langchain response format');
  console.log('2. OpenAI max_tokens increased from 4096 to 16384');
  console.log('3. Validation now accepts "Patient Name" field (with space)');
}

// Run the update
updateWorkflow()
  .then(() => {
    console.log('\nDone! Please test the workflow with a new document.');
  })
  .catch(err => {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  });
