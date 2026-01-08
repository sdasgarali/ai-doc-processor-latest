# Complete n8n Workflow Setup Guide
## 3-Branch Document Processing (EOB, Facesheet, Invoice)

## Overview

This guide provides step-by-step instructions to set up a complete n8n workflow with document category routing for EOB, Facesheet, and Invoice processing.

## Workflow Structure

```
Webhook → Extract Data → Switch (Route by Category)
                              ├── Branch 1: EOB (docCategory=1)
                              ├── Branch 2: Facesheet (docCategory=2)
                              └── Branch 3: Invoice (docCategory=3)
                                      ↓
                            [All branches merge here]
                                      ↓
                          Send Results to Upload Service
```

## Setup Instructions

### Step 1: Import Base Workflow

1. Open n8n editor
2. Import `EOB_Processing_with_DocCategory_Routing_COMPLETE.json`
3. This provides the base structure with:
   - Webhook Trigger
   - Extract Process Data
   - Switch Node (configured for 3 branches)
   - Send Results node

### Step 2: Add Processing Nodes to Each Branch

Due to the complexity and size of a full workflow JSON, I recommend **manually copying** your existing processing nodes for each branch:

#### For EOB Branch (Output 0):
1. From your original workflow, copy these nodes:
   - Get Model Pricing
   - Get Document AI Cost Config
   - Wait for Drive Upload  
   - Download PDF from Drive
   - Execute Python - Document AI
   - Parse Python Output
   - OpenAI - Extract EOB Data (keep existing EOB prompt)
   - Calculate Document AI Cost
   - Calculate OpenAI Cost
   - Calculate Total Cost & Time
   - Prepare JSON
   - Prepare CSV
   - JSON to Binary
   - CSV to Binary
   - Upload JSON to eob-results
   - Upload CSV to eob-results
   - Move & Rename PDF
   - Prepare Results Payload

2. Connect Switch Output 0 (EOB) → First node of this chain
3. Connect last node → "Send Results to Upload Service"

#### For Facesheet Branch (Output 1):
1. Duplicate all EOB branch nodes
2. Rename them (add "-Facesheet" suffix)
3. **CRITICAL**: Update the OpenAI node prompt:

```javascript
{
  "role": "system",
  "content": "You are a medical document extraction expert. Extract accurate patient demographic and medical information from facesheet documents."
},
{
  "role": "user",
  "content": "Extract ALL patient demographic and medical information from this facesheet document.\nINPUT: {{ $json.data.text }}\n\nFor EACH patient record, extract:\n- patient_name, first_name, last_name\n- date_of_birth (MM/DD/YYYY)\n- medical_record_number, account_number\n- admission_date, discharge_date (MM/DD/YYYY)\n- insurance_company, insurance_id\n- diagnosis_codes, procedure_codes\n- attending_physician, facility_name\n- patient_address, phone_number\n- emergency_contact, emergency_phone\n- allergies, medications\n- Confidence_Score (0-100)\n\nReturn ONLY valid JSON with 'data' array."
}
```

4. Connect Switch Output 1 (Facesheet) → First node
5. Connect last node → "Send Results to Upload Service"

#### For Invoice Branch (Output 2):
1. Duplicate all EOB branch nodes again
2. Rename them (add "-Invoice" suffix)
3. **CRITICAL**: Update the OpenAI node prompt:

```javascript
{
  "role": "system",
  "content": "You are an invoice data extraction expert. Extract accurate billing and line item information from invoices."
},
{
  "role": "user",
  "content": "Extract ALL invoice information from this document.\nINPUT: {{ $json.data.text }}\n\nFor EACH invoice, extract:\n- invoice_number, invoice_date (MM/DD/YYYY)\n- vendor_name, vendor_address, vendor_tax_id\n- customer_name, customer_address, billing_address\n- po_number, due_date (MM/DD/YYYY)\n- line_items (array with: item_description, quantity, unit_price, line_total)\n- subtotal, tax_amount, tax_rate, shipping_cost\n- total_amount, amount_due\n- payment_terms, payment_method\n- currency, notes\n- Confidence_Score (0-100)\n\nReturn ONLY valid JSON with 'data' array containing invoice header and line items."
}
```

4. Connect Switch Output 2 (Invoice) → First node
5. Connect last node → "Send Results to Upload Service"

### Step 3: Configure Merge Node

The "Send Results to Upload Service" node accepts input from all 3 branches. n8n will automatically handle this when you connect all 3 branches to it.

