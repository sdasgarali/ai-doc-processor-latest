DELETE FROM user_profile WHERE email = 'admin@eobsystem.com';
INSERT INTO user_profile (email, password, user_role, first_name, last_name, is_active) 
VALUES ('admin@eobsystem.com', '$2a$10$6MmHE6IuFAHCqpRm7R2OHu7cqKfHjgXhVEVj0DJR2VctQ/uxb/pcG', 'superadmin', 'System', 'Administrator', TRUE);
