# EOB EXTRACTION SYSTEM - DESIGN DOCUMENT (PART 2)

**Continuation from SYSTEM_DESIGN_DOCUMENT.md**

---

## 5. BACKEND API DESIGN (Continued)

### 5.2 Documents API

#### 5.2.1 POST /api/documents/upload
**Purpose:** Upload PDF document for processing

**Access:** Authenticated users

**Request Type:** multipart/form-data

**Request Body:**
```
file: PDF file (max 50MB)
doc_category: 1 (EOB) or 2 (Facesheet)
model_id: (optional) Model configuration ID
```

**Response (201):**
```json
{
  "success": true,
  "message": "Document uploaded successfully and processing started",
  "process_id": 123,
  "session_id": "5_20250107_143052"
}
```

**Validation Rules:**
- File must be PDF format
- File size max 50MB (configurable)
- Filename must NOT start with "Processed_"
- doc_category is required

**Processing Flow:**
1. Validate file and metadata
2. Create database record with status "In-Progress"
3. Rename file with process_id prefix
4. Upload to Google Drive (eob-source folder)
5. Trigger n8n webhook with metadata
6. Return response immediately (async processing)

#### 5.2.2 GET /api/documents
**Purpose:** List all documents with filtering and pagination

**Access:** Authenticated users (filtered by client_id for non-admin)

**Query Parameters:**
```
status: In-Progress | Processed | Failed
client_id: (admin only)
doc_category: 1 | 2
from_date: YYYY-MM-DD
to_date: YYYY-MM-DD
page: 1 (default)
limit: 20 (default)
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "process_id": 123,
      "doc_name": "123_sample_eob.pdf",
      "original_filename": "sample_eob.pdf",
      "no_of_pages": 15,
      "total_records": 45,
      "processing_status": "Processed",
      "time_initiated": "2025-01-07T14:30:00Z",
      "time_finished": "2025-01-07T14:32:15Z",
      "total_processing_time": 135,
      "cost": 0.4523,
      "user_email": "user@example.com",
      "client_name": "ABC Healthcare",
      "model_name": "GPT-4o-mini",
      "category_name": "eob"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### 5.2.3 GET /api/documents/:processId
**Purpose:** Get detailed information about a specific document

**Access:** Authenticated users (own documents or admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "process_id": 123,
    "doc_name": "123_sample_eob.pdf",
    "original_filename": "sample_eob.pdf",
    "no_of_pages": 15,
    "total_records": 45,
    "processing_status": "Processed",
    "time_initiated": "2025-01-07T14:30:00Z",
    "time_finished": "2025-01-07T14:32:15Z",
    "total_processing_time": 135,
    "cost": 0.4523,
    "document_ai_cost": 0.2250,
    "openai_cost": 0.2273,
    "link_to_file": "https://drive.google.com/file/d/.../view",
    "link_to_csv": "https://drive.google.com/file/d/.../view",
    "link_to_json": "https://drive.google.com/file/d/.../view",
    "session_id": "5_20250107_143052",
    "gdrive_file_id": "1ABC...",
    "user_email": "user@example.com",
    "client_name": "ABC Healthcare",
    "model_name": "GPT-4o-mini",
    "category_name": "eob"
  }
}
```

#### 5.2.4 GET /api/documents/:processId/data
**Purpose:** Get extracted data in JSON format

