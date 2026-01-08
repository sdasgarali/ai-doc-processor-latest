# n8n Workflow - Node by Node Configuration Guide

**Workflow URL:** http://localhost:5678/workflow/0u7zScXem9cjVNK6

---

## Workflow Structure Overview

```
1. Webhook → 2. Code → 3. HTTP (Pricing) → 4. HTTP (DocAI Cost)
                               ↓
5. Code (Wait) → 6. Google Drive (Download) → 7. Execute Command (Python)
                                                      ↓
                                   8. Code (Calc DocAI) → 12. Code (Total Cost)
                                                      ↓
                        9. Code (Parse) → 10. OpenAI → 11. Code (Calc OpenAI) → 12. Code (Total Cost)
                                                      ↓
                                          13. Code (Prep JSON) → 15. Code (JSON Binary) → 17. Google Drive (Upload JSON)
                                                      ↓                                              ↓
                                          14. Code (Prep CSV) → 16. Code (CSV Binary) → 18. Google Drive (Upload CSV)
                                                                                              ↓
                                          19. Google Drive (Move PDF) → 20. Code (Prep Results) → 21. HTTP (Send Results)
```

---

## NODE 1: Webhook Trigger

**Type:** Webhook
**Name:** Webhook Trigger

### Configuration:
- **HTTP Method:** POST
- **Path:** `eob-process`
- **Response Mode:** On Received
- **Response Code:** 200
- **Response Data:** Workflow Data

### Connection:
- Output → Node 2 (Extract Process Data)

### Test:
```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{"processId": 999, "test": true}'
```

---

## NODE 2: Extract Process Data

**Type:** Code
**Name:** Extract Process Data

### Code:
```javascript
// Extract webhook data
const webhookData = $input.first().json.body || $input.first().json;

return [{
  json: {
    processId: webhookData.processId,
    filename: webhookData.filename,
    originalFilename: webhookData.originalFilename,
    driveFileId: webhookData.driveFileId,
    userid: webhookData.userid,
    clientId: webhookData.clientId,
    sessionId: webhookData.sessionId,
    modelId: webhookData.modelId || 2,
    docCategory: webhookData.docCategory,
    startTime: new Date().toISOString()
  }
}];
```

### Connections:
- Input ← Node 1 (Webhook Trigger)
- Output → Node 3 (Get Model Pricing)
- Output → Node 4 (Get Document AI Cost Config)

---

## NODE 3: Get Model Pricing

**Type:** HTTP Request
**Name:** Get Model Pricing

### Configuration:
- **Method:** GET
- **URL:** `http://localhost:3000/api/admin/openai-models/{{ $('Extract Process Data').first().json.modelId }}/pricing`
- **Authentication:** None
- **Options:**
  - Response Format: JSON

### Connection:
- Input ← Node 2 (Extract Process Data)
- Output → Node 5 (Wait for Drive Upload)

---

## NODE 4: Get Document AI Cost Config

**Type:** HTTP Request
**Name:** Get Document AI Cost Config

### Configuration:
- **Method:** GET
- **URL:** `http://localhost:3000/api/admin/config/docai_cost_per_page`
- **Authentication:** None
- **Options:**
  - Response Format: JSON

### Connection:
- Input ← Node 2 (Extract Process Data)
- Output → Node 5 (Wait for Drive Upload)

---

## NODE 5: Wait for Drive Upload

**Type:** Code
**Name:** Wait for Drive Upload

### Code:
```javascript
// Wait 2 seconds for Google Drive upload to complete
await new Promise(resolve => setTimeout(resolve, 2000));

const processData = $('Extract Process Data').first().json;

return [{
  json: {
    ...processData,
    driveFileReady: true
  }
}];
```

### Connections:
- Input ← Node 3 (Get Model Pricing) - Wait for All
- Input ← Node 4 (Get Document AI Cost Config) - Wait for All
- Output → Node 6 (Download PDF from Drive)

---

## NODE 6: Download PDF from Drive

**Type:** Google Drive
**Name:** Download PDF from Drive

### Configuration:
- **Operation:** Download
- **File ID:** `={{ $('Extract Process Data').first().json.driveFileId }}`
- **Credential:** (Select your Google Drive OAuth2 credential)

