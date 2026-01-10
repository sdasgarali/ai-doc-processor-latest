-- MySQL Schema Export for eob_extraction


-- Table: audit_log
CREATE TABLE `audit_log` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `userid` int DEFAULT NULL,
  `action` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `record_id` int DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_userid` (`userid`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: billing_configuration
CREATE TABLE `billing_configuration` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `system_mailer` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ali.aitechs@gmail.com' COMMENT 'Email address for outgoing invoices',
  `system_mailer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'EOB Extraction System',
  `invoice_date_day` int DEFAULT '1' COMMENT 'Day of month to generate invoices (1-28)',
  `due_date_day` int DEFAULT '5' COMMENT 'Day of month for payment due date',
  `reminder_frequency_days` int DEFAULT '3' COMMENT 'Days between reminder emails',
  `max_reminder_count` int DEFAULT '5' COMMENT 'Maximum reminder emails to send',
  `auto_generate_enabled` tinyint(1) DEFAULT '1',
  `payment_gateway` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'stripe' COMMENT 'Payment processor (stripe, paypal, etc.)',
  `payment_gateway_config` json DEFAULT NULL COMMENT 'API keys and settings',
  `invoice_prefix` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'INV' COMMENT 'Prefix for invoice numbers',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `tax_rate` decimal(5,2) DEFAULT '0.00' COMMENT 'Tax percentage',
  `company_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'EOB Extraction System',
  `company_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `company_phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL COMMENT 'Admin who updated configuration',
  PRIMARY KEY (`config_id`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `billing_configuration_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: category_creation_request
