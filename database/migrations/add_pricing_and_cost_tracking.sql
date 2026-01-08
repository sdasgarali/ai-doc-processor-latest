-- ====================================================================
-- EOB Processing System - Pricing and Cost Tracking Migration
-- Created: 2025-11-07
-- Purpose: Add configurable pricing and cost tracking capabilities
-- ====================================================================

-- ====================================================================
-- 1. Update model_config table with pricing columns
-- ====================================================================

ALTER TABLE model_config
ADD COLUMN IF NOT EXISTS model_code VARCHAR(50) COMMENT 'OpenAI model code (e.g., gpt-4o, gpt-4o-mini)',
ADD COLUMN IF NOT EXISTS input_cost_per_1k DECIMAL(10,6) DEFAULT 0.00015 COMMENT 'Cost per 1000 input tokens in USD',
ADD COLUMN IF NOT EXISTS output_cost_per_1k DECIMAL(10,6) DEFAULT 0.0006 COMMENT 'Cost per 1000 output tokens in USD',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true COMMENT 'Whether this model is available for use',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ====================================================================
-- 2. Create system_config table for application-wide settings
-- ====================================================================

CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System-wide configuration settings';

-- ====================================================================
-- 3. Insert default OpenAI model pricing data
-- ====================================================================

INSERT INTO model_config (model_id, model_name, model_code, input_cost_per_1k, output_cost_per_1k, is_active)
VALUES
  (1, 'GPT-4o', 'gpt-4o', 0.005000, 0.015000, true),
  (2, 'GPT-4o-mini', 'gpt-4o-mini', 0.000150, 0.000600, true),
  (3, 'GPT-4-Turbo', 'gpt-4-turbo', 0.010000, 0.030000, true)
ON DUPLICATE KEY UPDATE
  model_code = VALUES(model_code),
  input_cost_per_1k = VALUES(input_cost_per_1k),
  output_cost_per_1k = VALUES(output_cost_per_1k),
  is_active = VALUES(is_active);

-- ====================================================================
-- 4. Insert default Document AI pricing
-- ====================================================================

INSERT INTO system_config (config_key, config_value, description)
VALUES
  ('docai_cost_per_page', '0.015', 'Google Document AI cost per page in USD'),
  ('default_model_id', '2', 'Default OpenAI model ID (2 = GPT-4o-mini)'),
  ('n8n_webhook_url', 'http://localhost:5678/webhook/eob-process', 'n8n webhook endpoint for EOB processing')
ON DUPLICATE KEY UPDATE
  config_value = config_value; -- Keep existing values if already set

-- ====================================================================
-- 5. Update document_processed table with cost tracking columns
-- ====================================================================

ALTER TABLE document_processed
ADD COLUMN IF NOT EXISTS json_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for JSON output',
ADD COLUMN IF NOT EXISTS csv_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for CSV output',
ADD COLUMN IF NOT EXISTS processed_pdf_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for processed PDF',
ADD COLUMN IF NOT EXISTS document_ai_cost DECIMAL(10,4) DEFAULT 0.0000 COMMENT 'Document AI processing cost in USD',
ADD COLUMN IF NOT EXISTS openai_cost DECIMAL(10,4) DEFAULT 0.0000 COMMENT 'OpenAI API cost in USD',
ADD COLUMN IF NOT EXISTS total_records INT DEFAULT 0 COMMENT 'Number of EOB records extracted',
ADD COLUMN IF NOT EXISTS no_of_pages INT DEFAULT 0 COMMENT 'Number of pages in PDF',
ADD COLUMN IF NOT EXISTS error_message TEXT COMMENT 'Error details if processing failed',
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'Pending' COMMENT 'Current processing status';

-- Add indexes for performance
ALTER TABLE document_processed
ADD INDEX IF NOT EXISTS idx_processing_status (processing_status),
ADD INDEX IF NOT EXISTS idx_json_drive_id (json_drive_id),
ADD INDEX IF NOT EXISTS idx_csv_drive_id (csv_drive_id);

-- ====================================================================
-- 6. Verification queries (optional - for testing)
-- ====================================================================

-- Verify model_config updates
-- SELECT model_id, model_name, model_code, input_cost_per_1k, output_cost_per_1k, is_active FROM model_config;

-- Verify system_config entries
-- SELECT * FROM system_config;

-- Verify document_processed columns
-- DESCRIBE document_processed;

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================

SELECT 'Migration completed successfully!' as status,
       NOW() as completed_at;