**Access:** Authenticated users (own documents or admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "Original_Page_No": 1,
        "EOB_Page_No": 1,
        "patient_acct": "123456",
        "Patient_ID": "P001",
        "Patient_Name": "John Doe",
        "service_date": "2024-01-15",
        "allowed_amount": 150.00,
        "paid_amount": 120.00,
        "Confidence_Score": 95
      }
    ]
  }
}
```

#### 5.2.5 GET /api/documents/:processId/download/:fileType
**Purpose:** Download file (pdf, csv, json, or zip)

**Access:** Authenticated users (own documents or admin)

**Parameters:**
- processId: Document process ID
- fileType: pdf | csv | json | zip

**Response:**
- Content-Type: application/pdf | text/csv | application/json | application/zip
- Content-Disposition: attachment; filename="..."

**For ZIP downloads:**
- Includes original PDF + CSV + JSON files

#### 5.2.6 GET /api/documents/:processId/logs
**Purpose:** Get processing logs for debugging

**Access:** Authenticated users (own documents or admin)

**Response (200):**
```json
{
  "success": true,
  "logs": [
    {
      "log_id": 1,
      "log_level": "INFO",
      "log_message": "Processing started",
      "log_details": null,
      "created_at": "2025-01-07T14:30:00Z"
    },
    {
      "log_id": 2,
      "log_level": "INFO",
      "log_message": "Uploaded to Google Drive",
      "created_at": "2025-01-07T14:30:15Z"
    }
  ]
}
```

#### 5.2.7 POST /api/documents/:processId/n8n-results
**Purpose:** Receive processing results from n8n workflow

**Access:** Public (called by n8n, no authentication)

**Request Body:**
```json
{
  "status": "Processed",
  "jsonDriveUrl": "https://drive.google.com/...",
  "csvDriveUrl": "https://drive.google.com/...",
  "jsonDriveId": "1ABC...",
  "csvDriveId": "1DEF...",
  "processingTimeSeconds": 135,
  "documentAiCost": 0.2250,
  "openAiCost": 0.2273,
  "totalCost": 0.4523,
  "totalRecords": 45,
  "noOfPages": 15,
  "errorMessage": null
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Results updated successfully",
  "processId": 123
}
```

**Side Effects:**
- Updates document_processed table
- Emits WebSocket event to subscribed clients
- Downloads JSON from Drive and populates extracted_data table

### 5.3 Admin API

#### 5.3.1 User Management

**GET /api/admin/users**
- List all users
- Access: Admin, SuperAdmin

**POST /api/admin/users** (via /api/auth/register)
- Create new user
- Access: Admin, SuperAdmin

**PUT /api/admin/users/:userid**
- Update user details
- Access: Admin, SuperAdmin

**DELETE /api/admin/users/:userid**
- Soft delete user (set is_active = false)
- Access: SuperAdmin only

#### 5.3.2 Client Management

**GET /api/admin/clients**
```json
{
  "success": true,
  "clients": [
    {
      "client_id": 1,
      "client_name": "ABC Healthcare",
      "contact_name": "John Smith",
      "email": "contact@abc.com",
      "status": "active",
      "user_count": 15,
      "document_count": 234
    }
  ]
}
```

**POST /api/admin/clients**
**PUT /api/admin/clients/:clientId**
**DELETE /api/admin/clients/:clientId**

#### 5.3.3 Model Management

**GET /api/admin/models**
**POST /api/admin/models**
**PUT /api/admin/models/:modelId**
**DELETE /api/admin/models/:modelId**

#### 5.3.4 Field Management

**GET /api/admin/fields**
**POST /api/admin/fields**
**PUT /api/admin/fields/:fieldId**
**DELETE /api/admin/fields/:fieldId**

#### 5.3.5 Document Category Management

**GET /api/admin/doc-categories**
**POST /api/admin/doc-categories**
**PUT /api/admin/doc-categories/:categoryId**
**DELETE /api/admin/doc-categories/:categoryId**

---

## 6. FRONTEND DESIGN

### 6.1 Component Structure

#### 6.1.1 Layout Component
**File:** `client/src/components/Layout.js`

**Functionality:**
- Persistent navigation sidebar
- Top header with user menu
- Breadcrumb navigation
- Responsive drawer for mobile

**Structure:**
```jsx
<Box sx={{ display: 'flex' }}>
  <AppBar>
    <Toolbar>
      <MenuIcon /> <!-- Mobile menu toggle -->
      <Typography>EOB Extraction System</Typography>
      <UserMenu /> <!-- Profile, Logout -->
    </Toolbar>
  </AppBar>
  
  <Drawer>
    <NavigationMenu>
      - Dashboard
      - Documents
      - Upload
      - Admin (if admin/superadmin)
      - Profile
    </NavigationMenu>
  </Drawer>
  
  <Box component="main">
    <Outlet /> <!-- Child routes render here -->
  </Box>
