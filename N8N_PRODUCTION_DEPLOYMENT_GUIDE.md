# n8n Production Deployment Guide
## Google Document AI + n8n Workflow Integration with Laravel Portal

This guide provides step-by-step instructions for deploying the n8n document processing workflow to production, integrating with Google Document AI, and connecting with your Laravel portal at **https://crc.truercm.com**.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Google Document AI Setup](#google-document-ai-setup)
3. [Python Script Configuration](#python-script-configuration)
4. [n8n Workflow Setup](#n8n-workflow-setup)
5. [Laravel Integration](#laravel-integration)
6. [Testing & Validation](#testing--validation)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

### Architecture

```
┌──────────────────┐
│  Laravel Portal  │
│ crc.truercm.com  │
└────────┬─────────┘
         │ 1. Upload Document to Google Drive
         │ 2. Trigger n8n Webhook
         ▼
┌────────────────────┐
│   n8n Workflow     │
│                    │
│ ┌────────────────┐ │
│ │ Webhook Trigger│ │
│ └───────┬────────┘ │
│         │          │
│         ▼          │
│ ┌────────────────┐ │
│ │Python Script   │ │
│ │Execute         │ │
│ └───────┬────────┘ │
│         │          │
│         ▼          │
│ ┌────────────────┐ │
│ │Google Document │ │
│ │AI Processor    │ │
│ └───────┬────────┘ │
│         │          │
│         ▼          │
│ ┌────────────────┐ │
│ │OpenAI GPT-4    │ │
│ │Enhancement     │ │
│ └───────┬────────┘ │
│         │          │
│         ▼          │
│ ┌────────────────┐ │
│ │Save to Google  │ │
│ │Drive (JSON/CSV)│ │
│ └───────┬────────┘ │
│         │          │
│         ▼          │
│ ┌────────────────┐ │
│ │Send Results    │ │
│ │Back to Laravel │ │
│ └────────────────┘ │
└────────────────────┘
         │
         ▼
┌────────────────────┐
│  Laravel Portal    │
│  Receives Results  │
└────────────────────┘
```

### Workflow Components

1. **Webhook Trigger**: Receives document information from Laravel
2. **Python Script Execution**: Invokes Google Document AI processor
3. **OpenAI Enhancement**: Refines and structures extracted data
4. **Google Drive Storage**: Saves results (JSON and CSV)
5. **Webhook Response**: Sends results back to Laravel

---

## Google Document AI Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Note your **Project ID** (e.g., `eob-extraction-system-57e1`)

### Step 2: Enable Document AI API

```bash
# Enable Document AI API
gcloud services enable documentai.googleapis.com --project=eob-extraction-system-57e1

# Enable Storage API (for Google Drive integration)
gcloud services enable drive.googleapis.com --project=eob-extraction-system-57e1
```

Or via Console:
1. Go to **APIs & Services → Library**
2. Search for "Document AI API"
3. Click **Enable**
4. Search for "Google Drive API"
5. Click **Enable**

### Step 3: Create Document AI Processor

1. Go to **Document AI → Processors** in Google Cloud Console
2. Click **Create Processor**
3. Select processor type based on document category:
   - **Form Parser**: For EOB, Invoices
   - **Document OCR**: For general documents
   - **Custom Processor**: For specialized extraction

4. Configure processor:
   ```
   Processor Name: EOB_Processor_v1
   Processor Type: Form Parser
   Region: us (United States)
   ```

5. Note the **Processor ID** (format: `projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`)
   - Example: `projects/123456789/locations/us/processors/abc123def456`

### Step 4: Create Multiple Processors (One per Document Category)

Create separate processors for each document type:

```
1. EOB_Processor_v1 → Processor ID: abc123def456
2. Facesheet_Processor_v1 → Processor ID: xyz789ghi012
3. Invoice_Processor_v1 → Processor ID: mno345pqr678
```

### Step 5: Create Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Configure:
   ```
   Name: document-ai-service
   Description: Service account for Document AI processing
   ```
4. Grant roles:
   - **Document AI API User**
   - **Storage Admin** (for Google Drive access)

5. Create JSON key:
   - Click on the service account
   - Go to **Keys** tab
   - Click **Add Key → Create new key**
   - Choose **JSON**
   - Download the key file
   - Rename to: `eob-extraction-system-57e1fdbf5dde.json`

### Step 6: Service Account Configuration

Place the service account JSON file in your n8n server:

```bash
# Create credentials directory
mkdir -p /opt/n8n/credentials

# Copy service account key
cp eob-extraction-system-57e1fdbf5dde.json /opt/n8n/credentials/

# Set permissions
chmod 600 /opt/n8n/credentials/eob-extraction-system-57e1fdbf5dde.json
```

---

## Python Script Configuration

### Python Script Location

```
C:\Automation\AI Agents\GCloud Document AI\Eob_process_n8n\eob_process_with_DocAI_n8n_without_watching_v6.py
```

### Script Overview

The Python script:
1. Receives Google Drive file ID from n8n
2. Downloads PDF from Google Drive
3. Sends PDF to Google Document AI processor
4. Processes and structures the response
5. Returns extracted data to n8n

### Prerequisites

Install required Python packages:

```bash
pip install google-cloud-documentai google-auth google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### Configuration File

Create `config.json` in the same directory as the Python script:

```json
{
  "project_id": "eob-extraction-system-57e1",
  "location": "us",
  "processors": {
    "EOB": {
      "processor_id": "abc123def456",
      "name": "EOB_Processor_v1"
    },
    "Facesheet": {
      "processor_id": "xyz789ghi012",
      "name": "Facesheet_Processor_v1"
    },
    "Invoice": {
      "processor_id": "mno345pqr678",
      "name": "Invoice_Processor_v1"
    }
  },
  "credentials_path": "C:\\Automation\\AI Agents\\GCloud Document AI\\Eob_process_n8n\\eob-extraction-system-57e1fdbf5dde.json",
  "google_drive": {
    "source_folder_id": "1DJZWF93Qx_hvAO-QU6PV2hDdC7l04olK",
    "results_folder_id": "1qL8H5LsVxC3mKdYgHxM9cPuBnOvRzWsE"
  }
}
```

### Python Script: Key Functions

#### 1. Initialize Document AI Client

```python
from google.cloud import documentai_v1 as documentai
from google.oauth2 import service_account
import json

def initialize_document_ai(config_path, credentials_path):
    """Initialize Document AI client with service account credentials"""
    
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Create credentials
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    
    # Initialize client
    client = documentai.DocumentProcessorServiceClient(credentials=credentials)
    
    return client, config
```

#### 2. Download File from Google Drive

```python
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

def download_from_google_drive(file_id, credentials_path):
    """Download file from Google Drive"""
    
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )
    
    service = build('drive', 'v3', credentials=credentials)
    
    request = service.files().get_media(fileId=file_id)
    file_content = io.BytesIO()
    downloader = MediaIoBaseDownload(file_content, request)
    
    done = False
    while not done:
        status, done = downloader.next_chunk()
    
    return file_content.getvalue()
```

#### 3. Process Document with Document AI

```python
def process_document_with_documentai(client, processor_name, document_content):
    """Process document using Google Document AI"""
    
    # Configure the process request
    raw_document = documentai.RawDocument(
        content=document_content,
        mime_type='application/pdf'
    )
    
    request = documentai.ProcessRequest(
        name=processor_name,
        raw_document=raw_document
    )
    
    # Process the document
    result = client.process_document(request=request)
    
    return result.document
```

#### 4. Extract and Structure Data

```python
def extract_data_from_document(document):
    """Extract structured data from Document AI response"""
    
    extracted_data = {
        'text': document.text,
        'entities': [],
        'tables': [],
        'pages': len(document.pages)
    }
    
    # Extract entities
    for entity in document.entities:
        extracted_data['entities'].append({
            'type': entity.type_,
            'mention_text': entity.mention_text,
            'confidence': entity.confidence,
            'normalized_value': entity.normalized_value.text if entity.normalized_value else None
        })
    
    # Extract tables
    for page in document.pages:
        for table in page.tables:
            table_data = []
            for row in table.body_rows:
                row_data = []
                for cell in row.cells:
                    row_data.append(cell.layout.text_anchor.content)
                table_data.append(row_data)
            extracted_data['tables'].append(table_data)
    
    return extracted_data
```

#### 5. Main Processing Function

```python
def main(drive_file_id, doc_category, config_path, credentials_path):
    """
    Main function to process document
    
    Args:
        drive_file_id: Google Drive file ID
        doc_category: Document category (EOB, Facesheet, Invoice)
        config_path: Path to config.json
        credentials_path: Path to service account JSON
    
    Returns:
        dict: Extracted data
    """
    
    # Initialize
    client, config = initialize_document_ai(config_path, credentials_path)
    
    # Get processor for document category
    processor_info = config['processors'].get(doc_category)
    if not processor_info:
        raise ValueError(f"No processor configured for category: {doc_category}")
    
    processor_name = f"projects/{config['project_id']}/locations/{config['location']}/processors/{processor_info['processor_id']}"
    
    # Download document from Google Drive
    document_content = download_from_google_drive(drive_file_id, credentials_path)
    
    # Process with Document AI
    document = process_document_with_documentai(client, processor_name, document_content)
    
    # Extract data
    extracted_data = extract_data_from_document(document)
    
    return extracted_data

# Entry point for n8n
if __name__ == "__main__":
    import sys
    
    # Get parameters from n8n
    drive_file_id = sys.argv[1]
    doc_category = sys.argv[2]
    
    config_path = "config.json"
    credentials_path = config['credentials_path']
    
    # Process document
    result = main(drive_file_id, doc_category, config_path, credentials_path)
    
    # Return result as JSON
    print(json.dumps(result))
```

### Environment Variables

Set these in your system or n8n environment:

```bash
# Windows
setx GOOGLE_APPLICATION_CREDENTIALS "C:\Automation\AI Agents\GCloud Document AI\Eob_process_n8n\eob-extraction-system-57e1fdbf5dde.json"

# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="/opt/n8n/credentials/eob-extraction-system-57e1fdbf5dde.json"
```

---

## n8n Workflow Setup

### Step 1: Install n8n

```bash
# Install n8n globally
npm install -g n8n

# Or use Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# For production with PM2
pm2 start n8n --name "n8n-workflow-engine"
```

### Step 2: Configure n8n

Create n8n configuration file `~/.n8n/config`:

```json
{
  "executions": {
    "process": "main",
    "mode": "regular",
    "timeout": 300,
    "maxTimeout": 3600,
    "saveDataOnError": "all",
    "saveDataOnSuccess": "all",
    "saveExecutionProgress": true,
    "saveDataManualExecutions": true
  },
  "endpoints": {
    "rest": "rest",
    "webhook": "webhook",
    "webhookTest": "webhook-test"
  }
}
```

### Step 3: Import Workflow

1. Access n8n at `http://your-server:5678` or `https://n8n.truercm.com`
2. Go to **Workflows**
3. Click **Import from File**
4. Select: `EOB Processing with Document Category Routing - Final.json`
5. Click **Import**

### Step 4: Configure Workflow Nodes

#### Node 1: Webhook Trigger

```json
{
  "httpMethod": "POST",
  "path": "eob-process",
  "responseMode": "onReceived",
  "options": {}
}
```

Webhook URL will be: `https://n8n.truercm.com/webhook/eob-process`

Expected payload from Laravel:
```json
{
  "drive_file_id": "1ABC123XYZ",
  "doc_category": "EOB",
  "client_id": 1,
  "original_filename": "document.pdf",
  "process_id": 123
}
```

#### Node 2: Python Execute

```json
{
  "command": "python3",
  "arguments": [
    "C:\\Automation\\AI Agents\\GCloud Document AI\\Eob_process_n8n\\eob_process_with_DocAI_n8n_without_watching_v6.py",
    "={{$json[\"drive_file_id\"]}}",
    "={{$json[\"doc_category\"]}}"
  ]
}
```

Output: JSON string with extracted data

#### Node 3: OpenAI Enhancement (Optional)

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert at structuring medical billing documents. Extract and organize the data into a structured JSON format."
    },
    {
      "role": "user",
      "content": "={{$json[\"output\"]}}"
    }
  ],
  "temperature": 0.3,
  "maxTokens": 4000
}
```

#### Node 4: Google Drive - Save JSON

```json
{
  "resource": "file",
  "operation": "upload",
  "name": "={{$json[\"process_id\"]}}_{{$json[\"original_filename\"]}}.json",
  "parents": ["1qL8H5LsVxC3mKdYgHxM9cPuBnOvRzWsE"],
  "data": "={{JSON.stringify($json[\"extracted_data\"], null, 2)}}"
}
```

#### Node 5: Google Drive - Save CSV

Convert JSON to CSV format and save

#### Node 6: HTTP Request - Send Results to Laravel

```json
{
  "method": "POST",
  "url": "https://crc.truercm.com/api/n8n/results",
  "authentication": "headerAuth",
  "headerAuth": {
    "name": "Authorization",
    "value": "Bearer YOUR_API_TOKEN"
  },
  "body": {
    "process_id": "={{$json[\"process_id\"]}}",
    "status": "Processed",
    "result_json_url": "={{$json[\"json_file_url\"]}}",
    "result_csv_url": "={{$json[\"csv_file_url\"]}}",
    "extracted_data": "={{$json[\"extracted_data\"]}}"
  }
}
```

### Step 5: Configure Credentials

#### Google Drive OAuth2

1. In n8n, go to **Credentials**
2. Click **Add Credential**
3. Select **Google Drive OAuth2 API**
4. Fill in:
   ```
   Client ID: Your Google Cloud OAuth Client ID
   Client Secret: Your Google Cloud OAuth Client Secret
   Authorization URL: https://accounts.google.com/o/oauth2/v2/auth
   Access Token URL: https://oauth2.googleapis.com/token
   ```
5. Click **Connect**
6. Authorize with Google

#### OpenAI API

1. Add Credential
2. Select **OpenAI**
3. Enter **API Key**: `sk-...`

### Step 6: Test Workflow

Test with sample data:
```json
{
  "drive_file_id": "1ABC123XYZ",
  "doc_category": "EOB",
  "client_id": 1,
  "original_filename": "test_eob.pdf",
  "process_id": 999
}
```

Click **Execute Workflow** and verify:
- ✅ Python script executes successfully
- ✅ Document AI processes document
- ✅ Data is extracted and structured
- ✅ Files are saved to Google Drive
- ✅ Results are sent to Laravel

### Step 7: Activate Workflow

Once tested, click the **Active** toggle to enable automatic processing.

---

## Laravel Integration

### Laravel Configuration

Add to `.env`:
```env
N8N_WEBHOOK_URL=https://n8n.truercm.com/webhook/eob-process
N8N_API_TOKEN=your-secure-api-token
GOOGLE_DRIVE_SOURCE_FOLDER=1DJZWF93Qx_hvAO-QU6PV2hDdC7l04olK
```

### Step 1: Upload Document to Google Drive

```php
<?php