### Connection:
- Input ← Node 5 (Wait for Drive Upload)
- Output → Node 7 (Execute Python - Document AI)

---

## NODE 7: Execute Python - Document AI

**Type:** Execute Command
**Name:** Execute Python - Document AI

### Configuration:
- **Command:**
```
python "C:\Automation\AI Agents\GCloud Document AI\Eob_process_n8n\eob_process_with_DocAI_n8n_without_watching_v6.py" "H:/My Drive/AAA AI-Training/Document Processing/EOB-Extractor/eob-source/{{ $('Extract Process Data').first().json.filename }}"
```
- **Timeout:** 300000 (5 minutes)

### Connections:
- Input ← Node 6 (Download PDF from Drive)
- Output → Node 8 (Calculate Document AI Cost)
- Output → Node 9 (Parse Python Output)

---

## NODE 8: Calculate Document AI Cost

**Type:** Code
**Name:** Calculate Document AI Cost

### Code:
```javascript
// Calculate Document AI cost dynamically
const pythonOutput = $('Execute Python - Document AI').first().json;
const docAiConfig = $('Get Document AI Cost Config').first().json.data;

// Extract number of pages
let pages = 0;
if (pythonOutput.data && pythonOutput.data.pages) {
  pages = pythonOutput.data.pages;
}

const costPerPage = parseFloat(docAiConfig.value || 0.015);
const documentAiCost = pages * costPerPage;

console.log(`Document AI Cost: ${pages} pages × $${costPerPage} = $${documentAiCost.toFixed(4)}`);

return [{
  json: {
    documentAiCost: parseFloat(documentAiCost.toFixed(4)),
    pages: pages,
    costPerPage: costPerPage
  }
}];
```

### Connection:
- Input ← Node 7 (Execute Python - Document AI)
- Output → Node 12 (Calculate Total Cost & Time)

---

## NODE 9: Parse Python Output

**Type:** Code
**Name:** Parse Python Output

### Code:
```javascript
// Parse Python script output to extract JSON data
const output = $input.first().json.stdout || '';

// Find JSON between markers
const startMarker = '===JSON_START===';
const endMarker = '===JSON_END===';

const startIdx = output.indexOf(startMarker);
const endIdx = output.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  throw new Error('Could not find JSON markers in Python output');
}

const jsonStr = output.substring(startIdx + startMarker.length, endIdx).trim();
const data = JSON.parse(jsonStr);

return [{
  json: {
    data: data,
    pages: data.pages || 0,
    rawDataPath: data.raw_data_file || ''
  }
}];
```

### Connection:
- Input ← Node 7 (Execute Python - Document AI)
- Output → Node 10 (OpenAI - Extract EOB Data)

---

## NODE 10: OpenAI - Extract EOB Data

**Type:** OpenAI (Chat Model)
**Name:** OpenAI - Extract EOB Data

### Configuration:
- **Model:** `{{ $('Get Model Pricing').first().json.data.model_code }}`
- **Credential:** (Select your OpenAI API credential)

### Messages:
**System Message:**
```
You are a document EOB data-extraction expert. Your task is to accurately extract and structure EOB (Explanation of Benefits) information from the provided document data.

Extract the following fields for each EOB entry:
- Original_page_no, EOB_page_no, patient_acct, Patient_ID, Claim_ID
- Patient_Name, First_Name, Last_Name, Date_of_Birth, SSN
- Provider_Name, Service_Date_From, Service_Date_To
- Total_Charges, Plan_Paid, Patient_Responsibility
- Deductible, Copay, Coinsurance
- Claim_Number, Group_Number, Subscriber_Name
- Relationship_to_Subscriber, Diagnosis_Codes, Procedure_Codes
- Service_Description, Provider_NPI, Insurance_Name, Plan_Type
- Remarks, Confidence_Score (0-100)

Output Format: Return a JSON object with:
{
  "data": [ {...extracted fields for each EOB entry...} ],
  "summary": { "total_records": number, "avg_confidence": number }
}
```

**User Message:**
```
Extract EOB data from this document:

{{ JSON.stringify($('Parse Python Output').first().json.data) }}
```

### Options:
- **Temperature:** 0.1
- **Max Tokens:** 4000

### Connections:
- Input ← Node 9 (Parse Python Output)
- Output → Node 11 (Calculate OpenAI Cost)
- Output → Node 13 (Prepare JSON)