</Box>
```

#### 6.1.2 PrivateRoute Component
**File:** `client/src/components/PrivateRoute.js`

**Functionality:**
- Checks authentication status
- Redirects to login if not authenticated
- Can check specific roles

```jsx
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  
  if (loading) return <CircularProgress />;
  
  if (!user) return <Navigate to="/login" />;
  
  if (roles && !roles.includes(user.user_role)) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}
```

### 6.2 Page Components

#### 6.2.1 Login Page
**File:** `client/src/pages/Login.js`

**Features:**
- Email/password form
- Form validation
- Error message display
- JWT token storage
- Auto-redirect to dashboard on success

#### 6.2.2 Dashboard Page
**File:** `client/src/pages/Dashboard.js`

**Features:**
- Statistics cards (total documents, processed, in progress, failed)
- Recent documents table
- Processing status chart
- Cost summary
- Quick upload button

**API Calls:**
- GET /api/documents?page=1&limit=10
- GET /api/admin/stats (if admin)

#### 6.2.3 Documents Page
**File:** `client/src/pages/Documents.js`

**Features:**
- Filterable document table
- Status filter (All, In-Progress, Processed, Failed)
- Date range filter
- Client filter (admin only)
- Category filter
- Pagination
- Download buttons (PDF, CSV, JSON, ZIP)
- View details button
- Real-time status updates via WebSocket

**Table Columns:**
- Process ID
- Document Name
- Pages
- Records
- Status
- Uploaded
- Processing Time
- Cost
- Actions

#### 6.2.4 DocumentDetails Page
**File:** `client/src/pages/DocumentDetails.js`

**Features:**
- Document metadata display
- Extracted data table (editable)
- Add/edit/delete rows
- Inline editing with validation
- Bulk delete rows
- Export buttons
- Processing logs viewer
- Cost breakdown

**Sections:**
1. **Metadata Card:**
   - Document name, pages, status
   - Upload time, processing time
   - Cost breakdown (Document AI + OpenAI)
   
2. **Extracted Data Table:**
   - All extracted fields as columns
   - Sortable columns
   - Filterable
   - Editable cells
   - Save changes button
   
3. **Processing Logs:**
   - Expandable section
   - Timestamped log entries
   - Color-coded by level (INFO, WARNING, ERROR)

#### 6.2.5 Upload Page
**File:** `client/src/pages/Upload.js`

**Features:**
- Drag-and-drop file upload
- File type validation (PDF only)
- File size validation
- Document category selection
- Model selection (optional)
- Upload progress indicator
- Success/error notifications
- Redirect to document details on success

#### 6.2.6 Profile Page
**File:** `client/src/pages/Profile.js`

**Features:**
- View/edit profile information
- Change timezone
- Change password
- View account statistics
- Last login information

### 6.3 Admin Panel Pages

#### 6.3.1 Admin Panel Layout
**File:** `client/src/pages/Admin/AdminPanel.js`

**Features:**
- Tabbed navigation for admin sections
- Access control (admin/superadmin only)
- Statistics dashboard

#### 6.3.2 User Management
**File:** `client/src/pages/Admin/UserManagement.js`

**Features:**
- User list table
- Create new user dialog
- Edit user dialog
- Deactivate/activate users
- Role assignment
- Client assignment
- Search and filter

#### 6.3.3 Client Management
**File:** `client/src/pages/Admin/ClientManagement.js`

**Features:**
- Client list table
- Add/edit/delete clients
- View client statistics
- Assign default models

#### 6.3.4 Field Management
**File:** `client/src/pages/Admin/FieldManagement.js`

**Features:**
- Field definition table
- Create/edit fields
- Define keywords for extraction
- Set field types and validation
- Link to document categories

#### 6.3.5 Model Management
**File:** `client/src/pages/Admin/ModelManagement.js`

**Features:**
- Model configuration list
- Create/edit models
- Select fields for model
- Set field order
- Assign to clients
- Set default models

### 6.4 State Management

#### 6.4.1 AuthContext
**File:** `client/src/contexts/AuthContext.js`

**State:**
```javascript
{
  user: {
    userid: number,
    email: string,
    first_name: string,
    last_name: string,
    user_role: string,
    client_id: number,
    timezone: string
  } | null,
  loading: boolean
}
```

**Methods:**
- `login(email, password)`: Authenticate user
- `logout()`: Clear session and redirect
- `updateProfile(data)`: Update user info
- `checkAuth()`: Verify token validity

**Storage:**
- JWT token stored in localStorage
- Auto-refresh token mechanism
- Token expiry handling

---

## 7. n8n WORKFLOW INTEGRATION

### 7.1 Workflow Overview

**Workflow ID:** KqwczyZhFJT5alBV  
**Webhook URL:** http://localhost:5678/webhook/eob-process  
**Total Nodes:** 21

### 7.2 Workflow Architecture

```
Webhook → Extract Data → Get Pricing → Wait
                             ↓
         Download PDF → Python DocAI → Parse Output
                             ↓
         OpenAI Extraction → Calculate Costs
                             ↓
         Generate JSON/CSV → Upload to Drive
                             ↓
         Move PDF → Send Results to Server