namespace App\Services;

use Google\Client;
use Google\Service\Drive;
use Illuminate\Support\Facades\Storage;

class GoogleDriveService
{
    protected $client;
    protected $service;
    
    public function __construct()
    {
        $this->client = new Client();
        $this->client->setAuthConfig(storage_path('app/google/credentials.json'));
        $this->client->addScope(Drive::DRIVE_FILE);
        $this->service = new Drive($this->client);
    }
    
    /**
     * Upload file to Google Drive
     *
     * @param string $filePath Local file path
     * @param string $fileName File name
     * @param string $folderId Google Drive folder ID
     * @return array File information including file_id
     */
    public function uploadFile($filePath, $fileName, $folderId)
    {
        $fileMetadata = new Drive\DriveFile([
            'name' => $fileName,
            'parents' => [$folderId]
        ]);
        
        $content = file_get_contents($filePath);
        
        $file = $this->service->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => 'application/pdf',
            'uploadType' => 'multipart',
            'fields' => 'id,name,webViewLink'
        ]);
        
        return [
            'file_id' => $file->id,
            'file_name' => $file->name,
            'web_view_link' => $file->webViewLink
        ];
    }
}
```

### Step 2: Trigger n8n Workflow

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class N8nService
{
    protected $webhookUrl;
    protected $apiToken;
    
    public function __construct()
    {
        $this->webhookUrl = config('services.n8n.webhook_url');
        $this->apiToken = config('services.n8n.api_token');
    }
    
    /**
     * Trigger n8n workflow to process document
     *
     * @param array $data Document information
     * @return array Response from n8n
     */
    public function triggerDocumentProcessing($data)
    {
        try {
            $response = Http::timeout(10)
                ->post($this->webhookUrl, [
                    'drive_file_id' => $data['drive_file_id'],
                    'doc_category' => $data['doc_category'],
                    'client_id' => $data['client_id'],
                    'original_filename' => $data['original_filename'],
                    'process_id' => $data['process_id']
                ]);
            
            if ($response->successful()) {
                Log::info('n8n workflow triggered successfully', [
                    'process_id' => $data['process_id']
                ]);
                
                return [
                    'success' => true,
                    'message' => 'Processing initiated'
                ];
            }
            
            Log::error('n8n workflow trigger failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            
            return [
                'success' => false,
                'message' => 'Failed to trigger processing'
            ];
            
        } catch (\Exception $e) {
            Log::error('Exception triggering n8n workflow', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
}
```

