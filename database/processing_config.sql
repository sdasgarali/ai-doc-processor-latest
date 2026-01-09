-- Processing Engine Configuration Table
-- Stores configuration that overrides .env settings
-- Supports default (global) config and per-doc-category config

USE eob_extraction;

-- Processing Configuration Table
CREATE TABLE IF NOT EXISTS processing_config (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    doc_category_id INT NULL COMMENT 'NULL = default/global config for all categories',
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE COMMENT 'True for sensitive values like API keys',
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doc_category_id) REFERENCES doc_category(category_id) ON DELETE CASCADE,
    UNIQUE KEY unique_category_key (doc_category_id, config_key),
    INDEX idx_doc_category (doc_category_id),
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configuration values (global settings)
INSERT INTO processing_config (doc_category_id, config_key, config_value, is_encrypted, description) VALUES
-- Provider Selection
(NULL, 'OCR_PROVIDER', 'google', FALSE, 'OCR provider: google or mistral'),
(NULL, 'LLM_PROVIDER', 'openai', FALSE, 'LLM provider: openai or mistral'),

-- Google Document AI Settings
(NULL, 'DOCAI_PROJECT_ID', '', FALSE, 'Google Cloud Project ID'),
(NULL, 'DOCAI_LOCATION', 'us', FALSE, 'Document AI processor location'),
(NULL, 'DOCAI_PROCESSOR_ID', '', FALSE, 'Document AI processor ID'),
(NULL, 'DOCAI_COST_PER_PAGE', '0.015', FALSE, 'Cost per page for Document AI'),

-- OpenAI Settings
(NULL, 'OPENAI_API_KEY', '', TRUE, 'OpenAI API Key'),
(NULL, 'OPENAI_MODEL', 'gpt-4o', FALSE, 'OpenAI model to use'),
(NULL, 'OPENAI_MAX_TOKENS', '16384', FALSE, 'Maximum tokens for OpenAI response'),
(NULL, 'OPENAI_TEMPERATURE', '0', FALSE, 'Temperature for OpenAI (0-1)'),
(NULL, 'OPENAI_INPUT_COST_PER_1K', '0.00015', FALSE, 'OpenAI input cost per 1K tokens'),
(NULL, 'OPENAI_OUTPUT_COST_PER_1K', '0.0006', FALSE, 'OpenAI output cost per 1K tokens'),

-- Mistral AI Settings
(NULL, 'MISTRAL_API_KEY', '', TRUE, 'Mistral AI API Key'),
(NULL, 'MISTRAL_MODEL', 'pixtral-large-latest', FALSE, 'Mistral model to use'),
(NULL, 'MISTRAL_INPUT_COST_PER_1K', '0.002', FALSE, 'Mistral input cost per 1K tokens'),
(NULL, 'MISTRAL_OUTPUT_COST_PER_1K', '0.006', FALSE, 'Mistral output cost per 1K tokens'),

-- Processing Settings
(NULL, 'MAX_PAGES_PER_SPLIT', '15', FALSE, 'Maximum pages before splitting document'),
(NULL, 'MAX_PARALLEL_WORKERS', '8', FALSE, 'Maximum parallel processing workers'),
(NULL, 'DOCUMENT_AI_TIMEOUT', '300000', FALSE, 'Document AI timeout in milliseconds'),
(NULL, 'USE_BATCH_PROCESSING', 'YES', FALSE, 'Use batch processing for large documents'),

-- Custom Extraction Prompt (can be overridden per category)
(NULL, 'EXTRACTION_PROMPT', '', FALSE, 'Custom extraction prompt (leave empty for default)')
ON DUPLICATE KEY UPDATE config_key = config_key;