```

### 7.3 Node-by-Node Specification

#### Node 1: Webhook Trigger
- **Type:** Webhook
- **Path:** eob-process
- **Method:** POST
- **Response:** 200 OK
- **Purpose:** Receive upload notification from server

**Expected Payload:**
```json
{
  "processId": 123,
  "filename": "123_document.pdf",
  "originalFilename": "document.pdf",
  "driveFileId": "1ABC...",
  "userid": 5,
  "clientId": 1,
  "sessionId": "5_20250107_143052",
  "modelId": 2,
  "docCategory": 1
}
```

#### Node 2: Extract Process Data
- **Type:** Code
- **Purpose:** Parse and structure webhook data

```javascript
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

#### Node 3: Get Model Pricing
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `http://localhost:3000/api/admin/openai-models/{{ modelId }}/pricing`
- **Purpose:** Get OpenAI model cost per 1K tokens

#### Node 4: Get Document AI Cost Config
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `http://localhost:3000/api/admin/config/docai_cost_per_page`
- **Purpose:** Get Document AI cost per page

#### Node 5: Wait for Drive Upload
- **Type:** Code
- **Purpose:** 2-second delay to ensure Drive file is ready

```javascript
await new Promise(resolve => setTimeout(resolve, 2000));
const processData = $('Extract Process Data').first().json;
return [{ json: { ...processData, driveFileReady: true } }];
```

#### Node 6: Download PDF from Drive
- **Type:** Google Drive - Download
- **File ID:** `={{ $('Extract Process Data').first().json.driveFileId }}`
- **Purpose:** Download PDF for processing

#### Node 7: Execute Python - Document AI
- **Type:** Execute Command
- **Command:** 
```bash
python "C:\Automation\AI Agents\GCloud Document AI\Eob_process_n8n\eob_process_with_DocAI_n8n_without_watching_v6.py" "H:/My Drive/AAA AI-Training/Document Processing/EOB-Extractor/eob-source/{{ filename }}"
```
- **Timeout:** 300000ms (5 minutes)
- **Purpose:** Extract text and structure via Google Document AI

**Python Script Output Format:**
```
===JSON_START===
{
  "pages": 15,
  "raw_data_file": "path/to/extracted_data.json",
  "data": {...extracted document structure...}
}
===JSON_END===
```

#### Node 8: Calculate Document AI Cost
- **Type:** Code
- **Purpose:** Calculate Document AI cost based on pages

```javascript
const pythonOutput = $('Execute Python - Document AI').first().json;
const docAiConfig = $('Get Document AI Cost Config').first().json.data;
const pages = pythonOutput.data?.pages || 0;
const costPerPage = parseFloat(docAiConfig.value || 0.015);
const documentAiCost = pages * costPerPage;

return [{
  json: {
    documentAiCost: parseFloat(documentAiCost.toFixed(4)),
    pages: pages,
    costPerPage: costPerPage
  }
}];
```