### Step 3: Document Upload Controller

```php
<?php

namespace App\Http\Controllers;

use App\Services\GoogleDriveService;
use App\Services\N8nService;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentController extends Controller
{
    protected $googleDrive;
    protected $n8n;
    
    public function __construct(GoogleDriveService $googleDrive, N8nService $n8n)
    {
        $this->googleDrive = $googleDrive;
        $this->n8n = $n8n;
    }
    
    /**
     * Upload and process document
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200', // 50MB
            'client_id' => 'required|integer',
            'doc_category' => 'required|string|in:EOB,Facesheet,Invoice',
        ]);
        
        DB::beginTransaction();
        
        try {
            // 1. Store file temporarily
            $file = $request->file('file');
            $originalFilename = $file->getClientOriginalName();
            $tempPath = $file->store('temp');
            
            // 2. Create database record
            $document = Document::create([
                'client_id' => $request->client_id,
                'original_filename' => $originalFilename,
                'doc_category' => $request->doc_category,
                'processing_status' => 'Pending',
                'uploaded_by' => auth()->id(),
                'uploaded_at' => now()
            ]);
            
            // 3. Upload to Google Drive
            $driveFile = $this->googleDrive->uploadFile(
                storage_path('app/' . $tempPath),
                $document->id . '_' . $originalFilename,
                config('services.google.drive_source_folder')
            );
            
            // 4. Update document with Google Drive info
            $document->update([
                'google_drive_file_id' => $driveFile['file_id'],
                'google_drive_url' => $driveFile['web_view_link'],
                'processing_status' => 'In-Progress'
            ]);
            
            // 5. Trigger n8n workflow
            $result = $this->n8n->triggerDocumentProcessing([
                'drive_file_id' => $driveFile['file_id'],
                'doc_category' => $request->doc_category,
                'client_id' => $request->client_id,
                'original_filename' => $originalFilename,
                'process_id' => $document->id
            ]);
            
            // 6. Clean up temp file
            \Storage::delete($tempPath);
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'Document uploaded and processing initiated',
                'data' => [
                    'process_id' => $document->id,
                    'status' => 'In-Progress',
                    'n8n_triggered' => $result['success']
                ]
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'success' => false,
                'message' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }
}
```

