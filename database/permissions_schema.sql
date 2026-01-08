-- Access Permission Module Database Schema
-- This schema provides granular permission management for users and roles

-- Permissions Table - Defines all available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    permission_category VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_permission_name (permission_name),
    INDEX idx_permission_category (permission_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role Permissions Table - Links permissions to roles
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_role ENUM('user', 'admin', 'superadmin', 'client') NOT NULL,
    permission_id INT NOT NULL,
    granted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    UNIQUE KEY unique_role_permission (user_role, permission_id),
    INDEX idx_user_role (user_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Specific Permissions Table - Overrides for individual users
-- Positive permissions (allow) or negative permissions (deny)
CREATE TABLE IF NOT EXISTS user_specific_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid INT NOT NULL,
    permission_id INT NOT NULL,
    permission_type ENUM('allow', 'deny') DEFAULT 'allow',
    granted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    FOREIGN KEY (userid) REFERENCES user_profile(userid) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES user_profile(userid) ON DELETE SET NULL,
    UNIQUE KEY unique_user_permission (userid, permission_id),
    INDEX idx_userid (userid),
    INDEX idx_permission_type (permission_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Comprehensive Permissions List
INSERT INTO permissions (permission_name, permission_category, description) VALUES
-- Dashboard Permissions
('view_dashboard', 'dashboard', 'View dashboard and statistics'),
('view_own_stats', 'dashboard', 'View own statistics only'),
('view_all_stats', 'dashboard', 'View all users/clients statistics'),

-- Document Permissions
('view_documents', 'documents', 'View documents list'),
('view_own_documents', 'documents', 'View only own documents'),
('view_all_documents', 'documents', 'View all documents across all clients'),
('upload_documents', 'documents', 'Upload new documents'),
('edit_documents', 'documents', 'Edit document details'),
('delete_documents', 'documents', 'Delete documents'),
('download_documents', 'documents', 'Download documents (PDF, CSV, JSON)'),
('reprocess_documents', 'documents', 'Reprocess existing documents'),

-- User Management Permissions
('view_users', 'user_management', 'View users list'),
('create_users', 'user_management', 'Create new users'),
('edit_users', 'user_management', 'Edit user details'),
('delete_users', 'user_management', 'Delete users'),
('reset_passwords', 'user_management', 'Reset user passwords'),
('manage_user_roles', 'user_management', 'Change user roles'),
('manage_user_permissions', 'user_management', 'Manage individual user permissions'),

-- Client Management Permissions
('view_clients', 'client_management', 'View clients list'),
('create_clients', 'client_management', 'Create new clients'),
('edit_clients', 'client_management', 'Edit client details'),
('delete_clients', 'client_management', 'Delete clients'),
('assign_models', 'client_management', 'Assign models to clients'),

-- Model Management Permissions
('view_models', 'model_management', 'View model configurations'),
('create_models', 'model_management', 'Create new model configurations'),
('edit_models', 'model_management', 'Edit model configurations'),
('delete_models', 'model_management', 'Delete model configurations'),
('view_model_fields', 'model_management', 'View model field mappings'),
('edit_model_fields', 'model_management', 'Edit model field mappings'),

-- Field Management Permissions
('view_fields', 'field_management', 'View fields list'),
('create_fields', 'field_management', 'Create new fields'),
('edit_fields', 'field_management', 'Edit field details'),
('delete_fields', 'field_management', 'Delete fields'),

-- Category Management Permissions
('view_categories', 'category_management', 'View document categories'),
('create_categories', 'category_management', 'Create new categories'),
('edit_categories', 'category_management', 'Edit categories'),
('delete_categories', 'category_management', 'Delete categories'),

-- Permission Management Permissions
('view_permissions', 'permission_management', 'View permissions list'),
('manage_role_permissions', 'permission_management', 'Manage role-based permissions'),
('manage_user_permissions', 'permission_management', 'Manage user-specific permissions'),
('view_audit_logs', 'permission_management', 'View permission audit logs'),

-- Pricing Management Permissions
('view_pricing', 'pricing_management', 'View pricing configurations'),
('edit_pricing', 'pricing_management', 'Edit pricing configurations'),

-- System Configuration Permissions
('view_system_config', 'system_config', 'View system configuration'),
('edit_system_config', 'system_config', 'Edit system configuration'),
('view_logs', 'system_config', 'View system logs'),
('export_data', 'system_config', 'Export system data'),
('import_data', 'system_config', 'Import system data')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Assign Default Permissions to Roles
-- SuperAdmin - Full Access
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'superadmin', permission_id, NULL
FROM permissions
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Admin - Most Access (excluding some system config)
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'admin', permission_id, NULL
FROM permissions
WHERE permission_name NOT IN ('edit_system_config', 'import_data')
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Client - Limited Access
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'client', permission_id, NULL
FROM permissions
WHERE permission_name IN (
    'view_dashboard',
    'view_own_stats',
    'view_documents',
    'view_own_documents',
    'upload_documents',
    'download_documents',
    'view_pricing'
)
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- User - Basic Access
INSERT INTO role_permissions (user_role, permission_id, granted_by)
SELECT 'user', permission_id, NULL
FROM permissions
WHERE permission_name IN (
    'view_dashboard',
    'view_own_stats',
    'view_documents',
    'view_own_documents',
    'upload_documents',
    'download_documents'
)
ON DUPLICATE KEY UPDATE user_role = VALUES(user_role);

-- Display results
SELECT 'Permissions schema created successfully!' as Status;
SELECT COUNT(*) as TotalPermissions FROM permissions;
SELECT user_role, COUNT(*) as PermissionCount FROM role_permissions GROUP BY user_role;
