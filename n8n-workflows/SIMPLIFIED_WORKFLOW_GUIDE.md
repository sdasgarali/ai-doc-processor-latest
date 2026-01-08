# EOB Simplified Working Webhook - Complete Guide

**File:** `EOB_Simplified_Working_Webhook.json`
**Webhook Path:** `/webhook/eob-simple`
**Nodes:** 9 (all Code nodes)
**Purpose:** Test core workflow functionality without Google Drive or real Document AI

---

## Quick Import & Test (5 minutes)

### Step 1: Import Workflow
1. Open n8n: http://localhost:5678
2. Click **"Add Workflow"** → **"Import from File"**
3. Select: `C:\n8ndata\eob-extraction-final\n8n-workflows\EOB_Simplified_Working_Webhook.json`
4. Click **"Save"**
5. **Activate** the workflow (toggle at top right)

### Step 2: Test the Webhook
```powershell
# PowerShell command (Windows)
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 999, "modelId": 2, "filename": "test.pdf"}' -ContentType "application/json"
```

### Step 3: Verify Success
1. Check executions: http://localhost:5678/executions
2. Click on the most recent execution
3. Should see **green checkmarks** on all 9 nodes
4. Check database:
   ```sql
   SELECT process_id, processing_status, document_ai_cost, openai_cost, total_cost, total_records
   FROM document_processed
   WHERE process_id = 999;
   ```

**Expected Result:**
- Status: "Processed"
- document_ai_cost: 0.1500 (10 pages × $0.015/page)
- openai_cost: ~0.0010 (GPT-4o-mini tokens)
- total_cost: ~0.1510
- total_records: 2

---

## Workflow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Webhook (POST /webhook/eob-simple)                      │
│    Receives: { processId, modelId, filename }              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 2. Extract Process Data                                     │
│    Validates input, sets defaults                           │
└───────────┬────────────────────────────┬────────────────────┘
            │                            │
┌───────────▼────────────┐   ┌───────────▼─────────────────┐
│ 3. Get Model Pricing   │   │ 4. Get DocAI Cost           │
│    API: /openai-models │   │    API: /config/docai_cost  │
└───────────┬────────────┘   └───────────┬─────────────────┘
            │                            │
            └──────────┬─────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ 5. Simulate Document AI                                     │
│    Mock: 10 pages, extract text, calculate cost            │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 6. Simulate OpenAI Extraction                               │
│    Mock: 2500 input + 1500 output tokens, calculate cost   │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 7. Calculate Total Cost                                     │
│    Sum: DocAI + OpenAI + processing time                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 8. Prepare Results                                          │
│    Format payload for database                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 9. Send Results to DB                                       │
│    POST: /api/documents/{processId}/n8n-results             │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│ 10. Final Summary (Output)                                  │
│     Display workflow completion status                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Node Details

### Node 1: Webhook
**Type:** Webhook
**Method:** POST
**Path:** `eob-simple`
**Response Mode:** On Received

**Input:**
```json
{
  "processId": 999,
  "modelId": 2,
  "filename": "test.pdf",
  "originalFilename": "test.pdf",
  "driveFileId": "optional",
  "userid": 1,
  "clientId": 1,
  "sessionId": "optional"
}
```

**Configuration:** Already configured, no changes needed

---

### Node 2: Extract Process Data
**Type:** Code
**Purpose:** Validate webhook input and set defaults

**Key Code:**
```javascript
const body = $input.first().json.body || $input.first().json;

const processId = body.processId || 999;
const modelId = body.modelId || 2;
const filename = body.filename || 'test.pdf';
```

**Output:**
```json
{
  "processId": 999,
  "modelId": 2,
  "filename": "test.pdf",
  "originalFilename": "test.pdf",
  "driveFileId": "test-drive-id",
  "userid": 1,
  "clientId": 1,
  "sessionId": "test-session",
  "startTime": "2025-11-07T12:34:56.789Z"
}
```

---

### Node 3: Get Model Pricing
**Type:** Code
**Purpose:** Fetch OpenAI model pricing from backend API

