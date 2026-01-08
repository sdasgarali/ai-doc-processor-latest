# n8n Document Category Routing Setup Guide

## Current Issue
The workflow file `EOB_Processing_DocAI_OpenAI_Webhook_integrated_with_Portal copy.json` has:
- "Extract Process Data" node with NO outgoing connections
- 3 duplicate processing chains (EOB, EOB1, EOB2) that are never reached
- No branching logic based on `docCategory`

## Solution: Add Switch Node for Document Category Routing

### Step 1: Add Switch Node After "Extract Process Data"

**Node Configuration:**
```
Node Type: Switch (n8n-nodes-base.switch)
Node Name: Route by Document Category
Position: After "Extract Process Data" (-1700, -144)
```

**Switch Rules Configuration:**
```javascript
{
  "rules": {
    "rules": [
      {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{ $json.docCategory }}",
              "rightValue": "1",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true,
        "outputKey": "EOB"
      },
      {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{ $json.docCategory }}",
              "rightValue": "2",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "renameOutput": true,
        "outputKey": "Facesheet"
      }
    ]
  },
  "options": {
    "fallbackOutput": "extra"
  }
}
```

### Step 2: Connect Nodes

**Add these connections in the JSON:**

1. **Extract Process Data → Route by Document Category**
   ```json
   "Extract Process Data": {
     "main": [
       [
         {
           "node": "Route by Document Category",
           "type": "main",
           "index": 0
         }
       ]
     ]
   }
   ```

2. **Route by Document Category → Get Model Pricing (EOB branch, output 0)**
   ```json
   "Route by Document Category": {
     "main": [
       [
         {
           "node": "Get Model Pricing",
           "type": "main",
           "index": 0
         }
       ],
       [
         {
           "node": "Get Model Pricing2",
           "type": "main",
           "index": 0
         }
       ],
       []
     ]
   }
   ```

### Step 3: Rename Processing Chains

For clarity, rename the duplicate chains:

**Branch 1 (docCategory = "1" - EOB):**
- Uses existing nodes: Get Model Pricing → ... → OpenAI - Extract EOB Data1
- Keep these nodes as-is (they're configured for EOB extraction)

**Branch 2 (docCategory = "2" - Facesheet):**
- Uses: Get Model Pricing2 → ... → OpenAI - Extract EOB Data2
- Modify the OpenAI prompt for Facesheet-specific extraction

**Branch 3 (Unused):**
- Delete the third duplicate chain (Get Model Pricing1, etc.)

### Step 4: Modify Facesheet Branch OpenAI Prompt

Update the **"OpenAI - Extract EOB Data2"** node's prompt for Facesheet processing:

```javascript
{
  "content": "Extract ALL patient demographic and medical information from this facesheet document.\nINPUT: {{ $json.data.text }}\n\nFor EACH patient record, extract these fields (return \"\" if not found):\n\n- patient_name: Full patient name\n- first_name: Patient first name\n- last_name: Patient last name  \n- date_of_birth: Date of birth (MM/DD/YYYY format)\n- medical_record_number: Medical record number (MRN)\n- account_number: Account number\n- admission_date: Date of admission (MM/DD/YYYY format)\n- discharge_date: Date of discharge (MM/DD/YYYY format)\n- insurance_company: Primary insurance company name\n- insurance_id: Insurance policy/member ID\n- diagnosis_codes: List of ICD-10 diagnosis codes\n- procedure_codes: List of CPT procedure codes\n- attending_physician: Name of attending physician\n- facility_name: Healthcare facility name\n- patient_address: Full patient address\n- phone_number: Patient contact phone\n- emergency_contact: Emergency contact name\n- emergency_phone: Emergency contact phone\n- allergies: Known allergies\n- medications: Current medications list\n- Confidence_Score: Your confidence in accuracy (0-100)\n\nIMPORTANT RULES:\n- Return \"\" (empty string) for any field not found\n- Return dates in MM/DD/YYYY format\n- Return arrays as comma-separated strings\n- Extract all legible information accurately\n\nReturn ONLY valid JSON with 'data' array.",
  "role": "user"
}
```

## Complete Node Setup Instructions

### 1. Open n8n Workflow Editor

1. Import the workflow JSON file
2. Click on the canvas to add a new node

### 2. Add Switch Node

1. Click **"+"** after "Extract Process Data"
2. Search for **"Switch"**
3. Configure as shown above
4. Set position: x=-1700, y=-144

### 3. Connect Switch Outputs

**Output 0 (EOB)** → Connect to "Get Model Pricing"
**Output 1 (Facesheet)** → Connect to "Get Model Pricing2"  
**Output 2 (Fallback)** → Leave unconnected or add error handling

### 4. Test the Routing

Send test webhooks with different docCategory values:

**Test EOB (docCategory = "1"):**
```json
{
  "processId": 100,
  "filename": "test_eob.pdf",
  "driveFileId": "abc123",
  "docCategory": "1",
  ...
}
```

**Test Facesheet (docCategory = "2"):**
```json
{
  "processId": 101,
  "filename": "test_facesheet.pdf",
  "driveFileId": "def456",
  "docCategory": "2",
  ...
}
```

## Visual Flow Diagram

```
Webhook Trigger
      ↓
Extract Process Data
      ↓
Route by Document Category (SWITCH)
      ├── Output 0: EOB (docCategory = "1")
      │        ↓
      │   Get Model Pricing
      │        ↓
      │   [EOB Processing Chain]
      │        ↓
      │   OpenAI - Extract EOB Data1
      │        ↓
      │   [Results & Upload]
      │
      └── Output 1: Facesheet (docCategory = "2")
               ↓
          Get Model Pricing2
               ↓
          [Facesheet Processing Chain]
               ↓
          OpenAI - Extract EOB Data2 (Modified Prompt)
               ↓
          [Results & Upload]
```

## Database Reference

Document categories from `doc_category` table:
- `1` = EOB (Explanation of Benefits)
- `2` = Facesheet
- Add more as needed

## Benefits of This Approach

1. **Single Workflow**: One workflow handles multiple document types
2. **Easy to Extend**: Add more categories by adding switch outputs
3. **Type-Specific Processing**: Each document type gets customized extraction
4. **Cost Efficient**: Shares common nodes (webhook, file download, cost calc)
5. **Maintainable**: Clear separation of processing logic

## Next Steps

1. Import/update the workflow in n8n
2. Add the Switch node with configuration above
3. Connect Extract Process Data → Switch
4. Connect Switch outputs to respective processing chains
5. Update Facesheet branch OpenAI prompt
6. Delete unused duplicate chain (Branch 3)
7. Test with sample documents
8. Monitor processing logs

## Troubleshooting

**Issue**: Switch not routing correctly
- Check docCategory value format (string "1" vs number 1)
- Verify Switch conditions use correct comparison
- Check webhook payload structure

**Issue**: Facesheet extraction not working
- Verify OpenAI prompt is updated for facesheet fields
- Check Python Document AI output structure
- Test with sample facesheet document

---

**Created**: January 10, 2025
**Workflow**: EOB_Processing_DocAI_OpenAI_Webhook_integrated_with_Portal copy.json