### Step 4: Receive Results from n8n

Create API endpoint to receive results:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class N8nWebhookController extends Controller
{
    /**
     * Receive processing results from n8n
     */
    public function receiveResults(Request $request)
    {
        // Validate API token
        $apiToken = $request->bearerToken();
        if ($apiToken !== config('services.n8n.api_token')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }
        
        $request->validate([
            'process_id' => 'required|integer',
            'status' => 'required|string',
            'result_json_url' => 'nullable|string',
            'result_csv_url' => 'nullable|string',
            'extracted_data' => 'nullable|array'
        ]);
        
        try {
            $document = Document::findOrFail($request->process_id);
            
            // Update document status
            $document->update([
                'processing_status' => $request->status,
                'result_json_url' => $request->result_json_url,
                'result_csv_url' => $request->result_csv_url,
                'extracted_data' => json_encode($request->extracted_data),
                'processed_at' => now()
            ]);
            
            Log::info('Processing completed', [
                'process_id' => $request->process_id,
                'status' => $request->status
            ]);
            
            // Optionally: Send notification to user
            // event(new DocumentProcessed($document));
            
            return response()->json([
                'success' => true,
                'message' => 'Results received successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to receive n8n results', [
                'error' => $e->getMessage(),
                'process_id' => $request->process_id
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to process results'
            ], 500);
        }
    }
}
```

### Step 5: Add Routes

```php
// routes/api.php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\Api\N8nWebhookController;

// Document upload (requires authentication)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/documents/upload', [DocumentController::class, 'upload']);
});