CREATE TABLE `category_creation_request` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expected_fields` text COLLATE utf8mb4_unicode_ci,
  `expected_output_format` enum('csv','json','excel','xlsx','xml','pdf','doc','docx','txt') COLLATE utf8mb4_unicode_ci DEFAULT 'csv',
  `sample_document_id` int DEFAULT NULL,
  `ai_model_used` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_prompt_used` text COLLATE utf8mb4_unicode_ci,
  `ai_response` json DEFAULT NULL,
  `suggested_fields` json DEFAULT NULL,
  `status` enum('pending','processing','review','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `created_category_id` int DEFAULT NULL,
  `created_profile_id` int DEFAULT NULL,
  `requested_by` int DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`request_id`),
  KEY `sample_document_id` (`sample_document_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_status` (`status`),
  KEY `idx_requested_by` (`requested_by`),
  CONSTRAINT `category_creation_request_ibfk_1` FOREIGN KEY (`sample_document_id`) REFERENCES `category_sample_document` (`sample_id`) ON DELETE SET NULL,
  CONSTRAINT `category_creation_request_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL,
  CONSTRAINT `category_creation_request_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: category_sample_document
CREATE TABLE `category_sample_document` (
  `sample_id` int NOT NULL AUTO_INCREMENT,
  `doc_category_id` int NOT NULL,
  `file_name` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_filename` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gdrive_file_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `expected_fields` text COLLATE utf8mb4_unicode_ci,
  `expected_output_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_analysis_result` json DEFAULT NULL,
  `ai_suggested_fields` json DEFAULT NULL,
  `analysis_status` enum('pending','analyzing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `analysis_error` text COLLATE utf8mb4_unicode_ci,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sample_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_category` (`doc_category_id`),
  KEY `idx_status` (`analysis_status`),
  CONSTRAINT `category_sample_document_ibfk_1` FOREIGN KEY (`doc_category_id`) REFERENCES `doc_category` (`category_id`) ON DELETE CASCADE,
  CONSTRAINT `category_sample_document_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: client
CREATE TABLE `client` (
  `client_id` int NOT NULL AUTO_INCREMENT,
  `client_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_started` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `active_model` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: client_usage
CREATE TABLE `client_usage` (
  `usage_id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `usage_details` json DEFAULT NULL COMMENT 'Breakdown of documents processed, storage used, etc.',
  `total_documents` int DEFAULT '0',
  `total_pages` int DEFAULT '0',
  `total_cost` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`usage_id`),
  UNIQUE KEY `idx_client_period` (`client_id`,`period_start`,`period_end`),
  CONSTRAINT `client_usage_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: cron_execution_log
CREATE TABLE `cron_execution_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `job_name` varchar(50) NOT NULL,
  `execution_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('success','failed') DEFAULT 'success',
  `details` json DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_job_time` (`job_name`,`execution_time`)
) ENGINE=InnoDB AUTO_INCREMENT=580 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: custom_report_access
CREATE TABLE `custom_report_access` (
  `access_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `userid` int NOT NULL,
  `can_edit` tinyint(1) DEFAULT '0',
  `granted_by` int NOT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`access_id`),
  UNIQUE KEY `unique_report_user` (`report_id`,`userid`),
  KEY `userid` (`userid`),
  KEY `granted_by` (`granted_by`),
  CONSTRAINT `custom_report_access_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `custom_reports` (`report_id`) ON DELETE CASCADE,
  CONSTRAINT `custom_report_access_ibfk_2` FOREIGN KEY (`userid`) REFERENCES `user_profile` (`userid`) ON DELETE CASCADE,
  CONSTRAINT `custom_report_access_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `user_profile` (`userid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: custom_reports
CREATE TABLE `custom_reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `report_name` varchar(255) NOT NULL,
  `description` text,
  `created_by` int NOT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `module` varchar(100) NOT NULL,
  `selected_fields` json NOT NULL,
  `filters` json DEFAULT NULL,
  `sort_order` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_module` (`module`),
  KEY `idx_public` (`is_public`),
  CONSTRAINT `custom_reports_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `user_profile` (`userid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: doc_category
CREATE TABLE `doc_category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_ai_generated` tinyint(1) DEFAULT '0',
  `sample_document_id` int DEFAULT NULL,
  `creation_request_id` int DEFAULT NULL,
  `requires_sample` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name` (`category_name`),
  KEY `idx_category_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: document_processed
CREATE TABLE `document_processed` (
  `process_id` int NOT NULL AUTO_INCREMENT,
  `doc_name` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_filename` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_of_pages` int DEFAULT NULL,
  `processing_status` enum('In-Progress','Processed','Failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'In-Progress',
  `time_initiated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `time_finished` timestamp NULL DEFAULT NULL,
  `total_processing_time` int DEFAULT NULL COMMENT 'Time in seconds',
  `cost` decimal(10,2) DEFAULT '0.00',
  `link_to_file` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `link_to_csv` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `link_to_json` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userid` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `model_id` int DEFAULT NULL,
  `session_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `doc_category` int DEFAULT NULL,
  `gdrive_file_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `json_drive_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `csv_drive_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_ai_cost` decimal(10,4) DEFAULT '0.0000',
  `openai_cost` decimal(10,4) DEFAULT '0.0000',
  `total_records` int DEFAULT '0',
  PRIMARY KEY (`process_id`),
  KEY `doc_category` (`doc_category`),
  KEY `idx_processing_status` (`processing_status`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_userid` (`userid`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_time_initiated` (`time_initiated`),
  CONSTRAINT `document_processed_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL,
  CONSTRAINT `document_processed_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `document_processed_ibfk_3` FOREIGN KEY (`doc_category`) REFERENCES `doc_category` (`category_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: extracted_data
CREATE TABLE `extracted_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `process_id` int NOT NULL,
  `row_data` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_process_id` (`process_id`),
  CONSTRAINT `extracted_data_ibfk_1` FOREIGN KEY (`process_id`) REFERENCES `document_processed` (`process_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=292 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: field_mapping
CREATE TABLE `field_mapping` (
  `mapping_id` int NOT NULL AUTO_INCREMENT,
  `model_id` int NOT NULL,
  `field_id` int NOT NULL,
  `field_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mapping_id`),
  UNIQUE KEY `unique_model_field` (`model_id`,`field_id`),
  KEY `idx_model_id` (`model_id`),
  KEY `idx_field_id` (`field_id`),
  CONSTRAINT `field_mapping_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `model_config` (`model_id`) ON DELETE CASCADE,
  CONSTRAINT `field_mapping_ibfk_2` FOREIGN KEY (`field_id`) REFERENCES `field_table` (`field_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: field_table
CREATE TABLE `field_table` (
  `field_id` int NOT NULL AUTO_INCREMENT,
  `field_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_display_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `field_type` enum('string','number','date','boolean') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'string',
  `doc_category` int DEFAULT NULL,
  `is_required` tinyint(1) DEFAULT '0',
  `default_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `validation_regex` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keywords` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'JSON array of keywords for field extraction',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`field_id`),
  UNIQUE KEY `unique_field_category` (`field_name`,`doc_category`),
  UNIQUE KEY `unique_field_name_doc_category` (`field_name`,`doc_category`),
  KEY `idx_doc_category` (`doc_category`),
  KEY `idx_field_name` (`field_name`),
  CONSTRAINT `field_table_ibfk_1` FOREIGN KEY (`doc_category`) REFERENCES `doc_category` (`category_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice
CREATE TABLE `invoice` (
  `invoice_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID format',
  `client_id` int NOT NULL,
  `usage_id` int DEFAULT NULL,
  `invoice_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Human-readable invoice number (e.g., INV-2025-001)',
  `invoice_date` date NOT NULL COMMENT 'Date invoice was generated',
  `due_date` date NOT NULL COMMENT 'Payment due date',
  `amount_due` decimal(10,2) NOT NULL,
  `status` enum('not_generated','unpaid','paid','overdue','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'not_generated',
  `payment_link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Secure payment token/URL',
  `payment_link_expires_at` timestamp NULL DEFAULT NULL,
  `pdf_attachment_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Path to generated PDF invoice',
  `paid_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_transaction_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `generated_by` int DEFAULT NULL COMMENT 'Admin who generated the invoice',
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  UNIQUE KEY `payment_link` (`payment_link`),
  KEY `usage_id` (`usage_id`),
  KEY `generated_by` (`generated_by`),
  KEY `idx_client_date` (`client_id`,`invoice_date`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`),
  CONSTRAINT `invoice_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE RESTRICT,
  CONSTRAINT `invoice_ibfk_2` FOREIGN KEY (`usage_id`) REFERENCES `client_usage` (`usage_id`) ON DELETE RESTRICT,
  CONSTRAINT `invoice_ibfk_3` FOREIGN KEY (`generated_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice_reminder_schedule
CREATE TABLE `invoice_reminder_schedule` (
  `schedule_id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `reminder_number` int NOT NULL COMMENT '1st, 2nd, 3rd reminder, etc.',
  `scheduled_for` timestamp NOT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `status` enum('scheduled','sent','cancelled','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `mail_log_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`schedule_id`),
  UNIQUE KEY `idx_invoice_reminder` (`invoice_id`,`reminder_number`),
  KEY `mail_log_id` (`mail_log_id`),
  KEY `idx_scheduled_status` (`scheduled_for`,`status`),
  CONSTRAINT `invoice_reminder_schedule_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`) ON DELETE CASCADE,
  CONSTRAINT `invoice_reminder_schedule_ibfk_2` FOREIGN KEY (`mail_log_id`) REFERENCES `mail_log` (`mail_log_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice_summary
undefined;

-- Table: mail_log
CREATE TABLE `mail_log` (
  `mail_log_id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_type` enum('invoice_generated','payment_reminder','payment_received','invoice_overdue','invoice_cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attachments` json DEFAULT NULL COMMENT 'Array of attachment file paths',
  `sent_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','success','failed','retry_pending') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `retry_count` int DEFAULT '0',
  `max_retries` int DEFAULT '3',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `next_retry_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mail_log_id`),
  KEY `idx_invoice_type` (`invoice_id`,`email_type`),
  KEY `idx_status_retry` (`status`,`next_retry_at`),
  CONSTRAINT `mail_log_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=378868 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: model
CREATE TABLE `model` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `doc_category_id` int DEFAULT NULL,
  `ai_model_id` int DEFAULT NULL,
  `purpose` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_model_version` (`model_name`,`version`),
  KEY `idx_model_name` (`model_name`),
  KEY `idx_version` (`version`),
  KEY `idx_doc_category_id` (`doc_category_id`),
  KEY `ai_model_id` (`ai_model_id`),
  CONSTRAINT `model_ibfk_1` FOREIGN KEY (`doc_category_id`) REFERENCES `doc_category` (`category_id`) ON DELETE SET NULL,
  CONSTRAINT `model_ibfk_2` FOREIGN KEY (`ai_model_id`) REFERENCES `model_config` (`model_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: model_config
CREATE TABLE `model_config` (
  `model_id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `doc_category` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `model_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'OpenAI model code (e.g., gpt-4o, gpt-4o-mini)',
  `input_cost_per_1k` decimal(10,6) DEFAULT '0.000150' COMMENT 'Cost per 1000 input tokens in USD',
  `output_cost_per_1k` decimal(10,6) DEFAULT '0.000600' COMMENT 'Cost per 1000 output tokens in USD',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Whether this model is available for use',
  PRIMARY KEY (`model_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_doc_category` (`doc_category`),
  KEY `idx_client_id` (`client_id`),
  CONSTRAINT `model_config_ibfk_1` FOREIGN KEY (`doc_category`) REFERENCES `doc_category` (`category_id`) ON DELETE CASCADE,
  CONSTRAINT `model_config_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `model_config_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: monthly_revenue
undefined;

-- Table: output_profile
CREATE TABLE `output_profile` (
  `profile_id` int NOT NULL AUTO_INCREMENT,
  `profile_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` int DEFAULT NULL,
  `doc_category_id` int NOT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `output_format` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'csv',
  `csv_delimiter` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT ',',
  `csv_quote_char` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT '"',
  `include_header` tinyint(1) DEFAULT '1',
  `date_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'YYYY-MM-DD',
  `number_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0.00',
  `currency_symbol` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT '$',
  `null_value` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `extraction_prompt` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`),
  KEY `doc_category_id` (`doc_category_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_client_category` (`client_id`,`doc_category_id`),
  KEY `idx_is_default` (`is_default`),
  CONSTRAINT `output_profile_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE CASCADE,
  CONSTRAINT `output_profile_ibfk_2` FOREIGN KEY (`doc_category_id`) REFERENCES `doc_category` (`category_id`) ON DELETE CASCADE,
  CONSTRAINT `output_profile_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: output_profile_field
CREATE TABLE `output_profile_field` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profile_id` int NOT NULL,
  `field_id` int NOT NULL,
  `custom_label` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `field_order` int DEFAULT '0',
  `is_included` tinyint(1) DEFAULT '1',
  `is_required` tinyint(1) DEFAULT '0',
  `default_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transform_type` enum('none','uppercase','lowercase','titlecase','date_format','number_format','currency','prefix','suffix','regex_replace','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'none',
  `transform_config` json DEFAULT NULL,
  `validation_rule` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_profile_field` (`profile_id`,`field_id`),
  KEY `field_id` (`field_id`),
  KEY `idx_profile_id` (`profile_id`),
  KEY `idx_field_order` (`profile_id`,`field_order`),
  CONSTRAINT `output_profile_field_ibfk_1` FOREIGN KEY (`profile_id`) REFERENCES `output_profile` (`profile_id`) ON DELETE CASCADE,
  CONSTRAINT `output_profile_field_ibfk_2` FOREIGN KEY (`field_id`) REFERENCES `field_table` (`field_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: payment_transaction
CREATE TABLE `payment_transaction` (
  `transaction_id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_link` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `status` enum('initiated','pending','success','failed','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'initiated',
  `payment_method` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gateway_transaction_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID from payment gateway',
  `gateway_response` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attempted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_invoice_status` (`invoice_id`,`status`),
  KEY `idx_payment_link` (`payment_link`),
  CONSTRAINT `payment_transaction_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`invoice_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: permissions
CREATE TABLE `permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `permission_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `permission_name` (`permission_name`),
  KEY `idx_permission_name` (`permission_name`),
  KEY `idx_permission_category` (`permission_category`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: processing_config
CREATE TABLE `processing_config` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `doc_category_id` int DEFAULT NULL COMMENT 'NULL = default/global config for all categories',
  `config_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci,
  `is_encrypted` tinyint(1) DEFAULT '0' COMMENT 'True for sensitive values like API keys',
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `unique_category_key` (`doc_category_id`,`config_key`),
  KEY `idx_doc_category` (`doc_category_id`),
  KEY `idx_config_key` (`config_key`),
  CONSTRAINT `processing_config_ibfk_1` FOREIGN KEY (`doc_category_id`) REFERENCES `doc_category` (`category_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: processing_logs
CREATE TABLE `processing_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `process_id` int NOT NULL,
  `log_level` enum('INFO','WARNING','ERROR') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'INFO',
  `log_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `log_details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_process_id` (`process_id`),
  KEY `idx_log_level` (`log_level`),
  CONSTRAINT `processing_logs_ibfk_1` FOREIGN KEY (`process_id`) REFERENCES `document_processed` (`process_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=289 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: report_field_definitions
CREATE TABLE `report_field_definitions` (
  `field_id` int NOT NULL AUTO_INCREMENT,
  `module` varchar(100) NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `field_type` varchar(50) NOT NULL,
  `table_name` varchar(100) NOT NULL,
  `column_name` varchar(100) NOT NULL,
  `required_permission` varchar(100) DEFAULT NULL,
  `is_sortable` tinyint(1) DEFAULT '1',
  `is_filterable` tinyint(1) DEFAULT '1',
  `description` text,
  `display_order` int DEFAULT '0',
  PRIMARY KEY (`field_id`),
  UNIQUE KEY `unique_module_field` (`module`,`field_name`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: role_permissions
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_role` enum('user','admin','superadmin','client') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`user_role`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  KEY `granted_by` (`granted_by`),
  KEY `idx_user_role` (`user_role`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`granted_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=148 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: system_config
CREATE TABLE `system_config` (
  `config_key` varchar(100) NOT NULL,
  `config_value` varchar(255) NOT NULL,
  `description` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`),
  KEY `idx_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: user_permissions
CREATE TABLE `user_permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `userid` int NOT NULL,
  `permission_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `unique_user_permission` (`userid`,`permission_name`),
  KEY `granted_by` (`granted_by`),
  KEY `idx_userid` (`userid`),
  CONSTRAINT `user_permissions_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `user_profile` (`userid`) ON DELETE CASCADE,
  CONSTRAINT `user_permissions_ibfk_2` FOREIGN KEY (`granted_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: user_profile
CREATE TABLE `user_profile` (
  `userid` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `user_role` enum('user','admin','superadmin','client') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `client_id` int DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `timezone` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userid`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_user_role` (`user_role`),
  KEY `idx_client_id` (`client_id`),
  CONSTRAINT `user_profile_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `client` (`client_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: user_specific_permissions
CREATE TABLE `user_specific_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userid` int NOT NULL,
  `permission_id` int NOT NULL,
  `permission_type` enum('allow','deny') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'allow',
  `granted_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_permission` (`userid`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  KEY `granted_by` (`granted_by`),
  KEY `idx_userid` (`userid`),
  KEY `idx_permission_type` (`permission_type`),
  CONSTRAINT `user_specific_permissions_ibfk_1` FOREIGN KEY (`userid`) REFERENCES `user_profile` (`userid`) ON DELETE CASCADE,
  CONSTRAINT `user_specific_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `user_specific_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `user_profile` (`userid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
