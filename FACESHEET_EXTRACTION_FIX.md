# Facesheet Extraction Issue - Diagnosis & Fix

## Problem
When uploading facesheet file `Zaina_Mussa_phil_v5.pdf`, the workflow produces empty results:
- `data: []` (no extracted data)
- OpenAI tokens: 0 (OpenAI never called)
- Document AI worked (2 pages processed)

## Root Causes & Solutions

### Issue 1: Wrong Document Category
**Check**: Was the file uploaded with `docCategory = "2"` for Facesheet?

**How to Verify:**
1. Check the upload portal - ensure Facesheet is selected
2. Check n8n execution log for the "Extract Process Data" node output
3. Look for: `"docCategory": "2"`

**If docCategory was "1":**
- File went to EOB branch (wrong prompt)
- EOB prompt returned no results for facesheet document
- **Solution**: Re-upload with correct category selection

### Issue 2: OpenAI Node Not Connected
**Check**: Is the OpenAI node connected in the Facesheet branch?

**How to Verify:**
1. Open n8n workflow
2. Trace from Switch Node Output 1 (Facesheet)
3. Verify these nodes are connected in sequence:
   - Parse Python Output → OpenAI Extract → Calculate OpenAI Cost

**If disconnected:**
- **Solution**: Connect the OpenAI node between Parse Python Output and Calculate OpenAI Cost

### Issue 3: Wrong OpenAI Prompt
**Check**: Does the OpenAI node have the EOB prompt or Facesheet prompt?

**Correct Facesheet Prompt Should Be:**
```javascript
System Message:
"You are a medical document extraction expert. Extract accurate patient demographic and medical information from facesheet documents."

User Message:
"Extract ALL patient demographic and medical information from this facesheet document.
INPUT: {{ $json.data.text }}

For EACH patient record, extract these fields (return \"\" if not found):

- patient_name: Full patient name
- first_name: Patient first name  
- last_name: Patient last name
- date_of_birth: Date of birth (MM/DD/YYYY format)
- medical_record_number: Medical record number (MRN)
- account_number: Account number
- admission_date: Date of admission (MM/DD/YYYY format)
- discharge_date: Date of discharge (MM/DD/YYYY format)
- insurance_company: Primary insurance company name
- insurance_id: Insurance policy/member ID
- diagnosis_codes: List of ICD-10 diagnosis codes (comma-separated)
- procedure_codes: List of CPT procedure codes (comma-separated)
- attending_physician: Name of attending physician
- facility_name: Healthcare facility name
- patient_address: Full patient address
- phone_number: Patient contact phone
- emergency_contact: Emergency contact name
- emergency_phone: Emergency contact phone
- allergies: Known allergies (comma-separated)
- medications: Current medications list (comma-separated)
- Confidence_Score: Your confidence in the accuracy of this extraction (0-100)

IMPORTANT RULES:
- Return \"\" (empty string) for any field not found, NOT \"N/A\"
- Return dates in MM/DD/YYYY format
- Return lists as comma-separated strings
- Extract all legible information accurately
- If field label is not found, search for similar labels
- Be thorough - check entire document

Return ONLY valid JSON with 'data' array containing one object per patient."
```

## Immediate Fix Steps

### Step 1: Check n8n Execution Log
1. Open n8n
2. Click on the failed execution
3. Click on "Extract Process Data" node
4. Check the output - look for `docCategory` value
5. Note what value it has

### Step 2: If docCategory Was Correct ("2")

**Then the issue is in the workflow configuration:**

1. **Check OpenAI Node Connection:**
   - Find the Facesheet branch (middle branch from Switch)
   - Verify "Parse Python Output - Facesheet" → "OpenAI Extract - Facesheet"
   - If missing, connect them

2. **Check OpenAI Node Configuration:**
   - Click on the OpenAI node in Facesheet branch
   - Verify the prompt matches the Facesheet prompt above
   - If it has EOB-related text, update it to Facesheet prompt

3. **Check Input to OpenAI:**
   - Click "Execute Previous Nodes"
   - Check if `$json.data.text` has the document text
   - If empty, the Python parsing step might have failed

### Step 3: If docCategory Was Wrong ("1" or missing)

**Then the issue is in the upload:**

1. **Check Upload Portal:**
   ```javascript
   // In client/src/pages/Upload.js
   // Ensure Facesheet category is selected
   // Should send: docCategory: "2"
   ```

2. **Check Doc Category Table:**
   ```sql
   SELECT * FROM doc_category WHERE category_name = 'Facesheet';
   -- Should return category_id = 2
   ```

3. **Re-upload with correct category**

## Testing the Fix

### Test 1: Manual n8n Execution
```json
{
  "processId": 100,
  "filename": "test_facesheet.pdf",
  "originalFilename": "Zaina_Mussa_phil_v5.pdf",
  "driveFileId": "your-file-id",
  "userid": 1,
  "clientId": 1,
  "sessionId": "1_20251110_150000",
  "modelId": 2,
  "docCategory": "2"
}
```

### Test 2: Check Expected Output
After fixing, the JSON should contain:
```json
{
  "data": [
    {
      "patient_name": "Zaina Mussa",
      "first_name": "Zaina",
      "last_name": "Mussa",
      "date_of_birth": "...",
      "medical_record_number": "...",
      "admission_date": "...",
      "insurance_company": "...",
      // ... other facesheet fields
    }
  ],
  "metadata": {
    "total_records": 1,
    "tokens": {
      "input": 5000,  // Should be > 0
      "output": 500   // Should be > 0
    }
  }
}
```

## Quick Diagnostic Checklist

- [ ] Verify docCategory = "2" in upload
- [ ] Verify Switch routes to Facesheet branch (Output 1)
- [ ] Verify OpenAI node exists in Facesheet branch
- [ ] Verify OpenAI node is connected
- [ ] Verify OpenAI node has Facesheet prompt (not EOB prompt)
- [ ] Verify Parse Python Output produces text
- [ ] Verify OpenAI credentials are configured
- [ ] Verify model is set to GPT-4o or GPT-4o-mini
- [ ] Verify jsonOutput is enabled in OpenAI node
- [ ] Verify temperature is set to 0

## Common Mistakes

### Mistake 1: Duplicated EOB Chain Without Updating Prompt
**Problem**: Copy-pasted EOB chain but forgot to change OpenAI prompt
**Solution**: Update the prompt to extract facesheet-specific fields

### Mistake 2: Wrong docCategory Value
**Problem**: Portal sends string "Facesheet" instead of "2"
**Solution**: Ensure portal sends the category_id, not category_name

### Mistake 3: Missing Node Connection
**Problem**: Nodes exist but aren't connected in sequence
**Solution**: Wire nodes in correct order

## Need More Help?

Run this diagnostic query:
```sql
SELECT 
  process_id,
  original_filename,
  doc_category,
  processing_status,
  total_records,
  openai_cost,
  document_ai_cost
FROM document_processed 
WHERE process_id = 80;
```

Check the `doc_category` value. If it's "1", the file went to EOB branch.

---

**Created**: January 10, 2025  
**Issue**: Process ID 80 - Zaina_Mussa_phil_v5.pdf extraction failure