// n8n webhook (uses bearer token authentication)
Route::post('/n8n/results', [N8nWebhookController::class, 'receiveResults']);
```

### Step 6: Database Migration

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocumentsTable extends Migration
{
    public function up()
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->string('original_filename');
            $table->string('doc_category'); // EOB, Facesheet, Invoice
            $table->string('google_drive_file_id')->nullable();
            $table->text('google_drive_url')->nullable();
            $table->enum('processing_status', ['Pending', 'In-Progress', 'Processed', 'Failed'])->default('Pending');
            $table->text('result_json_url')->nullable();
            $table->text('result_csv_url')->nullable();
            $table->json('extracted_data')->nullable();
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();
            
            $table->foreign('client_id')->references('id')->on('clients');
            $table->foreign('uploaded_by')->references('id')->on('users');
        });
    }
    
    public function down()
    {
        Schema::dropIfExists('documents');
    }
}
```

---

## Testing & Validation

### End-to-End Testing

#### Test 1: Upload Document via Laravel

```bash
# Using curl
curl -X POST https://crc.truercm.com/api/documents/upload \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "file=@test-eob.pdf" \
  -F "client_id=1" \
  -F "doc_category=EOB"
```

Expected response:
```json
{
  "success": true,
  "message": "Document uploaded and processing initiated",
  "data": {
    "process_id": 123,
    "status": "In-Progress",
    "n8n_triggered": true
  }
}
```