#### Node 9: Parse Python Output
- **Type:** Code
- **Purpose:** Extract JSON from Python script output

```javascript
const output = $input.first().json.stdout || '';
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

#### Node 10: OpenAI - Extract EOB Data
- **Type:** OpenAI Chat Model
- **Model:** `={{ $('Get Model Pricing').first().json.data.model_code }}`
- **Temperature:** 0.1
- **Max Tokens:** 4000

**System Prompt:**
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

#### Node 11: Calculate OpenAI Cost
- **Type:** Code
- **Purpose:** Calculate OpenAI API cost

```javascript
const aiResponse = $('OpenAI - Extract EOB Data').first().json;
const modelPricing = $('Get Model Pricing').first().json.data;

const inputTokens = aiResponse.usage?.prompt_tokens || 0;
const outputTokens = aiResponse.usage?.completion_tokens || 0;

const inputCostPer1k = parseFloat(modelPricing.input_cost_per_1k || 0.00015);
const outputCostPer1k = parseFloat(modelPricing.output_cost_per_1k || 0.0006);

const openAiCost = (inputTokens / 1000 * inputCostPer1k) + 
                   (outputTokens / 1000 * outputCostPer1k);

return [{
  json: {
    openAiCost: parseFloat(openAiCost.toFixed(4)),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    modelName: modelPricing.model_name,
    modelCode: modelPricing.model_code
  }
}];
```

#### Node 12: Calculate Total Cost & Time
- **Type:** Code
- **Purpose:** Sum all costs and calculate total processing time

```javascript
const processData = $('Extract Process Data').first().json;
const docAiCost = $('Calculate Document AI Cost').first().json;
const openAiCost = $('Calculate OpenAI Cost').first().json;

const startTime = new Date(processData.startTime);
const endTime = new Date();
const processingTimeSeconds = Math.round((endTime - startTime) / 1000);
const totalCost = parseFloat((docAiCost.documentAiCost + openAiCost.openAiCost).toFixed(4));

return [{
  json: {
    totalCost,
    documentAiCost: docAiCost.documentAiCost,
    openAiCost: openAiCost.openAiCost,
    processingTimeSeconds,
    pages: docAiCost.pages,
    inputTokens: openAiCost.inputTokens,
    outputTokens: openAiCost.outputTokens,
    modelUsed: openAiCost.modelName
  }
}];
```

#### Node 13: Prepare JSON
- **Type:** Code
- **Purpose:** Format extracted data as JSON

```javascript
const aiResponse = $('OpenAI - Extract EOB Data').first().json;
const processData = $('Extract Process Data').first().json;
const costData = $('Calculate Total Cost & Time').first().json;

let extractedData;
if (aiResponse.message) {
  const content = aiResponse.message.content || aiResponse.message;
  extractedData = typeof content === 'string' ? JSON.parse(content) : content;
} else if (aiResponse.choices && aiResponse.choices[0]) {
  extractedData = JSON.parse(aiResponse.choices[0].message.content);
} else {
  extractedData = aiResponse.data || aiResponse;
}

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

const baseFilename = processData.originalFilename.replace('.pdf', '');
const jsonFilename = `extracted_${baseFilename}.json`;

return [{
  json: {
    jsonOutput,
    jsonFilename,
    extractedRecords: extractedData.data || extractedData,
    totalRecords: (extractedData.data || extractedData).length || 0
  }
}];
```

#### Node 14: Prepare CSV
- **Type:** Code
- **Purpose:** Convert extracted data to CSV format

```javascript
const jsonData = $('Prepare JSON').first().json;
const records = jsonData.extractedRecords || [];

if (records.length === 0) {
  return [{ json: { csvFilename: '', csvContent: '' } }];
}

// Get all unique keys
const allKeys = new Set();
records.forEach(record => {
  Object.keys(record).forEach(key => allKeys.add(key));
});

