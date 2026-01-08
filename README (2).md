# EOB Extraction System

Enterprise-level document processing system for Explanation of Benefits (EOB) documents with n8n workflow integration, Google Drive storage, and comprehensive admin panel.

## 🎯 Features

### Core Functionality
- **Multi-user Document Upload**: Users worldwide can concurrently upload PDF documents
- **Intelligent PDF Processing**: Automatic splitting of large PDFs (>30 pages) with parallel processing
- **n8n Workflow Integration**: Automated processing pipeline with webhook triggers
- **Google Drive Integration**: Automatic upload to designated folders (eob-source, eob-results)
- **Real-time Progress Tracking**: WebSocket-based status updates
- **Comprehensive Data Extraction**: 25+ standard fields plus dynamic field mapping
- **Multiple Output Formats**: JSON, CSV, and ZIP downloads

### User Management
- Role-based access control (User, Admin, SuperAdmin, Client)
- User authentication with JWT tokens
- Profile management with timezone support
- Password reset functionality
- Audit logging for all actions

### Admin Panel
- **User Management**: Create, edit, delete users with role assignments
- **Client Management**: Manage client accounts and configurations
- **Model Configuration**: Create and manage field extraction models
- **Field Management**: Define and configure extraction fields with keywords
- **Document Categories**: Manage different document types (EOB, Facesheet, etc.)
- **Audit Logs**: Track all system activities

### Processing Features
- PDF page splitting (30 pages per chunk)
- Parallel processing of document parts
- Result consolidation with proper page numbering
- Error handling and logging
- "Already Processed" detection (files starting with `Processed_`)
- Session-based processing with unique identifiers

## 🏗️ System Architecture

```
┌─────────────────┐
│   React Client  │
│   (Port 3000)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────┐
│  Express Server │ ←──→ │    MySQL     │
│   (Port 5000)   │      │   Database   │
└────────┬────────┘      └──────────────┘
         │
         ├──→ Google Drive API
         │
         └──→ n8n Workflow
              (Port 5678)
```

## 📋 Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Google Cloud account (for Drive API)
- n8n instance running on localhost:5678

## 🚀 Installation

### 1. Clone Repository

```bash
cd c:/n8ndata/eob-extraction-final
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### 4. Database Setup

```bash
# Create MySQL database
mysql -u root -p

# Run the setup script
mysql -u root -p < database/setup.sql
```

Or let the system auto-create:
The server will automatically create the database and tables on first run.

### 5. Environment Configuration

Update the `.env` file with your configuration:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=AdminRootDBAli
DB_NAME=documentprocessingdb
DB_PORT=3306

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024
JWT_EXPIRE=24h

# Google Drive
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
GOOGLE_DRIVE_FOLDER_SOURCE=eob-source
GOOGLE_DRIVE_FOLDER_RESULTS=eob-results

# n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook/eob-process
N8N_WORKFLOW_ID=Z0rxBnTp1NrUlJy8

# Processing
PDF_SPLIT_PAGE_LIMIT=30
UPLOAD_DIR=./uploads
RESULTS_DIR=./results
TEMP_DIR=./temp

# CORS
CORS_ORIGIN=http://localhost:3000
SOCKET_IO_CORS_ORIGIN=http://localhost:3000
```

### 6. Google Drive API Setup

**📘 For detailed setup instructions, see [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md)**

Quick setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials or Service Account
5. Add authorized redirect URIs
6. Download credentials and update `.env`

**Folder Configuration:**
- Default source folder: `eob-source` (configurable in `.env`)
- Default results folder: `eob-results` (configurable in `.env`)
- Folders are automatically created if they don't exist
- System works without Drive configured (local storage only)

### 7. n8n Workflow Setup

1. Import the workflow file: `C:\Users\AsgarAliSayed\Downloads\EOB_data_Extract_OCR-API__n8n_latest_v8_eob_assistant (2).json`
2. Configure the webhook URL to match your n8n instance
3. Activate the workflow

## 🎮 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- n8n: http://localhost:5678

### Production Mode

```bash
# Build frontend
cd client
npm run build
cd ..

# Start server
npm start
```

## 📚 API Documentation

### Authentication

**POST /api/auth/login**
```json
{
  "email": "admin@eobsystem.com",
  "password": "Admin@123"
}
```

**GET /api/auth/profile**
- Requires: Bearer token

**PUT /api/auth/profile**
- Update user profile

**POST /api/auth/change-password**
- Change user password

### Documents

**POST /api/documents/upload**
- Upload PDF document
- FormData with file and doc_category

**GET /api/documents**
- List all documents with filters
- Query params: status, client_id, doc_category, page, limit

**GET /api/documents/:processId**
- Get document details

**GET /api/documents/:processId/data**
- Get extracted data (JSON)