#### Test 2: Verify n8n Workflow Execution

1. Go to n8n: `https://n8n.truercm.com`
2. Navigate to **Executions**
3. Find the latest execution
4. Verify all nodes executed successfully:
   - ✅ Webhook received data
   - ✅ Python script executed
   - ✅ Document AI processed
   - ✅ OpenAI enhanced (if enabled)
   - ✅ Results saved to Google Drive
   - ✅ Webhook sent to Laravel

#### Test 3: Verify Document AI Processing

Check Google Cloud Console:
1. Go to **Document AI → Processors**
2. Select your processor
3. Check **Recent Requests** tab
4. Verify request was processed successfully

#### Test 4: Verify Results in Laravel

```php
// Check document status
$document = Document::find(123);
echo $document->processing_status; // Should be "Processed"
echo $document->result_json_url; // Google Drive URL
echo $document->extracted_data; // JSON data
```

### Performance Testing

Test processing time for different document sizes:

```
Small (1-2 pages): ~30-45 seconds
Medium (3-5 pages): ~60-90 seconds
Large (10+ pages): ~120-180 seconds
```

### Load Testing

Test concurrent processing:

```bash
# Upload 10 documents simultaneously
for i in {1..10}; do
  curl -X POST https://crc.truercm.com/api/documents/upload \
    -H "Authorization: Bearer TOKEN" \
    -F "file=@test-eob.pdf" \
    -F "client_id=1" \
    -F "doc_category=EOB" &
done
```

