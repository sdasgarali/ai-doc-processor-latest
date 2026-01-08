# Webhook Data Summary - File Upload Flow

## Overview
When a file is uploaded through http://localhost:3000/upload, the system triggers an n8n webhook after successfully uploading the file to Google Drive.

## Upload Flow Sequence

1. **User uploads file** via frontend (http://localhost:3000/upload)
2. **Backend receives file** at endpoint: `POST /api/documents/upload`
3. **File processing**:
   - Validates file (PDF only)
   - Checks if filename starts with "Processed_" (rejects if true)
   - Creates database record with status "In-Progress"
   - Renames file to include process_id: `{process_id}_{originalFilename}`
   - Uploads file to Google Drive (async)
4. **After successful Google Drive upload**, triggers n8n webhook
5. **n8n processes the document** and returns results

## Webhook Details

### Webhook URL
```
Default: http://localhost:5678/webhook/eob-process
Configured via: process.env.N8N_WEBHOOK_URL
```

### HTTP Method
```
POST
```

### Webhook Payload Structure

```json
{
  "processId": 123,
  "filename": "123_document.pdf",
  "originalFilename": "document.pdf",
  "driveFileId": "1ABC123xyz456def789",
  "userid": 5,
  "clientId": 2,
  "sessionId": "5_20251110_140530",
  "modelId": 2,
  "docCategory": "1"
}
```

## Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `processId` | Number | Auto-generated database ID for this processing job | `123` |
| `filename` | String | Renamed filename with process_id prefix | `"123_EOB-Document.pdf"` |
| `originalFilename` | String | Original uploaded filename | `"EOB-Document.pdf"` |
| `driveFileId` | String | Google Drive file ID after upload | `"1ABC123xyz456def789"` |
| `userid` | Number | User ID who uploaded the file | `5` |
| `clientId` | Number | Client ID associated with the user | `2` |
| `sessionId` | String | Unique session identifier | `"5_20251110_140530"` |
| `modelId` | Number | AI model ID for processing (default: 2 = GPT-4o-mini) | `2` |
| `docCategory` | String | Document category ID (1=EOB, 2=Facesheet, etc.) | `"1"` |

## Session ID Format
```
{userid}_{YYYYMMDD}_{HHmmss}
Example: 5_20251110_140530
```

## Model ID Options
- `2` - GPT-4o-mini (default if not specified)
- Other model IDs configured in model_config table

## Document Categories
- `1` - EOB (Explanation of Benefits)
- `2` - Facesheet
- (Other categories defined in doc_category table)

## Code Location
**File:** `routes/documents.js`
**Lines:** ~127-149

```javascript
// Trigger n8n webhook AFTER successful Google Drive upload
try {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/eob-process';

  await axios.post(
    webhookUrl,
    {
      processId: processId,
      filename: newFilename,
      originalFilename: req.file.originalname,
      driveFileId: driveResult.fileId,
      userid: req.user.userid,
      clientId: req.user.client_id,
      sessionId: sessionId,
      modelId: selectedModelId,
      docCategory: doc_category
    },
    { timeout: 5000 }
  );

  console.log(`✓ Triggered n8n processing for process_id: ${processId}, model: ${selectedModelId}`);
} catch (webhookError) {
  console.error('Failed to trigger n8n webhook:', webhookError.message);
  // Updates status to Failed if webhook fails
}
```

## Important Notes

1. **Webhook Trigger Timing**: The webhook is triggered ONLY AFTER successful Google Drive upload, not immediately after file upload to the server.

2. **Async Processing**: The Google Drive upload and webhook trigger happen asynchronously (non-blocking), so the user receives a success response immediately.

3. **Error Handling**: 
   - If Google Drive upload fails → Document status set to "Failed"
   - If webhook call fails → Document status set to "Failed"
   - Timeout set to 5 seconds for webhook call

4. **Response to User**: User receives immediate response with:
   ```json
   {
     "success": true,
     "message": "Document uploaded successfully and processing started",
     "process_id": 123,
     "session_id": "5_20251110_140530"
   }
   ```

5. **Database State**: At webhook trigger time:
   - Document record exists in `document_processed` table
   - Status is "In-Progress"
   - Google Drive file ID is stored in `gdrive_file_id` field

## Webhook Return Flow

After n8n processes the document, it calls back to:
```
POST /api/documents/:processId/n8n-results
```

With results including:
- `status` - "Processed" or "Failed"
- `jsonDriveUrl` - Google Drive URL for JSON results
- `csvDriveUrl` - Google Drive URL for CSV results
- `jsonDriveId` - Google Drive file ID for JSON
- `csvDriveId` - Google Drive file ID for CSV
- `processingTimeSeconds` - Total processing time
- `documentAiCost` - Cost from Document AI
- `openAiCost` - Cost from OpenAI
- `totalCost` - Combined cost
- `totalRecords` - Number of records extracted
- `noOfPages` - Number of pages in document

## Testing the Webhook

To monitor webhook calls, check the server logs for:
```
✓ Uploaded to Google Drive: {filename} (ID: {fileId})
✓ Triggered n8n processing for process_id: {processId}, model: {modelId}
```

Or if it fails:
```
Failed to trigger n8n webhook: {error_message}
```

## Environment Variables

Configure the webhook URL in `.env`:
```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/eob-process
```

---

**Last Updated:** January 10, 2025
**Location:** routes/documents.js (POST /upload endpoint)
