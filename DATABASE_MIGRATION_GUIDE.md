# DocuParse - Database Migration Guide

## Complete Instructions for Database Migration

**Version:** 1.0
**Last Updated:** January 2026

---

## Table of Contents

- [Part A: Supabase to Supabase Migration](#part-a-supabase-to-supabase-migration)
- [Part B: Supabase to Google Cloud SQL Migration](#part-b-supabase-to-google-cloud-sql-migration)
- [Appendix: Schema Reference](#appendix-schema-reference)

---

# Part A: Supabase to Supabase Migration

## Overview

This guide explains how to migrate your DocuParse database from one Supabase project to another Supabase project (different account or same account).

### When to Use This Guide
- Moving to a different Supabase account
- Creating a new Supabase project for production
- Cloning database for testing/staging environment
- Transferring ownership to a different organization

---

## Prerequisites

- Access to source Supabase project (current database)
- Access to destination Supabase project (new database)
- PostgreSQL client installed (psql) OR Supabase CLI
- Stable internet connection

---

## Method 1: Using Supabase Dashboard (Easiest)

### Step 1: Export Schema from Source Project

1. **Login to Source Supabase Project**
   - Go to: https://supabase.com/dashboard
   - Select your source project

2. **Open SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"**

3. **Export Schema (Structure Only)**

   Run this query to get your schema:
   ```sql
   -- Get all table definitions
   SELECT
       'CREATE TABLE ' || tablename || ' (' ||
       string_agg(
           column_name || ' ' || data_type ||
           CASE WHEN character_maximum_length IS NOT NULL
                THEN '(' || character_maximum_length || ')'
                ELSE '' END ||
           CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
           ', '
       ) || ');'
   FROM information_schema.columns
   WHERE table_schema = 'public'
   GROUP BY tablename;
   ```

   **Better Alternative:** Use the Schema Visualizer
   - Click **"Database"** → **"Schema Visualizer"**
   - This shows all your tables and relationships

### Step 2: Export Data from Source Project

1. **Go to Table Editor**
   - Click **"Table Editor"** in left sidebar

2. **Export Each Table**
   - Click on each table (e.g., `user_profile`)
   - Click the **"Export"** button (download icon)
   - Select **"Export as CSV"**
   - Save the file (e.g., `user_profile.csv`)

3. **Repeat for All Tables**
   Export these tables in order:
   - `client`
   - `user_profile`
   - `doc_category`
   - `model_config`
   - `processing_config`
   - `document_processed`
   - `extracted_data`
   - `field_table`
   - `output_profile`
   - `invoice`
   - `mail_log`
   - (any other tables you have)

### Step 3: Create Destination Supabase Project

1. **Create New Project**
   - Go to: https://supabase.com/dashboard
   - Click **"New Project"**
   - Fill in:
     - **Organization:** Select or create
     - **Project name:** `docuparse-production` (or your choice)
     - **Database password:** Create strong password (SAVE THIS!)
     - **Region:** Choose closest to your users
   - Click **"Create new project"**
   - Wait 2-3 minutes for provisioning

2. **Note Connection Details**
   - Go to **"Settings"** → **"Database"**
   - Save:
     - **Host:** `db.xxxxx.supabase.co`
     - **Database name:** `postgres`
     - **Port:** `5432`
     - **User:** `postgres`
     - **Password:** (the one you set)

### Step 4: Create Schema in Destination Project

1. **Open SQL Editor** in destination project

2. **Run Schema Creation Script**

   Copy and paste this entire script:

   ```sql
   -- =============================================
   -- DocuParse Database Schema for Supabase
   -- =============================================

   -- Drop existing types if they exist (for clean migration)
   DROP TYPE IF EXISTS user_role_enum CASCADE;
   DROP TYPE IF EXISTS processing_status_enum CASCADE;
   DROP TYPE IF EXISTS client_status_enum CASCADE;
   DROP TYPE IF EXISTS invoice_status_enum CASCADE;
   DROP TYPE IF EXISTS mail_status_enum CASCADE;
   DROP TYPE IF EXISTS field_type_enum CASCADE;
   DROP TYPE IF EXISTS output_format_enum CASCADE;

   -- Create ENUM types
   CREATE TYPE user_role_enum AS ENUM ('user', 'admin', 'superadmin', 'client');
   CREATE TYPE processing_status_enum AS ENUM ('In-Progress', 'Processed', 'Failed');
   CREATE TYPE client_status_enum AS ENUM ('active', 'inactive');
   CREATE TYPE invoice_status_enum AS ENUM ('not_generated', 'unpaid', 'paid', 'overdue', 'cancelled');
   CREATE TYPE mail_status_enum AS ENUM ('pending', 'success', 'failed', 'retry_pending');
   CREATE TYPE field_type_enum AS ENUM ('string', 'number', 'date', 'boolean');
   CREATE TYPE output_format_enum AS ENUM ('csv', 'json', 'excel', 'xlsx', 'xml', 'pdf', 'doc', 'docx', 'txt');

   -- Create updated_at trigger function
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
   END;
   $$ language 'plpgsql';

   -- =============================================
   -- Core Tables
   -- =============================================

   -- Client table
   CREATE TABLE IF NOT EXISTS client (
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

   -- User profile table
   CREATE TABLE IF NOT EXISTS user_profile (
       userid SERIAL PRIMARY KEY,
       email VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       last_login TIMESTAMP,
       user_role user_role_enum DEFAULT 'user',
       client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,
       first_name VARCHAR(100),
       last_name VARCHAR(100),
       is_active BOOLEAN DEFAULT true,
       timezone VARCHAR(50) DEFAULT 'UTC',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Document category table
   CREATE TABLE IF NOT EXISTS doc_category (
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

   -- Model configuration table
   CREATE TABLE IF NOT EXISTS model_config (
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

   -- Processing configuration table
   CREATE TABLE IF NOT EXISTS processing_config (
       config_id SERIAL PRIMARY KEY,
       config_key VARCHAR(100) UNIQUE NOT NULL,
       config_value TEXT,
       description TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Document processed table
   CREATE TABLE IF NOT EXISTS document_processed (
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
       model_id INTEGER REFERENCES model_config(model_id) ON DELETE SET NULL,
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

   -- Extracted data table
   CREATE TABLE IF NOT EXISTS extracted_data (
       id SERIAL PRIMARY KEY,
       process_id INTEGER REFERENCES document_processed(process_id) ON DELETE CASCADE,
       row_data JSONB,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Field table
   CREATE TABLE IF NOT EXISTS field_table (
       field_id SERIAL PRIMARY KEY,
       category_id INTEGER REFERENCES doc_category(category_id) ON DELETE CASCADE,
       field_name VARCHAR(100) NOT NULL,
       field_type field_type_enum DEFAULT 'string',
       field_description TEXT,
       is_required BOOLEAN DEFAULT false,
       display_order INTEGER DEFAULT 0,
       default_value TEXT,
       validation_regex VARCHAR(500),
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       UNIQUE(category_id, field_name)
   );

   -- Output profile table
   CREATE TABLE IF NOT EXISTS output_profile (
       profile_id SERIAL PRIMARY KEY,
       profile_name VARCHAR(100) NOT NULL,
       category_id INTEGER REFERENCES doc_category(category_id) ON DELETE CASCADE,
       output_format output_format_enum DEFAULT 'csv',
       field_mappings JSONB,
       include_headers BOOLEAN DEFAULT true,
       delimiter VARCHAR(10) DEFAULT ',',
       is_default BOOLEAN DEFAULT false,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Invoice table
   CREATE TABLE IF NOT EXISTS invoice (
       invoice_id SERIAL PRIMARY KEY,
       client_id INTEGER REFERENCES client(client_id) ON DELETE CASCADE,
       invoice_number VARCHAR(50) UNIQUE NOT NULL,
       billing_period_start DATE NOT NULL,
       billing_period_end DATE NOT NULL,
       invoice_date DATE NOT NULL,
       due_date DATE NOT NULL,
       amount_due DECIMAL(10,2) NOT NULL,
       status invoice_status_enum DEFAULT 'not_generated',
       payment_link VARCHAR(255) UNIQUE,
       payment_link_expires_at TIMESTAMP,
       pdf_attachment_path VARCHAR(500),
       notes TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW(),
       paid_at TIMESTAMP,
       paid_amount DECIMAL(10,2)
   );

   -- Mail log table
   CREATE TABLE IF NOT EXISTS mail_log (
       mail_log_id SERIAL PRIMARY KEY,
       invoice_id INTEGER REFERENCES invoice(invoice_id) ON DELETE SET NULL,
       recipient_email VARCHAR(255) NOT NULL,
       email_type VARCHAR(50),
       subject VARCHAR(500),
       body TEXT,
       attachments JSONB,
       sent_at TIMESTAMP,
       status mail_status_enum DEFAULT 'pending',
       retry_count INTEGER DEFAULT 0,
       max_retries INTEGER DEFAULT 3,
       error_message TEXT,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Billing configuration table
   CREATE TABLE IF NOT EXISTS billing_configuration (
       id SERIAL PRIMARY KEY,
       setting_key VARCHAR(100) UNIQUE NOT NULL,
       setting_value TEXT,
       description TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- =============================================
   -- Create Indexes
   -- =============================================

   CREATE INDEX IF NOT EXISTS idx_doc_category ON document_processed(doc_category);
   CREATE INDEX IF NOT EXISTS idx_processing_status ON document_processed(processing_status);
   CREATE INDEX IF NOT EXISTS idx_session_id ON document_processed(session_id);
   CREATE INDEX IF NOT EXISTS idx_doc_userid ON document_processed(userid);
   CREATE INDEX IF NOT EXISTS idx_doc_client_id ON document_processed(client_id);
   CREATE INDEX IF NOT EXISTS idx_extracted_process_id ON extracted_data(process_id);
   CREATE INDEX IF NOT EXISTS idx_field_category ON field_table(category_id);
   CREATE INDEX IF NOT EXISTS idx_invoice_client ON invoice(client_id);
   CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoice(status);

   -- =============================================
   -- Create Triggers
   -- =============================================

   CREATE TRIGGER update_client_updated_at BEFORE UPDATE ON client
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_doc_category_updated_at BEFORE UPDATE ON doc_category
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_document_processed_updated_at BEFORE UPDATE ON document_processed
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_model_config_updated_at BEFORE UPDATE ON model_config
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_processing_config_updated_at BEFORE UPDATE ON processing_config
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_invoice_updated_at BEFORE UPDATE ON invoice
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   ```

3. **Click "Run"** to execute

### Step 5: Import Data into Destination Project

1. **Go to Table Editor** in destination project

2. **Import Data for Each Table**

   **Import Order (Important - follow this order for foreign keys):**

   a. **client** (no dependencies)
      - Click on `client` table
      - Click **"Insert"** → **"Import data from CSV"**
      - Select `client.csv`
      - Click **"Import"**

   b. **user_profile** (depends on client)
      - Same process with `user_profile.csv`

   c. **doc_category** (no dependencies)
      - Same process

   d. **model_config** (no dependencies)
      - Same process

   e. **processing_config** (no dependencies)
      - Same process

   f. **document_processed** (depends on user_profile, client, doc_category, model_config)
      - Same process

   g. **extracted_data** (depends on document_processed)
      - Same process

   h. **field_table** (depends on doc_category)
      - Same process

   i. **output_profile** (depends on doc_category)
      - Same process

   j. **invoice** (depends on client)
      - Same process

   k. **mail_log** (depends on invoice)
      - Same process

### Step 6: Reset Sequences

After importing data, reset the auto-increment sequences:

1. **Open SQL Editor** in destination project

2. **Run this script:**

   ```sql
   -- Reset all sequences to max value + 1
   SELECT setval('client_client_id_seq', COALESCE((SELECT MAX(client_id) FROM client), 0) + 1, false);
   SELECT setval('user_profile_userid_seq', COALESCE((SELECT MAX(userid) FROM user_profile), 0) + 1, false);
   SELECT setval('doc_category_category_id_seq', COALESCE((SELECT MAX(category_id) FROM doc_category), 0) + 1, false);
   SELECT setval('model_config_model_id_seq', COALESCE((SELECT MAX(model_id) FROM model_config), 0) + 1, false);
   SELECT setval('processing_config_config_id_seq', COALESCE((SELECT MAX(config_id) FROM processing_config), 0) + 1, false);
   SELECT setval('document_processed_process_id_seq', COALESCE((SELECT MAX(process_id) FROM document_processed), 0) + 1, false);
   SELECT setval('extracted_data_id_seq', COALESCE((SELECT MAX(id) FROM extracted_data), 0) + 1, false);
   SELECT setval('field_table_field_id_seq', COALESCE((SELECT MAX(field_id) FROM field_table), 0) + 1, false);
   SELECT setval('output_profile_profile_id_seq', COALESCE((SELECT MAX(profile_id) FROM output_profile), 0) + 1, false);
   SELECT setval('invoice_invoice_id_seq', COALESCE((SELECT MAX(invoice_id) FROM invoice), 0) + 1, false);
   SELECT setval('mail_log_mail_log_id_seq', COALESCE((SELECT MAX(mail_log_id) FROM mail_log), 0) + 1, false);
   ```

### Step 7: Update Application Configuration

1. **Get New Supabase Credentials**
   - Go to destination project **"Settings"** → **"API"**
   - Copy:
     - **Project URL:** `https://xxxxx.supabase.co`
     - **anon public key:** `eyJhbGciOiJIUzI1NiIs...`
     - **service_role key:** `eyJhbGciOiJIUzI1NiIs...`

2. **Update Environment Variables**

   Update your `.env` or Vercel environment variables:
   ```
   SUPABASE_URL=https://NEW-PROJECT-ID.supabase.co
   SUPABASE_ANON_KEY=your-new-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key
   ```

3. **Redeploy Application**
   - If using Vercel, push a commit or redeploy manually
   - If using Cloud Run, redeploy with new environment variables

### Step 8: Verify Migration

1. **Test Login**
   - Open your application
   - Login with existing credentials

2. **Verify Data**
   - Check documents list
   - Check user accounts
   - Check categories and configurations

---

## Method 2: Using pg_dump (Advanced)

For large databases or automated migrations:

### Step 1: Get Connection Strings

**Source Database:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Destination Database:**
```
postgresql://postgres:[PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres
```

### Step 2: Export from Source

```bash
# Export schema and data
pg_dump "postgresql://postgres:[PASSWORD]@db.[SOURCE].supabase.co:5432/postgres" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f docuparse_backup.sql
```

### Step 3: Import to Destination

```bash
# Import to new database
psql "postgresql://postgres:[PASSWORD]@db.[DESTINATION].supabase.co:5432/postgres" \
  -f docuparse_backup.sql
```

---

# Part B: Supabase to Google Cloud SQL Migration

## Overview

This guide explains how to migrate your DocuParse database from Supabase to Google Cloud SQL (PostgreSQL).

### When to Use This Guide
- Moving to Google Cloud infrastructure
- Need more control over database configuration
- Compliance requirements for data location
- Scaling beyond Supabase limits

---

## Prerequisites

- Access to source Supabase project
- Google Cloud account with billing enabled
- Google Cloud SQL instance created (see GOOGLE_CLOUD_DEPLOYMENT_GUIDE.md)
- PostgreSQL client (psql) or Cloud Shell access

---

## Method 1: Using CSV Export/Import (Recommended for Most Users)

### Step 1: Export Data from Supabase

Follow the same export steps from Part A, Method 1, Steps 1-2.

Export all tables as CSV files.

### Step 2: Prepare Google Cloud SQL

1. **Ensure Cloud SQL Instance is Running**
   - Go to Google Cloud Console → SQL
   - Verify instance status is green

2. **Connect to Cloud SQL**

   **Option A: Using Cloud Shell**
   ```bash
   gcloud sql connect docuparse-db --user=postgres
   ```

   **Option B: Using External psql**
   ```bash
   psql -h [CLOUD_SQL_PUBLIC_IP] -U postgres -d docuparse
   ```

### Step 3: Create Schema in Cloud SQL

Run the same schema creation script from Part A, Step 4 in your Cloud SQL database.

```sql
-- Run the full schema script from Part A, Step 4
-- (Copy and paste the entire script)
```

### Step 4: Import Data Using Cloud Storage

1. **Create Cloud Storage Bucket**
   ```bash
   gsutil mb gs://docuparse-migration-data
   ```

2. **Upload CSV Files**
   ```bash
   gsutil cp *.csv gs://docuparse-migration-data/
   ```

3. **Grant Cloud SQL Access to Bucket**
   - Go to Cloud SQL → Your instance → Overview
   - Find the service account (looks like: `p123456789-abcdef@gcp-sa-cloud-sql.iam.gserviceaccount.com`)
   - Go to Cloud Storage → Your bucket → Permissions
   - Add the service account with "Storage Object Viewer" role

4. **Import Each Table**

   ```bash
   # Import client table
   gcloud sql import csv docuparse-db \
     gs://docuparse-migration-data/client.csv \
     --database=docuparse \
     --table=client

   # Import user_profile table
   gcloud sql import csv docuparse-db \
     gs://docuparse-migration-data/user_profile.csv \
     --database=docuparse \
     --table=user_profile

   # Continue for all tables...
   ```

   **Import Order:**
   1. client
   2. user_profile
   3. doc_category
   4. model_config
   5. processing_config
   6. document_processed
   7. extracted_data
   8. field_table
   9. output_profile
   10. invoice
   11. mail_log
   12. billing_configuration

### Step 5: Reset Sequences

After import, run the sequence reset script from Part A, Step 6.

### Step 6: Cleanup

```bash
# Remove migration bucket after successful migration
gsutil rm -r gs://docuparse-migration-data
```

---

## Method 2: Using pg_dump (For Large Databases)

### Step 1: Export from Supabase

1. **Get Supabase Connection String**
   - Go to Supabase Dashboard → Settings → Database
   - Copy the connection string

2. **Export Database**
   ```bash
   # Export full database
   pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
     --no-owner \
     --no-acl \
     --clean \
     --if-exists \
     --exclude-table='_*' \
     --exclude-table='auth.*' \
     --exclude-table='storage.*' \
     --exclude-table='realtime.*' \
     -f docuparse_migration.sql
   ```

   **Note:** We exclude Supabase-specific tables (auth, storage, realtime) that don't exist in Cloud SQL.

### Step 2: Modify Export for Cloud SQL Compatibility

1. **Open the export file** and make these changes:

   **Remove Supabase-specific items:**
   ```bash
   # Remove any references to Supabase extensions
   sed -i '/CREATE EXTENSION.*supabase/d' docuparse_migration.sql
   sed -i '/COMMENT ON EXTENSION/d' docuparse_migration.sql
   ```

2. **Or create a clean export script:**

   Create file `export_clean.sh`:
   ```bash
   #!/bin/bash

   SOURCE_DB="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

   # Export only public schema tables
   pg_dump "$SOURCE_DB" \
     --schema=public \
     --no-owner \
     --no-acl \
     --clean \
     --if-exists \
     -f docuparse_clean.sql
   ```

### Step 3: Import to Cloud SQL

**Option A: Using Cloud Shell (Recommended)**

1. **Upload SQL file to Cloud Shell**
   - Click the three dots menu → Upload File
   - Select your `docuparse_migration.sql`

2. **Import to Cloud SQL**
   ```bash
   # Connect and import
   gcloud sql connect docuparse-db --user=postgres < docuparse_migration.sql
   ```

**Option B: Using Cloud Storage**

1. **Upload to Cloud Storage**
   ```bash
   gsutil cp docuparse_migration.sql gs://docuparse-migration-data/
   ```

2. **Import via Cloud SQL**
   ```bash
   gcloud sql import sql docuparse-db \
     gs://docuparse-migration-data/docuparse_migration.sql \
     --database=docuparse
   ```

### Step 4: Verify Data Integrity

```sql
-- Connect to Cloud SQL and run:

-- Check row counts
SELECT 'client' as table_name, COUNT(*) as rows FROM client
UNION ALL SELECT 'user_profile', COUNT(*) FROM user_profile
UNION ALL SELECT 'doc_category', COUNT(*) FROM doc_category
UNION ALL SELECT 'document_processed', COUNT(*) FROM document_processed
UNION ALL SELECT 'extracted_data', COUNT(*) FROM extracted_data;

-- Verify relationships
SELECT dp.process_id, dp.doc_name, u.email, c.client_name
FROM document_processed dp
LEFT JOIN user_profile u ON dp.userid = u.userid
LEFT JOIN client c ON dp.client_id = c.client_id
LIMIT 5;
```

---

## Step 5: Update Application Configuration

### For Vercel Deployment

Remove Supabase variables and add Cloud SQL variables:

**Remove:**
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Add:**
```
DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE
DB_NAME=docuparse
DB_USER=postgres
DB_PASSWORD=your-password
DB_PORT=5432
```

### For Cloud Run Deployment

1. Go to Cloud Run → Your service → Edit & Deploy New Revision
2. Update environment variables as above
3. Add Cloud SQL connection under "Connections"
4. Deploy

### Update Application Code

The application's `config/database.js` already supports both Supabase and PostgreSQL. It will automatically use PostgreSQL when Supabase environment variables are not set.

---

## Post-Migration Checklist

### Verify Everything Works

- [ ] Application connects to new database
- [ ] User login works
- [ ] Document upload works
- [ ] Document processing works
- [ ] All data visible in dashboard
- [ ] Admin functions work
- [ ] Reports generate correctly

### Performance Tuning (Cloud SQL)

After migration, consider these optimizations:

```sql
-- Analyze tables for query optimization
ANALYZE client;
ANALYZE user_profile;
ANALYZE document_processed;
ANALYZE extracted_data;

-- Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Backup Configuration (Cloud SQL)

1. **Enable Automated Backups**
   - Go to Cloud SQL → Instance → Edit
   - Enable "Automate backups"
   - Set backup window

2. **Enable Point-in-Time Recovery**
   - Enable "Point-in-time recovery"
   - This allows restoring to any point in time

---

## Rollback Plan

If migration fails, you can rollback:

### Rollback to Supabase

1. **Restore Supabase Environment Variables**
   ```
   SUPABASE_URL=https://original.supabase.co
   SUPABASE_ANON_KEY=original-key
   SUPABASE_SERVICE_ROLE_KEY=original-service-key
   ```

2. **Redeploy Application**
   - Push a commit or manually redeploy

### Keep Original Database

**Important:** Do not delete your original Supabase project until you have:
- [ ] Verified all data migrated correctly
- [ ] Tested all application functions
- [ ] Run in production for at least 1 week
- [ ] Created backups of the new database

---

## Troubleshooting

### Common Issues

**Issue: Foreign key constraint errors during import**
- Solution: Import tables in correct order (parent tables before child tables)

**Issue: Sequence values not incrementing**
- Solution: Run the sequence reset script after import

**Issue: ENUM type conflicts**
- Solution: Drop existing types before creating new ones

**Issue: Connection timeout**
- Solution: Check firewall rules and authorized networks in Cloud SQL

**Issue: Character encoding issues**
- Solution: Ensure UTF-8 encoding:
  ```bash
  pg_dump ... --encoding=UTF8
  psql ... -v ON_ERROR_STOP=1 --set=client_encoding=UTF8
  ```

---

## Appendix: Schema Reference

### Table Relationships

```
client (1) ──────────────────┬──> (N) user_profile
                             ├──> (N) document_processed
                             └──> (N) invoice

user_profile (1) ────────────┬──> (N) document_processed

doc_category (1) ────────────┬──> (N) document_processed
                             ├──> (N) field_table
                             └──> (N) output_profile

model_config (1) ────────────┬──> (N) document_processed

document_processed (1) ──────┬──> (N) extracted_data

invoice (1) ─────────────────┬──> (N) mail_log
```

### Data Types Mapping

| Supabase Type | Cloud SQL Type | Notes |
|---------------|----------------|-------|
| SERIAL | SERIAL | Auto-increment |
| VARCHAR(n) | VARCHAR(n) | Same |
| TEXT | TEXT | Same |
| INTEGER | INTEGER | Same |
| DECIMAL(p,s) | DECIMAL(p,s) | Same |
| BOOLEAN | BOOLEAN | Same |
| TIMESTAMP | TIMESTAMP | Same |
| JSONB | JSONB | Same |
| ENUM types | ENUM types | Must recreate |

---

## Summary

### Migration Paths

| From | To | Recommended Method |
|------|----|--------------------|
| Supabase | Supabase (same account) | Dashboard export/import |
| Supabase | Supabase (different account) | Dashboard export/import |
| Supabase | Cloud SQL | pg_dump or CSV + Cloud Storage |

### Time Estimates

| Database Size | CSV Method | pg_dump Method |
|---------------|------------|----------------|
| < 100 MB | 30-60 min | 20-30 min |
| 100 MB - 1 GB | 1-2 hours | 30-60 min |
| > 1 GB | 2-4 hours | 1-2 hours |

---

**Need Help?**

If you encounter issues during migration:
1. Check the Troubleshooting section above
2. Verify all prerequisites are met
3. Ensure proper import order for foreign key constraints
4. Check database logs for specific error messages
