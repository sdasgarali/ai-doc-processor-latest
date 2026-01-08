-- Custom Reports Schema
-- Allows users to create and save custom report configurations

-- Table to store custom report configurations
CREATE TABLE IF NOT EXISTS custom_reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  report_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  module VARCHAR(100) NOT NULL, -- e.g., 'documents', 'clients', 'users'
  selected_fields JSON NOT NULL, -- Array of field names to include
  filters JSON, -- Saved filter configuration
  sort_order JSON, -- Saved sort configuration
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES user_profile(userid) ON DELETE CASCADE,
  INDEX idx_created_by (created_by),
  INDEX idx_module (module),
  INDEX idx_public (is_public)
);

-- Table to track report access/sharing
CREATE TABLE IF NOT EXISTS custom_report_access (
  access_id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  userid INT NOT NULL,
  can_edit BOOLEAN DEFAULT FALSE,
  granted_by INT NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES custom_reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES user_profile(userid) ON DELETE CASCADE,
  UNIQUE KEY unique_report_user (report_id, userid)
);

-- Table to define available fields per module
CREATE TABLE IF NOT EXISTS report_field_definitions (
  field_id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  field_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'date', 'boolean'
  table_name VARCHAR(100) NOT NULL, -- Actual database table
  column_name VARCHAR(100) NOT NULL, -- Actual database column
  required_permission VARCHAR(100), -- Permission needed to view this field
  is_sortable BOOLEAN DEFAULT TRUE,
  is_filterable BOOLEAN DEFAULT TRUE,
  description TEXT,
  display_order INT DEFAULT 0,
  UNIQUE KEY unique_module_field (module, field_name),
  INDEX idx_module (module)
);

-- Insert default field definitions for documents module
INSERT INTO report_field_definitions (module, field_name, display_name, field_type, table_name, column_name, required_permission, is_sortable, is_filterable, description, display_order) VALUES
-- Document Process Fields
('documents', 'process_id', 'Process ID', 'number', 'document_processed', 'process_id', 'view_documents', TRUE, TRUE, 'Unique process identifier', 1),
('documents', 'original_filename', 'Document Name', 'string', 'document_processed', 'original_filename', 'view_documents', TRUE, TRUE, 'Original filename', 2),
('documents', 'processing_status', 'Status', 'string', 'document_processed', 'processing_status', 'view_documents', TRUE, TRUE, 'Processing status', 3),
('documents', 'no_of_pages', 'Pages', 'number', 'document_processed', 'no_of_pages', 'view_documents', TRUE, TRUE, 'Number of pages', 4),
('documents', 'total_records', 'Records', 'number', 'document_processed', 'total_records', 'view_documents', TRUE, TRUE, 'Total records extracted', 5),
('documents', 'cost', 'Cost ($)', 'number', 'document_processed', 'cost', 'view_documents', TRUE, TRUE, 'Processing cost', 6),
('documents', 'time_initiated', 'Upload Date', 'date', 'document_processed', 'time_initiated', 'view_documents', TRUE, TRUE, 'Upload timestamp', 7),
('documents', 'time_finished', 'Completion Date', 'date', 'document_processed', 'time_finished', 'view_documents', TRUE, TRUE, 'Completion timestamp', 8),
('documents', 'total_processing_time', 'Processing Time', 'number', 'document_processed', 'total_processing_time', 'view_documents', TRUE, TRUE, 'Total processing time in seconds', 9),
('documents', 'document_ai_cost', 'Document AI Cost', 'number', 'document_processed', 'document_ai_cost', 'view_documents', TRUE, TRUE, 'Document AI processing cost', 10),
('documents', 'openai_cost', 'OpenAI Cost', 'number', 'document_processed', 'openai_cost', 'view_documents', TRUE, TRUE, 'OpenAI processing cost', 11),
-- Client Fields (joined)
('documents', 'client_name', 'Client Name', 'string', 'client', 'client_name', 'view_clients', TRUE, TRUE, 'Client organization name', 12),
('documents', 'client_contact', 'Client Contact', 'string', 'client', 'contact_name', 'view_clients', TRUE, TRUE, 'Client contact person', 13),
('documents', 'client_email', 'Client Email', 'string', 'client', 'email', 'view_clients', TRUE, TRUE, 'Client email address', 14),
-- User Fields (joined)
('documents', 'user_email', 'Uploaded By', 'string', 'user_profile', 'email', 'view_users', TRUE, TRUE, 'User who uploaded the document', 15),
('documents', 'user_first_name', 'User First Name', 'string', 'user_profile', 'first_name', 'view_users', TRUE, TRUE, 'User first name', 16),
('documents', 'user_last_name', 'User Last Name', 'string', 'user_profile', 'last_name', 'view_users', TRUE, TRUE, 'User last name', 17),
-- Category Fields (joined)
('documents', 'category_name', 'Category', 'string', 'doc_category', 'category_name', 'view_documents', TRUE, TRUE, 'Document category', 18),
-- Model Fields (joined)
('documents', 'model_name', 'Model Used', 'string', 'model_config', 'model_name', 'view_documents', TRUE, TRUE, 'AI model used for processing', 19),
('documents', 'model_id', 'Model ID', 'number', 'document_processed', 'model_id', 'view_documents', TRUE, TRUE, 'Model identifier', 20);

