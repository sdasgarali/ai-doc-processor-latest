-- ================================================
-- Billing & Invoice Module Database Schema
-- EOB Extraction System
-- ================================================

-- Table: client_usage
-- Tracks monthly usage and costs for each client
CREATE TABLE IF NOT EXISTS client_usage (
    usage_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    usage_details JSON COMMENT 'Breakdown of documents processed, storage used, etc.',
    total_documents INT DEFAULT 0,
    total_pages INT DEFAULT 0,
    total_cost DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE CASCADE,
    UNIQUE KEY idx_client_period (client_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice
-- Stores all invoice records
CREATE TABLE IF NOT EXISTS invoice (
    invoice_id VARCHAR(36) PRIMARY KEY COMMENT 'UUID format',
    client_id INT NOT NULL,
    usage_id INT,
    invoice_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Human-readable invoice number (e.g., INV-2025-001)',
    invoice_date DATE NOT NULL COMMENT 'Date invoice was generated',
    due_date DATE NOT NULL COMMENT 'Payment due date',
    amount_due DECIMAL(10,2) NOT NULL,
    status ENUM('not_generated', 'unpaid', 'paid', 'overdue', 'cancelled') DEFAULT 'not_generated',
    payment_link VARCHAR(255) UNIQUE COMMENT 'Secure payment token/URL',
    payment_link_expires_at TIMESTAMP NULL,
    pdf_attachment_path VARCHAR(500) COMMENT 'Path to generated PDF invoice',
    paid_at TIMESTAMP NULL,
    payment_method VARCHAR(100),
    payment_transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    generated_by INT COMMENT 'Admin who generated the invoice',
    FOREIGN KEY (client_id) REFERENCES client(client_id) ON DELETE RESTRICT,
    FOREIGN KEY (usage_id) REFERENCES client_usage(usage_id) ON DELETE RESTRICT,
    FOREIGN KEY (generated_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    INDEX idx_client_date (client_id, invoice_date),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: billing_configuration
-- System-wide billing settings (single row table)
CREATE TABLE IF NOT EXISTS billing_configuration (
    config_id INT PRIMARY KEY AUTO_INCREMENT,
    system_mailer VARCHAR(255) NOT NULL DEFAULT 'ali.aitechs@gmail.com' COMMENT 'Email address for outgoing invoices',
    system_mailer_name VARCHAR(255) DEFAULT 'EOB Extraction System',
    invoice_date_day INT DEFAULT 1 COMMENT 'Day of month to generate invoices (1-28)',
    due_date_day INT DEFAULT 5 COMMENT 'Day of month for payment due date',
    reminder_frequency_days INT DEFAULT 3 COMMENT 'Days between reminder emails',
    max_reminder_count INT DEFAULT 5 COMMENT 'Maximum reminder emails to send',
    auto_generate_enabled BOOLEAN DEFAULT TRUE,
    payment_gateway VARCHAR(100) DEFAULT 'stripe' COMMENT 'Payment processor (stripe, paypal, etc.)',
    payment_gateway_config JSON COMMENT 'API keys and settings',
    invoice_prefix VARCHAR(20) DEFAULT 'INV' COMMENT 'Prefix for invoice numbers',
    currency VARCHAR(3) DEFAULT 'USD',
    tax_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Tax percentage',
    company_name VARCHAR(255) DEFAULT 'EOB Extraction System',
    company_address TEXT,
    company_phone VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT COMMENT 'Admin who updated configuration',
    FOREIGN KEY (updated_by) REFERENCES user_profile(userid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configuration
INSERT INTO billing_configuration (config_id) VALUES (1)
ON DUPLICATE KEY UPDATE config_id=config_id;

-- Table: mail_log
-- Tracks all outgoing emails related to invoices
CREATE TABLE IF NOT EXISTS mail_log (
    mail_log_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id VARCHAR(36) NOT NULL,
    email_type ENUM('invoice_generated', 'payment_reminder', 'payment_received', 'invoice_overdue', 'invoice_cancelled') NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    body TEXT,
    attachments JSON COMMENT 'Array of attachment file paths',
    sent_at TIMESTAMP NULL,
    status ENUM('pending', 'success', 'failed', 'retry_pending') DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message TEXT,
    next_retry_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    INDEX idx_invoice_type (invoice_id, email_type),
    INDEX idx_status_retry (status, next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: payment_transaction
-- Tracks payment attempts and transactions
CREATE TABLE IF NOT EXISTS payment_transaction (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id VARCHAR(36) NOT NULL,
    payment_link VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('initiated', 'pending', 'success', 'failed', 'refunded') DEFAULT 'initiated',
    payment_method VARCHAR(100),
    gateway_transaction_id VARCHAR(255) COMMENT 'ID from payment gateway',
    gateway_response JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    error_message TEXT,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE RESTRICT,
    INDEX idx_invoice_status (invoice_id, status),
    INDEX idx_payment_link (payment_link)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: invoice_reminder_schedule
-- Manages reminder email scheduling
CREATE TABLE IF NOT EXISTS invoice_reminder_schedule (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id VARCHAR(36) NOT NULL,
    reminder_number INT NOT NULL COMMENT '1st, 2nd, 3rd reminder, etc.',
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP NULL,
    status ENUM('scheduled', 'sent', 'cancelled', 'skipped') DEFAULT 'scheduled',
    mail_log_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (mail_log_id) REFERENCES mail_log(mail_log_id) ON DELETE SET NULL,
    UNIQUE KEY idx_invoice_reminder (invoice_id, reminder_number),
    INDEX idx_scheduled_status (scheduled_for, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Views for reporting
-- ================================================

-- View: invoice_summary
CREATE OR REPLACE VIEW invoice_summary AS
SELECT 
    i.invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.due_date,
    i.amount_due,
    i.status,
    i.paid_at,
    c.client_id,
    c.client_name,
    c.email as client_email,
    u.total_documents,
    u.total_pages,
    u.period_start,
    u.period_end,
    DATEDIFF(CURDATE(), i.due_date) as days_overdue,
    (SELECT COUNT(*) FROM mail_log WHERE invoice_id = i.invoice_id AND email_type = 'payment_reminder') as reminders_sent
FROM invoice i
JOIN client c ON i.client_id = c.client_id
LEFT JOIN client_usage u ON i.usage_id = u.usage_id;

-- View: monthly_revenue
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT 
    DATE_FORMAT(invoice_date, '%Y-%m') as month,
    COUNT(*) as invoice_count,
    SUM(amount_due) as total_billed,
    SUM(CASE WHEN status = 'paid' THEN amount_due ELSE 0 END) as total_paid,
    SUM(CASE WHEN status IN ('unpaid', 'overdue') THEN amount_due ELSE 0 END) as total_outstanding
FROM invoice
GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
ORDER BY month DESC;

-- ================================================
-- Stored Procedures
-- ================================================

DELIMITER //

-- Procedure to calculate usage for a client
CREATE PROCEDURE calculate_client_usage(
    IN p_client_id INT,
    IN p_period_start DATE,
    IN p_period_end DATE
)
BEGIN
    DECLARE v_total_documents INT DEFAULT 0;
    DECLARE v_total_pages INT DEFAULT 0;
    DECLARE v_total_cost DECIMAL(10,2) DEFAULT 0.00;
    
    -- Calculate from document_processed table
    SELECT 
        COUNT(*) as doc_count,
        COALESCE(SUM(no_of_pages), 0) as page_count,
        COALESCE(SUM(total_cost), 0) as cost_sum
    INTO 
        v_total_documents,
        v_total_pages,
        v_total_cost
    FROM document_processed
    WHERE client_id = p_client_id
    AND DATE(upload_timestamp) BETWEEN p_period_start AND p_period_end;
    
    -- Insert or update usage record
    INSERT INTO client_usage (
        client_id,
        period_start,
        period_end,
        total_documents,
        total_pages,
        total_cost,
        usage_details
    ) VALUES (
        p_client_id,
        p_period_start,
        p_period_end,
        v_total_documents,
        v_total_pages,
        v_total_cost,
        JSON_OBJECT(
            'documents', v_total_documents,
            'pages', v_total_pages,
            'cost', v_total_cost
        )
    )
    ON DUPLICATE KEY UPDATE
        total_documents = v_total_documents,
        total_pages = v_total_pages,
        total_cost = v_total_cost,
        usage_details = JSON_OBJECT(
            'documents', v_total_documents,
            'pages', v_total_pages,
            'cost', v_total_cost
        ),
        updated_at = CURRENT_TIMESTAMP;
        
    SELECT LAST_INSERT_ID() as usage_id;
END//

DELIMITER ;
