// Setup default Processing Engine Configuration from python_processor/.env
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://hzzsunmbnhjfgbloyaan.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enN1bm1ibmhqZmdibG95YWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjA0MDcsImV4cCI6MjA4MzYzNjQwN30.s4ST0UNO3gBGs8xFe1kEvR_Ts5wc930wugQrWTKq1R4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Default configurations from python_processor/.env
// Using existing key names from the database
const defaultConfigs = [
  // Google Cloud Document AI (using DOCAI_ prefix as in database)
  { config_key: 'DOCAI_PROJECT_ID', config_value: 'optical-valor-477121-d0', description: 'Google Cloud Project ID for Document AI', is_encrypted: false },
  { config_key: 'DOCAI_LOCATION', config_value: 'us', description: 'Google Cloud Document AI Location', is_encrypted: false },
  { config_key: 'DOCAI_PROCESSOR_ID', config_value: 'c159d8b2fb74ffc9', description: 'Google Cloud Document AI Processor ID', is_encrypted: false },

  // Provider Selection
  { config_key: 'OCR_PROVIDER', config_value: 'google', description: 'OCR Provider: google or mistral', is_encrypted: false },
  { config_key: 'LLM_PROVIDER', config_value: 'openai', description: 'LLM Provider: openai or mistral', is_encrypted: false },

  // API Keys (sensitive - mark as encrypted placeholder)
  { config_key: 'OPENAI_API_KEY', config_value: 'sk-proj-xxxxx', description: 'OpenAI API Key', is_encrypted: true },
  { config_key: 'MISTRAL_API_KEY', config_value: 'dK6Dxxxxx', description: 'Mistral AI API Key', is_encrypted: true },

  // Model Configuration
  { config_key: 'OPENAI_MODEL', config_value: 'gpt-4o', description: 'OpenAI Model for extraction', is_encrypted: false },
  { config_key: 'OPENAI_MAX_TOKENS', config_value: '16384', description: 'Maximum tokens for OpenAI response', is_encrypted: false },
  { config_key: 'OPENAI_TEMPERATURE', config_value: '0', description: 'OpenAI temperature (0 = deterministic)', is_encrypted: false },
  { config_key: 'MISTRAL_MODEL', config_value: 'pixtral-large-latest', description: 'Mistral AI Model for OCR/extraction', is_encrypted: false },

  // Cost Configuration
  { config_key: 'DOCAI_COST_PER_PAGE', config_value: '0.015', description: 'Google Document AI cost per page ($)', is_encrypted: false },
  { config_key: 'OPENAI_INPUT_COST_PER_1K', config_value: '0.00015', description: 'OpenAI input cost per 1K tokens ($)', is_encrypted: false },
  { config_key: 'OPENAI_OUTPUT_COST_PER_1K', config_value: '0.0006', description: 'OpenAI output cost per 1K tokens ($)', is_encrypted: false },
  { config_key: 'MISTRAL_INPUT_COST_PER_1K', config_value: '0.002', description: 'Mistral input cost per 1K tokens ($)', is_encrypted: false },
  { config_key: 'MISTRAL_OUTPUT_COST_PER_1K', config_value: '0.006', description: 'Mistral output cost per 1K tokens ($)', is_encrypted: false },

  // Processing Configuration
  { config_key: 'MAX_PAGES_PER_SPLIT', config_value: '15', description: 'Maximum pages per PDF split for processing', is_encrypted: false },
  { config_key: 'MAX_PARALLEL_WORKERS', config_value: '8', description: 'Maximum parallel workers for processing', is_encrypted: false },
  { config_key: 'DOCUMENT_AI_TIMEOUT', config_value: '300000', description: 'Document AI timeout in milliseconds', is_encrypted: false },
  { config_key: 'USE_BATCH_PROCESSING', config_value: 'YES', description: 'Use batch processing for large documents (YES/NO)', is_encrypted: false }
];

async function setupDefaultConfig() {
  console.log('Setting up default Processing Engine Configuration...\n');

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const config of defaultConfigs) {
    try {
      // Check if config already exists for default (null doc_category_id)
      const { data: existing, error: selectError } = await supabase
        .from('processing_config')
        .select('config_id')
        .is('doc_category_id', null)
        .eq('config_key', config.config_key);

      if (selectError) {
        console.error(`Error checking ${config.config_key}:`, selectError.message);
        errors++;
        continue;
      }

      if (existing && existing.length > 0) {
        // Update existing config
        const { error: updateError } = await supabase
          .from('processing_config')
          .update({
            config_value: config.config_value,
            description: config.description,
            is_encrypted: config.is_encrypted,
            updated_at: new Date().toISOString()
          })
          .eq('config_id', existing[0].config_id);

        if (updateError) {
          console.error(`Error updating ${config.config_key}:`, updateError.message);
          errors++;
        } else {
          console.log(`  Updated: ${config.config_key}`);
          updated++;
        }
      } else {
        // Insert new config - let the database generate the config_id
        const { error: insertError } = await supabase
          .from('processing_config')
          .insert({
            doc_category_id: null,
            config_key: config.config_key,
            config_value: config.config_value,
            description: config.description,
            is_encrypted: config.is_encrypted
          });

        if (insertError) {
          console.error(`Error inserting ${config.config_key}:`, insertError.message);
          errors++;
        } else {
          console.log(`  Inserted: ${config.config_key}`);
          inserted++;
        }
      }
    } catch (err) {
      console.error(`Error processing ${config.config_key}:`, err.message);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${defaultConfigs.length}`);
}

setupDefaultConfig().catch(console.error);
