# Facesheet Extraction Returns Zero Data - Debug Guide

## Problem
Facesheet file `4875cb6b7514d6ed3ecab322329193f6_FS_from_ticket_#9916392.pdf` produces empty JSON with `data: []`

## Step-by-Step Debugging

### Step 1: Check if OpenAI Was Called

**In n8n:**
1. Open the failed execution
2. Find the "OpenAI Extract" node (or "OpenAI Extract - Facesheet")
3. Check the output
4. Look for `usage.prompt_tokens` and `usage.completion_tokens`

**If tokens = 0 or node didn't execute:**
- OpenAI was never called
- Go to **Issue A** below

**If tokens > 0 but data is empty:**
- OpenAI was called but returned no data
- Go to **Issue B** below

---

## Issue A: OpenAI Not Called (tokens = 0)

### Possible Causes:

#### A1: Wrong Document Category
**Check:** Was file uploaded with `docCategory = "2"`?
```sql
SELECT process_id, doc_category, openai_cost 
FROM document_processed 
WHERE original_filename LIKE '%4875cb6b%';
```

If `doc_category = 1`, the file went to EOB branch.
**Fix:** Re-upload with Facesheet category selected.

#### A2: OpenAI Node Not Connected
**Check:** Is OpenAI node connected in the Facesheet branch?
1. Open workflow
2. Trace from "Parse Python Output" → "OpenAI Extract" → "Calculate OpenAI Cost"
3. Verify all connections exist

**Fix:** Connect the nodes properly.

#### A3: Document AI Produced No Text
**Check:** Click on "Parse Python Output" node
- Look for `$json.data.text`
- Is it empty or very short?

**Fix:** Document AI failed to extract text. Check:
- Is PDF readable (not scanned image)?
- Is PDF corrupted?
- Try opening PDF manually to verify

---

## Issue B: OpenAI Called But Returned Empty Data

This is the most likely issue. OpenAI is being too strict or the prompt doesn't match the document format.

### Debug OpenAI Response:

1. **In n8n execution, click on OpenAI node**
2. **Look at the output**
3. **Check what OpenAI actually returned**

You might see something like:
```json
{
  "data": [],
  "message": "No facesheet data found" 
}
```

### Root Cause: Prompt Too Strict or Doesn't Match Document

**Solution: Use More Flexible Facesheet Prompt**

Replace your OpenAI Facesheet prompt with this more flexible version:

```javascript
System Message:
"You are an expert medical document analyst. Your task is to extract ANY and ALL information from medical documents, especially facesheets, admission forms, and patient information sheets. Be flexible and comprehensive."

User Message:
"Analyze this medical document and extract ALL available information.
INPUT: {{ $json.data.text }}

This document may be a facesheet, admission form, patient information sheet, or similar medical document.

Extract ALL available fields. Return \"\" for fields not found:

PATIENT INFORMATION:
- patient_name: Full name (try: Patient, Patient Name, Name, Pt Name)
- first_name: First name
- last_name: Last name  
- middle_name: Middle name or initial
- date_of_birth: DOB (try: DOB, Date of Birth, Birth Date, formats: MM/DD/YYYY, YYYY-MM-DD)
- age: Patient age
- gender: Gender/Sex (M/F/Male/Female)
- ssn: Social Security Number
- medical_record_number: MRN (try: MRN, Medical Record #, MR#, Record Number)
- account_number: Account # (try: Account, Acct #, Account Number)
- patient_id: Any other patient identifier

CONTACT INFORMATION:
- patient_address: Full address (street, city, state, zip)
- street_address: Street address only
- city: City
- state: State
- zip_code: ZIP code
- phone_number: Phone (try: Phone, Tel, Telephone, Cell, Mobile)
- email: Email address

ADMISSION/VISIT INFORMATION:
- admission_date: Admission date (try: Admit Date, Admission, Date Admitted)
- discharge_date: Discharge date (try: Discharge, Date Discharged)
- visit_date: Visit date
- admission_type: Type (Emergency, Elective, etc.)
- room_number: Room/Bed number
- facility_name: Hospital/facility name
- facility_address: Facility address

INSURANCE INFORMATION:
- insurance_company: Primary insurance (try: Insurance, Payer, Insurance Co)
- insurance_id: Policy/Member ID (try: Policy #, Member ID, Subscriber ID)
- insurance_group: Group number
- subscriber_name: Subscriber/policyholder name
- subscriber_relationship: Relationship to patient
- secondary_insurance: Secondary insurance company
- secondary_insurance_id: Secondary policy ID

MEDICAL INFORMATION:
- diagnosis_codes: ICD-10 codes (comma-separated)
- primary_diagnosis: Main diagnosis description
- secondary_diagnoses: Additional diagnoses (comma-separated)
- procedure_codes: CPT codes (comma-separated)
- procedures: Procedure descriptions (comma-separated)
- allergies: Known allergies (comma-separated)
- medications: Current medications (comma-separated)
- chief_complaint: Chief complaint/reason for visit

PROVIDER INFORMATION:
- attending_physician: Attending/primary physician name
- referring_physician: Referring physician
- consulting_physician: Consulting physician
- primary_care_physician: PCP name

EMERGENCY CONTACT:
- emergency_contact: Emergency contact name
- emergency_relationship: Relationship
- emergency_phone: Emergency contact phone
- emergency_address: Emergency contact address

OTHER:
- notes: Any other important information
- special_instructions: Special instructions or notes
- code_status: Code status (Full Code, DNR, etc.)
- advanced_directives: Advanced directives information
- language: Preferred language
- interpreter_needed: Yes/No
- Confidence_Score: Your confidence (0-100)

IMPORTANT INSTRUCTIONS:
1. Be FLEXIBLE with field labels - look for similar terms
2. Extract EVERYTHING you can find - don't be strict about format
3. If you find a field but the label doesn't exactly match, extract it anyway
4. For dates, accept ANY date format and convert to MM/DD/YYYY
5. Return \"\" only if the field is truly not in the document
6. Look in headers, footers, sidebars - check the ENTIRE document
7. If a section is labeled differently (e.g., \"Guarantor\" instead of \"Emergency Contact\"), extract it
8. Extract partial information if complete information isn't available

Return ONLY valid JSON with this structure:
{
  \"data\": [
    {
      // All fields here
    }
  ]
}

If you find ANY patient information AT ALL, include it in the data array. Only return empty array if the document truly contains no extractable information."
```

