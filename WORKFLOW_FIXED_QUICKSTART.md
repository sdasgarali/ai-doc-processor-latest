# EOB Workflow FIXED - Quick Start

**Status:** ✅ All Issues Fixed and Ready to Import
**File:** `n8n-workflows/EOB_Processing_Webhook_v3_FIXED.json`

---

## What Was Fixed

✅ **3 HTTP Request nodes** → Replaced with Code nodes (no more "Invalid URL" error)
✅ **All `localhost` references** → Changed to `127.0.0.1` (IPv4, no connection issues)
✅ **Send Results node** → Simplified with JSON body + error handling
✅ **Backend APIs** → Tested and working

---

## Import Now (5 Minutes)

### Step 1: Import Fixed Workflow
1. Open n8n: http://localhost:5678
2. **Add Workflow** → **Import from File**
3. Select: `C:\n8ndata\eob-extraction-final\n8n-workflows\EOB_Processing_Webhook_v3_FIXED.json`
4. Save and **Activate** (toggle must be blue)

### Step 2: Test API Nodes (No credentials needed)
```powershell
# Test the webhook
Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-process" -Method Post -Body '{"processId": 9999, "modelId": 2, "filename": "test.pdf", "originalFilename": "test.pdf", "driveFileId": "fake-id"}' -ContentType "application/json"
```

**Expected:**
- Response: "Workflow was started"
- Check execution: http://localhost:5678/executions
- Nodes 1-4 should be **green** (API calls working!)
- Node 5 will fail (expected - no Google Drive file)

### Step 3: Configure Credentials (When Ready for Real Processing)

**Google Drive OAuth2** (needed by 4 nodes):
- Click any Google Drive node
- Select or create "Google Drive OAuth2" credential

**OpenAI API** (needed by 1 node):
- Click "OpenAI - Extract EOB Data" node
- Select or create "EOB-Assistant" credential

---

## What Each Node Does

| # | Node Name | Type | What It Does | Needs Credentials? |
|---|-----------|------|--------------|-------------------|
| 1 | Webhook Trigger | Webhook | Receives POST from backend | No |
| 2 | Extract Process Data | Code | Parses webhook data | No |
| **3** | **Get Model Pricing** | **Code** (FIXED) | **Fetches OpenAI pricing from API** | **No** |
| **4** | **Get DocAI Cost Config** | **Code** (FIXED) | **Fetches DocAI cost from API** | **No** |
| 5 | Wait for Drive Upload | Code | Waits 2 seconds for file | No |
| 6 | Download PDF from Drive | Google Drive | Downloads uploaded PDF | Yes - Google Drive |
| 7 | Execute Python - Document AI | Execute Command | Runs Python script for OCR | No (needs Python) |
| 8 | Calculate Document AI Cost | Code | Calculates DocAI cost | No |
| 9 | Parse Python Output | Code | Extracts JSON from Python | No |
| 10 | OpenAI - Extract EOB Data | OpenAI | Extracts structured data | Yes - OpenAI API |
| 11 | Calculate OpenAI Cost | Code | Calculates OpenAI cost | No |
| 12 | Calculate Total Cost & Time | Code | Sums all costs | No |
| 13 | Prepare JSON | Code | Formats JSON output | No |
| 14 | Prepare CSV | Code | Converts to CSV | No |
| 15 | JSON to Binary | Code | Prepares for upload | No |
| 16 | CSV to Binary | Code | Prepares for upload | No |
| 17 | Upload JSON to eob-results | Google Drive | Uploads JSON file | Yes - Google Drive |
| 18 | Upload CSV to eob-results | Google Drive | Uploads CSV file | Yes - Google Drive |
| 19 | Move & Rename PDF | Google Drive | Moves PDF to results | Yes - Google Drive |
| 20 | Prepare Results Payload | Code | Formats database payload | No |
| **21** | **Send Results to Upload Service** | **Code** (FIXED) | **POSTs to backend database** | **No** |

**Nodes that were fixed:** 3, 4, 21 (marked in bold)

---

## Success Criteria

### ✅ After Import & Test (Step 2)
- Webhook responds: "Workflow was started"
- Nodes 1-4 are green in execution view
- Node 3 output shows: `{"data":{"model_name":"GPT-4o-mini",...}}`
- Node 4 output shows: `{"data":{"key":"docai_cost_per_page","value":0.015}}`

### ✅ After Full Configuration (All Credentials)
- All 21 nodes turn green
- Database updated with status "Processed"
- Files appear in Google Drive eob-results folder

---

## Troubleshooting

### "Webhook not registered"
- Make sure workflow is **Activated** (blue toggle)
- Save and re-activate if needed

### Node 3 or 4 fails
- Check backend: `curl http://127.0.0.1:3000/api/admin/openai-models/2/pricing`
- If backend not responding, restart: `cd C:\n8ndata\eob-extraction-final && npm run dev`

### Node 6 fails (Google Drive)
- Expected during testing with fake file ID
- Configure Google Drive credentials for real files

---

## Files Delivered

- **`EOB_Processing_Webhook_v3_FIXED.json`** - Fixed workflow (import this!)
- **`WORKFLOW_FIXES_APPLIED.md`** - Detailed documentation of all fixes
- **`WORKFLOW_FIXED_QUICKSTART.md`** - This file (quick start guide)

---

## Next Steps

1. ✅ Import workflow (Step 1)
2. ✅ Test API nodes (Step 2)
3. ⏱️ Configure Google Drive credentials (when ready)
4. ⏱️ Configure OpenAI credentials (when ready)
5. ⏱️ Test with real file upload (end-to-end)

---

**The workflow is fixed and ready to use!**
**All known issues have been resolved.**

For detailed explanation of what was fixed, see: `WORKFLOW_FIXES_APPLIED.md`
