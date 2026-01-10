// Check processing_config table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://hzzsunmbnhjfgbloyaan.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enN1bm1ibmhqZmdibG95YWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjA0MDcsImV4cCI6MjA4MzYzNjQwN30.s4ST0UNO3gBGs8xFe1kEvR_Ts5wc930wugQrWTKq1R4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data, error } = await supabase
    .from('processing_config')
    .select('*')
    .order('config_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Current processing_config entries:\n');
  console.log('config_id | doc_category_id | config_key');
  console.log('-'.repeat(60));
  data.forEach(c => {
    console.log(`${c.config_id} | ${c.doc_category_id || 'NULL'} | ${c.config_key}`);
  });
  console.log('\nTotal:', data.length);

  // Check for the missing keys
  const missingKeys = ['PROJECT_ID', 'LOCATION', 'PROCESSOR_ID', 'LLAMA_CLOUD_API_KEY', 'SERVER_HOST', 'SERVER_PORT', 'BACKEND_URL', 'GDRIVE_RESULTS_FOLDER_ID', 'COST_TRACKING'];
  console.log('\nChecking for missing keys:');
  for (const key of missingKeys) {
    const found = data.find(c => c.config_key === key);
    console.log(`  ${key}: ${found ? `Found (id=${found.config_id}, cat=${found.doc_category_id})` : 'NOT FOUND'}`);
  }
}

checkConfig().catch(console.error);