**API Call:**
```javascript
const response = await this.helpers.httpRequest({
  method: 'GET',
  url: `http://127.0.0.1:3000/api/admin/openai-models/${modelId}/pricing`,
  json: true
});
```

**Expected Response:**
```json
{
  "data": {
    "model_id": 2,
    "model_name": "GPT-4o-mini",
    "model_code": "gpt-4o-mini",
    "input_cost_per_1k": 0.00015,
    "output_cost_per_1k": 0.0006
  }
}
```

**Troubleshooting:**
- Error: "connect ECONNREFUSED" → Backend not running
  - Fix: Start backend: `npm run dev` in project root
- Error: "404 Not Found" → Pricing API not set up
  - Fix: Run migration: `add_pricing_minimal.sql`

---

### Node 4: Get DocAI Cost
**Type:** Code
**Purpose:** Fetch Document AI cost per page from system config

**API Call:**
```javascript
const response = await this.helpers.httpRequest({
  method: 'GET',
  url: 'http://127.0.0.1:3000/api/admin/config/docai_cost_per_page',
  json: true
});
```

**Expected Response:**
```json
{
  "data": {
    "key": "docai_cost_per_page",
    "value": "0.015",
    "description": "Google Document AI cost per page in USD"
  }
}
```

---

### Node 5: Simulate Document AI
**Type:** Code
**Purpose:** Mock Document AI processing without calling real API

**What It Does:**
- Simulates processing a 10-page PDF
- Calculates cost: 10 pages × $0.015/page = $0.15
- Returns mock extracted text and tables

**Mock Output:**
```json
{
  "documentAiCost": 0.15,
  "pages": 10,
  "costPerPage": 0.015,
  "extractedData": {
    "pages": 10,
    "text": "Sample EOB document text...",
    "tables": [
      { "page": 1, "data": "Patient info table" },
      { "page": 2, "data": "Claims table" }
    ]
  }
}
```

**Why Simulate?**
- Avoids Google Cloud billing during testing
- No need to configure Document AI credentials
- Faster execution (no API call latency)

---

### Node 6: Simulate OpenAI
**Type:** Code
**Purpose:** Mock OpenAI extraction without calling real API

**What It Does:**
- Simulates token usage: 2500 input + 1500 output = 4000 total
- Calculates cost using real pricing from Node 3
- Returns mock EOB extracted data (2 records)

**Cost Calculation:**
```javascript
const inputCost = (2500 / 1000) * 0.00015 = $0.000375
const outputCost = (1500 / 1000) * 0.0006 = $0.0009
const openAiCost = $0.001275 (rounds to $0.0013)
```

**Mock EOB Data:**
```json
{
  "data": [
    {
      "Original_page_no": "1",
      "patient_acct": "12345-67890",
      "Patient_Name": "DOE, JOHN",
      "Total_Charges": "1500.00",
      "Plan_Paid": "1200.00",
      "Patient_Responsibility": "300.00",
      "Confidence_Score": 95
    },
    {
      "Original_page_no": "2",
      "patient_acct": "12345-67891",
      "Patient_Name": "DOE, JOHN",
      "Total_Charges": "800.00",
      "Plan_Paid": "650.00",
      "Patient_Responsibility": "150.00",
      "Confidence_Score": 92
    }
  ],
  "summary": {
    "total_records": 2,
    "avg_confidence": 93.5
  }
}
```

---

### Node 7: Calculate Total Cost
**Type:** Code
**Purpose:** Sum all costs and calculate processing time

**Calculation:**
```javascript
const totalCost = docAiCost.documentAiCost + openAiCost.openAiCost
const processingTimeSeconds = (endTime - startTime) / 1000
```

**Output:**
```json
{
  "processId": 999,
  "totalCost": 0.1513,
  "documentAiCost": 0.15,
  "openAiCost": 0.0013,
  "processingTimeSeconds": 3,
  "pages": 10,
  "inputTokens": 2500,
  "outputTokens": 1500,
  "totalTokens": 4000,
  "modelUsed": "GPT-4o-mini",
  "modelCode": "gpt-4o-mini",
  "totalRecords": 2
}
```

---

### Node 8: Prepare Results
**Type:** Code
**Purpose:** Format payload for database update

**Output Format:**
```json
{
  "processId": 999,
  "status": "Processed",
  "jsonDriveUrl": "https://drive.google.com/simulated/json",
  "csvDriveUrl": "https://drive.google.com/simulated/csv",
  "jsonDriveId": "simulated-json-id",
  "csvDriveId": "simulated-csv-id",
  "processedPdfDriveId": "simulated-pdf-id",
  "processingTimeSeconds": 3,
  "documentAiCost": 0.15,
  "openAiCost": 0.0013,
  "totalCost": 0.1513,
  "totalRecords": 2,
  "noOfPages": 10,
  "errorMessage": null
}
```

**Note:** Uses simulated Google Drive URLs since we're not actually uploading files

---

### Node 9: Send Results to DB
**Type:** Code
**Purpose:** POST results to upload service database

**API Call:**
```javascript
const response = await this.helpers.httpRequest({
  method: 'POST',
  url: `http://127.0.0.1:3000/api/documents/${results.processId}/n8n-results`,
  json: true,
  body: results
});
```

**Backend Endpoint:** `routes/documents.js:231`

**Database Update:**
Updates `document_processed` table:
- `processing_status` = "Processed"
- `document_ai_cost` = 0.15
- `openai_cost` = 0.0013
- `cost` = 0.1513
- `total_records` = 2
- `no_of_pages` = 10
- `json_drive_url`, `csv_drive_url`, `processed_pdf_drive_id`
- `time_completed` = NOW()

**Error Handling:**
```javascript
try {
  const response = await this.helpers.httpRequest({...});
  return [{ json: { status: 'success', response } }];
} catch (error) {
  return [{ json: { status: 'error', error: error.message } }];
}
```

---

### Node 10: Final Summary
**Type:** Code
**Purpose:** Output workflow completion summary

**Output:**
```json
{
  "workflow": "EOB Simplified Working Webhook",
  "processId": 999,
  "status": "success",
  "costs": {
    "documentAi": 0.15,
    "openAi": 0.0013,
    "total": 0.1513
  },
  "processing": {
    "pages": 10,
    "records": 2,
    "timeSeconds": 3
  },
  "databaseUpdated": true
}
```

---

## Testing Scenarios

### Test 1: Basic Webhook (Default Model)
```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 1001}' -ContentType "application/json"
```

**Expected:**
- Model: GPT-4o-mini (default model_id: 2)
- DocAI Cost: $0.15
- OpenAI Cost: ~$0.0013
- Total: ~$0.1513

---

### Test 2: Different Model (GPT-4o)
```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 1002, "modelId": 1}' -ContentType "application/json"
```

**Expected:**
- Model: GPT-4o (model_id: 1)
- DocAI Cost: $0.15
- OpenAI Cost: ~$0.035 (much higher due to GPT-4o pricing)
- Total: ~$0.185

---

### Test 3: Custom Filename
```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 1003, "filename": "patient_eob_jan2024.pdf", "originalFilename": "patient_eob_jan2024.pdf"}' -ContentType "application/json"
```

**Expected:**
- Same costs as Test 1
- Filename stored in database: "patient_eob_jan2024.pdf"

---

### Test 4: Concurrent Processing
```powershell
# Run all three commands at once (different PowerShell windows)
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 2001}' -ContentType "application/json"
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 2002}' -ContentType "application/json"
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body '{"processId": 2003}' -ContentType "application/json"
```

**Expected:**
- All 3 executions appear in n8n dashboard
- All 3 succeed independently
- All 3 database records updated

---

## Verification Queries

### Check Latest Execution
```sql
SELECT
  process_id,
  doc_name,
  processing_status,
  document_ai_cost,
  openai_cost,
  cost as total_cost,
  total_records,
  no_of_pages,
  total_processing_time as time_seconds,
  time_initiated,
  time_completed
