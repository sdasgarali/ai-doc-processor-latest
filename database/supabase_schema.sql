-- PostgreSQL Schema for Supabase
-- Converted from MySQL schema for eob_extraction database
-- DocuParse - Universal AI Document Processing Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role_enum AS ENUM ('user', 'admin', 'superadmin', 'client');
CREATE TYPE processing_status_enum AS ENUM ('In-Progress', 'Processed', 'Failed');
CREATE TYPE client_status_enum AS ENUM ('active', 'inactive');
CREATE TYPE invoice_status_enum AS ENUM ('not_generated', 'unpaid', 'paid', 'overdue', 'cancelled');
CREATE TYPE email_type_enum AS ENUM ('invoice_generated', 'payment_reminder', 'payment_received', 'invoice_overdue', 'invoice_cancelled');
CREATE TYPE mail_status_enum AS ENUM ('pending', 'success', 'failed', 'retry_pending');
CREATE TYPE field_type_enum AS ENUM ('string', 'number', 'date', 'boolean');
CREATE TYPE transform_type_enum AS ENUM ('none', 'uppercase', 'lowercase', 'titlecase', 'date_format', 'number_format', 'currency', 'prefix', 'suffix', 'regex_replace', 'custom');
CREATE TYPE analysis_status_enum AS ENUM ('pending', 'analyzing', 'completed', 'failed');
CREATE TYPE request_status_enum AS ENUM ('pending', 'processing', 'review', 'approved', 'rejected');
CREATE TYPE output_format_enum AS ENUM ('csv', 'json', 'excel', 'xlsx', 'xml', 'pdf', 'doc', 'docx', 'txt');
CREATE TYPE log_level_enum AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE permission_type_enum AS ENUM ('allow', 'deny');
CREATE TYPE reminder_status_enum AS ENUM ('scheduled', 'sent', 'cancelled', 'skipped');
CREATE TYPE payment_status_enum AS ENUM ('initiated', 'pending', 'success', 'failed', 'refunded');
CREATE TYPE cron_status_enum AS ENUM ('success', 'failed');

