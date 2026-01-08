-- Add Billing & Invoice Module Permissions
-- Run this to add billing permissions to your existing permission system

-- Insert Billing Permissions
INSERT INTO permissions (permission_name, permission_category, description) VALUES
-- Billing Configuration Permissions
('view_billing_config', 'billing_management', 'View billing configuration settings'),
('edit_billing_config', 'billing_management', 'Edit billing configuration settings'),

-- Invoice Management Permissions
('view_invoices', 'invoice_management', 'View invoices list'),
('view_all_invoices', 'invoice_management', 'View all invoices across all clients'),
('view_own_invoices', 'invoice_management', 'View only own invoices (for clients)'),
('generate_invoices', 'invoice_management', 'Generate invoices manually'),
('edit_invoices', 'invoice_management', 'Edit invoice details and status'),
('download_invoice_pdf', 'invoice_management', 'Download invoice PDFs'),
('send_invoice_email', 'invoice_management', 'Send/resend invoice emails'),
('mark_invoice_paid', 'invoice_management', 'Mark invoices as paid manually'),
('cancel_invoices', 'invoice_management', 'Cancel invoices'),

-- Payment Management Permissions
('process_payments', 'payment_management', 'Process online payments'),
('view_payment_history', 'payment_management', 'View payment transaction history'),
('refund_payments', 'payment_management', 'Process payment refunds'),

-- Email/Mail Log Permissions
('view_mail_logs', 'mail_management', 'View email logs'),
('retry_failed_emails', 'mail_management', 'Retry failed email delivery'),
('send_payment_reminders', 'mail_management', 'Send payment reminder emails')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Assign Billing Permissions to SuperAdmin (all permissions)
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'superadmin', permission_id, NULL
FROM permissions
WHERE permission_category IN ('billing_management', 'invoice_management', 'payment_management', 'mail_management')
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Assign Billing Permissions to Admin (most permissions except editing config)
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'admin', permission_id, NULL
FROM permissions
WHERE permission_category IN ('billing_management', 'invoice_management', 'payment_management', 'mail_management')
AND permission_name NOT IN ('edit_billing_config', 'refund_payments')
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Assign Billing Permissions to Client (view only + payment)
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'client', permission_id, NULL
FROM permissions
WHERE permission_name IN (
    'view_own_invoices',
    'download_invoice_pdf',
    'process_payments',
    'view_payment_history'
)
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Display results
SELECT 'Billing permissions added successfully!' as Status;
SELECT permission_category, COUNT(*) as PermissionCount 
FROM permissions 
WHERE permission_category IN ('billing_management', 'invoice_management', 'payment_management', 'mail_management')
GROUP BY permission_category;

SELECT user_role, COUNT(*) as BillingPermissionCount 
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE p.permission_category IN ('billing_management', 'invoice_management', 'payment_management', 'mail_management')
GROUP BY user_role;