-- Insert default field definitions for clients module
INSERT INTO report_field_definitions (module, field_name, display_name, field_type, table_name, column_name, required_permission, is_sortable, is_filterable, description, display_order) VALUES
('clients', 'client_id', 'Client ID', 'number', 'client', 'client_id', 'view_clients', TRUE, TRUE, 'Unique client identifier', 1),
('clients', 'client_name', 'Client Name', 'string', 'client', 'client_name', 'view_clients', TRUE, TRUE, 'Client organization name', 2),
('clients', 'contact_name', 'Contact Name', 'string', 'client', 'contact_name', 'view_clients', TRUE, TRUE, 'Primary contact person', 3),
('clients', 'email', 'Email', 'string', 'client', 'email', 'view_clients', TRUE, TRUE, 'Contact email', 4),
('clients', 'phone_no', 'Phone', 'string', 'client', 'phone_no', 'view_clients', TRUE, TRUE, 'Contact phone number', 5),
('clients', 'address', 'Address', 'string', 'client', 'address', 'view_clients', TRUE, TRUE, 'Business address', 6),
('clients', 'is_active', 'Active Status', 'boolean', 'client', 'is_active', 'view_clients', TRUE, TRUE, 'Client active status', 7),
('clients', 'created_date', 'Created Date', 'date', 'client', 'created_date', 'view_clients', TRUE, TRUE, 'Account creation date', 8),
('clients', 'active_model', 'Active Model', 'number', 'client', 'active_model', 'view_clients', TRUE, TRUE, 'Default model for client', 9);

-- Insert default field definitions for users module
INSERT INTO report_field_definitions (module, field_name, display_name, field_type, table_name, column_name, required_permission, is_sortable, is_filterable, description, display_order) VALUES
('users', 'userid', 'User ID', 'number', 'user_profile', 'userid', 'view_users', TRUE, TRUE, 'Unique user identifier', 1),
('users', 'email', 'Email', 'string', 'user_profile', 'email', 'view_users', TRUE, TRUE, 'User email address', 2),
('users', 'first_name', 'First Name', 'string', 'user_profile', 'first_name', 'view_users', TRUE, TRUE, 'User first name', 3),
('users', 'last_name', 'Last Name', 'string', 'user_profile', 'last_name', 'view_users', TRUE, TRUE, 'User last name', 4),
('users', 'user_role', 'Role', 'string', 'user_profile', 'user_role', 'view_users', TRUE, TRUE, 'User role', 5),
('users', 'is_active', 'Active Status', 'boolean', 'user_profile', 'is_active', 'view_users', TRUE, TRUE, 'User active status', 6),
('users', 'last_login', 'Last Login', 'date', 'user_profile', 'last_login', 'view_users', TRUE, TRUE, 'Last login timestamp', 7),
('users', 'created_at', 'Created Date', 'date', 'user_profile', 'created_at', 'view_users', TRUE, TRUE, 'Account creation date', 8),
('users', 'timezone', 'Timezone', 'string', 'user_profile', 'timezone', 'view_users', TRUE, TRUE, 'User timezone', 9);

COMMIT;