FROM document_processed
ORDER BY process_id DESC
LIMIT 5;
```

### Check Specific Process
```sql
SELECT *
FROM document_processed
WHERE process_id = 999;
```

### Calculate Total Costs Today
```sql
SELECT
  COUNT(*) as total_documents,
  SUM(no_of_pages) as total_pages,
  SUM(document_ai_cost) as total_docai,
  SUM(openai_cost) as total_openai,
  SUM(cost) as grand_total
FROM document_processed
WHERE DATE(time_initiated) = CURDATE();
```

---

## Troubleshooting

### Issue: Webhook Returns 404
**Symptom:** "The requested webhook 'POST eob-simple' is not registered"

**Check:**
1. Is workflow activated? (toggle at top right should be blue)
2. Is webhook path correct? Should be exactly `eob-simple`

**Fix:**
- Activate the workflow
- Save and reactivate if needed

---

### Issue: Node "Get Model Pricing" Fails
**Symptom:** "connect ECONNREFUSED ::1:3000" or "connect ECONNREFUSED 127.0.0.1:3000"

**Check:**
```powershell
# Test if backend is running
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/admin/openai-models/2/pricing"
```

**Fix:**
```bash
# Start backend
cd C:\n8ndata\eob-extraction-final
npm run dev
```

**Verify backend is listening on port 3000**

---

### Issue: Database Not Updating
**Symptom:** Node 9 succeeds but database shows no changes

**Check:**
1. View n8n execution logs (click on Node 9 "Send Results to DB")
2. Check response from backend:
   ```json
   {
     "message": "Process results updated successfully",
     "processId": 999
   }
   ```

**Debug:**
```sql
-- Check if process_id exists
SELECT * FROM document_processed WHERE process_id = 999;
```

**If process_id doesn't exist:**
You need to create a record first (usually done during file upload). For testing, insert manually:

```sql
INSERT INTO document_processed (
  process_id, doc_name, userid, client_id, processing_status, time_initiated
) VALUES (
  999, 'test.pdf', 1, 1, 'Pending', NOW()
);
```

---

### Issue: Wrong Costs Calculated
**Symptom:** Costs don't match expected values

**Check Pricing:**
```sql
-- Check OpenAI model pricing
SELECT model_id, model_name, model_code, input_cost_per_1k, output_cost_per_1k
FROM model_config
WHERE model_code IS NOT NULL;

