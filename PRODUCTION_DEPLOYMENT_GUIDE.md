# Production Deployment Guide
## Universal Document Processing System Integration

This guide provides detailed instructions for deploying the Universal Document Processing System to production and integrating it with existing portals like **crc.truercm.com**.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Production Architecture](#production-architecture)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Database Setup](#database-setup)
6. [Backend Deployment](#backend-deployment)
7. [Frontend Deployment](#frontend-deployment)
8. [n8n Workflow Integration](#n8n-workflow-integration)
9. [Portal Integration](#portal-integration)
10. [Security Configuration](#security-configuration)
11. [Testing & Validation](#testing--validation)
12. [Monitoring & Maintenance](#monitoring--maintenance)

---

## System Overview

The Universal Document Processing System consists of:

- **Backend API** (Node.js/Express) - Document management and processing
- **Frontend Portal** (React) - User interface
- **n8n Workflow Engine** - Document extraction automation
- **MySQL Database** - Data storage
- **Google Drive Integration** - Cloud file storage

### Key Features

- ✅ Multi-tenant client management
- ✅ Document category routing (EOB, Facesheet, Invoice, etc.)
- ✅ AI-powered data extraction
- ✅ Automated billing & invoicing
- ✅ Real-time processing status updates
- ✅ Role-based access control

---

## Prerequisites

### Required Software

- **Node.js**: v18.x or higher
- **MySQL**: v8.0 or higher
- **n8n**: Latest version
- **PM2**: For process management (production)
- **Nginx**: For reverse proxy (recommended)
- **SSL Certificate**: For HTTPS (Let's Encrypt recommended)

### Required Accounts

- Google Cloud Platform account (for Google Drive API)
- SMTP email service (Gmail App Password or SendGrid)
- Domain name with DNS access

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Load Balancer  │ (Optional)
         │   / SSL Cert    │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼────┐
│ Nginx │   │ Nginx │   │ Nginx  │
│ Proxy │   │ Proxy │   │ Proxy  │
└───┬───┘   └───┬───┘   └───┬────┘
    │           │           │
    │      ┌────▼────┐      │
    │      │ Backend │      │
    │      │ API     │      │
    │      │ (Port   │      │
    │      │ 5000)   │      │
    │      └────┬────┘      │
    │           │           │
┌───▼────┐  ┌──▼──┐    ┌──▼────┐
│Frontend│  │MySQL│    │  n8n  │
│ React  │  │  DB │    │ Engine│
│(Port   │  └─────┘    │(Port  │
│ 3000)  │             │ 5678) │
└────────┘             └───┬───┘
                           │
                     ┌─────▼──────┐
                     │Google Drive│
                     └────────────┘
```

---

## API Endpoints Reference

### Base URL Structure

```
Production: https://crc.truercm.com/api
Development: http://localhost:5000/api
```

### Authentication Endpoints

#### 1. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "userid": 1,
    "username": "user@example.com",
    "user_role": "admin",
    "client_id": null
  }
}
```

#### 2. Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>

Response:
{
  "success": true,
  "user": { ... }
}
```

#### 3. Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

### Document Processing Endpoints

#### 1. Upload Document
```http
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: <PDF file>
- client_id: <number>
- doc_category_id: <number>
- model_id: <number>

Response:
{
  "success": true,
  "message": "Document uploaded and processing initiated",
  "data": {
    "process_id": 123,
    "original_filename": "document.pdf",
    "processing_status": "In-Progress",
    "google_drive_url": "https://drive.google.com/...",
    "n8n_triggered": true
  }
}
```

#### 2. Get Document Status
```http
GET /api/documents/:processId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "process_id": 123,
    "original_filename": "document.pdf",
    "processing_status": "Processed",
    "time_initiated": "2025-11-12T10:30:00Z",
    "time_finished": "2025-11-12T10:35:00Z",
    "extracted_data": [ ... ]
  }
}
```

#### 3. List Documents
```http
GET /api/documents?client_id=1&status=Processed&page=1&limit=20
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "documents": [ ... ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

#### 4. Download Document
```http
GET /api/documents/:processId/download?fileType=pdf
Authorization: Bearer <token>

Response: PDF file (binary)
```

#### 5. Download Extracted Data
```http
GET /api/documents/:processId/download?fileType=csv
Authorization: Bearer <token>

Response: CSV file
```

### Client Management Endpoints

#### 1. Get Clients (Admin)
```http
GET /api/admin/clients
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "client_id": 1,
      "client_name": "ACME Corporation",
      "email": "contact@acme.com",
      "total_documents": 150,
      "total_pages": 450
    }
  ]
}
```

#### 2. Create Client
```http
POST /api/admin/clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_name": "New Client Corp",
  "email": "info@newclient.com",
  "contact_person": "John Doe",
  "phone": "+1234567890"
}
```

### Model Configuration Endpoints

#### 1. Get Models
```http
GET /api/admin/models
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "model_id": 1,
      "model_name": "EOB_Extraction_v1",
      "doc_category_id": 1,
      "is_active": true
    }
  ]
}
```

#### 2. Get Model Fields
```http
GET /api/admin/models/:modelId/fields
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "field_id": 1,
      "field_name": "patient_name",
      "field_type": "text",
      "is_required": true
    }
  ]
}
```

### Document Categories Endpoints

```http
GET /api/admin/categories
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "doc_category_id": 1,
      "category_name": "EOB",
      "description": "Explanation of Benefits"
    },
    {
      "doc_category_id": 2,
      "category_name": "Facesheet",
      "description": "Patient Facesheet"
    }
  ]
}
```

### Billing Endpoints

#### 1. Generate Invoices
```http
POST /api/billing/invoices/generate
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Generated: 5, Updated: 0, Skipped: 3",
  "data": {
    "invoices": [ ... ],
    "summary": {
      "total_generated": 5,
      "total_updated": 0,
      "total_skipped": 3
    }
  }
}
```

#### 2. Get Invoices
```http
GET /api/billing/invoices?client_id=1&status=unpaid
Authorization: Bearer <token>
```

#### 3. Download Invoice PDF
```http
GET /api/billing/invoices/:invoiceId/pdf
Authorization: Bearer <token>

Response: PDF file
```

###  Webhook Endpoint (for n8n)

```http
POST /api/documents/webhook/n8n-results
Content-Type: application/json

{
  "process_id": 123,
  "status": "Processed",
  "result_json_url": "https://drive.google.com/...",
  "result_csv_url": "https://drive.google.com/..."
}

Response:
{
  "success": true,
  "message": "Processing completed successfully"
}
```

---

## Database Setup

### 1. Create Production Database

```sql
CREATE DATABASE eob_extraction_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eob_user'@'localhost' IDENTIFIED BY 'SecurePassword123!';
GRANT ALL PRIVILEGES ON eob_extraction_prod.* TO 'eob_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Run Database Migrations

```bash
# Navigate to project directory
cd /var/www/document-processing

# Run setup script
mysql -u eob_user -p eob_extraction_prod < database/setup.sql

# Run additional migrations
mysql -u eob_user -p eob_extraction_prod < database/permissions_schema.sql
mysql -u eob_user -p eob_extraction_prod < database/billing_invoice_schema.sql
mysql -u eob_user -p eob_extraction_prod < database/custom_reports_schema.sql
```

### 3. Create Admin User

```sql
USE eob_extraction_prod;

-- Insert admin user (password: Admin@123)
INSERT INTO user (username, password_hash, user_role, email, first_name, last_name)
VALUES (
  'admin@truercm.com',
  '$2a$10$XYZ...', -- Use bcrypt to hash password
  'superadmin',
  'admin@truercm.com',
  'System',
  'Administrator'
);
```

---

## Backend Deployment

### 1. Clone Repository

```bash
# On production server
cd /var/www
git clone <your-repository-url> document-processing
cd document-processing
```

### 2. Install Dependencies

```bash
npm install --production
```

### 3. Configure Environment

Create `.env` file:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=eob_user
DB_PASSWORD=SecurePassword123!
DB_NAME=eob_extraction_prod
DB_PORT=3306

# Server Configuration
PORT=5000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Google Drive Configuration
ENABLE_GOOGLE_DRIVE=true
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://crc.truercm.com/auth/google/callback
GOOGLE_DRIVE_SOURCE_FOLDER_ID=your-folder-id
GOOGLE_DRIVE_RESULTS_FOLDER_ID=your-folder-id
GOOGLE_REFRESH_TOKEN=your-refresh-token

# n8n Configuration
ENABLE_N8N=true
N8N_WEBHOOK_URL=https://n8n.truercm.com/webhook/eob-process
N8N_WORKFLOW_ID=your-workflow-id

# Document Processing Configuration
MAX_FILE_SIZE=50000000
ALLOWED_FILE_TYPES=application/pdf
UPLOAD_DIR=./uploads
RESULTS_DIR=./results

# CORS Configuration
CORS_ORIGIN=https://crc.truercm.com

# Billing Configuration
APP_URL=https://crc.truercm.com

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@truercm.com
SMTP_PASS=your-app-password

# Stripe (Optional)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 4. Setup PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start server.js --name "document-processing-api"

# Configure PM2 to start on system boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs document-processing-api

# Restart application
pm2 restart document-processing-api
```

### 5. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/document-processing`:

```nginx
# Upstream backend
upstream backend_api {
    server localhost:5000;
    keepalive 64;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name crc.truercm.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name crc.truercm.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/crc.truercm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crc.truercm.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Root directory for frontend
    root /var/www/document-processing/client/build;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # File uploads
    client_max_body_size 50M;
}
```

Enable site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/document-processing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Frontend Deployment

### 1. Build React Application

```bash
cd /var/www/document-processing/client

# Install dependencies
npm install

# Create production build
npm run build
```

### 2. Configure API Base URL

Update `client/src/config.js`:

```javascript
const config = {
  API_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://crc.truercm.com/api'
    : 'http://localhost:5000/api',
  SOCKET_URL: process.env.NODE_ENV === 'production'
    ? 'https://crc.truercm.com'
    : 'http://localhost:5000'
};

export default config;
```

---

## n8n Workflow Integration

### 1. Install n8n

```bash
# Install n8n globally
npm install -g n8n

# Or use Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### 2. Import Workflow

1. Access n8n: `https://n8n.truercm.com`
2. Go to **Workflows → Import from File**
3. Select: `EOB Processing with Document Category Routing - Final.json`
4. Click **Import**

### 3. Configure Workflow Credentials

#### Google Drive Credentials
- **Name**: Google Drive OAuth2
- **Client ID**: From Google Cloud Console
- **Client Secret**: From Google Cloud Console
- **Redirect URL**: `https://n8n.truercm.com/rest/oauth2-credential/callback`

#### OpenAI Credentials
- **API Key**: Your OpenAI API key

#### HTTP Request Credentials (for webhook)
- **URL**: `https://crc.truercm.com/api/documents/webhook/n8n-results`
- **Authentication**: None (or Bearer Token if required)

### 4. Update Webhook URLs

In the workflow, update:
1. **Webhook Trigger** node:
   - Webhook URL: `https://n8n.truercm.com/webhook/eob-process`
   
2. **HTTP Request** node (send results back):
   - URL: `https://crc.truercm.com/api/documents/webhook/n8n-results`

### 5. Activate Workflow

Click **Active** toggle to enable the workflow.

---

## Portal Integration

### Integrating with Existing Portal (crc.truercm.com)

#### Option 1: Iframe Integration

```html
<!-- In your existing portal -->
<iframe 
  src="https://crc.truercm.com" 
  width="100%" 
  height="800px"
  frameborder="0"
></iframe>
```

#### Option 2: API Integration

```javascript
// In your existing portal's JavaScript
const API_BASE = 'https://crc.truercm.com/api';
let authToken = null;

// Login function
async function login(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    authToken = data.token;
    localStorage.setItem('doc_processing_token', authToken);
  }
  return data;
}

// Upload document function
async function uploadDocument(file, clientId, docCategoryId, modelId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('client_id', clientId);
  formData.append('doc_category_id', docCategoryId);
  formData.append('model_id', modelId);
  
  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });
  
  return await response.json();
}

// Get documents function
async function getDocuments(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`${API_BASE}/documents?${params}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  return await response.json();
}

// Usage example
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];
  
  const result = await uploadDocument(file, 1, 1, 1);
  console.log('Upload result:', result);
  
  // Poll for status updates
  pollDocumentStatus(result.data.process_id);
});

function pollDocumentStatus(processId) {
  const interval = setInterval(async () => {
    const response = await fetch(`${API_BASE}/documents/${processId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const data = await response.json();
    
    if (data.data.processing_status === 'Processed') {
      clearInterval(interval);
      console.log('Processing complete!', data);
      // Download results or display them
    }
  }, 5000); // Check every 5 seconds
}
```

#### Option 3: Widget Integration

Create a widget that can be embedded in any page:

```html
<script src="https://crc.truercm.com/widget.js"></script>
<div id="doc-processing-widget"></div>
<script>
  DocumentProcessingWidget.init({
    container: '#doc-processing-widget',
    apiKey: 'your-api-key',
    clientId: 1,
    onUploadComplete: (result) => {
      console.log('Document uploaded:', result);
    }
  });
</script>
```

---

## Security Configuration

### 1. Firewall Setup

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. Database Security

```sql
-- Remove test users
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Secure passwords
ALTER USER 'eob_user'@'localhost' IDENTIFIED BY 'VeryStrongPassword123!@#';

FLUSH PRIVILEGES;
```

### 3. API Rate Limiting

Already configured in `server.js`:
- 100 requests per 15 minutes per IP
- Adjustable in `.env`

### 4. CORS Configuration

Update `.env`:
```env
CORS_ORIGIN=https://crc.truercm.com,https://www.crc.truercm.com
```

### 5. SSL/TLS Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d crc.truercm.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Testing & Validation

### 1. Health Check

```bash
curl https://crc.truercm.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-12T10:30:00Z",
  "environment": "production"
}
```

### 2. Authentication Test

```bash
curl -X POST https://crc.truercm.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@truercm.com","password":"Admin@123"}'
```

### 3. Document Upload Test

```bash
curl -X POST https://crc.truercm.com/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test-document.pdf" \
  -F "client_id=1" \
  -F "doc_category_id=1" \
  -F "model_id=1"
```

### 4. End-to-End Test

1. Login to portal
2. Upload test document
3. Monitor processing status
4. Download extracted data
5. Verify results

---

## Monitoring & Maintenance

### 1. Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs document-processing-api --lines 100

# Check status
pm2 status
```

### 2. Database Monitoring

```sql
-- Check database size
SELECT 
  table_schema AS 'Database',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'eob_extraction_prod'
GROUP BY table_schema;

-- Check slow queries
SHOW PROCESSLIST;
```

### 3. Disk Space Monitoring

```bash
# Check disk usage
df -h

# Check uploads directory
du -sh /var/www/document-processing/uploads
du -sh /var/www/document-processing/results
```

### 4. Backup Strategy

```bash
#!/bin/bash
# backup.sh - Run daily via cron

# Database backup
mysqldump -u eob_user -p eob_extraction_prod > /backups/db_$(date +%Y%m%d).sql

# File backups
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz /var/www/document-processing/uploads
tar -czf /backups/results_$(date +%Y%m%d).tar.gz /var/www/document-processing/results

# Keep only last 30 days
find /backups -name "*.sql" -mtime +30 -delete
find /backups -name "*.tar.gz" -mtime +30 -delete
```

Add to crontab:
```bash
0 2 * * * /usr/local/bin/backup.sh
```

### 5. Log Rotation

Create `/etc/logrotate.d/document-processing`:
```
/var/www/document-processing/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
# Check if API is running
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check logs
pm2 logs document-processing-api
```

#### 2. Database Connection Error
```bash
# Test database connection
mysql -u eob_user -p -h localhost eob_extraction_prod

# Check credentials in .env
cat .env | grep DB_
```

#### 3. n8n Workflow Not Triggering
- Verify workflow is Active
- Check webhook URL is correct
- Test webhook manually:
  ```bash
  curl -X POST https://n8n.truercm.com/webhook/eob-process \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

#### 4. Google Drive Access Issues
- Regenerate refresh token
- Check folder permissions
- Verify credentials in n8n

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs
- Monitor disk space
- Review error logs

**Weekly:**
- Review system performance
- Check backup integrity
- Update dependencies (if needed)

**Monthly:**
- Review security updates
- Optimize database
- Clean old logs and files

### Contact & Support

For production support:
- Email: support@truercm.com
- Documentation: https://docs.truercm.com
- Emergency: [Emergency contact number]

---

## Changelog

### Version 1.0.0 (Current)
- Initial production deployment
- Complete n8n workflow integration
- Billing module
- Multi-client support
- Real-time processing updates

---

**Document Last Updated**: November 12, 2025
**Version**: 1.0.0
**Status**: Production Ready ✅
