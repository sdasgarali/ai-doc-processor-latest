-- Output Profiles Schema
-- Supports AI-driven category creation and client-specific output customization
-- Date: 2026-01-09

USE eob_extraction;

-- =====================================================
-- OUTPUT PROFILE TABLE
-- Stores default and client-specific output profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS output_profile (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    profile_name VARCHAR(100) NOT NULL,
    client_id INT DEFAULT NULL,  -- NULL = DEFAULT profile for category
    doc_category_id INT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,  -- TRUE for system default profiles
    output_format ENUM('csv', 'json', 'excel', 'xml') DEFAULT 'csv',
    csv_delimiter VARCHAR(5) DEFAULT ',',
    csv_quote_char VARCHAR(5) DEFAULT '"',
    include_header BOOLEAN DEFAULT TRUE,
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    number_format VARCHAR(50) DEFAULT '0.00',
    currency_symbol VARCHAR(10) DEFAULT '$',
    null_value VARCHAR(50) DEFAULT '',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE CASCADE,
    FOREIGN KEY (doc_category_id) REFERENCES doc_category(category_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    UNIQUE KEY unique_default_category (doc_category_id, is_default),
    UNIQUE KEY unique_client_category (client_id, doc_category_id),
    INDEX idx_client_category (client_id, doc_category_id),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- OUTPUT PROFILE FIELDS TABLE
-- Defines which fields are included and their configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS output_profile_field (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    field_id INT NOT NULL,
    custom_label VARCHAR(255),           -- Client's preferred column name
    field_order INT DEFAULT 0,           -- Column order in output (1, 2, 3...)
    is_included BOOLEAN DEFAULT TRUE,    -- Include in output?
    is_required BOOLEAN DEFAULT FALSE,   -- Required field?
    default_value VARCHAR(255),          -- Default if empty
    transform_type ENUM('none', 'uppercase', 'lowercase', 'titlecase',
                        'date_format', 'number_format', 'currency',
                        'prefix', 'suffix', 'regex_replace', 'custom') DEFAULT 'none',
    transform_config JSON,               -- Configuration for transform
    validation_rule JSON,                -- Validation rules
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES output_profile(profile_id) ON DELETE CASCADE,
    FOREIGN KEY (field_id) REFERENCES field_table(field_id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_field (profile_id, field_id),
    INDEX idx_profile_id (profile_id),
    INDEX idx_field_order (profile_id, field_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CATEGORY SAMPLE DOCUMENTS TABLE
-- Stores sample documents uploaded for AI analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS category_sample_document (
    sample_id INT AUTO_INCREMENT PRIMARY KEY,
    doc_category_id INT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    file_path VARCHAR(1000),
    gdrive_file_id VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),
    description TEXT,                    -- User's description of expected fields
    expected_fields TEXT,                -- JSON array of expected field names
    expected_output_format VARCHAR(50),  -- Expected output format
    ai_analysis_result JSON,             -- AI's analysis of the document
    ai_suggested_fields JSON,            -- AI-suggested field schema
    analysis_status ENUM('pending', 'analyzing', 'completed', 'failed') DEFAULT 'pending',
    analysis_error TEXT,
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_category_id) REFERENCES doc_category(category_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    INDEX idx_category (doc_category_id),
    INDEX idx_status (analysis_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CATEGORY CREATION REQUEST TABLE
-- Tracks AI-powered category creation requests
-- =====================================================
CREATE TABLE IF NOT EXISTS category_creation_request (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT NOT NULL,
    expected_fields TEXT,                -- JSON array of expected field names
    expected_output_format ENUM('csv', 'json', 'excel') DEFAULT 'csv',
    sample_document_id INT,
    ai_model_used VARCHAR(100),          -- e.g., 'gpt-4', 'mistral-large'
    ai_prompt_used TEXT,
    ai_response JSON,
    suggested_fields JSON,               -- AI-generated field suggestions
    status ENUM('pending', 'processing', 'review', 'approved', 'rejected') DEFAULT 'pending',
    review_notes TEXT,
    created_category_id INT,             -- Reference to created category
    created_profile_id INT,              -- Reference to created default profile
    requested_by INT,
    reviewed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    FOREIGN KEY (sample_document_id) REFERENCES category_sample_document(sample_id) ON DELETE SET NULL,
    FOREIGN KEY (created_category_id) REFERENCES doc_category(category_id) ON DELETE SET NULL,
    FOREIGN KEY (created_profile_id) REFERENCES output_profile(profile_id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_requested_by (requested_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- UPDATE DOC_CATEGORY TABLE
-- Add fields for AI-generated categories
-- =====================================================
ALTER TABLE doc_category
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sample_document_id INT,
ADD COLUMN IF NOT EXISTS creation_request_id INT,
ADD COLUMN IF NOT EXISTS requires_sample BOOLEAN DEFAULT TRUE;

-- =====================================================
-- CREATE DEFAULT PROFILES FOR EXISTING CATEGORIES
-- =====================================================

-- Create DEFAULT profile for EOB category
INSERT INTO output_profile (profile_name, client_id, doc_category_id, is_default, output_format, description)
SELECT 'EOB Default Profile', NULL, category_id, TRUE, 'csv', 'Default output profile for EOB documents'
FROM doc_category WHERE category_name = 'eob'
ON DUPLICATE KEY UPDATE profile_name = profile_name;

-- Create DEFAULT profile for Facesheet category
INSERT INTO output_profile (profile_name, client_id, doc_category_id, is_default, output_format, description)
SELECT 'Facesheet Default Profile', NULL, category_id, TRUE, 'csv', 'Default output profile for Facesheet documents'
FROM doc_category WHERE category_name = 'facesheet'
ON DUPLICATE KEY UPDATE profile_name = profile_name;

-- =====================================================
-- POPULATE EOB DEFAULT PROFILE FIELDS
-- =====================================================
INSERT INTO output_profile_field (profile_id, field_id, custom_label, field_order, is_included, is_required)
SELECT
    op.profile_id,
    ft.field_id,
    ft.field_display_name,
    ROW_NUMBER() OVER (ORDER BY ft.field_id) as field_order,
    TRUE,
    ft.is_required
FROM output_profile op
JOIN doc_category dc ON op.doc_category_id = dc.category_id
JOIN field_table ft ON ft.doc_category = dc.category_id
WHERE dc.category_name = 'eob' AND op.is_default = TRUE
ON DUPLICATE KEY UPDATE custom_label = VALUES(custom_label);

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- View to get effective profile for client/category
CREATE OR REPLACE VIEW v_effective_output_profile AS
SELECT
    c.client_id,
    c.client_name,
    dc.category_id,
    dc.category_name,
    COALESCE(client_profile.profile_id, default_profile.profile_id) as effective_profile_id,
    COALESCE(client_profile.profile_name, default_profile.profile_name) as effective_profile_name,
    COALESCE(client_profile.output_format, default_profile.output_format) as output_format,
    CASE WHEN client_profile.profile_id IS NOT NULL THEN 'client' ELSE 'default' END as profile_source
FROM client c
CROSS JOIN doc_category dc
LEFT JOIN output_profile client_profile
    ON client_profile.client_id = c.client_id
    AND client_profile.doc_category_id = dc.category_id
    AND client_profile.is_active = TRUE
LEFT JOIN output_profile default_profile
    ON default_profile.doc_category_id = dc.category_id
    AND default_profile.is_default = TRUE
    AND default_profile.is_active = TRUE;

-- View to get profile fields with details
CREATE OR REPLACE VIEW v_output_profile_fields AS
SELECT
    op.profile_id,
    op.profile_name,
    op.client_id,
    op.doc_category_id,
    op.is_default,
    opf.id as profile_field_id,
    opf.field_id,
    ft.field_name,
    COALESCE(opf.custom_label, ft.field_display_name) as display_label,
    opf.field_order,
    opf.is_included,
    opf.is_required,
    opf.default_value,
    opf.transform_type,
    opf.transform_config,
    ft.field_type
FROM output_profile op
JOIN output_profile_field opf ON op.profile_id = opf.profile_id
JOIN field_table ft ON opf.field_id = ft.field_id
WHERE opf.is_included = TRUE
ORDER BY op.profile_id, opf.field_order;

-- =====================================================
-- STORED PROCEDURE: Copy Default Profile to Client
-- =====================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS sp_copy_profile_to_client(
    IN p_source_profile_id INT,
    IN p_target_client_id INT,
    IN p_profile_name VARCHAR(100),
    IN p_created_by INT
)
BEGIN
    DECLARE v_new_profile_id INT;
    DECLARE v_category_id INT;

    -- Get category from source profile
    SELECT doc_category_id INTO v_category_id
    FROM output_profile WHERE profile_id = p_source_profile_id;

    -- Check if client profile already exists
    IF EXISTS (SELECT 1 FROM output_profile
               WHERE client_id = p_target_client_id
               AND doc_category_id = v_category_id) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Client profile already exists for this category';
    END IF;

    -- Create new profile for client
    INSERT INTO output_profile (
        profile_name, client_id, doc_category_id, is_default,
        output_format, csv_delimiter, csv_quote_char, include_header,
        date_format, number_format, currency_symbol, null_value,
        description, is_active, created_by
    )
    SELECT
        COALESCE(p_profile_name, CONCAT(profile_name, ' - Custom')),
        p_target_client_id,
        doc_category_id,
        FALSE,
        output_format, csv_delimiter, csv_quote_char, include_header,
        date_format, number_format, currency_symbol, null_value,
        CONCAT('Customized from: ', profile_name),
        TRUE,
        p_created_by
    FROM output_profile
    WHERE profile_id = p_source_profile_id;

    SET v_new_profile_id = LAST_INSERT_ID();

    -- Copy all fields
    INSERT INTO output_profile_field (
        profile_id, field_id, custom_label, field_order,
        is_included, is_required, default_value,
        transform_type, transform_config, validation_rule
    )
    SELECT
        v_new_profile_id,
        field_id, custom_label, field_order,
        is_included, is_required, default_value,
        transform_type, transform_config, validation_rule
    FROM output_profile_field
    WHERE profile_id = p_source_profile_id;

    SELECT v_new_profile_id as new_profile_id;
END //

DELIMITER ;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_output_profile_active
ON output_profile(is_active, doc_category_id);

CREATE INDEX IF NOT EXISTS idx_profile_field_included
ON output_profile_field(profile_id, is_included, field_order);
