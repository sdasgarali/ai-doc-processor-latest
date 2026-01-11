# DocuParse - Google Cloud Enterprise Deployment Guide

## Complete Step-by-Step Instructions for Production Deployment

**Version:** 1.0
**Last Updated:** January 2026
**Estimated Time:** 2-3 hours

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Google Cloud Project Setup](#phase-1-google-cloud-project-setup)
4. [Phase 2: Database Setup (Cloud SQL)](#phase-2-database-setup-cloud-sql-postgresql)
5. [Phase 3: Secret Manager Setup](#phase-3-secret-manager-setup)
6. [Phase 4: Document AI Processor Setup](#phase-4-document-ai-processor-setup)
7. [Phase 5: Deploy Python Processor](#phase-5-deploy-python-processor-cloud-run)
8. [Phase 6: Deploy Node.js Backend](#phase-6-deploy-nodejs-backend-cloud-run)
9. [Phase 7: Deploy Frontend](#phase-7-deploy-frontend-firebase-hosting)
10. [Phase 8: Update Configuration](#phase-8-update-configuration)
11. [Phase 9: Custom Domain (Optional)](#phase-9-custom-domain-optional)
12. [Phase 10: Verification & Testing](#phase-10-verification--testing)
13. [Cost Estimation](#cost-estimation-monthly)
14. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GOOGLE CLOUD                              │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Firebase   │     │  Cloud Run   │     │  Cloud Run   │    │
│  │   Hosting    │────▶│   Backend    │────▶│   Python     │    │
│  │  (Frontend)  │     │  (Node.js)   │     │  Processor   │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│         │                    │                     │            │
│         │                    ▼                     │            │
│         │             ┌──────────────┐             │            │
│         │             │  Cloud SQL   │◀────────────┘            │
│         │             │ (PostgreSQL) │                          │
│         │             └──────────────┘                          │
│         │                    │                                  │
│         │             ┌──────────────┐     ┌──────────────┐    │
│         │             │   Secret     │     │  Document AI │    │
│         │             │   Manager    │     │  Processor   │    │
│         │             └──────────────┘     └──────────────┘    │
│         │                                                       │
│         └──────────────────────────────────────────────────────│
│                                                                  │
│  External APIs: OpenAI GPT-4                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Description

| Component | Service | Purpose |
|-----------|---------|---------|
| Frontend | Firebase Hosting | React web application (UI) |
| Backend | Cloud Run | Node.js/Express API server |
| Processor | Cloud Run | Python document processing |
| Database | Cloud SQL | PostgreSQL data storage |
| Secrets | Secret Manager | Secure credential storage |
| OCR | Document AI | PDF text extraction |
| LLM | OpenAI API | Data extraction from text |

---

## Prerequisites

Before starting, ensure you have:

- [ ] Google account (Gmail)
- [ ] Credit card for billing (free tier available, won't be charged initially)
- [ ] GitHub account with repository access
- [ ] OpenAI API key (https://platform.openai.com/api-keys)
- [ ] Basic familiarity with web browsers and copy/paste

### Important Information to Gather

Create a secure document to store these values as you proceed:

```
PROJECT_ID: ____________________
REGION: us-central1
DB_PASSWORD: ____________________
DB_PUBLIC_IP: ____________________
JWT_SECRET: ____________________
OPENAI_API_KEY: ____________________
DOCUMENT_AI_PROCESSOR_ID: ____________________
PYTHON_PROCESSOR_URL: ____________________
BACKEND_URL: ____________________
FRONTEND_URL: ____________________
```

---

## Phase 1: Google Cloud Project Setup

### Step 1.1: Create Google Cloud Account & Project

1. **Open Google Cloud Console**
   - Go to: https://console.cloud.google.com
   - Sign in with your Google account
   - If first time, accept Terms of Service

2. **Create New Project**
   - Look at the top-left of the page, next to "Google Cloud" logo
   - Click the project dropdown (might show "Select a project")
   - In the popup, click **"New Project"** (top right)
   - Fill in:
     - **Project name:** `docuparse-production`
     - **Organization:** Leave as "No organization" or select yours
     - **Location:** Leave as default
   - Click **"Create"**
   - Wait 30-60 seconds for project creation
   - You'll see a notification when complete

3. **Select Your Project**
   - Click the project dropdown again
   - Click on `docuparse-production` to select it
   - The dropdown should now show your project name

### Step 1.2: Enable Billing

1. **Open Billing Page**
   - Click the hamburger menu (☰) on the top-left
   - Scroll down and click **"Billing"**

2. **Set Up Billing Account**
   - If you see "This project has no billing account":
     - Click **"Link a billing account"**
     - Click **"Create billing account"** if none exists
   - Follow the prompts:
     - Select your country
     - Enter payment method (credit/debit card)
     - Complete verification
   - Link the billing account to your project

> **💡 Note:** New Google Cloud accounts get **$300 free credit** valid for 90 days. You won't be charged until you explicitly upgrade and exceed free tier limits.

### Step 1.3: Enable Required APIs

**Method A: Using Cloud Shell (Recommended)**

1. Click the **Cloud Shell** icon (looks like `>_`) in the top-right toolbar
2. Wait for the terminal to load (30 seconds)
3. Copy and paste this command, then press Enter:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  documentai.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  firebase.googleapis.com
```

4. Wait for completion (1-2 minutes)
5. You should see "Operation finished successfully" for each API

**Method B: Manual (Alternative)**

1. Click hamburger menu (☰) → **"APIs & Services"** → **"Library"**
2. For each API below, search and click **"Enable"**:
   - Cloud Run API
   - Cloud Build API
   - Cloud SQL Admin API
   - Secret Manager API
   - Document AI API
   - Artifact Registry API
   - Compute Engine API
   - Firebase Management API

---

## Phase 2: Database Setup (Cloud SQL PostgreSQL)

### Step 2.1: Create Cloud SQL Instance

1. **Navigate to Cloud SQL**
   - Click hamburger menu (☰)
   - Click **"SQL"** (under Databases section)
   - Click **"Create Instance"**

2. **Choose Database Engine**
   - Click **"Choose PostgreSQL"**

3. **Configure Instance Info**
   - **Instance ID:** `docuparse-db`
   - **Password:** Click "Generate" or create a strong password
   - **⚠️ IMPORTANT: Save this password securely! You'll need it later.**
   - **Database version:** PostgreSQL 15
   - **Cloud SQL Edition:** Enterprise
   - **Preset:** Select "Development" (cheaper for testing)

4. **Choose Region**
   - **Region:** `us-central1 (Iowa)`
   - **Zonal availability:** Single zone (cheaper)

5. **Customize Instance (Click "Show Configuration Options")**

   **Machine Configuration:**
   - Click **"Machine configuration"**
   - Select **"Shared core"**
   - Choose **"1 vCPU, 0.614 GB"** (smallest, cheapest)

   **Storage:**
   - Click **"Storage"**
   - **Storage type:** SSD
   - **Storage capacity:** 10 GB
   - ✅ Check "Enable automatic storage increases"

   **Connections:**
   - Click **"Connections"**
   - ✅ Check **"Public IP"**
   - Click **"Add a Network"** under "Authorized networks"
     - **Name:** `allow-cloud-run`
     - **Network:** `0.0.0.0/0` (allows all - we'll secure with password)
     - Click **"Done"**

   **Data Protection:**
   - Click **"Data Protection"**
   - Uncheck "Enable deletion protection" (for development)
   - Set backup to your preference

6. **Create Instance**
   - Click **"Create Instance"** button at bottom
   - **Wait 10-15 minutes** for instance to be created
   - Status will change from "Creating" to a green checkmark

### Step 2.2: Create Database

1. **Click on your instance** (`docuparse-db`)

2. **Create Database**
   - Click **"Databases"** tab on the left
   - Click **"Create Database"**
   - **Database name:** `docuparse`
   - Click **"Create"**

3. **Note Connection Details**
   - Click **"Overview"** tab
   - Find and save:
     - **Public IP address:** (e.g., `34.123.45.67`)
     - **Connection name:** `docuparse-production:us-central1:docuparse-db`

### Step 2.3: Initialize Database Schema

1. **Open Cloud Shell** (click `>_` icon at top)

2. **Connect to Database**
   ```bash
   gcloud sql connect docuparse-db --user=postgres --quiet
   ```
   - Type `Y` if prompted to allowlist IP
   - Enter the password you saved earlier

3. **Connect to docuparse database**
   ```sql
   \c docuparse
   ```

4. **Create the Schema**

   Copy and paste the following SQL commands (you can paste all at once):

   ```sql
   -- Create ENUM types
   CREATE TYPE user_role_enum AS ENUM ('user', 'admin', 'superadmin', 'client');
   CREATE TYPE processing_status_enum AS ENUM ('In-Progress', 'Processed', 'Failed');
   CREATE TYPE client_status_enum AS ENUM ('active', 'inactive');
   CREATE TYPE invoice_status_enum AS ENUM ('not_generated', 'unpaid', 'paid', 'overdue', 'cancelled');

   -- Create user_profile table
   CREATE TABLE user_profile (
       userid SERIAL PRIMARY KEY,
       email VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       last_login TIMESTAMP,
       user_role user_role_enum DEFAULT 'user',
       client_id INTEGER,
       first_name VARCHAR(100),
       last_name VARCHAR(100),
       is_active BOOLEAN DEFAULT true,
       timezone VARCHAR(50) DEFAULT 'UTC',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Create client table
   CREATE TABLE client (
       client_id SERIAL PRIMARY KEY,
       client_name VARCHAR(255) NOT NULL,
       address VARCHAR(500),
       email VARCHAR(255),
       phone_no VARCHAR(50),
       date_started DATE,
       end_date DATE,
       status client_status_enum DEFAULT 'active',
       active_model INTEGER,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Create doc_category table
   CREATE TABLE doc_category (
       category_id SERIAL PRIMARY KEY,
       category_name VARCHAR(100) NOT NULL,
       category_description TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       is_ai_generated BOOLEAN DEFAULT false,
       sample_document_id INTEGER,
       creation_request_id INTEGER,
       requires_sample BOOLEAN DEFAULT true
   );

   -- Create document_processed table
   CREATE TABLE document_processed (
       process_id SERIAL PRIMARY KEY,
       doc_name VARCHAR(500) NOT NULL,
       original_filename VARCHAR(500),
       no_of_pages INTEGER,
       processing_status processing_status_enum DEFAULT 'In-Progress',
       time_initiated TIMESTAMP DEFAULT NOW(),
       time_finished TIMESTAMP,
       total_processing_time INTEGER,
       cost DECIMAL(10,4) DEFAULT 0,
       link_to_file VARCHAR(500),
       link_to_csv VARCHAR(500),
       link_to_json VARCHAR(500),
       userid INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
       client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,
       model_id INTEGER,
       session_id VARCHAR(100),
       doc_category INTEGER REFERENCES doc_category(category_id) ON DELETE SET NULL,
       gdrive_file_id VARCHAR(255),
       error_message TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       json_drive_id VARCHAR(255),
       csv_drive_id VARCHAR(255),
       document_ai_cost DECIMAL(10,4) DEFAULT 0,
       openai_cost DECIMAL(10,4) DEFAULT 0,
       total_records INTEGER DEFAULT 0
   );

   -- Create indexes
   CREATE INDEX idx_doc_category ON document_processed(doc_category);
   CREATE INDEX idx_processing_status ON document_processed(processing_status);
   CREATE INDEX idx_session_id ON document_processed(session_id);
   CREATE INDEX idx_doc_userid ON document_processed(userid);

   -- Create extracted_data table
   CREATE TABLE extracted_data (
       id SERIAL PRIMARY KEY,
       process_id INTEGER REFERENCES document_processed(process_id) ON DELETE CASCADE,
       row_data JSONB,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Create model_config table
   CREATE TABLE model_config (
       model_id SERIAL PRIMARY KEY,
       model_name VARCHAR(100) NOT NULL,
       model_provider VARCHAR(50),
       model_version VARCHAR(50),
       cost_per_1k_input_tokens DECIMAL(10,6),
       cost_per_1k_output_tokens DECIMAL(10,6),
       is_active BOOLEAN DEFAULT true,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Create processing_config table
   CREATE TABLE processing_config (
       config_id SERIAL PRIMARY KEY,
       config_key VARCHAR(100) UNIQUE NOT NULL,
       config_value TEXT,
       description TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Insert default admin user (password: Admin123!)
   INSERT INTO user_profile (email, password, user_role, first_name, last_name, is_active)
   VALUES ('admin@docuparse.com', '$2a$10$JS9dWVw1ipFDdHtfQIjWwuNmRHztyRJMTO16QBWNUSmUpbLCgso/2', 'superadmin', 'Admin', 'User', true);

   -- Insert default categories
   INSERT INTO doc_category (category_name, category_description) VALUES
   ('eob', 'Explanation of Benefits documents'),
   ('facesheet', 'Patient facesheet documents'),
   ('invoice', 'Invoice documents');

   -- Insert default model config
   INSERT INTO model_config (model_name, model_provider, model_version, cost_per_1k_input_tokens, cost_per_1k_output_tokens, is_active)
   VALUES ('GPT-4o-mini', 'openai', 'gpt-4o-mini', 0.00015, 0.0006, true);

   -- Insert default processing config
   INSERT INTO processing_config (config_key, config_value, description) VALUES
   ('docai_cost_per_page', '0.0015', 'Cost per page for Document AI processing'),
   ('default_model_id', '1', 'Default model ID for processing');
   ```

5. **Verify Tables Created**
   ```sql
   \dt
   ```
   You should see a list of tables.

6. **Exit PostgreSQL**
   ```sql
   \q
   ```

---

## Phase 3: Secret Manager Setup

### Step 3.1: Navigate to Secret Manager

1. Click hamburger menu (☰)
2. Go to **"Security"** → **"Secret Manager"**
3. If prompted, click **"Enable API"**

### Step 3.2: Create Secrets

Create each secret by clicking **"Create Secret"**:

**Secret 1: Database Password**
- **Name:** `db-password`
- **Secret value:** (paste your Cloud SQL password)
- Click **"Create Secret"**

**Secret 2: JWT Secret**
- **Name:** `jwt-secret`
- **Secret value:** Generate a random string
  - Open Cloud Shell and run: `openssl rand -base64 32`
  - Copy the output
- Click **"Create Secret"**

**Secret 3: OpenAI API Key**
- **Name:** `openai-api-key`
- **Secret value:** (paste your OpenAI API key starting with `sk-`)
- Click **"Create Secret"**

### Step 3.3: Verify Secrets

You should now have 3 secrets listed:
- `db-password`
- `jwt-secret`
- `openai-api-key`

---

## Phase 4: Document AI Processor Setup

### Step 4.1: Create Document AI Processor

1. **Navigate to Document AI**
   - Click hamburger menu (☰)
   - Go to **"Artificial Intelligence"** → **"Document AI"**
   - Click **"Explore Processors"** or **"Processor Gallery"**

2. **Create Form Parser Processor**
   - Find **"Form Parser"** and click on it
   - Click **"Create Processor"**
   - **Processor name:** `docuparse-form-parser`
   - **Region:** Select `US` (United States)
   - Click **"Create"**

3. **Save Processor ID**
   - After creation, you'll be on the processor details page
   - Look at the URL or the processor details
   - Note the **Processor ID** (a long alphanumeric string)
   - Format: `projects/PROJECT_NUMBER/locations/us/processors/PROCESSOR_ID`
   - Save just the last part (PROCESSOR_ID)

### Step 4.2: Create Service Account

1. **Navigate to IAM**
   - Click hamburger menu (☰)
   - Go to **"IAM & Admin"** → **"Service Accounts"**

2. **Create Service Account**
   - Click **"+ Create Service Account"**
   - **Service account name:** `docuparse-processor-sa`
   - **Service account ID:** `docuparse-processor-sa` (auto-filled)
   - Click **"Create and Continue"**

3. **Grant Roles**
   - Click **"Select a role"** dropdown
   - Add these roles (click "Add Another Role" for each):
     - `Document AI API User`
     - `Cloud Run Invoker`
     - `Secret Manager Secret Accessor`
   - Click **"Continue"**
   - Click **"Done"**

4. **Create Key for Service Account**
   - Click on the service account you just created
   - Go to **"Keys"** tab
   - Click **"Add Key"** → **"Create new key"**
   - Select **"JSON"**
   - Click **"Create"**
   - **A JSON file will download - save this securely!**

5. **Add Service Account Key to Secret Manager**
   - Go back to **Secret Manager**
   - Click **"Create Secret"**
   - **Name:** `docai-service-account`
   - **Secret value:** Open the downloaded JSON file, copy ALL contents, paste here
   - Click **"Create Secret"**

---

## Phase 5: Deploy Python Processor (Cloud Run)

### Step 5.1: Connect GitHub Repository

1. **Go to Cloud Build**
   - Click hamburger menu (☰)
   - Go to **"Cloud Build"** → **"Repositories"** (2nd generation)
   - Click **"Create Host Connection"**

2. **Connect to GitHub**
   - **Region:** `us-central1`
   - **Name:** `github-connection`
   - Click **"Connect"**
   - Authorize Google Cloud Build in GitHub popup
   - Click **"Install in a new account"** or select existing
   - Select your repository: `ai-doc-processor-latest`
   - Click **"Install"**

3. **Link Repository**
   - Back in Cloud Console, click **"Link Repository"**
   - Select your connection and repository
   - Click **"Link"**

### Step 5.2: Create Cloud Run Service for Python Processor

1. **Go to Cloud Run**
   - Click hamburger menu (☰) → **"Cloud Run"**
   - Click **"Create Service"**

2. **Select Deployment Option**
   - Choose **"Continuously deploy from a repository (source or Dockerfile)"**
   - Click **"Set Up With Cloud Build"**

3. **Configure Repository**
   - **Repository:** Select your linked repository
   - **Branch:** `^main$`
   - **Build Type:** Select **"Dockerfile"**
   - **Source location:** `/python_processor/Dockerfile`
   - Click **"Save"**

4. **Configure Service**
   - **Service name:** `docuparse-processor`
   - **Region:** `us-central1`

5. **Configure Resources (Expand sections)**

   **CPU allocation and pricing:**
   - Select "CPU is only allocated during request processing"

   **Autoscaling:**
   - **Minimum instances:** `0`
   - **Maximum instances:** `10`

   **Ingress:**
   - Select "Allow all traffic"

   **Authentication:**
   - Select "Allow unauthenticated invocations"

6. **Container Configuration (Click "Container(s), Volumes, Networking, Security")**

   **Container tab:**
   - **Container port:** `8080`

   **Resources:**
   - **Memory:** `1 GiB`
   - **CPU:** `1`

   **Variables & Secrets tab - Add Environment Variables:**

   Click **"+ Add Variable"** for each:

   | Name | Value |
   |------|-------|
   | `GOOGLE_CLOUD_PROJECT` | `docuparse-production` |
   | `DOCUMENT_AI_LOCATION` | `us` |
   | `DOCUMENT_AI_PROCESSOR_ID` | (your processor ID from Phase 4) |
   | `BACKEND_URL` | `https://docuparse-backend-XXXXX-uc.a.run.app` (update later) |

   **Add Secrets (Click "Reference a Secret"):**

   | Environment Variable | Secret | Version |
   |---------------------|--------|---------|
   | `OPENAI_API_KEY` | `openai-api-key` | `latest` |
   | `GOOGLE_APPLICATION_CREDENTIALS_JSON` | `docai-service-account` | `latest` |

   **Cloud SQL connections:**
   - Click **"Add Connection"**
   - Select: `docuparse-production:us-central1:docuparse-db`

   **Request timeout:**
   - Set to `300` seconds

7. **Create Service**
   - Click **"Create"**
   - Wait 3-5 minutes for build and deployment

8. **Save the URL**
   - Once deployed, copy the URL shown (e.g., `https://docuparse-processor-xxxxx-uc.a.run.app`)
   - Save this as `PYTHON_PROCESSOR_URL`

---

## Phase 6: Deploy Node.js Backend (Cloud Run)

### Step 6.1: Create Backend Dockerfile

First, you need to add a Dockerfile to your repository root.

1. **In your local repository**, create a file named `Dockerfile` in the root directory with this content:

```dockerfile
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
```

2. **Commit and push** this file to GitHub

### Step 6.2: Create Backend Cloud Run Service

1. **Go to Cloud Run**
   - Click **"Create Service"**

2. **Select Deployment Option**
   - Choose **"Continuously deploy from a repository"**
   - Click **"Set Up With Cloud Build"**

3. **Configure Repository**
   - **Repository:** Select your repository
   - **Branch:** `^main$`
   - **Build Type:** **"Dockerfile"**
   - **Source location:** `/Dockerfile`
   - Click **"Save"**

4. **Configure Service**
   - **Service name:** `docuparse-backend`
   - **Region:** `us-central1`

5. **Configure Resources**

   **CPU allocation:**
   - "CPU is only allocated during request processing"

   **Autoscaling:**
   - **Minimum instances:** `1` (keeps one instance warm for faster response)
   - **Maximum instances:** `100`

   **Authentication:**
   - Select "Allow unauthenticated invocations"

6. **Container Configuration**

   **Container tab:**
   - **Container port:** `8080`

   **Resources:**
   - **Memory:** `512 MiB`
   - **CPU:** `1`

   **Variables & Secrets - Environment Variables:**

   | Name | Value |
   |------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `DB_HOST` | `/cloudsql/docuparse-production:us-central1:docuparse-db` |
   | `DB_NAME` | `docuparse` |
   | `DB_USER` | `postgres` |
   | `DB_PORT` | `5432` |
   | `PROCESSOR_WEBHOOK_URL` | (your Python processor URL from Phase 5) |
   | `CORS_ORIGIN` | `*` |
   | `JWT_EXPIRE` | `24h` |

   **Secrets:**

   | Environment Variable | Secret | Version |
   |---------------------|--------|---------|
   | `DB_PASSWORD` | `db-password` | `latest` |
   | `JWT_SECRET` | `jwt-secret` | `latest` |

   **Cloud SQL connections:**
   - Add: `docuparse-production:us-central1:docuparse-db`

   **Request timeout:** `60` seconds

7. **Create Service**
   - Click **"Create"**
   - Wait 3-5 minutes

8. **Save the URL**
   - Copy the deployed URL (e.g., `https://docuparse-backend-xxxxx-uc.a.run.app`)
   - Save this as `BACKEND_URL`

---

## Phase 7: Deploy Frontend (Firebase Hosting)

### Step 7.1: Set Up Firebase Project

1. **Go to Firebase Console**
   - Open: https://console.firebase.google.com
   - Click **"Add project"** (or "Create a project")
   - Select **"Add Firebase to a Google Cloud project"**
   - Choose: `docuparse-production`
   - Click **"Continue"**
   - Disable Google Analytics (optional)
   - Click **"Create project"**
   - Wait for setup, then click **"Continue"**

### Step 7.2: Deploy Frontend via Cloud Shell

1. **Open Cloud Shell** in Google Cloud Console

2. **Clone Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-doc-processor-latest.git
   cd ai-doc-processor-latest
   ```

3. **Install Dependencies**
   ```bash
   cd client
   npm install
   ```

4. **Create Production Environment File**
   ```bash
   # Replace XXXXX with your actual backend URL
   echo "REACT_APP_API_URL=https://docuparse-backend-XXXXX-uc.a.run.app" > .env.production
   ```

5. **Build Frontend**
   ```bash
   npm run build
   ```

6. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

7. **Login to Firebase**
   ```bash
   firebase login --no-localhost
   ```
   - Copy the URL provided and open in browser
   - Complete authentication
   - Paste the authorization code back in terminal

8. **Initialize Firebase Hosting**
   ```bash
   cd ..
   firebase init hosting
   ```

   Answer the prompts:
   - **Select project:** Use existing project → `docuparse-production`
   - **Public directory:** `client/build`
   - **Single-page app:** `Yes`
   - **Set up automatic builds:** `No` (for now)
   - **Overwrite index.html:** `No`

9. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```

10. **Save Frontend URL**
    - After deployment, you'll see: `Hosting URL: https://docuparse-production.web.app`
    - Save this as `FRONTEND_URL`

---

## Phase 8: Update Configuration

### Step 8.1: Update Python Processor with Backend URL

1. **Go to Cloud Run** → Click on `docuparse-processor`
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Update `BACKEND_URL` to your actual backend URL:
   - `https://docuparse-backend-XXXXX-uc.a.run.app`
5. Click **"Deploy"**

### Step 8.2: Update Backend with Frontend URL (CORS)

1. **Go to Cloud Run** → Click on `docuparse-backend`
2. Click **"Edit & Deploy New Revision"**
3. Go to **"Variables & Secrets"** tab
4. Update `CORS_ORIGIN`:
   - `https://docuparse-production.web.app`
5. Click **"Deploy"**

---

## Phase 9: Custom Domain (Optional)

### Step 9.1: Map Domain to Frontend (Firebase)

1. **Go to Firebase Console** → Your project → **Hosting**
2. Click **"Add custom domain"**
3. Enter: `app.yourdomain.com`
4. Follow DNS verification:
   - Add TXT record to verify ownership
   - Add A records for Firebase hosting
5. Wait for SSL certificate provisioning (up to 24 hours)

### Step 9.2: Map Domain to Backend (Cloud Run)

1. **Go to Cloud Run** → `docuparse-backend`
2. Click **"Integrations"** tab → **"Custom Domains"**
3. Click **"Add Mapping"**
4. Enter: `api.yourdomain.com`
5. Follow DNS verification steps
6. After setup, update `CORS_ORIGIN` to include your custom domain

---

## Phase 10: Verification & Testing

### Step 10.1: Test Backend Health

Open in browser or run in Cloud Shell:
```bash
curl https://docuparse-backend-XXXXX-uc.a.run.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-11T...",
  "version": "1.0.0",
  "database": "postgres"
}
```

### Step 10.2: Test Python Processor Health

```bash
curl https://docuparse-processor-XXXXX-uc.a.run.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-11T...",
  "version": "1.0.0"
}
```

### Step 10.3: Test Frontend

1. Open browser: `https://docuparse-production.web.app`
2. You should see the login page

### Step 10.4: Test Login

1. Enter credentials:
   - **Email:** `admin@docuparse.com`
   - **Password:** `Admin123!`
2. Click **"Login"**
3. You should see the dashboard

### Step 10.5: Test Document Upload

1. Navigate to **"Upload"** or **"Documents"**
2. Select a PDF file
3. Choose category: "EOB"
4. Click **"Upload"**
5. Wait for processing to complete
6. Verify status changes from "In-Progress" to "Processed"

---

## Cost Estimation (Monthly)

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| Cloud Run (Backend) | 1 min instance, scales to 0 | $5-15 |
| Cloud Run (Processor) | Scales to 0 | $5-20 |
| Cloud SQL (PostgreSQL) | db-f1-micro, 10GB | $10-25 |
| Firebase Hosting | Free tier | $0 |
| Document AI | $1.50 per 1000 pages | Variable |
| Secret Manager | 6 secrets | $0.36 |
| OpenAI API | Based on usage | Variable |
| **Total (Low Usage)** | | **~$25-50/month** |
| **Total (Medium Usage)** | | **~$50-100/month** |

### Cost Optimization Tips

1. **Use minimum instance = 0** for Cloud Run (scales to zero when not in use)
2. **Use db-f1-micro** for Cloud SQL during development
3. **Enable automatic storage increases** instead of over-provisioning
4. **Monitor usage** in Cloud Console → Billing → Reports
5. **Set up budget alerts** to avoid unexpected charges

---

## Troubleshooting

### Common Issues

**Issue: Cloud Run deployment fails**
- Check Cloud Build logs for errors
- Verify Dockerfile is correct
- Ensure all required files are in repository

**Issue: Database connection fails**
- Verify Cloud SQL instance is running
- Check Cloud SQL connection string format
- Ensure service has Cloud SQL Client role

**Issue: "Unauthorized" errors**
- Check JWT_SECRET is set correctly
- Verify token is being sent in Authorization header
- Check CORS_ORIGIN includes your frontend URL

**Issue: Document processing stuck**
- Check Python processor logs in Cloud Run
- Verify BACKEND_URL is correct
- Check Document AI API is enabled

**Issue: Frontend can't connect to backend**
- Verify REACT_APP_API_URL is correct
- Check CORS_ORIGIN includes frontend URL
- Rebuild frontend after changing .env

### Viewing Logs

1. **Cloud Run Logs:**
   - Go to Cloud Run → Select service → **"Logs"** tab

2. **Cloud Build Logs:**
   - Go to Cloud Build → **"History"** → Click on build

3. **Cloud SQL Logs:**
   - Go to Cloud SQL → Instance → **"Logs"** tab

---

## Summary Checklist

- [ ] **Phase 1:** Google Cloud Project created and APIs enabled
- [ ] **Phase 2:** Cloud SQL PostgreSQL instance running with schema
- [ ] **Phase 3:** All secrets stored in Secret Manager
- [ ] **Phase 4:** Document AI processor created with service account
- [ ] **Phase 5:** Python Processor deployed to Cloud Run
- [ ] **Phase 6:** Node.js Backend deployed to Cloud Run
- [ ] **Phase 7:** Frontend deployed to Firebase Hosting
- [ ] **Phase 8:** All URLs and configurations updated
- [ ] **Phase 9:** Custom domain configured (optional)
- [ ] **Phase 10:** All tests passing

---

## Support

For issues specific to this deployment:
1. Check the Troubleshooting section above
2. Review Cloud Run and Cloud Build logs
3. Verify all environment variables are set correctly

For Google Cloud specific issues:
- Google Cloud Documentation: https://cloud.google.com/docs
- Google Cloud Support: https://cloud.google.com/support

---

**Congratulations!** Your DocuParse application is now running on Google Cloud Platform with enterprise-grade infrastructure.