**Node Configuration:**
```javascript
const results = $input.first().json;
console.log('Sending results to upload service:', results.processId);

try {
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: `http://127.0.0.1:3000/api/documents/${results.processId}/n8n-results`,
    json: true,
    body: {
      processId: results.processId,
      status: results.status,
      processingTimeSeconds: results.processingTimeSeconds,
      documentAiCost: results.documentAiCost,
      openAiCost: results.openAiCost,
      totalCost: results.totalCost,
      totalRecords: results.totalRecords,
      noOfPages: results.noOfPages,
      jsonDriveUrl: results.jsonDriveUrl || null,
      csvDriveUrl: results.csvDriveUrl || null,
      jsonDriveId: results.jsonDriveId || null,
      csvDriveId: results.csvDriveId || null
    }
  });
  
  console.log('✓ Results sent successfully');
  return [{ json: { status: 'success', response: response } }];
} catch (error) {
  console.error('✗ Failed to send results:', error.message);
  return [{ json: { status: 'error', error: error.message } }];
}
```

### Step 4: Update Database

Add Invoice category to `doc_category` table:

```sql
INSERT INTO doc_category (category_id, category_name, description, created_at)
VALUES (3, 'Invoice', 'Invoice documents', NOW())
ON DUPLICATE KEY UPDATE category_name = 'Invoice';
```

### Step 5: Test Each Branch

#### Test EOB (docCategory = 1):
```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{
    "processId": 100,
    "filename": "test_eob.pdf",
    "originalFilename": "test_eob.pdf",
    "driveFileId": "your-drive-file-id",
    "userid": 1,
    "clientId": 1,
    "sessionId": "1_20251110_140000",
    "modelId": 2,
    "docCategory": "1"
  }'
```

#### Test Facesheet (docCategory = 2):
```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{
    "processId": 101,
    "filename": "test_facesheet.pdf",
    "originalFilename": "test_facesheet.pdf",
    "driveFileId": "your-drive-file-id",
    "userid": 1,
    "clientId": 1,
    "sessionId": "1_20251110_140001",
    "modelId": 2,
    "docCategory": "2"
  }'
```

#### Test Invoice (docCategory = 3):
```bash
curl -X POST http://localhost:5678/webhook/eob-process \
  -H "Content-Type: application/json" \
  -d '{
    "processId": 102,
    "filename": "test_invoice.pdf",
    "originalFilename": "test_invoice.pdf",
    "driveFileId": "your-drive-file-id",
    "userid": 1,
    "clientId": 1,
    "sessionId": "1_20251110_140002",
    "modelId": 2,
    "docCategory": "3"
  }'
```

## Quick Setup Alternative

If you prefer not to manually configure everything, you can:

1. **Use your existing workflow** as the base
2. **Add ONLY the Switch node** after "Extract Process Data"
3. **Duplicate existing chain twice** (for Facesheet and Invoice)
4. **Modify only the OpenAI prompts** in the duplicated chains
5. **Connect all 3 outputs** to a single merge/send results node

### Quick Connection Map:

```
Extract Process Data
    ↓
Switch Node
    ├─ Output 0 → [Use existing EOB chain as-is]
    ├─ Output 1 → [Duplicate EOB chain, rename, update OpenAI prompt for Facesheet]
    └─ Output 2 → [Duplicate EOB chain, rename, update OpenAI prompt for Invoice]
           ↓
    All 3 connect to: Send Results Node
```

## Field Mappings by Document Type

### EOB Fields:
- patient_acct, Patient_ID, Claim_ID
- Patient Name, First_Name, Last Name
- member_number, service_date
- allowed_amount, paid_amount, billed_amount
- cpt_hcpcs, adjustments (CO45, CO144, CO253)
- check_number, patient_responsibility

### Facesheet Fields:
- patient_name, first_name, last_name, date_of_birth
- medical_record_number, account_number
- admission_date, discharge_date
- insurance_company, insurance_id
- diagnosis_codes, procedure_codes
- attending_physician, facility_name
- allergies, medications

### Invoice Fields:
- invoice_number, invoice_date
- vendor_name, vendor_address, vendor_tax_id
- customer_name, billing_address
- po_number, due_date
- line_items[] (description, quantity, unit_price, total)
- subtotal, tax_amount, total_amount
- payment_terms, payment_method

## Monitoring & Debugging

### Check Switch Routing:
- Monitor n8n execution logs
- Verify docCategory value in "Extract Process Data" output
- Confirm Switch node routes to correct output

### Check Processing:
- Each branch should process independently
- Monitor OpenAI token usage per branch
- Verify Document AI costs calculated correctly

### Check Results:
- Confirm results sent to upload service
- Verify data populated in `document_processed` table
- Check `extracted_data` table for parsed records

## Troubleshooting

**Issue**: Switch not routing
- Check docCategory value format (string vs number)
- Verify Switch conditions use string comparison
- Test with manual executions

**Issue**: Wrong data extracted
- Verify OpenAI prompt matches document type
- Check model temperature (should be 0 for accuracy)
- Review Document AI preprocessing output

**Issue**: Results not sent to upload service
- Check URL: `http://127.0.0.1:3000/api/documents/{processId}/n8n-results`
- Verify payload structure matches backend expectations
- Check network connectivity between n8n and backend

---

**Created**: January 10, 2025
**Files**:
- Base workflow: `EOB_Processing_with_DocCategory_Routing_COMPLETE.json`
- Setup guide: `N8N_DOC_CATEGORY_ROUTING_SETUP.md`
- Documentation: `N8N_COMPLETE_WORKFLOW_SETUP_GUIDE.md`
