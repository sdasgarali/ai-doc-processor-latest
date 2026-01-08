-- Create Model table for AI/ML model version management
CREATE TABLE IF NOT EXISTS model (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_model_version (model_name, version),
    INDEX idx_model_name (model_name),
    INDEX idx_version (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some sample models
INSERT INTO model (model_name, version) VALUES
('Document AI EOB Processor', '1.0.0'),
('Document AI EOB Processor', '1.1.0'),
('Document AI EOB Processor', '2.0.0')
ON DUPLICATE KEY UPDATE model_name = model_name;