**GET /api/documents/:processId/download/:fileType**
- Download file (pdf, csv, json, zip)

### Admin Routes

**GET /api/admin/users**
- List all users

**POST /api/admin/users** (via /api/auth/register)
- Create new user

**PUT /api/admin/users/:userid**
- Update user

**GET /api/admin/clients**
- List all clients

**POST /api/admin/clients**
- Create new client

**GET /api/admin/models**
- List all models

**POST /api/admin/models**
- Create new model configuration

**GET /api/admin/fields**
- List all fields

**POST /api/admin/fields**
- Create new field

## 🗄️ Database Schema

### Key Tables

- `user_profile`: User accounts and authentication
- `client`: Client organizations
- `document_processed`: Document processing records
- `doc_category`: Document types (EOB, Facesheet, etc.)
- `field_table`: Field definitions with keywords
- `model_config`: Extraction model configurations
- `field_mapping`: Model-to-field relationships
- `processing_logs`: Processing activity logs
- `audit_log`: System audit trail

## 📊 Output Format

### JSON Schema
```json
{
  "input_file": "document.pdf",
  "session_id": "user123_20240609_114523",
  "processing_id": "12345",
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
      "Confidence_Score": 0.95
    }
  ],
  "errors": []
}
```

### CSV Format
- First 25 standard columns in fixed order
- Dynamic fields from model configuration
- Error column (rightmost)
- Metadata rows at top (Session ID, Processing ID)

## 🔐 Default Credentials

**SuperAdmin Account:**
- Email: admin@eobsystem.com
- Password: Admin@123

**Important:** Change default password after first login!

## 🛠️ Configuration

### PDF Processing
- Pages per chunk: 30 (configurable via PDF_SPLIT_PAGE_LIMIT)
- Max file size: 50MB (configurable via MAX_FILE_SIZE)
- Supported format: PDF only

### Google Drive
- Source folder: eob-source
- Results folder: eob-results
- Files prefixed with `Processed_` are skipped

### Field Extraction
- 25 standard EOB fields
- Custom fields via model configuration
- Keyword-based extraction
- Confidence scoring

## 🧪 Testing

```bash
# Backend tests
npm test

# Frontend tests
cd client
npm test
```

## 📝 Processing Workflow

1. **Upload**: User uploads PDF via UI
2. **Validation**: Check filename (reject if starts with `Processed_`)
3. **Storage**: Save to local uploads directory
4. **Database**: Create processing record with status "In-Progress"
5. **Split**: If >30 pages, split into chunks
6. **Google Drive**: Upload all parts to eob-source folder
7. **n8n Trigger**: Call webhook for each part with metadata
8. **Processing**: n8n workflow extracts data via Document AI
9. **Consolidation**: Merge results from all parts
10. **Output**: Generate CSV and JSON files
11. **Results Upload**: Upload to eob-results folder
12. **Complete**: Update database status to "Processed"

## 🌍 Internationalization

- Timezone support for all users
- Date formatting based on user timezone
- Multi-language ready (structure in place)

## 🔍 Monitoring

- Processing logs stored in database
- Real-time progress via WebSocket
- Audit logging for admin actions
- Error tracking and reporting

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check MySQL service
# Windows
net start MySQL80

# Verify credentials
mysql -u root -p
```

### n8n Workflow Not Triggering
- Check n8n is running: http://localhost:5678
- Verify webhook URL in .env
- Check n8n workflow is activated
- Review n8n logs for errors

### Google Drive Upload Failing
- Verify API credentials
- Check OAuth permissions
- Ensure Drive API is enabled
- Review folder permissions

### Port Already in Use
```bash
# Windows - Kill process on port
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 📦 Project Structure

```
eob-extraction-final/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   └── App.js
│   └── package.json
├── config/                # Configuration files
│   └── database.js
├── database/              # Database scripts
│   └── setup.sql
├── middleware/            # Express middleware
│   └── auth.js
├── routes/                # API routes
│   ├── auth.js
│   ├── documents.js
│   └── admin.js
├── services/              # Business logic
│   ├── documentProcessor.js
│   ├── googleDrive.js
│   └── dataFormatter.js
├── uploads/               # Uploaded files
├── results/               # Processing results
├── temp/                  # Temporary files
├── .env                   # Environment variables
├── server.js              # Express server
├── package.json
└── README.md
```

## 🤝 Contributing

This is an enterprise system. For modifications:
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit for review

## 📄 License

Proprietary - Internal use only

## 🆘 Support

For issues or questions:
- Check troubleshooting section
- Review logs in ./logs/
- Contact system administrator

## 🔄 Updates

### Version 1.0.0
- Initial release
- Core processing functionality
- Admin panel
- Google Drive integration
- n8n workflow support

---

**Built with ❤️ for enterprise document processing**