---

## NODE 11: Calculate OpenAI Cost

**Type:** Code
**Name:** Calculate OpenAI Cost

### Code:
```javascript
// Calculate OpenAI cost dynamically
const aiResponse = $('OpenAI - Extract EOB Data').first().json;
const modelPricing = $('Get Model Pricing').first().json.data;

const inputTokens = aiResponse.usage?.prompt_tokens || 0;
const outputTokens = aiResponse.usage?.completion_tokens || 0;

const inputCostPer1k = parseFloat(modelPricing.input_cost_per_1k || 0.00015);
const outputCostPer1k = parseFloat(modelPricing.output_cost_per_1k || 0.0006);

const openAiCost = (inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k);

console.log(`OpenAI Cost: ${inputTokens} input + ${outputTokens} output = $${openAiCost.toFixed(4)}`);

return [{
  json: {
    openAiCost: parseFloat(openAiCost.toFixed(4)),
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
    modelName: modelPricing.model_name,
    modelCode: modelPricing.model_code
  }
}];
```

### Connection:
- Input ← Node 10 (OpenAI - Extract EOB Data)
- Output → Node 12 (Calculate Total Cost & Time)

---

## NODE 12: Calculate Total Cost & Time

**Type:** Code
**Name:** Calculate Total Cost & Time

### Code:
```javascript
// Calculate total cost and processing time
const processData = $('Extract Process Data').first().json;
const docAiCost = $('Calculate Document AI Cost').first().json;
const openAiCost = $('Calculate OpenAI Cost').first().json;

const startTime = new Date(processData.startTime);
const endTime = new Date();
const processingTimeMs = endTime - startTime;
const processingTimeSeconds = Math.round(processingTimeMs / 1000);

const totalCost = parseFloat((docAiCost.documentAiCost + openAiCost.openAiCost).toFixed(4));

console.log(`Total Cost: $${totalCost}`);
console.log(`Processing Time: ${processingTimeSeconds} seconds`);

return [{
  json: {
    totalCost: totalCost,
    documentAiCost: docAiCost.documentAiCost,
    openAiCost: openAiCost.openAiCost,
    processingTimeSeconds: processingTimeSeconds,
    pages: docAiCost.pages,
    inputTokens: openAiCost.inputTokens,
    outputTokens: openAiCost.outputTokens,
    modelUsed: openAiCost.modelName
  }
}];
```

### Connections:
- Input ← Node 8 (Calculate Document AI Cost) - Wait for All
- Input ← Node 11 (Calculate OpenAI Cost) - Wait for All
- Output → Node 13 (Prepare JSON)
- Output → Node 14 (Prepare CSV)

---

## NODE 13: Prepare JSON

**Type:** Code
**Name:** Prepare JSON

### Code:
```javascript
// Prepare JSON output
const aiResponse = $('OpenAI - Extract EOB Data').first().json;
const processData = $('Extract Process Data').first().json;
const costData = $('Calculate Total Cost & Time').first().json;

let extractedData;

// Handle different response formats
if (aiResponse.message) {
  const content = aiResponse.message.content || aiResponse.message;
  extractedData = typeof content === 'string' ? JSON.parse(content) : content;
} else if (aiResponse.choices && aiResponse.choices[0]) {
  extractedData = JSON.parse(aiResponse.choices[0].message.content);
} else if (typeof aiResponse === 'string') {
  extractedData = JSON.parse(aiResponse);
} else {
  extractedData = aiResponse.data || aiResponse;
}

const baseFilename = processData.originalFilename.replace('.pdf', '');
const jsonFilename = `extracted_${baseFilename}.json`;

const jsonOutput = {
  data: extractedData.data || extractedData,
  metadata: {
    original_pdf: processData.originalFilename,
    process_id: processData.processId,
    processed_at: new Date().toISOString(),
    source: 'Document AI + OpenAI',
    model_used: costData.modelUsed,
    total_records: (extractedData.data || extractedData).length || 0,
    pages: costData.pages,
    processing_time_seconds: costData.processingTimeSeconds,
    costs: {
      document_ai: costData.documentAiCost,
      openai: costData.openAiCost,
      total: costData.totalCost
    },
    summary: extractedData.summary || {}
  }
};

return [{
  json: {
    jsonOutput: jsonOutput,
    jsonFilename: jsonFilename,
    extractedRecords: extractedData.data || extractedData,
    totalRecords: (extractedData.data || extractedData).length || 0
  }
}];
```