Verify:
- All workflows execute successfully
- No timeouts or errors
- Results are correctly saved

---

## Troubleshooting

### Common Issues

#### Issue 1: Python Script Not Found

**Error**: `python3: can't open file: No such file or directory`

**Solution**:
```bash
# Verify Python script path in n8n node
# Update to correct path:
C:\Automation\AI Agents\GCloud Document AI\Eob_process_n8n\eob_process_with_DocAI_n8n_without_watching_v6.py

# Or on Linux:
/opt/automation/python-scripts/eob_process_with_DocAI_n8n_without_watching_v6.py
```

#### Issue 2: Google Document AI Authentication Failed

**Error**: `403 Permission denied` or `401 Unauthorized`

**Solutions**:
1. Verify service account key file exists
2. Check environment variable:
   ```bash
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```
3. Verify service account has correct roles:
   - Document AI API User
   - Storage Admin
4. Regenerate service account key if needed

#### Issue 3: Google Drive File Not Found

**Error**: `File not found` or `404`

**Solutions**:
1. Verify file ID is correct
2. Check service account has access to the file
3. Share the Google Drive folder with service account email
4. Verify folder ID in config.json

#### Issue 4: n8n Workflow Timeout

**Error**: `Workflow execution timeout`

**Solutions**:
1. Increase timeout in n8n config:
   ```json
   {
     "executions": {
       "timeout": 600,
       "maxTimeout": 3600
     }
   }
   ```
2. Optimize Python script for faster processing
3. Use smaller documents for testing

#### Issue 5: OpenAI API Rate Limit

**Error**: `429 Too Many Requests`

**Solutions**:
1. Add retry logic with exponential backoff
2. Upgrade OpenAI API tier
3. Implement queue system for processing
4. Add delays between requests

#### Issue 6: Laravel Upload Failed

**Error**: `Upload failed` or `500 Internal Server Error`

**Solutions**:
1. Check Laravel logs:
   ```bash
   tail -f storage/logs/laravel.log
   ```
2. Verify Google Drive credentials
3. Check file size limits in php.ini:
   ```ini
   upload_max_filesize = 50M
   post_max_size = 50M
   ```
4. Verify database connection

#### Issue 7: n8n Webhook Not Receiving Data

**Error**: Webhook doesn't trigger or receives empty data

**Solutions**:
1. Test webhook URL directly:
   ```bash
   curl -X POST https://n8n.truercm.com/webhook/eob-process \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
2. Check n8n logs:
   ```bash
   pm2 logs n8n-workflow-engine
   ```
3. Verify workflow is **Active**
4. Check firewall rules allow incoming webhooks

### Monitoring & Logs

#### n8n Logs

```bash
# PM2 logs
pm2 logs n8n-workflow-engine

# n8n execution logs
# Available in n8n UI: Executions tab
```

#### Laravel Logs

```bash
# Application logs
tail -f storage/logs/laravel.log

# HTTP logs
tail -f storage/logs/http.log
```

#### Google Cloud Logs

```bash
# Document AI logs
gcloud logging read "resource.type=documentai.googleapis.com" \
  --limit 50 \
  --format json
