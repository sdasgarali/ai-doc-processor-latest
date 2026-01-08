-- Update company name in billing configuration
UPDATE billing_configuration 
SET company_name = 'Universal Document Processing System'
WHERE config_id = 1;

-- Show the updated configuration
SELECT company_name, system_mailer_name FROM billing_configuration WHERE config_id = 1;