-- Function for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Table: client (referenced by many tables, create first)
CREATE TABLE client (
    client_id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_no VARCHAR(50),
    date_started DATE,
    end_date DATE,
    status client_status_enum DEFAULT 'active',
    active_model INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_client_status ON client(status);
CREATE INDEX idx_client_email ON client(email);

-- Table: user_profile
CREATE TABLE user_profile (
    userid SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP,
    user_role user_role_enum DEFAULT 'user',
    client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_user_email ON user_profile(email);
CREATE INDEX idx_user_role ON user_profile(user_role);
CREATE INDEX idx_user_client_id ON user_profile(client_id);

-- Table: doc_category
CREATE TABLE doc_category (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    sample_document_id INTEGER,
    creation_request_id INTEGER,
    requires_sample BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_category_name ON doc_category(category_name);

-- Table: permissions
CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    permission_category VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_permission_name ON permissions(permission_name);
CREATE INDEX idx_permission_category ON permissions(permission_category);

-- Table: audit_log
CREATE TABLE audit_log (
    audit_id SERIAL PRIMARY KEY,
    userid INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_userid ON audit_log(userid);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- Table: billing_configuration
CREATE TABLE billing_configuration (
    config_id SERIAL PRIMARY KEY,
    system_mailer VARCHAR(255) NOT NULL DEFAULT 'ali.aitechs@gmail.com',
    system_mailer_name VARCHAR(255) DEFAULT 'DocuParse System',
    invoice_date_day INTEGER DEFAULT 1,
    due_date_day INTEGER DEFAULT 5,
    reminder_frequency_days INTEGER DEFAULT 3,
    max_reminder_count INTEGER DEFAULT 5,
    auto_generate_enabled BOOLEAN DEFAULT TRUE,
    payment_gateway VARCHAR(100) DEFAULT 'stripe',
    payment_gateway_config JSONB,
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    currency VARCHAR(3) DEFAULT 'USD',
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    company_name VARCHAR(255) DEFAULT 'DocuParse System',
    company_address TEXT,
    company_phone VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL
);

-- Table: category_sample_document
CREATE TABLE category_sample_document (
    sample_id SERIAL PRIMARY KEY,
    doc_category_id INTEGER NOT NULL REFERENCES doc_category(category_id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    file_path VARCHAR(1000),
    gdrive_file_id VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    description TEXT,
    expected_fields TEXT,
    expected_output_format VARCHAR(50),
    ai_analysis_result JSONB,
    ai_suggested_fields JSONB,
    analysis_status analysis_status_enum DEFAULT 'pending',
    analysis_error TEXT,
    uploaded_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sample_category ON category_sample_document(doc_category_id);
CREATE INDEX idx_sample_status ON category_sample_document(analysis_status);

-- Table: category_creation_request
CREATE TABLE category_creation_request (
    request_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT NOT NULL,
    expected_fields TEXT,
    expected_output_format output_format_enum DEFAULT 'csv',
    sample_document_id INTEGER REFERENCES category_sample_document(sample_id) ON DELETE SET NULL,
    ai_model_used VARCHAR(100),
    ai_prompt_used TEXT,
    ai_response JSONB,
    suggested_fields JSONB,
    status request_status_enum DEFAULT 'pending',
    review_notes TEXT,
    created_category_id INTEGER,
    created_profile_id INTEGER,
    requested_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    reviewed_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP
);
CREATE INDEX idx_request_status ON category_creation_request(status);
CREATE INDEX idx_request_requested_by ON category_creation_request(requested_by);

-- Table: client_usage
CREATE TABLE client_usage (
    usage_id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    usage_details JSONB,
    total_documents INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, period_start, period_end)
);

-- Table: cron_execution_log
CREATE TABLE cron_execution_log (
    log_id SERIAL PRIMARY KEY,
    job_name VARCHAR(50) NOT NULL,
    execution_time TIMESTAMP DEFAULT NOW(),
    status cron_status_enum DEFAULT 'success',
    details JSONB
);
CREATE INDEX idx_cron_job_time ON cron_execution_log(job_name, execution_time);

-- Table: custom_reports
CREATE TABLE custom_reports (
    report_id SERIAL PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES user_profile(userid) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    module VARCHAR(100) NOT NULL,
    selected_fields JSONB NOT NULL,
    filters JSONB,
    sort_order JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_report_created_by ON custom_reports(created_by);
CREATE INDEX idx_report_module ON custom_reports(module);
CREATE INDEX idx_report_public ON custom_reports(is_public);

-- Table: custom_report_access
CREATE TABLE custom_report_access (
    access_id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES custom_reports(report_id) ON DELETE CASCADE,
    userid INTEGER NOT NULL REFERENCES user_profile(userid) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT FALSE,
    granted_by INTEGER NOT NULL REFERENCES user_profile(userid) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, userid)
);

-- Table: document_processed
CREATE TABLE document_processed (
    process_id SERIAL PRIMARY KEY,
    doc_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    no_of_pages INTEGER,
    processing_status processing_status_enum DEFAULT 'In-Progress',
    time_initiated TIMESTAMP DEFAULT NOW(),
    time_finished TIMESTAMP,
    total_processing_time INTEGER,
    cost DECIMAL(10,2) DEFAULT 0.00,
    link_to_file VARCHAR(1000),
    link_to_csv VARCHAR(1000),
    link_to_json VARCHAR(1000),
    userid INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    client_id INTEGER REFERENCES client(client_id) ON DELETE SET NULL,
    model_id INTEGER,
    session_id VARCHAR(255),
    doc_category INTEGER REFERENCES doc_category(category_id) ON DELETE SET NULL,
    gdrive_file_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    json_drive_id VARCHAR(255),
    csv_drive_id VARCHAR(255),
    document_ai_cost DECIMAL(10,4) DEFAULT 0.0000,
    openai_cost DECIMAL(10,4) DEFAULT 0.0000,
    total_records INTEGER DEFAULT 0
);
CREATE INDEX idx_doc_category ON document_processed(doc_category);
CREATE INDEX idx_processing_status ON document_processed(processing_status);
CREATE INDEX idx_session_id ON document_processed(session_id);
CREATE INDEX idx_doc_userid ON document_processed(userid);
CREATE INDEX idx_doc_client_id ON document_processed(client_id);
CREATE INDEX idx_time_initiated ON document_processed(time_initiated);

-- Table: extracted_data
CREATE TABLE extracted_data (
    id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES document_processed(process_id) ON DELETE CASCADE,
    row_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_extracted_process_id ON extracted_data(process_id);

-- Table: field_table
CREATE TABLE field_table (
    field_id SERIAL PRIMARY KEY,
    field_name VARCHAR(255) NOT NULL,
    field_display_name VARCHAR(255),
    field_type field_type_enum DEFAULT 'string',
    doc_category INTEGER REFERENCES doc_category(category_id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255),
    validation_regex VARCHAR(500),
    keywords TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(field_name, doc_category)
);
CREATE INDEX idx_field_doc_category ON field_table(doc_category);
CREATE INDEX idx_field_name ON field_table(field_name);

-- Table: invoice
CREATE TABLE invoice (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id INTEGER NOT NULL REFERENCES client(client_id) ON DELETE RESTRICT,
    usage_id INTEGER REFERENCES client_usage(usage_id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    status invoice_status_enum DEFAULT 'not_generated',
    payment_link VARCHAR(255) UNIQUE,
    payment_link_expires_at TIMESTAMP,
    pdf_attachment_path VARCHAR(500),
    paid_at TIMESTAMP,
    payment_method VARCHAR(100),
    payment_transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    generated_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL
);
CREATE INDEX idx_invoice_client_date ON invoice(client_id, invoice_date);
CREATE INDEX idx_invoice_status ON invoice(status);
CREATE INDEX idx_invoice_due_date ON invoice(due_date);

-- Table: mail_log
CREATE TABLE mail_log (
    mail_log_id SERIAL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    email_type email_type_enum NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT,
    attachments JSONB,
    sent_at TIMESTAMP,
    status mail_status_enum DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_mail_invoice_type ON mail_log(invoice_id, email_type);
CREATE INDEX idx_mail_status_retry ON mail_log(status, next_retry_at);

-- Table: invoice_reminder_schedule
CREATE TABLE invoice_reminder_schedule (
    schedule_id SERIAL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    reminder_number INTEGER NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status reminder_status_enum DEFAULT 'scheduled',
    mail_log_id INTEGER REFERENCES mail_log(mail_log_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(invoice_id, reminder_number)
);
CREATE INDEX idx_reminder_scheduled_status ON invoice_reminder_schedule(scheduled_for, status);

-- Table: model_config
CREATE TABLE model_config (
    model_id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    doc_category INTEGER NOT NULL REFERENCES doc_category(category_id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES client(client_id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    model_code VARCHAR(50),
    input_cost_per_1k DECIMAL(10,6) DEFAULT 0.000150,
    output_cost_per_1k DECIMAL(10,6) DEFAULT 0.000600,
    is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_model_doc_category ON model_config(doc_category);
CREATE INDEX idx_model_client_id ON model_config(client_id);

-- Table: model
CREATE TABLE model (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW(),
    doc_category_id INTEGER REFERENCES doc_category(category_id) ON DELETE SET NULL,
    ai_model_id INTEGER REFERENCES model_config(model_id),
    purpose TEXT,
    UNIQUE(model_name, version)
);
CREATE INDEX idx_model_name ON model(model_name);
CREATE INDEX idx_model_version ON model(version);
CREATE INDEX idx_model_doc_category_id ON model(doc_category_id);

-- Table: field_mapping
CREATE TABLE field_mapping (
    mapping_id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES model_config(model_id) ON DELETE CASCADE,
    field_id INTEGER NOT NULL REFERENCES field_table(field_id) ON DELETE CASCADE,
    field_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(model_id, field_id)
);
CREATE INDEX idx_mapping_model_id ON field_mapping(model_id);
CREATE INDEX idx_mapping_field_id ON field_mapping(field_id);

-- Table: output_profile
CREATE TABLE output_profile (
    profile_id SERIAL PRIMARY KEY,
    profile_name VARCHAR(100) NOT NULL,
    client_id INTEGER REFERENCES client(client_id) ON DELETE CASCADE,
    doc_category_id INTEGER NOT NULL REFERENCES doc_category(category_id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    output_format VARCHAR(100) DEFAULT 'csv',
    csv_delimiter VARCHAR(5) DEFAULT ',',
    csv_quote_char VARCHAR(5) DEFAULT '"',
    include_header BOOLEAN DEFAULT TRUE,
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    number_format VARCHAR(50) DEFAULT '0.00',
    currency_symbol VARCHAR(10) DEFAULT '$',
    null_value VARCHAR(50) DEFAULT '',
    description TEXT,
    extraction_prompt TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_profile_client_category ON output_profile(client_id, doc_category_id);
CREATE INDEX idx_profile_is_default ON output_profile(is_default);

-- Table: output_profile_field
CREATE TABLE output_profile_field (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES output_profile(profile_id) ON DELETE CASCADE,
    field_id INTEGER NOT NULL REFERENCES field_table(field_id) ON DELETE CASCADE,
    custom_label VARCHAR(255),
    field_order INTEGER DEFAULT 0,
    is_included BOOLEAN DEFAULT TRUE,
    is_required BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255),
    transform_type transform_type_enum DEFAULT 'none',
    transform_config JSONB,
    validation_rule JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(profile_id, field_id)
);
CREATE INDEX idx_profile_field_profile_id ON output_profile_field(profile_id);
CREATE INDEX idx_profile_field_order ON output_profile_field(profile_id, field_order);

-- Table: payment_transaction
CREATE TABLE payment_transaction (
    transaction_id SERIAL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoice(invoice_id) ON DELETE RESTRICT,
    payment_link VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status_enum DEFAULT 'initiated',
    payment_method VARCHAR(100),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    attempted_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);
CREATE INDEX idx_payment_invoice_status ON payment_transaction(invoice_id, status);
CREATE INDEX idx_payment_link ON payment_transaction(payment_link);

-- Table: processing_config
CREATE TABLE processing_config (
    config_id SERIAL PRIMARY KEY,
    doc_category_id INTEGER REFERENCES doc_category(category_id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(doc_category_id, config_key)
);
CREATE INDEX idx_processing_doc_category ON processing_config(doc_category_id);
CREATE INDEX idx_processing_config_key ON processing_config(config_key);

-- Table: processing_logs
CREATE TABLE processing_logs (
    log_id SERIAL PRIMARY KEY,
    process_id INTEGER NOT NULL REFERENCES document_processed(process_id) ON DELETE CASCADE,
    log_level log_level_enum DEFAULT 'INFO',
    log_message TEXT,
    log_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_processing_log_process_id ON processing_logs(process_id);
CREATE INDEX idx_processing_log_level ON processing_logs(log_level);

-- Table: report_field_definitions
CREATE TABLE report_field_definitions (
    field_id SERIAL PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    required_permission VARCHAR(100),
    is_sortable BOOLEAN DEFAULT TRUE,
    is_filterable BOOLEAN DEFAULT TRUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    UNIQUE(module, field_name)
);
CREATE INDEX idx_report_field_module ON report_field_definitions(module);

-- Table: role_permissions
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    user_role user_role_enum NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_role, permission_id)
);
CREATE INDEX idx_role_permissions_role ON role_permissions(user_role);

-- Table: system_config
CREATE TABLE system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: user_permissions
CREATE TABLE user_permissions (
    permission_id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL REFERENCES user_profile(userid) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    granted_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(userid, permission_name)
);
CREATE INDEX idx_user_permissions_userid ON user_permissions(userid);

-- Table: user_specific_permissions
CREATE TABLE user_specific_permissions (
    id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL REFERENCES user_profile(userid) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    permission_type permission_type_enum DEFAULT 'allow',
    granted_by INTEGER REFERENCES user_profile(userid) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(userid, permission_id)
);
CREATE INDEX idx_user_specific_userid ON user_specific_permissions(userid);
CREATE INDEX idx_user_specific_type ON user_specific_permissions(permission_type);

-- Create updated_at triggers for all tables
CREATE TRIGGER update_client_updated_at BEFORE UPDATE ON client FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doc_category_updated_at BEFORE UPDATE ON doc_category FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_configuration_updated_at BEFORE UPDATE ON billing_configuration FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_sample_document_updated_at BEFORE UPDATE ON category_sample_document FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_usage_updated_at BEFORE UPDATE ON client_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_reports_updated_at BEFORE UPDATE ON custom_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_processed_updated_at BEFORE UPDATE ON document_processed FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_extracted_data_updated_at BEFORE UPDATE ON extracted_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_field_table_updated_at BEFORE UPDATE ON field_table FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_updated_at BEFORE UPDATE ON invoice FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mail_log_updated_at BEFORE UPDATE ON mail_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_model_config_updated_at BEFORE UPDATE ON model_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_model_updated_at BEFORE UPDATE ON model FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_field_mapping_updated_at BEFORE UPDATE ON field_mapping FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_output_profile_updated_at BEFORE UPDATE ON output_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_output_profile_field_updated_at BEFORE UPDATE ON output_profile_field FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_config_updated_at BEFORE UPDATE ON processing_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views
CREATE OR REPLACE VIEW v_effective_output_profile AS
SELECT
    COALESCE(cp.profile_id, dp.profile_id) as profile_id,
    COALESCE(cp.profile_name, dp.profile_name) as profile_name,
    COALESCE(cp.client_id, dp.client_id) as client_id,
    COALESCE(cp.doc_category_id, dp.doc_category_id) as doc_category_id,
    COALESCE(cp.output_format, dp.output_format) as output_format,
    COALESCE(cp.csv_delimiter, dp.csv_delimiter) as csv_delimiter,
    COALESCE(cp.csv_quote_char, dp.csv_quote_char) as csv_quote_char,
    COALESCE(cp.include_header, dp.include_header) as include_header,
    COALESCE(cp.date_format, dp.date_format) as date_format,
    COALESCE(cp.number_format, dp.number_format) as number_format,
    COALESCE(cp.currency_symbol, dp.currency_symbol) as currency_symbol,
    COALESCE(cp.null_value, dp.null_value) as null_value,
    COALESCE(cp.extraction_prompt, dp.extraction_prompt) as extraction_prompt,
    CASE WHEN cp.profile_id IS NOT NULL THEN FALSE ELSE TRUE END as is_default_profile
FROM output_profile dp
LEFT JOIN output_profile cp ON dp.doc_category_id = cp.doc_category_id AND cp.client_id IS NOT NULL
WHERE dp.is_default = TRUE AND dp.is_active = TRUE;

CREATE OR REPLACE VIEW v_output_profile_fields AS
SELECT
    opf.id,
    opf.profile_id,
    opf.field_id,
    ft.field_name,
    COALESCE(opf.custom_label, ft.field_display_name, ft.field_name) as display_label,
    ft.field_type,
    opf.field_order,
    opf.is_included,
    opf.is_required,
    opf.default_value,
    opf.transform_type,
    opf.transform_config,
    opf.validation_rule
FROM output_profile_field opf
JOIN field_table ft ON opf.field_id = ft.field_id
WHERE opf.is_included = TRUE
ORDER BY opf.field_order;

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE client ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured based on your authentication strategy
-- Example policy (customize based on your needs):
-- CREATE POLICY "Users can view own profile" ON user_profile FOR SELECT USING (auth.uid()::text = userid::text);
