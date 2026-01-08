# EOB EXTRACTION SYSTEM - COMPLETE FUNCTIONAL & TECHNICAL DESIGN DOCUMENT

**Document Version:** 1.0  
**Last Updated:** January 7, 2025  
**System Version:** 1.0.0

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Design](#3-architecture-design)
4. [Database Design](#4-database-design)
5. [Backend API Design](#5-backend-api-design)
6. [Frontend Design](#6-frontend-design)
7. [n8n Workflow Integration](#7-n8n-workflow-integration)
8. [Security & Authentication](#8-security--authentication)
9. [Data Processing Pipeline](#9-data-processing-pipeline)
10. [External Integrations](#10-external-integrations)
11. [Configuration & Environment](#11-configuration--environment)
12. [Installation & Deployment](#12-installation--deployment)
13. [Testing Strategy](#13-testing-strategy)
14. [Maintenance & Operations](#14-maintenance--operations)
15. [Appendices](#15-appendices)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose
This document provides complete functional and technical specifications for the EOB (Explanation of Benefits) Extraction System. It serves as the definitive reference for rebuilding the entire system from scratch without additional clarification.

### 1.2 System Description
An enterprise-level document processing system that:
- Accepts PDF uploads from authenticated users
- Processes EOB documents using Google Document AI and OpenAI
- Extracts structured data with 25+ standard fields
- Stores results in MySQL database and Google Drive
- Provides real-time processing status via WebSockets
- Offers comprehensive admin panel for user, client, and model management

### 1.3 Key Features
- Multi-tenant architecture with role-based access control
- n8n workflow automation for document processing
- Google Drive integration for storage
- Dynamic model configuration with custom field mapping
- Cost tracking (Document AI + OpenAI usage)
- Real-time WebSocket updates
- CSV and JSON export capabilities
- Comprehensive audit logging

### 1.4 Technology Stack

**Backend:**
- Node.js 18+
- Express.js 4.18.2
- MySQL 8.0+ with mysql2 driver
- JWT authentication
- Socket.IO for real-time updates

**Frontend:**
- React 18+
- Material-UI (MUI)
- React Router v6
- Axios for API calls
- Context API for state management

**External Services:**
- n8n (workflow automation)
- Google Drive API (file storage)
- Google Document AI (OCR/extraction)
- OpenAI GPT models (intelligent extraction)

**Development Tools:**
- Nodemon for development
- Concurrently for running multiple processes
- Winston for logging

---

## 2. SYSTEM OVERVIEW

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            React SPA (Port 3000)                          │  │
│  │  - Material-UI Components                                 │  │
│  │  - JWT Auth Context                                       │  │
│  │  - Socket.IO Client                                       │  │
│  │  - Axios HTTP Client                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │       Express.js Server (Port 5000)                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────────┐      │  │
│  │  │   Routes   │  │ Middleware │  │   Services    │      │  │
│  │  │ - Auth     │  │ - JWT      │  │ - Document    │      │  │
│  │  │ - Documents│  │ - CORS     │  │ - Google Drive│      │  │
│  │  │ - Admin    │  │ - Rate Lim.│  │ - Formatter   │      │  │
│  │  └────────────┘  └────────────┘  └───────────────┘      │  │
│  │                                                            │  │
│  │              Socket.IO Server (Real-time)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓                              ↓
┌──────────────────────────┐      ┌──────────────────────────────┐
│    DATA LAYER            │      │   WORKFLOW LAYER             │
│  ┌────────────────────┐  │      │  ┌────────────────────────┐ │
│  │  MySQL Database    │  │      │  │  n8n (Port 5678)       │ │
│  │  - 11 Core Tables  │  │      │  │  - 21 Node Workflow    │ │
│  │  - Audit Logging   │  │      │  │  - Webhook Trigger     │ │
│  │  - User Management │  │      │  │  - Python Integration  │ │
│  └────────────────────┘  │      │  └────────────────────────┘ │
└──────────────────────────┘      └──────────────────────────────┘
                                              ↓
                    ┌─────────────────────────────────────────┐
                    │      EXTERNAL SERVICES                  │
                    │  ┌───────────────┐  ┌───────────────┐  │
                    │  │ Google Drive  │  │ Document AI   │  │
                    │  │ - File Storage│  │ - OCR Extract │  │
                    │  └───────────────┘  └───────────────┘  │
                    │  ┌───────────────┐                     │
                    │  │   OpenAI API  │                     │
                    │  │ - GPT Models  │                     │
                    │  └───────────────┘                     │
                    └─────────────────────────────────────────┘
```

### 2.2 User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **SuperAdmin** | System administrator | Full access to all features, user management, system configuration |
| **Admin** | Organization administrator | Manage users within organization, view all documents, configure models |
| **Client** | Client organization user | View/upload documents for their organization, limited admin functions |
| **User** | Regular user | Upload documents, view own documents, basic profile management |

### 2.3 Core Workflows

#### 2.3.1 Document Upload & Processing Flow
```
User → Upload PDF → Server Validation → Database Record Created
                                              ↓
                                    Google Drive Upload
                                              ↓
                                    n8n Webhook Triggered
                                              ↓
                        ┌────────────────────────────────────┐
                        │     n8n Processing Pipeline        │
                        │  1. Download PDF from Drive        │
                        │  2. Document AI OCR Extraction     │
                        │  3. OpenAI Intelligent Parsing     │
                        │  4. Cost Calculation               │
                        │  5. Generate JSON/CSV              │
                        │  6. Upload Results to Drive        │
                        │  7. Move PDF to Processed Folder   │
                        │  8. Send Results Back to Server    │
                        └────────────────────────────────────┘
                                              ↓
                        Database Updated → User Notified via WebSocket
```

#### 2.3.2 User Authentication Flow
```
Login Request → Validate Credentials → Generate JWT Token
                                              ↓
                                    Return Token to Client
                                              ↓
                                    Store in LocalStorage
                                              ↓
                        Subsequent Requests Include Token in Header
                                              ↓
                        Server Validates Token on Each Request
```

---

## 3. ARCHITECTURE DESIGN

### 3.1 Backend Architecture

#### 3.1.1 Directory Structure
```
eob-extraction-final/
├── config/
│   ├── database.js              # MySQL connection & setup
│   └── eob-extraction-system-*.json  # Google Service Account credentials
├── middleware/
│   └── auth.js                  # Authentication middleware
├── routes/
│   ├── auth.js                  # Authentication routes
│   ├── documents.js             # Document management routes
│   └── admin.js                 # Admin panel routes
├── services/
│   ├── documentProcessor.js     # Document processing logic
│   ├── googleDrive.js           # Google Drive integration
│   └── dataFormatter.js         # CSV/JSON formatting
├── database/
│   ├── setup.sql                # Complete database schema
│   ├── model_table.sql          # Model configuration schema
│   ├── update_model_table.sql   # Schema updates
│   └── add_field_unique_constraint.sql
├── uploads/                     # Uploaded PDF files
├── results/                     # Generated CSV/JSON files
├── temp/                        # Temporary processing files
├── logs/                        # Application logs
├── server.js                    # Main server entry point
├── package.json                 # Dependencies
└── .env                         # Environment configuration
```

#### 3.1.2 Core Modules

**server.js** - Main Application Server
```javascript
// Key Responsibilities:
- Express app initialization
- Middleware configuration (CORS, Helmet, Rate Limiting)
- Socket.IO setup for real-time updates
- Route registration
- Database connection management
- Error handling
- Graceful shutdown handling
```

**config/database.js** - Database Configuration
```javascript
// Key Responsibilities:
- MySQL connection pool management
- Database auto-creation on startup
- Query execution wrapper
- Transaction support
- Connection testing
```

**middleware/auth.js** - Authentication & Authorization
```javascript
// Functions:
- verifyToken(): JWT token validation
- checkRole(): Role-based access control
- checkClientAccess(): Multi-tenant isolation
- checkPermission(): Granular permissions
- logActivity(): Audit logging
```

### 3.2 Frontend Architecture

#### 3.2.1 Directory Structure
```
client/
├── public/
│   └── index.html               # HTML template
├── src/
│   ├── index.js                 # React entry point
│   ├── App.js                   # Main app component with routing
│   ├── components/
│   │   ├── Layout.js            # Main layout with sidebar
│   │   ├── PrivateRoute.js      # Protected route wrapper
│   │   └── PricingConfiguration.jsx
│   ├── contexts/
│   │   └── AuthContext.js       # Global auth state
│   ├── pages/
│   │   ├── Login.js             # Login page
│   │   ├── Dashboard.js         # User dashboard
│   │   ├── Documents.js         # Document listing
│   │   ├── DocumentDetails.js   # Document viewer/editor
│   │   ├── Upload.js            # File upload page
│   │   ├── Profile.js           # User profile
│   │   └── Admin/
│   │       ├── AdminPanel.js    # Admin layout
│   │       ├── UserManagement.js
│   │       ├── ClientManagement.js
│   │       ├── DocCategoryManagement.js
│   │       ├── ModelManagement.js
│   │       ├── FieldManagement.js
│   │       └── PricingConfig.js
│   └── package.json
```

#### 3.2.2 State Management

**AuthContext** - Global Authentication State
```javascript
// Provides:
- user: Current user object
- loading: Auth check in progress
- login(credentials): Login function
- logout(): Logout function
- updateProfile(data): Profile update
- Token management in localStorage
```

#### 3.2.3 Routing Structure
```
/ (root)
├── /login                       # Public route
└── / (authenticated)
    ├── /dashboard               # Home dashboard
    ├── /documents               # Document list
    ├── /documents/:processId    # Document details
    ├── /upload                  # Upload page
    ├── /profile                 # User profile
    └── /admin                   # Admin panel (admin/superadmin only)
        ├── /admin/users
        ├── /admin/clients
        ├── /admin/doc-categories
        ├── /admin/model-versions
        ├── /admin/fields
        └── /admin/pricing
```

---

## 4. DATABASE DESIGN

### 4.1 Entity Relationship Diagram

```
┌─────────────────┐         ┌──────────────────┐
│   client        │────┬───→│  user_profile    │
│ PK: client_id   │    │    │ PK: userid       │
│ - client_name   │    │    │ FK: client_id    │
│ - contact_name  │    │    │ - email          │
│ - email         │    │    │ - password       │
│ - status        │    │    │ - user_role      │
│ - active_model  │    │    │ - is_active      │
└─────────────────┘    │    └──────────────────┘
         │             │              │
         │             │              │
         ↓             │              ↓
┌─────────────────┐   │    ┌──────────────────┐
│ model_config    │   │    │ audit_log        │
│ PK: model_id    │   │    │ PK: audit_id     │
│ FK: client_id   │   │    │ FK: userid       │
│ FK: doc_category│   │    │ - action         │
│ - model_name    │   │    │ - table_name     │
│ - is_default    │   │    │ - record_id      │
└─────────────────┘   │    └──────────────────┘
         │            │
         │            │
         ↓            │
┌─────────────────┐   │
│ field_mapping   │   │
│ PK: mapping_id  │   │
│ FK: model_id    │   │
│ FK: field_id    │   │
│ - field_order   │   │
└─────────────────┘   │
         │            │
         ↓            │
┌─────────────────┐   │    ┌──────────────────────┐
│ field_table     │   │    │ document_processed   │
│ PK: field_id    │   └───→│ PK: process_id       │
│ FK: doc_category│        │ FK: userid           │
│ - field_name    │        │ FK: client_id        │
│ - field_type    │        │ FK: model_id         │
│ - keywords      │        │ FK: doc_category     │
└─────────────────┘        │ - doc_name           │
         ↑                 │ - processing_status  │
         │                 │ - no_of_pages        │
┌─────────────────┐        │ - total_records      │
│ doc_category    │        │ - cost               │
│ PK: category_id │        │ - link_to_file       │
│ - category_name │        │ - link_to_csv        │
└─────────────────┘        │ - link_to_json       │
                           │ - session_id         │
                           │ - gdrive_file_id     │
                           └──────────────────────┘
                                     │
                                     ↓
                           ┌──────────────────────┐
                           │ processing_logs      │
                           │ PK: log_id           │
                           │ FK: process_id       │
                           │ - log_level          │
                           │ - log_message        │
                           └──────────────────────┘
```

### 4.2 Core Tables

#### 4.2.1 user_profile
**Purpose:** User authentication and profile management

```sql
CREATE TABLE user_profile (
    userid INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP NULL,
    user_role ENUM('user', 'admin', 'superadmin', 'client') DEFAULT 'user',
    client_id INT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE SET NULL
);
```

**Key Fields:**
- `userid`: Primary key, auto-increment
- `email`: Unique identifier for login
- `password`: Bcrypt hashed password
- `user_role`: Role-based access control
- `client_id`: Links user to organization
- `timezone`: User's preferred timezone
- `is_active`: Soft delete flag

**Indexes:**
- PRIMARY KEY (userid)
- UNIQUE KEY (email)
- INDEX (user_role)
- INDEX (client_id)

#### 4.2.2 client
**Purpose:** Multi-tenant organization management

```sql
CREATE TABLE client (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_no VARCHAR(50),
    date_started DATE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    active_model INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `client_id`: Primary key
- `client_name`: Organization name
- `status`: Active/Inactive flag
- `active_model`: Default model_id for this client

#### 4.2.3 document_processed
**Purpose:** Document processing records and metadata

```sql
CREATE TABLE document_processed (
    process_id INT AUTO_INCREMENT PRIMARY KEY,
    doc_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    no_of_pages INT,
    total_records INT DEFAULT 0,
    processing_status ENUM('In-Progress', 'Processed', 'Failed') DEFAULT 'In-Progress',
    time_initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_finished TIMESTAMP NULL,
    total_processing_time INT COMMENT 'Time in seconds',
    cost DECIMAL(10,4) DEFAULT 0,
    document_ai_cost DECIMAL(10,4) DEFAULT 0,
    openai_cost DECIMAL(10,4) DEFAULT 0,
    link_to_file VARCHAR(1000),
    link_to_csv VARCHAR(1000),
    link_to_json VARCHAR(1000),
    json_drive_id VARCHAR(255),
    csv_drive_id VARCHAR(255),
    userid INT,
    client_id INT,
    model_id INT,
    session_id VARCHAR(255),
    doc_category INT,
    gdrive_file_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE SET NULL,
    FOREIGN KEY (doc_category) REFERENCES doc_category(category_id) ON DELETE SET NULL
);
```

**Key Fields:**
- `process_id`: Unique processing identifier
- `processing_status`: In-Progress → Processed/Failed
- `session_id`: Format: {userid}_{YYYYMMDD_HHmmss}
- `cost`: Total processing cost (Document AI + OpenAI)
- `gdrive_file_id`: Source PDF Google Drive ID
- `json_drive_id`: Results JSON Google Drive ID
- `csv_drive_id`: Results CSV Google Drive ID

**Indexes:**
- PRIMARY KEY (process_id)
- INDEX (processing_status)
- INDEX (session_id)
- INDEX (userid)
- INDEX (client_id)

#### 4.2.4 field_table
**Purpose:** Field definitions with keyword mappings

```sql
CREATE TABLE field_table (
    field_id INT AUTO_INCREMENT PRIMARY KEY,
    field_name VARCHAR(255) NOT NULL,
    field_display_name VARCHAR(255),
    field_type ENUM('string', 'number', 'date', 'boolean') DEFAULT 'string',
    doc_category INT,
    is_required BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255),
    validation_regex VARCHAR(500),
    keywords TEXT COMMENT 'JSON array of keywords for field extraction',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_category) REFERENCES doc_category(category_id) ON DELETE CASCADE,
    UNIQUE KEY unique_field_category (field_name, doc_category)
);
```

**Key Fields:**
- `field_name`: Internal field identifier
- `field_display_name`: User-friendly label
- `field_type`: Data type for validation
- `keywords`: JSON array for extraction hints
- `doc_category`: Links to document type

**Default EOB Fields (23 fields):**
```
patient_acct, Patient_ID, Claim_ID, Patient_Name, First_Name, 
Last_Name, member_number, service_date, allowed_amount, 
interest_amount, paid_amount, insurance_co, billed_amount, 
cpt_hcpcs, adj_co45, adj_co144, adj_co253, check_number, 
account_number, patient_responsibility, claim_summary, 
action_required, reason_code_comments
```

#### 4.2.5 model_config
**Purpose:** Extraction model configurations

```sql
CREATE TABLE model_config (
    model_id INT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    doc_category INT NOT NULL,
    client_id INT,
    is_default BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_category) REFERENCES doc_category(category_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES user_profile(userid) ON DELETE SET NULL
);
```

#### 4.2.6 field_mapping
**Purpose:** Links models to specific fields

```sql
CREATE TABLE field_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    field_id INT NOT NULL,
    field_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES model_config(model_id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES field_table(field_id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_field (model_id, field_id)
);
```

#### 4.2.7 doc_category
**Purpose:** Document type classification

```sql
CREATE TABLE doc_category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Default Categories:**
- ID 1: 'eob' - Explanation of Benefits
- ID 2: 'facesheet' - Patient Facesheet

#### 4.2.8 processing_logs
**Purpose:** Detailed processing activity logs

```sql
CREATE TABLE processing_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    process_id INT NOT NULL,
    log_level ENUM('INFO', 'WARNING', 'ERROR') DEFAULT 'INFO',
    log_message TEXT,
    log_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES document_processed(process_id) ON DELETE CASCADE
);
```

#### 4.2.9 audit_log
**Purpose:** System-wide audit trail

```sql
CREATE TABLE audit_log (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    userid INT,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE SET NULL
);
```

#### 4.2.10 user_permissions
**Purpose:** Granular permission management

```sql
CREATE TABLE user_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    granted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    UNIQUE KEY unique_user_permission (userid, permission_name)
);
```

### 4.3 Views

#### 4.3.1 v_processing_summary
```sql
CREATE OR REPLACE VIEW v_processing_summary AS
SELECT 
    dp.process_id,
    dp.doc_name,
    dp.no_of_pages,
    dp.processing_status,
    dp.time_initiated,
    dp.time_finished,
    dp.total_processing_time,
    u.email as user_email,
    c.client_name,
    mc.model_name,
    dc.category_name
FROM document_processed dp
LEFT JOIN user_profile u ON dp.userid = u.userid
LEFT JOIN client c ON dp.client_id = c.client_id
LEFT JOIN model_config mc ON dp.model_id = mc.model_id
LEFT JOIN doc_category dc ON dp.doc_category = dc.category_id
ORDER BY dp.time_initiated DESC;
```

---

## 5. BACKEND API DESIGN

### 5.1 Authentication API

#### 5.1.1 POST /api/auth/register
**Purpose:** Create new user account

**Access:** Public (but typically restricted to admins in production)

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "user_role": "user",
  "client_id": 1,
  "timezone": "America/New_York"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "userid": 5,
    "email": "user@example.com",
    "user_role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation Rules:**
- Email must be valid format and unique
- Password minimum 8 characters
- user_role must be: user, admin, superadmin, or client
- client_id required for non-superadmin users

#### 5.1.2 POST /api/auth/login
**Purpose:** Authenticate user and return JWT token

**Access:** Public

**Request Body:**
```json
{
  "email": "admin@eobsystem.com",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userid": 1,
    "email": "admin@eobsystem.com",
    "first_name": "System",
    "last_name": "Administrator",
    "user_role": "superadmin",
    "client_id": null,
    "timezone": "UTC"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

#### 5.1.3 GET /api/auth/profile
**Purpose:** Get current user profile

**Access:** Authenticated users

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "userid": 1,
    "email": "admin@eobsystem.com",
    "first_name": "System",
    "last_name": "Administrator",
    "user_role": "superadmin",
    "client_id": null,
    "timezone": "UTC",
    "last_login": "2025-01-07T20:30:00Z"
  }
}
```

#### 5.1.4 PUT /api/auth/profile
**Purpose:** Update user profile

**Access:** Authenticated users

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "timezone": "America/Chicago"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user