-- Check Document AI pricing
SELECT config_key, config_value
FROM system_config
WHERE config_key = 'docai_cost_per_page';
```

**Expected Values:**
- GPT-4o-mini: input=$0.00015, output=$0.0006
- GPT-4o: input=$0.005, output=$0.015
- DocAI: $0.015/page

**Fix Wrong Pricing:**
```sql
UPDATE model_config SET input_cost_per_1k = 0.00015, output_cost_per_1k = 0.0006 WHERE model_id = 2;
UPDATE system_config SET config_value = '0.015' WHERE config_key = 'docai_cost_per_page';
```

---

## Next Steps: Expanding to Full Workflow

Once this simplified workflow is working, you can expand to the full workflow with:

### 1. Real Google Drive Integration
**Replace:** Node 5 "Simulate Document AI"
**With:** Nodes that:
- Download PDF from Google Drive (using drive_file_id)
- Save to local disk
- Execute Python script for Document AI
- Upload results back to Drive

### 2. Real OpenAI Extraction
**Replace:** Node 6 "Simulate OpenAI"
**With:** Real OpenAI API node that:
- Sends Document AI output to GPT-4o-mini
- Uses the EOB extraction prompt
- Returns actual structured data
- Tracks real token usage

### 3. File Management
**Add nodes for:**
- Move PDF to eob-results folder
- Rename to: `{process_id}_{original_name}.pdf`
- Upload JSON to Drive
- Upload CSV to Drive
- Store Drive URLs in database

**Estimated Time to Expand:** 2-3 hours
**Prerequisites:**
- Google Drive OAuth credentials in n8n
- OpenAI API key in n8n
- Python environment with Document AI installed

---

## Workflow Comparison

### Simplified Workflow (Current)
- **Nodes:** 9
- **External Dependencies:** Backend API only
- **Processing Time:** 2-5 seconds
- **Cost per Test:** $0.00 (simulated)
- **Use Case:** Testing cost calculation logic

### Full Workflow (Future)
- **Nodes:** 21
- **External Dependencies:** Backend API, Google Drive, OpenAI, Document AI, Python
- **Processing Time:** 30-120 seconds (depends on PDF size)
- **Cost per Test:** $0.15-$1.50 (real API costs)
- **Use Case:** Production EOB processing

---

## Success Criteria

Your simplified workflow is working correctly if:

✅ Webhook responds immediately (< 1 second)
✅ All 9 nodes show green checkmarks in execution
✅ Database `document_processed` table updates with:
   - `processing_status` = "Processed"
   - `document_ai_cost` = 0.15
   - `openai_cost` ≈ 0.0013 (GPT-4o-mini)
   - `cost` ≈ 0.1513
   - `total_records` = 2
   - `no_of_pages` = 10
   - `time_completed` is set

✅ No errors in n8n execution logs
✅ Backend logs show successful POST to `/n8n-results`
✅ Concurrent requests (3+ at once) all succeed

---

## Maintenance

### Update Pricing
**Via Admin UI:** http://localhost:3000/admin/pricing (if integrated)

**Via SQL:**
```sql
-- Update OpenAI pricing
UPDATE model_config
SET input_cost_per_1k = 0.00020, output_cost_per_1k = 0.00070
WHERE model_id = 2;

-- Update Document AI pricing
UPDATE system_config
SET config_value = '0.020'
WHERE config_key = 'docai_cost_per_page';
```

**Note:** Changes take effect immediately (next webhook call will fetch new pricing)

---

## Support

### View Execution Logs
1. Open: http://localhost:5678/executions
2. Click on any execution
3. Click on each node to see input/output
4. Check "Output" tab for data passed to next node

### Enable Debugging
**Add to any Code node:**
```javascript
console.log('Debug:', JSON.stringify(yourVariable, null, 2));
```

**View logs:** In n8n execution view, expand node → "Logs" tab

---

**Workflow Version:** 1.0
**Last Updated:** 2025-11-07
**Status:** Production Ready (for testing cost calculation logic)
