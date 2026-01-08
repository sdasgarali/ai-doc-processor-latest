# EOB Processing System - Dynamic Pricing Implementation Guide

**Version:** 3.0 - Webhook-Triggered with Dynamic Cost Calculation
**Date:** 2025-11-07
**Status:** Ready for Testing

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Files Created/Modified](#files-createdmodified)
4. [Database Setup](#database-setup)
5. [n8n Workflow Setup](#n8n-workflow-setup)
6. [Backend Configuration](#backend-configuration)
7. [Frontend Integration](#frontend-integration)
8. [Testing Guide](#testing-guide)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This implementation adds **configurable pricing** and **dynamic cost calculation** to the EOB processing system:

### Key Features

✅ **Webhook-Triggered Processing** - Instant, concurrent document processing
✅ **Dynamic Cost Calculation** - Real-time pricing based on configurable models
✅ **Cost Tracking** - Per-document tracking of Document AI + OpenAI costs
✅ **Admin Configuration UI** - Update pricing without code changes
✅ **Model Selection** - Choose GPT-4o, GPT-4o-mini, or GPT-4-Turbo
✅ **Google Drive Integration** - Direct links to processed files in database

### Cost Defaults

| Service | Item | Default Cost |
|---------|------|--------------|
| **Document AI** | Per page | $0.015 |
| **GPT-4o-mini** | Input (1k tokens) | $0.00015 |
| **GPT-4o-mini** | Output (1k tokens) | $0.0006 |
| **GPT-4o** | Input (1k tokens) | $0.0050 |
| **GPT-4o** | Output (1k tokens) | $0.0150 |
| **GPT-4-Turbo** | Input (1k tokens) | $0.0100 |
| **GPT-4-Turbo** | Output (1k tokens) | $0.0300 |

**Default Model:** GPT-4o-mini (most cost-effective)

---

## Architecture Changes

### Before (Old System)

```
Upload → Local Processing → Python Script → Results
         (Single source)
```

**Issues:**
- Python and upload service both processed files
- Duplicate timestamp-suffixed files
- No cost tracking
- No concurrent processing

### After (New System)

```
Upload → Google Drive → n8n Webhook → Process → Results → Update DB
                           ↓
                   Dynamic Pricing API
                   (model_config + system_config)
```

**Benefits:**
- Single source of truth (n8n)
- Clean filename management (`{process_id}_{original_name}.pdf`)
- Real-time cost calculation
- Concurrent processing
- Configurable pricing

---

## Files Created/Modified

### Created Files

| File | Purpose |
|------|---------|
| `database/migrations/add_pricing_and_cost_tracking.sql` | Database schema for pricing and costs |
| `n8n-workflows/EOB_Processing_Webhook_v3_Dynamic_Pricing.json` | Complete n8n workflow (21 nodes) |
| `client/src/components/PricingConfiguration.jsx` | React admin UI for pricing |
| `IMPLEMENTATION_GUIDE.md` | This file |

### Modified Files

| File | Changes |
|------|---------|
| `routes/documents.js` | • Added process_id to filename<br>• Webhook trigger to n8n<br>• New `/n8n-results` endpoint<br>• Disabled old processing |
| `routes/admin.js` | • OpenAI model pricing endpoints<br>• System configuration endpoints<br>• Public endpoints for n8n |

---

## Database Setup

### Step 1: Run Migration

Execute the SQL migration script:

```bash
mysql -u your_username -p your_database_name < database/migrations/add_pricing_and_cost_tracking.sql
```

Or manually import via MySQL Workbench:
1. Open MySQL Workbench
2. Connect to your database
3. File → Open SQL Script
4. Select `add_pricing_and_cost_tracking.sql`
5. Execute

### Step 2: Verify Migration

```sql
-- Check model_config columns
DESCRIBE model_config;

-- Check system_config table
SELECT * FROM system_config;

-- Check document_processed columns
DESCRIBE document_processed;
```

You should see:
- `model_config` now has: `model_code`, `input_cost_per_1k`, `output_cost_per_1k`, `is_active`
- `system_config` table exists with `docai_cost_per_page` entry
- `document_processed` has: `json_drive_id`, `csv_drive_id`, `processed_pdf_drive_id`, `document_ai_cost`, `openai_cost`, `total_records`, `no_of_pages`

### Step 3: Verify Data

```sql
-- Check OpenAI models
SELECT model_id, model_name, model_code, input_cost_per_1k, output_cost_per_1k, is_active
FROM model_config;

-- Check system config
SELECT * FROM system_config;
```

Expected output:
- 3 models: GPT-4o, GPT-4o-mini, GPT-4-Turbo
- `docai_cost_per_page = 0.015`

---

## n8n Workflow Setup

### Step 1: Import Workflow

1. Open n8n: http://localhost:5678
2. Click "Workflows" in sidebar
3. Click "+ Add workflow" → "Import from File"
4. Select: `n8n-workflows/EOB_Processing_Webhook_v3_Dynamic_Pricing.json`
5. Click "Import"

### Step 2: Configure Credentials

The workflow requires 2 credentials:

#### A. Google Drive OAuth2

1. In workflow, click any Google Drive node
2. Click "Create New Credential"
3. Follow Google OAuth setup:
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Add redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
   - Copy Client ID and Secret
   - Paste in n8n
4. Click "Connect my account"
5. Authorize access

#### B. OpenAI API

1. Click the "OpenAI - Extract EOB Data" node
2. Create credential named "EOB-Assistant"
3. Add your OpenAI API key

### Step 3: Configure Webhook

The webhook endpoint will be: `http://localhost:5678/webhook/eob-process`

**Important:** Make sure this URL is accessible from your upload service (localhost in this case).

### Step 4: Activate Workflow

1. Toggle "Active" switch at top right
2. Workflow status should show "Active"

### Step 5: Test Webhook

```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{
    "processId": 999,
    "filename": "test.pdf",
    "originalFilename": "test.pdf",
    "driveFileId": "test-file-id",
    "userid": 1,
    "clientId": 1,
    "sessionId": "test-session",
    "modelId": 2,
    "docCategory": 1
  }'
```

---

## Backend Configuration

### Step 1: Update Environment Variables

Edit `.env` file:

```env
# n8n Configuration
N8N_WEBHOOK_URL=http://localhost:5678/webhook/eob-process

# Upload Directory
UPLOAD_DIR=./uploads

# Google Drive folder IDs (should already be configured)
GDRIVE_EOB_SOURCE_FOLDER_ID=1DJZWF93Qx_hvAO-QU6PV2hDdC7l04olK
GDRIVE_EOB_RESULTS_FOLDER_ID=140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR
```

### Step 2: Install Dependencies

Make sure `axios` is installed:

```bash
cd C:\n8ndata\eob-extraction-final
npm install axios
```

### Step 3: Restart Backend Server

```bash
npm run dev
# or
node server.js
```

Verify server starts without errors.

---

## Frontend Integration

### Step 1: Add Component to Admin Panel

Edit your admin routes file (e.g., `client/src/App.js` or admin routing):

```javascript
import PricingConfiguration from './components/PricingConfiguration';

// Add route
<Route path="/admin/pricing" element={<PricingConfiguration />} />
```

### Step 2: Add to Admin Menu

Add menu item to admin navigation:

```javascript
{
  title: 'Pricing Configuration',
  icon: <SettingsIcon />,
  path: '/admin/pricing',
  roles: ['admin', 'superadmin']
}
```

### Step 3: Build Frontend

```bash
cd client
npm install
npm run build
```

---

## Testing Guide

### Phase 1: Database & API Testing

#### Test 1: Verify Database Migration

```sql
-- Test 1A: Check model pricing
SELECT * FROM model_config WHERE model_code IS NOT NULL;

-- Test 1B: Check system config
SELECT * FROM system_config;

-- Expected: 3 models with pricing, 1 config entry for docai_cost_per_page
```

#### Test 2: Test API Endpoints

```bash
# Test 2A: Get all OpenAI models (public endpoint)
curl http://localhost:3000/api/admin/openai-models

# Test 2B: Get specific model pricing
curl http://localhost:3000/api/admin/openai-models/2/pricing

# Test 2C: Get Document AI cost
curl http://localhost:3000/api/admin/config/docai_cost_per_page

# Expected: JSON responses with pricing data
```

#### Test 3: Test Admin UI (requires authentication)

1. Login as admin user
2. Navigate to `/admin/pricing`
3. Verify:
   - Document AI cost displays correctly
   - 3 OpenAI models show with pricing
   - Edit buttons work
   - Can update and save pricing

### Phase 2: Single File Upload Test

#### Test 4: Upload Single PDF

1. **Prepare Test File**
   - Use a small PDF (2-3 pages)
   - Name: `Test_EOB_Single.pdf`

2. **Upload via UI**
   - Go to upload page: http://localhost:3000/upload
   - Select file
   - Choose model (or use default GPT-4o-mini)
   - Click Upload

3. **Verify Upload Service Response**
   ```json
   {
     "success": true,
     "message": "Document uploaded successfully and processing started",
     "process_id": 123,
     "session_id": "1_20251107_120000"
   }
   ```

4. **Check Database (Initial State)**
   ```sql
   SELECT process_id, doc_name, processing_status, model_id, gdrive_file_id
   FROM document_processed
   WHERE process_id = 123;
   ```

   Expected:
   - `doc_name`: `123_Test_EOB_Single.pdf`
   - `processing_status`: `In-Progress`
   - `gdrive_file_id`: Not null

5. **Monitor n8n Execution**
   - Go to: http://localhost:5678/executions
   - Find latest execution
   - Watch it progress through all 21 nodes
   - Check each node output

6. **Verify Final Database State**
   ```sql
   SELECT
     process_id,
     processing_status,
     json_drive_id,
     csv_drive_id,
     no_of_pages,
     document_ai_cost,
     openai_cost,
     cost as total_cost,
     total_records,
     total_processing_time,
     link_to_json,
     link_to_csv
   FROM document_processed
   WHERE process_id = 123;
   ```

   Expected:
   - `processing_status`: `Processed`
   - `json_drive_id`, `csv_drive_id`: Not null
   - `no_of_pages`: 2 or 3
   - `document_ai_cost`: ~0.03-0.045 (2-3 pages × $0.015)
   - `openai_cost`: ~0.10-0.20 (depends on tokens)
   - `total_cost`: Sum of above
   - `total_records`: Number of EOB entries found
   - `link_to_json`, `link_to_csv`: Google Drive URLs

7. **Verify Google Drive**
   - Go to eob-results folder
   - Check files exist:
     - `extracted_Test_EOB_Single.json`
     - `extracted_Test_EOB_Single.csv`
     - `Processed_Test_EOB_Single.pdf`

8. **Verify JSON Content**
   ```json
   {
     "data": [
       { ...extracted EOB fields... }
     ],
     "metadata": {
       "original_pdf": "Test_EOB_Single.pdf",
       "process_id": 123,
       "model_used": "GPT-4o-mini",
       "costs": {
         "document_ai": 0.03,
         "openai": 0.15,
         "total": 0.18
       }
     }
   }
   ```

### Phase 3: Concurrent Upload Test

#### Test 5: Upload Multiple Files Simultaneously

1. **Prepare 3-5 Test Files**
   - `Test_EOB_A.pdf`
   - `Test_EOB_B.pdf`
   - `Test_EOB_C.pdf`
   - Etc.

2. **Upload Concurrently**
   - Open multiple browser tabs
   - Upload different files simultaneously
   - OR use script:
     ```bash
     for file in Test_EOB_*.pdf; do
       curl -X POST http://localhost:3000/api/documents/upload \
         -F "file=@$file" \
         -F "doc_category=1" \
         -F "model_id=2" \
         -H "Authorization: Bearer YOUR_TOKEN" &
     done
     wait
     ```

3. **Monitor n8n Executions**
   - Should see multiple executions running in parallel
   - Each should complete independently

4. **Verify All Completed**
   ```sql
   SELECT process_id, doc_name, processing_status, cost, total_records
   FROM document_processed
   WHERE doc_name LIKE '%Test_EOB_%'
   ORDER BY process_id DESC;
   ```

   Expected: All show `Processed` status with costs calculated

### Phase 4: Cost Calculation Verification

#### Test 6: Verify Cost Accuracy

**Scenario A: GPT-4o-mini (default)**

Upload 10-page PDF:
```
Expected Document AI Cost: 10 pages × $0.015 = $0.15
Expected OpenAI Cost: ~$0.20 (varies by tokens)
Expected Total: ~$0.35
```

**Scenario B: GPT-4o (expensive model)**

Upload same 10-page PDF with `model_id=1`:
```
Expected Document AI Cost: 10 pages × $0.015 = $0.15
Expected OpenAI Cost: ~$0.67 (same tokens, higher rate)
Expected Total: ~$0.82
```

**Verify:**
```sql
SELECT
  model_id,
  no_of_pages,
  document_ai_cost,
  openai_cost,
  cost as total_cost
FROM document_processed
WHERE process_id IN (last_two_ids);
```

#### Test 7: Pricing Configuration Changes

1. **Update Document AI Cost**
   - Go to admin pricing page
   - Change cost from $0.015 to $0.020
   - Save

2. **Upload New File**
   - Upload another 10-page PDF

3. **Verify New Cost**
   ```sql
   SELECT no_of_pages, document_ai_cost
   FROM document_processed
   ORDER BY process_id DESC LIMIT 1;
   ```
   Expected: `document_ai_cost = 0.20` (10 × $0.020)

4. **Update OpenAI Pricing**
   - Change GPT-4o-mini pricing
   - Upload another file
   - Verify new OpenAI cost reflects change

### Phase 5: Error Handling Test

#### Test 8: Invalid File Test

Upload non-PDF file - should be rejected by upload service.

#### Test 9: Google Drive Failure

Temporarily disable Google Drive credentials in n8n:
- Upload should create DB record
- n8n should fail gracefully
- Status should be "Failed" with error message

#### Test 10: OpenAI Failure

Use invalid OpenAI API key:
- Document AI should complete
- OpenAI step should fail
- Error should be captured in database

---

## API Reference

### Public Endpoints (No Auth Required)

These endpoints are used by n8n to fetch pricing dynamically.

#### Get All OpenAI Models

```http
GET /api/admin/openai-models
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "model_id": 2,
      "model_name": "GPT-4o-mini",
      "model_code": "gpt-4o-mini",
      "input_cost_per_1k": 0.00015,
      "output_cost_per_1k": 0.0006,
      "is_active": true
    }
  ]
}
```

#### Get Model Pricing by ID

```http
GET /api/admin/openai-models/:modelId/pricing
```

**Example:** `GET /api/admin/openai-models/2/pricing`

**Response:**
```json
{
  "success": true,
  "data": {
    "model_id": 2,
    "model_name": "GPT-4o-mini",
    "model_code": "gpt-4o-mini",
    "input_cost_per_1k": 0.00015,
    "output_cost_per_1k": 0.0006
  }
}
```

#### Get System Configuration

```http
GET /api/admin/config/:key
```

**Example:** `GET /api/admin/config/docai_cost_per_page`

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "docai_cost_per_page",
    "value": 0.015,
    "description": "Google Document AI cost per page in USD"
  }
}
```

### Admin Endpoints (Auth Required)

#### Update Model Pricing

```http
PUT /api/admin/openai-models/:modelId/pricing
Authorization: Bearer <token>
Content-Type: application/json

{
  "input_cost_per_1k": 0.00015,
  "output_cost_per_1k": 0.0006
}
```

#### Update System Configuration

```http
PUT /api/admin/config/:key
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "0.020"
}
```

### n8n Callback Endpoint

#### Send Results Back to Upload Service

```http
POST /api/documents/:processId/n8n-results
Content-Type: application/json

{
  "status": "Processed",
  "jsonDriveUrl": "https://drive.google.com/...",
  "csvDriveUrl": "https://drive.google.com/...",
  "jsonDriveId": "file-id-123",
  "csvDriveId": "file-id-456",
  "processedPdfDriveId": "file-id-789",
  "processingTimeSeconds": 45,
  "documentAiCost": 0.15,
  "openAiCost": 0.20,
  "totalCost": 0.35,
  "totalRecords": 5,
  "noOfPages": 10
}
```

---

## Troubleshooting

### Issue 1: Webhook Not Triggering

**Symptoms:** File uploads but n8n workflow doesn't execute

**Checks:**
1. Is n8n workflow active? (Check toggle at top right)
2. Is webhook URL correct in `.env`?
   ```bash
   echo $N8N_WEBHOOK_URL
   # Should be: http://localhost:5678/webhook/eob-process
   ```
3. Check upload service logs for webhook errors
4. Test webhook directly:
   ```bash
   curl -X POST http://localhost:5678/webhook/eob-process \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

**Fix:**
- Restart n8n
- Restart upload service
- Verify webhook path in n8n workflow

### Issue 2: Cost Calculation Wrong

**Symptoms:** Costs in database don't match expected values

**Checks:**
1. Verify pricing in database:
   ```sql
   SELECT * FROM model_config WHERE model_id = 2;
   SELECT * FROM system_config WHERE config_key = 'docai_cost_per_page';
   ```
2. Check n8n execution logs:
   - Click execution
   - Check "Calculate Document AI Cost" node output
   - Check "Calculate OpenAI Cost" node output
3. Verify token counts:
   ```sql
   SELECT openai_cost, no_of_pages, document_ai_cost
   FROM document_processed
   WHERE process_id = XXX;
   ```

**Fix:**
- Update pricing via admin UI
- Re-run migration if prices are wrong

### Issue 3: Files Not Moving to eob-results

**Symptoms:** Files stay in eob-source, not renamed

**Checks:**
1. Check Google Drive credentials in n8n
2. Verify folder IDs:
   - eob-results: `140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR`
3. Check "Move & Rename PDF" node logs

**Fix:**
- Reconnect Google Drive OAuth in n8n
- Verify folder permissions

### Issue 4: Database Not Updating

**Symptoms:** n8n completes but database still shows "In-Progress"

**Checks:**
1. Check "Send Results to Upload Service" node output
2. Verify upload service received callback:
   ```bash
   # Check upload service logs
   tail -f logs/app.log | grep "n8n-results"
   ```
3. Check if process_id matches

**Fix:**
- Verify `/n8n-results` endpoint is working:
  ```bash
  curl -X POST http://localhost:3000/api/documents/123/n8n-results \
    -H "Content-Type: application/json" \
    -d '{"status": "Processed", "totalCost": 0.35}'
  ```

### Issue 5: OpenAI Errors

**Symptoms:** "OpenAI API error" in n8n logs

**Checks:**
1. Verify API key in n8n credentials
2. Check OpenAI account has credits
3. Verify model access (GPT-4o-mini should be available to all)

**Fix:**
- Update OpenAI API key in n8n
- Switch to different model
- Check OpenAI dashboard for quota issues

---

## Success Criteria Checklist

Use this checklist to verify complete implementation:

### Database Setup
- [ ] Migration executed successfully
- [ ] 3 OpenAI models exist in `model_config`
- [ ] `system_config` has `docai_cost_per_page`
- [ ] `document_processed` has all new columns

### n8n Workflow
- [ ] Workflow imported successfully
- [ ] Google Drive credentials configured
- [ ] OpenAI credentials configured
- [ ] Workflow is active
- [ ] Webhook responds to test POST

### Backend
- [ ] Upload service starts without errors
- [ ] Axios installed
- [ ] `.env` has N8N_WEBHOOK_URL
- [ ] All admin API endpoints respond correctly

### Frontend
- [ ] PricingConfiguration component accessible
- [ ] Can view current pricing
- [ ] Can update Document AI cost
- [ ] Can update OpenAI model pricing
- [ ] Changes saved successfully

### End-to-End Testing
- [ ] Single file upload completes successfully
- [ ] Database updated with all cost fields
- [ ] Files created in eob-results:
  - [ ] extracted_{name}.json
  - [ ] extracted_{name}.csv
  - [ ] Processed_{name}.pdf
- [ ] JSON contains metadata with costs
- [ ] Concurrent uploads work (3+ files simultaneously)
- [ ] Different models calculate different costs
- [ ] Pricing changes reflected in new uploads

---

## Performance Benchmarks

Expected processing times (varies by document complexity):

| Pages | Document AI | OpenAI (4o-mini) | Total Time | Cost (4o-mini) |
|-------|-------------|------------------|------------|----------------|
| 1-5 | ~10s | ~15s | ~30s | ~$0.10 |
| 6-10 | ~15s | ~25s | ~45s | ~$0.20 |
| 11-20 | ~25s | ~40s | ~70s | ~$0.35 |
| 21-50 | ~50s | ~60s | ~120s | ~$0.80 |

**Note:** Times may vary based on:
- Document complexity
- Network speed
- Google API latency
- OpenAI API queue time

---

## Next Steps After Testing

1. **Monitor Production Usage**
   - Track costs per client
   - Monitor error rates
   - Optimize prompts for accuracy

2. **Performance Optimization**
   - Consider caching for repeated documents
   - Batch processing for bulk uploads
   - Optimize OpenAI prompt for fewer tokens

3. **Feature Enhancements**
   - Email notifications on completion
   - Webhook events for real-time updates
   - Cost budgets per client
   - Detailed analytics dashboard

4. **Security**
   - Add authentication to webhook endpoint
   - Implement rate limiting
   - Add request validation

---

## Support

If you encounter issues not covered in this guide:

1. **Check Logs**
   - Upload service: `logs/app.log`
   - n8n: Execution logs in UI
   - Database: MySQL slow query log

2. **Debug Mode**
   Enable debug logging in `.env`:
   ```env
   DEBUG=true
   LOG_LEVEL=debug
   ```

3. **Contact**
   - Review execution logs in n8n
   - Check database state with provided SQL queries
   - Verify all configuration values

---

## Changelog

### Version 3.0 (2025-11-07)
- ✅ Added webhook-triggered processing
- ✅ Implemented dynamic cost calculation
- ✅ Created admin pricing configuration UI
- ✅ Added process_id to filenames
- ✅ Removed timestamp suffixes
- ✅ Added Google Drive URL storage
- ✅ Implemented concurrent processing support

### Version 2.0 (Previous)
- Basic n8n workflow with polling
- Fixed filename issues
- Added Document AI integration

### Version 1.0 (Original)
- Upload service with local processing
- Basic EOB extraction

---

**Implementation Status:** ✅ Complete - Ready for Testing

**Next Action:** Proceed with Phase 1 testing (Database & API verification)