### Connections:
- Input ← Node 10 (OpenAI - Extract EOB Data) - Wait for All
- Input ← Node 12 (Calculate Total Cost & Time) - Wait for All
- Output → Node 14 (Prepare CSV)
- Output → Node 15 (JSON to Binary)

---

## NODE 14: Prepare CSV

**Type:** Code
**Name:** Prepare CSV

### Code:
```javascript
// Prepare CSV output
const jsonData = $('Prepare JSON').first().json;
const processData = $('Extract Process Data').first().json;

const records = jsonData.extractedRecords || [];

if (records.length === 0) {
  return [{
    json: {
      csvFilename: '',
      csvContent: ''
    }
  }];
}

// Get all unique keys
const allKeys = new Set();
records.forEach(record => {
  Object.keys(record).forEach(key => allKeys.add(key));
});

const headers = Array.from(allKeys);

// Build CSV
const csvRows = [headers.join(',')];

records.forEach(record => {
  const row = headers.map(header => {
    const value = record[header] || '';
    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  });
  csvRows.push(row.join(','));
});

const csvContent = csvRows.join('\n');
const baseFilename = processData.originalFilename.replace('.pdf', '');
const csvFilename = `extracted_${baseFilename}.csv`;

return [{
  json: {
    csvFilename: csvFilename,
    csvContent: csvContent
  }
}];
```

### Connections:
- Input ← Node 12 (Calculate Total Cost & Time)
- Input ← Node 13 (Prepare JSON)
- Output → Node 16 (CSV to Binary)

---

## NODE 15: JSON to Binary

**Type:** Code
**Name:** JSON to Binary

### Code:
```javascript
// Convert JSON to binary
const jsonData = $('Prepare JSON').first().json;
const jsonStr = JSON.stringify(jsonData.jsonOutput, null, 2);
const buffer = Buffer.from(jsonStr, 'utf8');

return [{
  json: {
    filename: jsonData.jsonFilename
  },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'application/json',
      fileName: jsonData.jsonFilename
    }
  }
}];
```

### Connection:
- Input ← Node 13 (Prepare JSON)
- Output → Node 17 (Upload JSON to eob-results)

---

## NODE 16: CSV to Binary

**Type:** Code
**Name:** CSV to Binary

### Code:
```javascript
// Convert CSV to binary
const csvData = $('Prepare CSV').first().json;
const buffer = Buffer.from(csvData.csvContent, 'utf8');

return [{
  json: {
    filename: csvData.csvFilename
  },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'text/csv',
      fileName: csvData.csvFilename
    }
  }
}];
```

### Connection:
- Input ← Node 14 (Prepare CSV)
- Output → Node 18 (Upload CSV to eob-results)

---

## NODE 17: Upload JSON to eob-results

**Type:** Google Drive
**Name:** Upload JSON to eob-results

### Configuration:
- **Operation:** Upload
- **Folder ID:** `140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR`
- **File Name:** `={{ $json.filename }}`
- **Binary Property:** data
- **Credential:** (Same Google Drive OAuth2 credential)

### Connection:
- Input ← Node 15 (JSON to Binary)
- Output → Node 19 (Move & Rename PDF)

---

## NODE 18: Upload CSV to eob-results

**Type:** Google Drive
**Name:** Upload CSV to eob-results

### Configuration:
- **Operation:** Upload
- **Folder ID:** `140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR`
- **File Name:** `={{ $json.filename }}`
- **Binary Property:** data
- **Credential:** (Same Google Drive OAuth2 credential)

### Connection:
- Input ← Node 16 (CSV to Binary)
- Output → Node 19 (Move & Rename PDF)

---

## NODE 19: Move & Rename PDF

**Type:** Google Drive
**Name:** Move & Rename PDF

### Configuration:
- **Operation:** Update
- **File ID:** `={{ $('Extract Process Data').first().json.driveFileId }}`
- **Update Fields:**
  - **Name:** `Processed_{{ $('Extract Process Data').first().json.originalFilename }}`
  - **Parents to Add:** `140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR`
