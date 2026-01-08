-- Insert Demo Client Users
-- This script creates 5 demo clients with realistic data for UI/backend demonstration

-- First, insert clients
INSERT INTO client (client_name, contact_name, email, phone_no, date_started, status, active_model) VALUES
('HealthCare Solutions Inc', 'Sarah Johnson', 'sarah.johnson@healthcaresolutions.com', '(555) 123-4567', '2024-01-15', 'active', 4),
('MediClaim Processing LLC', 'Michael Chen', 'michael.chen@mediclaimprocessing.com', '(555) 234-5678', '2024-02-20', 'active', 4),
('Premier Medical Billing', 'Jennifer Martinez', 'jennifer.martinez@premiermedicalbilling.com', '(555) 345-6789', '2024-03-10', 'active', 4),
('Apex Healthcare Services', 'David Thompson', 'david.thompson@apexhealthcare.com', '(555) 456-7890', '2024-04-05', 'active', 4),
('Unity Medical Group', 'Lisa Anderson', 'lisa.anderson@unitymedicalgroup.com', '(555) 567-8901', '2024-05-12', 'active', 4)
ON DUPLICATE KEY UPDATE client_name = VALUES(client_name);

-- Get the client IDs (assuming they will be auto-incremented starting from the next available ID)
-- We'll use a temporary variable approach

-- Insert user profiles for each client
-- Password for all demo users: Demo@123
-- Hashed with bcrypt: $2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG

INSERT INTO user_profile (email, password, user_role, client_id, first_name, last_name, is_active, timezone) 
SELECT 'sarah.johnson@healthcaresolutions.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'client', client_id, 'Sarah', 'Johnson', TRUE, 'America/New_York'
FROM client WHERE email = 'sarah.johnson@healthcaresolutions.com'
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO user_profile (email, password, user_role, client_id, first_name, last_name, is_active, timezone) 
SELECT 'michael.chen@mediclaimprocessing.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'client', client_id, 'Michael', 'Chen', TRUE, 'America/Los_Angeles'
FROM client WHERE email = 'michael.chen@mediclaimprocessing.com'
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO user_profile (email, password, user_role, client_id, first_name, last_name, is_active, timezone) 
SELECT 'jennifer.martinez@premiermedicalbilling.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'client', client_id, 'Jennifer', 'Martinez', TRUE, 'America/Chicago'
FROM client WHERE email = 'jennifer.martinez@premiermedicalbilling.com'
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO user_profile (email, password, user_role, client_id, first_name, last_name, is_active, timezone) 
SELECT 'david.thompson@apexhealthcare.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'client', client_id, 'David', 'Thompson', TRUE, 'America/Denver'
FROM client WHERE email = 'david.thompson@apexhealthcare.com'
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO user_profile (email, password, user_role, client_id, first_name, last_name, is_active, timezone) 
SELECT 'lisa.anderson@unitymedicalgroup.com', '$2a$10$8K1p/a0dL3.I9/YR5YY0qOcuS9K.w5vMj.ZoHyQGdmNPz5O4rG5BG', 'client', client_id, 'Lisa', 'Anderson', TRUE, 'America/Phoenix'
FROM client WHERE email = 'lisa.anderson@unitymedicalgroup.com'
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- Display the created users
SELECT 
    c.client_id,
    c.client_name,
    c.contact_name,
    c.email as client_email,
    c.phone_no,
    c.date_started,
    c.status,
    u.userid,
    u.email as user_email,
    u.first_name,
    u.last_name,
    u.user_role,
    u.timezone
FROM client c
LEFT JOIN user_profile u ON c.client_id = u.client_id
WHERE c.email IN (
    'sarah.johnson@healthcaresolutions.com',
    'michael.chen@mediclaimprocessing.com',
    'jennifer.martinez@premiermedicalbilling.com',
    'david.thompson@apexhealthcare.com',
    'lisa.anderson@unitymedicalgroup.com'
)
ORDER BY c.client_id;

-- Summary
SELECT 'Demo Clients Created Successfully!' as Status;
SELECT 'Login Credentials:' as Info;
SELECT 'Email: sarah.johnson@healthcaresolutions.com, Password: Demo@123' as Client1;
SELECT 'Email: michael.chen@mediclaimprocessing.com, Password: Demo@123' as Client2;
SELECT 'Email: jennifer.martinez@premiermedicalbilling.com, Password: Demo@123' as Client3;
SELECT 'Email: david.thompson@apexhealthcare.com, Password: Demo@123' as Client4;
SELECT 'Email: lisa.anderson@unitymedicalgroup.com, Password: Demo@123' as Client5;
