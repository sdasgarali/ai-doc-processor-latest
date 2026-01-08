-- EOB Extraction System Database Setup
-- Database: eob_extraction

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS eob_extraction;
USE eob_extraction;

-- Document Categories Table
CREATE TABLE IF NOT EXISTS doc_category (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default categories
INSERT INTO doc_category (category_id, category_name, category_description) VALUES
(1, 'eob', 'Explanation of Benefits documents'),
(2, 'facesheet', 'Patient facesheet documents')
ON DUPLICATE KEY UPDATE category_name = category_name;

-- Client Table
CREATE TABLE IF NOT EXISTS client (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone_no VARCHAR(50),
    date_started DATE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    active_model INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Profile Table
CREATE TABLE IF NOT EXISTS user_profile (
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
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_user_role (user_role),
    INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document Processed Table
CREATE TABLE IF NOT EXISTS document_processed (
    process_id INT AUTO_INCREMENT PRIMARY KEY,
    doc_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    no_of_pages INT,
    processing_status ENUM('In-Progress', 'Processed', 'Failed') DEFAULT 'In-Progress',
    time_initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_finished TIMESTAMP NULL,
    total_processing_time INT COMMENT 'Time in seconds',
    link_to_file VARCHAR(1000),
    link_to_csv VARCHAR(1000),
    link_to_json VARCHAR(1000),
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
    FOREIGN KEY (doc_category) REFERENCES doc_category(category_id) ON DELETE SET NULL,
    INDEX idx_processing_status (processing_status),
    INDEX idx_session_id (session_id),
    INDEX idx_userid (userid),
    INDEX idx_client_id (client_id),
    INDEX idx_time_initiated (time_initiated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Field Table
CREATE TABLE IF NOT EXISTS field_table (
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
    UNIQUE KEY unique_field_category (field_name, doc_category),
    INDEX idx_doc_category (doc_category),
    INDEX idx_field_name (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default EOB fields
INSERT INTO field_table (field_name, field_display_name, field_type, doc_category, keywords) VALUES
('patient_acct', 'Patient Account', 'string', 1, '["patient account", "acct", "account no"]'),
('Patient_ID', 'Patient ID', 'string', 1, '["patient id", "patient identifier"]'),
('Claim_ID', 'Claim ID', 'string', 1, '["claim id", "claim number"]'),
('Patient_Name', 'Patient Name', 'string', 1, '["patient name", "name"]'),
('First_Name', 'First Name', 'string', 1, '["first name", "given name"]'),
('Last_Name', 'Last Name', 'string', 1, '["last name", "surname", "family name"]'),
('member_number', 'Member Number', 'string', 1, '["member number", "member id"]'),
('service_date', 'Service Date', 'date', 1, '["service date", "date of service", "dos"]'),
('allowed_amount', 'Allowed Amount', 'number', 1, '["allowed amount", "allowed"]'),
('interest_amount', 'Interest Amount', 'number', 1, '["interest", "interest amount"]'),
('paid_amount', 'Paid Amount', 'number', 1, '["paid amount", "amount paid"]'),
('insurance_co', 'Insurance Company', 'string', 1, '["insurance", "insurer", "payer"]'),
('billed_amount', 'Billed Amount', 'number', 1, '["billed amount", "charges"]'),
('cpt_hcpcs', 'CPT/HCPCS', 'string', 1, '["cpt", "hcpcs", "procedure code"]'),
('adj_co45', 'Adjustment CO45', 'number', 1, '["co45", "adjustment 45"]'),
('adj_co144', 'Adjustment CO144', 'number', 1, '["co144", "adjustment 144"]'),
('adj_co253', 'Adjustment CO253', 'number', 1, '["co253", "adjustment 253"]'),
('check_number', 'Check Number', 'string', 1, '["check number", "check no", "eft"]'),
('account_number', 'Account Number', 'string', 1, '["account number", "account"]'),
('patient_responsibility', 'Patient Responsibility', 'number', 1, '["patient responsibility", "patient owes"]'),
('claim_summary', 'Claim Summary', 'string', 1, '["claim summary", "summary"]'),
('action_required', 'Action Required', 'string', 1, '["action required", "action"]'),
('reason_code_comments', 'Reason Code Comments', 'string', 1, '["reason code", "remarks", "comments"]')
ON DUPLICATE KEY UPDATE field_display_name = VALUES(field_display_name);

-- Model Configuration Table
CREATE TABLE IF NOT EXISTS model_config (
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
    FOREIGN KEY (created_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    INDEX idx_doc_category (doc_category),
    INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Field Mapping Table (links models to fields)
CREATE TABLE IF NOT EXISTS field_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    field_id INT NOT NULL,
    field_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES model_config(model_id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES field_table(field_id) ON DELETE CASCADE,
    UNIQUE KEY unique_model_field (model_id, field_id),
    INDEX idx_model_id (model_id),
    INDEX idx_field_id (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Processing Logs Table
CREATE TABLE IF NOT EXISTS processing_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    process_id INT NOT NULL,
    log_level ENUM('INFO', 'WARNING', 'ERROR') DEFAULT 'INFO',
    log_message TEXT,
    log_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES document_processed(process_id) ON DELETE CASCADE,
    INDEX idx_process_id (process_id),
    INDEX idx_log_level (log_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Permissions Table
CREATE TABLE IF NOT EXISTS user_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    granted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    UNIQUE KEY unique_user_permission (userid, permission_name),
    INDEX idx_userid (userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
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
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE SET NULL,
    INDEX idx_userid (userid),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create default superadmin user (password: Admin@123)
INSERT INTO user_profile (email, password, user_role, first_name, last_name) VALUES
('admin@eobsystem.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'superadmin', 'System', 'Administrator')
ON DUPLICATE KEY UPDATE email = email;

-- Views for reporting
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

-- Grant privileges (adjust as needed for production)
-- GRANT ALL PRIVILEGES ON documentprocessingdb.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;