const headers = Array.from(allKeys);
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

return [{ json: { csvFilename, csvContent } }];
```

#### Node 15: JSON to Binary
- **Type:** Code
- **Purpose:** Convert JSON string to binary for upload

```javascript
const jsonData = $('Prepare JSON').first().json;
const jsonStr = JSON.stringify(jsonData.jsonOutput, null, 2);
const buffer = Buffer.from(jsonStr, 'utf8');

return [{
  json: { filename: jsonData.jsonFilename },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'application/json',
      fileName: jsonData.jsonFilename
    }
  }
}];
```

#### Node 16: CSV to Binary
- **Type:** Code
- **Purpose:** Convert CSV string to binary for upload

```javascript
const csvData = $('Prepare CSV').first().json;
const buffer = Buffer.from(csvData.csvContent, 'utf8');

return [{
  json: { filename: csvData.csvFilename },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'text/csv',
      fileName: csvData.csvFilename
    }
  }
}];
```

#### Node 17: Upload JSON to eob-results
- **Type:** Google Drive - Upload
- **Folder ID:** 140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR
- **File Name:** `={{ $json.filename }}`
- **Binary Property:** data

#### Node 18: Upload CSV to eob-results
- **Type:** Google Drive - Upload
- **Folder ID:** 140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR
- **File Name:** `={{ $json.filename }}`
- **Binary Property:** data

#### Node 19: Move & Rename PDF
- **Type:** Google Drive - Update
- **File ID:** `={{ $('Extract Process Data').first().json.driveFileId }}`
- **New Name:** `Processed_{{ originalFilename }}`
- **New Parent:** 140_11GaATZVV3Ez7aQE7FGJJ4DHWXVFR (eob-results)
- **Purpose:** Move processed PDF to results folder with "Processed_" prefix

#### Node 20: Prepare Results Payload
- **Type:** Code
- **Purpose:** Collect all results for server callback

```javascript
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
    noOfPages: costData.pages,
    errorMessage: null
  }
}];
```

#### Node 21: Send Results to Server
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `http://localhost:3000/api/documents/{{ processId }}/n8n-results`
- **Body:** JSON from previous node
- **Purpose:** Send processing results back to server

**Workflow Complete**

### 7.4 Error Handling

Each node in the workflow includes error handling:
- Try/catch blocks in code nodes
- Timeout settings for long-running operations
- Fallback values for missing data
- Error status reporting back to server

**Error Workflow:**
1. If any node fails, capture error message
2. Update document status to "Failed" via server callback
3. Log error details for debugging
4. Notify user via WebSocket

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Authentication & Authorization

**JWT Token Management:**
- Token expiry: 24 hours (configurable)
- Refresh token mechanism
- Secure token storage (httpOnly cookies in production)
- Token validation on every request

**Role-Based Access Control (RBAC):**
- SuperAdmin: Full system access
- Admin: Client management, user management within client
- User: Own documents only

**Password Security:**
- bcrypt hashing (10 rounds)
- Minimum password requirements
- Password change functionality
- Account lockout after failed attempts

### 8.2 Data Security

**File Upload Security:**
- File type validation (PDF only)
- File size limits (50MB default)
- Virus scanning (recommended for production)
- Filename sanitization

**Database Security:**
- Parameterized queries (prevent SQL injection)
- Prepared statements for all queries
- Database connection pooling
- Regular backups

**API Security:**
- CORS configuration
- Rate limiting (recommended for production)
- Input validation on all endpoints
- XSS prevention
- CSRF protection for state-changing operations

### 8.3 Google Drive Security

**OAuth2 Configuration:**
- Secure credential storage
- Token refresh mechanism
- Scoped access (drive.file only)
- Regular credential rotation

**Folder Permissions:**
- Service account access only
- Read/write permissions on specific folders
- No public access

### 8.4 n8n Security

**Webhook Security:**
- Internal network only (localhost)
- No authentication required (internal communication)
- Firewall rules to block external access

