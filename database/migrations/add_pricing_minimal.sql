-- ====================================================================
-- EOB Processing System - Minimal Pricing Migration
-- ====================================================================

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default pricing data into model_config
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

-- Insert system configuration
INSERT INTO system_config (config_key, config_value, description)
VALUES
  ('docai_cost_per_page', '0.015', 'Google Document AI cost per page in USD'),
  ('default_model_id', '2', 'Default OpenAI model ID (2 = GPT-4o-mini)'),
  ('n8n_webhook_url', 'http://localhost:5678/webhook/eob-process', 'n8n webhook endpoint for EOB processing')
ON DUPLICATE KEY UPDATE config_value = config_value;

-- Add cost tracking columns to document_processed
ALTER TABLE document_processed ADD COLUMN json_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for JSON';
ALTER TABLE document_processed ADD COLUMN csv_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for CSV';
ALTER TABLE document_processed ADD COLUMN processed_pdf_drive_id VARCHAR(255) COMMENT 'Google Drive file ID for processed PDF';
ALTER TABLE document_processed ADD COLUMN document_ai_cost DECIMAL(10,4) DEFAULT 0.0000 COMMENT 'Document AI cost in USD';
ALTER TABLE document_processed ADD COLUMN openai_cost DECIMAL(10,4) DEFAULT 0.0000 COMMENT 'OpenAI API cost in USD';
ALTER TABLE document_processed ADD COLUMN total_records INT DEFAULT 0 COMMENT 'Number of EOB records extracted';
ALTER TABLE document_processed ADD COLUMN error_message TEXT COMMENT 'Error details if processing failed';

-- Add indexes
ALTER TABLE document_processed ADD INDEX idx_json_drive_id (json_drive_id);
ALTER TABLE document_processed ADD INDEX idx_csv_drive_id (csv_drive_id);

SELECT 'Migration completed!' as status;
