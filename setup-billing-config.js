/**
 * Setup Billing Configuration for Supabase
 * Run: node setup-billing-config.js
 */

require('dotenv').config({ path: '.env.production' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzzsunmbnhjfgbloyaan.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enN1bm1ibmhqZmdibG95YWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjA0MDcsImV4cCI6MjA4MzYzNjQwN30.s4ST0UNO3gBGs8xFe1kEvR_Ts5wc930wugQrWTKq1R4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function setupBillingConfig() {
  console.log('Setting up billing configuration...\n');

  try {
    // Check if billing_configuration exists
    const { data: existingConfig, error: checkError } = await supabase
      .from('billing_configuration')
      .select('*')
      .eq('config_id', 1)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected
      console.error('Error checking billing config:', checkError.message);
    }

    if (!existingConfig) {
      // Insert default billing configuration (without company_email which may not exist)
      const { data, error } = await supabase
        .from('billing_configuration')
        .insert({
          system_mailer: 'noreply@docuparse.com',
          system_mailer_name: 'DocuParse Billing',
          invoice_date_day: 1,
          due_date_day: 15,
          reminder_frequency_days: 7,
          max_reminder_count: 3,
          auto_generate_enabled: true,
          payment_gateway: 'stripe',
          invoice_prefix: 'INV',
          currency: 'USD',
          tax_rate: 0,
          company_name: 'DocuParse Inc.',
          company_address: '123 AI Street, Tech City, TC 12345',
          company_phone: '+1 (555) 123-4567'
        })
        .select();

      if (error) {
        console.error('Error inserting billing config:', error.message);
      } else {
        console.log('Billing configuration created successfully');
      }
    } else {
      console.log('Billing configuration already exists');
    }

    // Add pricing config keys if missing
    const pricingConfigs = [
      { config_key: 'docai_cost_per_page', config_value: '0.015', description: 'Document AI cost per page (USD)', is_encrypted: false },
      { config_key: 'OPENAI_INPUT_COST_PER_1K', config_value: '0.0025', description: 'OpenAI input cost per 1K tokens (USD)', is_encrypted: false },
      { config_key: 'OPENAI_OUTPUT_COST_PER_1K', config_value: '0.01', description: 'OpenAI output cost per 1K tokens (USD)', is_encrypted: false }
    ];

    for (const config of pricingConfigs) {
      const { data: existing, error: existErr } = await supabase
        .from('processing_config')
        .select('config_id')
        .eq('config_key', config.config_key);

      if (existErr) {
        console.error(`Error checking ${config.config_key}:`, existErr.message);
        continue;
      }

      if (!existing || existing.length === 0) {
        const { error } = await supabase
          .from('processing_config')
          .insert({
            config_key: config.config_key,
            config_value: config.config_value,
            description: config.description,
            is_encrypted: config.is_encrypted,
            doc_category_id: null
          });

        if (error) {
          console.error(`Error inserting ${config.config_key}:`, error.message);
        } else {
          console.log(`Added ${config.config_key}: ${config.config_value}`);
        }
      } else {
        console.log(`${config.config_key} already exists`);
      }
    }

    console.log('\nSetup complete!');

  } catch (error) {
    console.error('Setup error:', error.message);
  }
}

setupBillingConfig();