### Why This Works Better:

1. **More Flexible**: Looks for similar field names
2. **Comprehensive**: Lists many possible field variations
3. **Less Strict**: Accepts partial information
4. **Better Instructions**: Tells OpenAI to be thorough
5. **Handles Different Formats**: Works with various facesheet layouts

---

## Step 2: Test Document AI Output

### Check if Document AI Extracted Text:

1. In n8n, click on "Parse Python Output" node
2. Look at the output JSON
3. Check `$json.data.text` - is there text content?

**If text is empty or very short:**
- The PDF might be a scanned image
- Document AI failed to OCR it
- **Solution**: Check if PDF needs pre-processing or better OCR

**If text exists but OpenAI returns nothing:**
- The prompt is too strict
- Use the flexible prompt above

---

## Step 3: Check Document Format

### Manual Inspection:
1. Open the PDF: `4875cb6b7514d6ed3ecab322329193f6_FS_from_ticket_#9916392.pdf`
2. Look for:
   - Is it a standard facesheet?
   - Is it readable (not blurry)?
   - What fields are actually present?
   - Are labels clearly marked?

### Common Issues:
- **Handwritten forms**: Hard for OCR to read
- **Poor quality scans**: Blurry or low resolution
- **Non-standard layouts**: OpenAI doesn't recognize the format
- **Multiple pages**: Patient info might be on page 2

---

## Step 4: Enable Debug Logging

### Add Debug Node After OpenAI:

Add a Code node after OpenAI with:
```javascript
const aiResponse = $input.first().json;

console.log('=== OPENAI RESPONSE DEBUG ===');
console.log('Full response:', JSON.stringify(aiResponse, null, 2));
console.log('Message:', aiResponse.message?.content || aiResponse.choices?.[0]?.message?.content);
console.log('Usage:', aiResponse.usage);

return [$input.first()];
```

This will show you EXACTLY what OpenAI returned.

---

## Quick Fix Checklist

- [ ] Verify `docCategory = "2"` in database
- [ ] Verify OpenAI node exists and is connected
- [ ] Check OpenAI node has Facesheet prompt (not EOB)
- [ ] Verify `usage.prompt_tokens > 0` (OpenAI was called)
- [ ] Replace with flexible prompt above
- [ ] Check Document AI output has text
- [ ] Open PDF manually to verify it's readable
- [ ] Enable debug logging to see OpenAI response
- [ ] Check OpenAI temperature = 0 for consistency
- [ ] Verify model is GPT-4o or GPT-4o-mini

---

## Expected Result After Fix

```json
{
  "data": [
    {
      "patient_name": "John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "01/15/1980",
      "medical_record_number": "MRN123456",
      "admission_date": "11/10/2025",
      "insurance_company": "Blue Cross",
      "insurance_id": "BC12345678",
      "attending_physician": "Dr. Smith",
      // ... other fields
      "Confidence_Score": 95
    }
  ],
  "metadata": {
    "total_records": 1,
    "tokens": {
      "input": 8000,
      "output": 600
    }
  }
}
```

---

## Still Not Working?

If you've tried everything above:

1. **Export n8n execution data** (click on execution → Download)
2. **Check the OpenAI node output** - what did it actually return?
3. **Share the Document AI text output** - is text being extracted?
4. **Try with a different facesheet** - does ANY facesheet work?

The issue is either:
- Wrong category routing
- Missing/disconnected OpenAI node  
- Prompt too strict (most common)
- Document AI not extracting text
- OpenAI credentials/API issue

---

**Created**: January 10, 2025  
**File**: 4875cb6b7514d6ed3ecab322329193f6_FS_from_ticket_#9916392.pdf
**Issue**: Zero data extracted from facesheet