```

### Health Checks

#### n8n Health Check

```bash
curl https://n8n.truercm.com/healthz
```

#### Laravel Health Check

```bash
curl https://crc.truercm.com/api/health
```

#### Python Script Test

```bash
python3 eob_process_with_DocAI_n8n_without_watching_v6.py \
  "TEST_FILE_ID" \
  "EOB"
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Google Cloud Project created
- [ ] Document AI API enabled
- [ ] Processors created for all document categories
- [ ] Service account created with correct permissions
- [ ] Service account JSON key downloaded
- [ ] Python script tested locally
- [ ] n8n installed and configured
- [ ] Workflow imported and tested
- [ ] Laravel integration code deployed
- [ ] Database migrations run
- [ ] API endpoints tested

### Deployment

- [ ] n8n running in production mode (PM2)
- [ ] Workflow activated
- [ ] SSL certificates configured
- [ ] Firewall rules configured
- [ ] Environment variables set
- [ ] Monitoring tools configured
- [ ] Backup strategy implemented

### Post-Deployment

- [ ] End-to-end test completed successfully
- [ ] Performance metrics baseline established
- [ ] Documentation updated
- [ ] Team trained on system
- [ ] Support procedures documented

---

## Performance Optimization

### Tips for Faster Processing

1. **Use Batch Processing**: Process multiple documents in batches
2. **Optimize Python Script**: Cache credentials, reuse connections
3. **Use CDN**: For Google Drive file access
4. **Enable Caching**: Cache Document AI responses
5. **Parallel Processing**: Use n8n's parallel execution
6. **Resource Allocation**: Increase server resources for n8n

### Cost Optimization

1. **Document AI Pricing**: ~$0.015 per page
2. **OpenAI Pricing**: ~$0.03 per 1K tokens (GPT-4)
3. **Google Drive Storage**: Free up to 15GB, then $1.99/month for 100GB
4. **n8n Hosting**: Self-hosted is free, cloud pricing varies

### Monitoring Metrics

Track these metrics:
- **Processing Time**: Average time per document
- **Success Rate**: % of successful processings
- **Error Rate**: % of failed processings
- **API Costs**: Monthly spending on APIs
- **Storage Usage**: Google Drive storage used

---

## Support & Maintenance

### Regular Maintenance

**Daily:**
- Monitor n8n executions
- Check error logs
- Verify API quotas

**Weekly:**
- Review processing metrics
- Check storage usage
- Update documentation

**Monthly:**
- Review and optimize costs
- Update dependencies
- Backup configurations

### Contact Information

For technical support:
- **n8n Issues**: https://github.com/n8n-io/n8n/issues
- **Document AI**: https://cloud.google.com/document-ai/docs/support
- **OpenAI**: https://help.openai.com/

---

## Appendix

### Useful Commands

```bash
# n8n commands
pm2 start n8n
pm2 stop n8n
pm2 restart n8n
pm2 logs n8n

# Python package installation
pip install google-cloud-documentai
pip install google-auth
pip install google-api-python-client

# Test Google Drive access
python3 -c "from googleapiclient.discovery import build; print('OK')"

# Test Document AI
gcloud ai document-processors list --location=us
```

### Reference Links

- **Google Document AI**: https://cloud.google.com/document-ai/docs
- **n8n Documentation**: https://docs.n8n.io/
- **Laravel Documentation**: https://laravel.com/docs
- **OpenAI API**: https://platform.openai.com/docs

---

**Document Version**: 1.0.0  
**Last Updated**: November 12, 2025  
**Status**: Production Ready ✅

---

## Quick Start Summary

1. **Setup Google Cloud**:
   - Enable Document AI API
   - Create processors
   - Create service account

2. **Configure Python Script**:
   - Install dependencies
   - Update config.json
   - Test locally

3. **Setup n8n**:
   - Install n8n
   - Import workflow
   - Configure credentials
   - Activate workflow

4. **Integrate with Laravel**:
   - Add service classes
   - Create controllers
   - Setup routes
   - Test upload

5. **Deploy to Production**:
   - Use PM2 for n8n
   - Configure SSL
   - Setup monitoring
   - Test end-to-end

**Your production n8n workflow is now ready to process documents from https://crc.truercm.com!**