- **Credential:** (Same Google Drive OAuth2 credential)

### Connections:
- Input ← Node 17 (Upload JSON) - Wait for All
- Input ← Node 18 (Upload CSV) - Wait for All
- Output → Node 20 (Prepare Results Payload)

---

## NODE 20: Prepare Results Payload

**Type:** Code
**Name:** Prepare Results Payload

### Code:
```javascript
// Prepare results to send back
const processData = $('Extract Process Data').first().json;
const costData = $('Calculate Total Cost & Time').first().json;
const jsonUpload = $('Upload JSON to eob-results').first().json;
const csvUpload = $('Upload CSV to eob-results').first().json;
const pdfMove = $('Move & Rename PDF').first().json;
const jsonData = $('Prepare JSON').first().json;

return [{
  json: {
    processId: processData.processId,
    status: 'Processed',
    jsonDriveUrl: jsonUpload.webViewLink || jsonUpload.webContentLink || '',
    csvDriveUrl: csvUpload.webViewLink || csvUpload.webContentLink || '',
    jsonDriveId: jsonUpload.id || '',
    csvDriveId: csvUpload.id || '',
    processedPdfDriveId: pdfMove.id || '',
    processingTimeSeconds: costData.processingTimeSeconds,
    documentAiCost: costData.documentAiCost,
    openAiCost: costData.openAiCost,
    totalCost: costData.totalCost,
    totalRecords: jsonData.totalRecords,
    noOfPages: costData.pages
  }
}];
```

### Connection:
- Input ← Node 19 (Move & Rename PDF)
- Output → Node 21 (Send Results to Upload Service)

---

## NODE 21: Send Results to Upload Service

**Type:** HTTP Request
**Name:** Send Results to Upload Service

### Configuration:
- **Method:** POST
- **URL:** `http://localhost:3000/api/documents/{{ $('Extract Process Data').first().json.processId }}/n8n-results`
- **Send Body:** Yes (JSON)
- **Body Parameters:**
  - status: `={{ $json.status }}`
  - jsonDriveUrl: `={{ $json.jsonDriveUrl }}`
  - csvDriveUrl: `={{ $json.csvDriveUrl }}`
  - jsonDriveId: `={{ $json.jsonDriveId }}`
  - csvDriveId: `={{ $json.csvDriveId }}`
  - processedPdfDriveId: `={{ $json.processedPdfDriveId }}`
  - processingTimeSeconds: `={{ $json.processingTimeSeconds }}`
  - documentAiCost: `={{ $json.documentAiCost }}`
  - openAiCost: `={{ $json.openAiCost }}`
  - totalCost: `={{ $json.totalCost }}`
  - totalRecords: `={{ $json.totalRecords }}`
  - noOfPages: `={{ $json.noOfPages }}`

### Connection:
- Input ← Node 20 (Prepare Results Payload)

---

## Quick Configuration Checklist

- [ ] All 21 nodes created
- [ ] All connections made (see diagram at top)
- [ ] Google Drive credential configured (nodes 6, 17, 18, 19)
- [ ] OpenAI credential configured (node 10)
- [ ] Webhook path set to `eob-process` (node 1)
- [ ] Python script path correct (node 7)
- [ ] API URLs correct (nodes 3, 4, 21)
- [ ] Google Drive folder IDs correct (nodes 17, 18, 19)
- [ ] Workflow activated (toggle at top right)

---

## Testing the Workflow

### Test 1: Webhook Response
```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{"processId": 999, "test": true}'
```
Expected: 200 OK response

### Test 2: Check API Endpoints
```bash
# Test model pricing
curl http://localhost:3000/api/admin/openai-models/2/pricing

# Test DocAI cost
curl http://localhost:3000/api/admin/config/docai_cost_per_page
```
Expected: JSON responses with pricing data

---

## Troubleshooting

### Issue: Nodes not connecting
**Solution:** Click and drag from output dot of one node to input dot of next node

### Issue: Expressions not working
**Solution:** Make sure to use `={{ }}` syntax for expressions, and reference nodes by exact name like `$('Node Name').first().json.field`

### Issue: Google Drive errors
**Solution:** Reconnect OAuth credential, ensure you have granted all required permissions

### Issue: Python script fails
**Solution:** Verify path exists, Google Drive Desktop is connected, credentials file is in place