**Credential Management:**
- Encrypted credential storage in n8n
- Google OAuth credentials
- OpenAI API keys

### 8.5 Production Recommendations

**SSL/TLS:**
- HTTPS for all external communications
- SSL certificates (Let's Encrypt recommended)
- Redirect HTTP to HTTPS

**Environment Variables:**
- Never commit .env files
- Use environment-specific configurations
- Secure secrets management (AWS Secrets Manager, etc.)

**Logging & Monitoring:**
- Centralized logging
- Error tracking (Sentry, etc.)
- Performance monitoring
- Security audit logs

**Regular Updates:**
- Keep dependencies updated
- Security patches
- Regular security audits

---

## 9. DEPLOYMENT ARCHITECTURE

### 9.1 System Components

**Component Diagram:**
```
                    ┌─────────────────┐
                    │   Load Balancer │ (Optional)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Frontend      │
                    │   (React App)   │
                    │   Port 3000     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Backend API   │
                    │   (Express.js)  │
                    │   Port 5000     │
                    └────┬────┬───────┘
                         │    │
              ┌──────────┘    └──────────┐
              │                           │
     ┌────────▼────────┐         ┌───────▼────────┐
     │   MySQL         │         │   n8n Workflow │
     │   Database      │         │   Port 5678    │
     │   Port 3306     │         └───────┬────────┘
     └─────────────────┘                 │
                                 ┌───────▼────────┐
                                 │  Google Drive  │
                                 │  Document AI   │
                                 │  OpenAI API    │
                                 └────────────────┘
```

### 9.2 Deployment Options

#### Option 1: Single Server Deployment
**Requirements:**
- Windows Server or Linux (Ubuntu 20.04+)
- 8GB RAM minimum
- 4 CPU cores
- 100GB storage

**Services:**
- Node.js 18+
- MySQL 8.0+
- n8n
- Python 3.9+ (for Document AI)

#### Option 2: Containerized Deployment
**Docker Compose Setup:**
- Frontend container
- Backend container
- MySQL container
- n8n container

**Benefits:**
- Easy scaling
- Environment consistency
- Simple deployment

#### Option 3: Cloud Deployment
**AWS Example:**
- EC2 for backend/n8n
- RDS for MySQL
- S3 for file storage (alternative to Google Drive)
- CloudFront for frontend
- Route 53 for DNS

### 9.3 Scaling Considerations

**Horizontal Scaling:**
- Multiple backend instances behind load balancer
- Database replication (read replicas)
- Stateless session management

**Vertical Scaling:**
- Increase server resources
- Optimize database queries
- Implement caching (Redis)

**Queue-Based Processing:**
- Implement job queue (Bull, RabbitMQ)
- Separate processing workers
- Async document processing

---

## 10. MONITORING & MAINTENANCE

### 10.1 System Monitoring

**Key Metrics:**
- API response times
- Database query performance
- Document processing success rate
- Storage usage
- System resource utilization

**Tools:**
- PM2 for Node.js process management
- Prometheus for metrics collection
- Grafana for visualization
- New Relic / DataDog (optional)

### 10.2 Log Management

**Log Types:**
- Application logs (Winston)
- Access logs (Morgan)
- Error logs
- Processing logs (database)
- Audit logs

**Log Rotation:**
- Daily rotation
- Compression of old logs
- Retention policy (30 days default)

### 10.3 Backup Strategy

**Database Backups:**
- Daily automated backups
- Retention: 30 days
- Test restore procedures monthly

**File Backups:**
- Google Drive handles file redundancy
- Optional: Backup to secondary storage

### 10.4 Maintenance Tasks

**Daily:**
- Monitor error logs
- Check processing queue
- Verify backup completion

**Weekly:**
- Review system performance
- Check disk space
- Update cost tracking reports

**Monthly:**
- Security patches
- Database optimization
- Review and archive old documents
- Performance tuning

**Quarterly:**
- Dependency updates
- Security audit
- Disaster recovery test
- Review and update documentation

---

## 11. COST MANAGEMENT

### 11.1 Cost Components

**External API Costs:**
- Google Document AI: $0.015/page (configurable)
- OpenAI API: Variable based on model and tokens
- Google Drive: Free for reasonable usage

**Infrastructure Costs:**
- Server hosting
- Database hosting
- Bandwidth
- Storage

### 11.2 Cost Tracking

**Per-Document Tracking:**
- Document AI cost
- OpenAI cost
- Total cost
- Stored in database for reporting

**Reporting:**
- Cost by client
- Cost by user
- Cost by date range
- Cost by model

**Cost Optimization:**
- Model selection (cheaper models for simple documents)
- Batch processing
- Caching of repeated extractions

---

## 12. FUTURE ENHANCEMENTS

### 12.1 Planned Features

**Phase 2:**
- Batch upload
- Advanced search and filtering
- Custom field definitions per client
- Email notifications
- Scheduled reports

**Phase 3:**
- Machine learning model training
- OCR for scanned documents
- Multi-language support
- Mobile application
- API for third-party integrations

**Phase 4:**
- Advanced analytics dashboard
- Predictive cost analysis
- Automated quality checks
- Integration with EHR systems

### 12.2 Technical Improvements

**Performance:**
- Redis caching layer
- GraphQL API
- Database query optimization
- CDN for static assets

**Security:**
- Two-factor authentication
- Single sign-on (SSO)
- Advanced audit logging
- Compliance certifications (HIPAA, etc.)

**Scalability:**
- Microservices architecture
- Kubernetes orchestration
- Auto-scaling
- Multi-region deployment

---

## 13. TROUBLESHOOTING GUIDE

### 13.1 Common Issues

**Document Upload Fails:**
- Check file size (< 50MB)
- Verify PDF format
- Check Google Drive quota
- Verify OAuth credentials

**Processing Stuck:**
- Check n8n workflow status
- Verify Python script path
- Check Document AI quota
- Review processing logs

**n8n Workflow Not Triggering:**
- Verify webhook URL in .env
- Check workflow is activated
- Review n8n execution logs
- Test webhook manually

**Google Drive Connection Issues:**
- Refresh OAuth token
- Verify credentials
- Check API quotas
- Test Drive API access

### 13.2 Log Analysis

**Error Types:**
- 400 errors: Client/validation errors
- 401/403 errors: Authentication/authorization
- 500 errors: Server errors
- Processing errors: Check processing_logs table

**Log Locations:**
- Application: `./logs/server.log`
- Database: `processing_logs` table
- n8n: n8n execution history

### 13.3 Performance Issues

**Slow API Responses:**
- Check database query performance
- Review slow query log
- Optimize indexes
- Consider caching

**High Processing Times:**
- Check Document AI response times
- Review OpenAI API performance
- Optimize Python script
- Consider parallel processing

---

## 14. TESTING STRATEGY

### 14.1 Unit Testing

**Backend Tests:**
- API endpoint tests
- Service layer tests
- Utility function tests
- Database query tests

**Frontend Tests:**
- Component tests
- Hook tests
- Utility function tests

**Tools:**
- Jest
- Supertest (API testing)
- React Testing Library

### 14.2 Integration Testing

**Test Scenarios:**
- Complete document upload flow
- User authentication flow
- Admin operations
- WebSocket communication

**Test Data:**
- Sample PDF documents
- Test user accounts
- Mock API responses

### 14.3 End-to-End Testing

**Tools:**
- Playwright or Cypress
- Automated browser testing

**Test Cases:**
- Login → Upload → View Results
- Admin user management
- Client management workflow
- Model configuration

### 14.4 Performance Testing

**Load Testing:**
- Concurrent uploads
- API stress testing
- Database load testing

**Tools:**
- Apache JMeter
- k6
- Artillery

---

**END OF DOCUMENT**

This document covers the complete system design from backend APIs through frontend components, n8n workflow integration, security considerations, deployment architecture, and operational procedures. Together with SYSTEM_DESIGN_DOCUMENT.md, these documents provide comprehensive technical specifications for rebuilding or maintaining the EOB Extraction System.
