const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('Cleaning up duplicate entries...');

  // Delete all but the first entry for each key where doc_category_id is NULL
  await conn.execute(`
    DELETE p1 FROM processing_config p1
    INNER JOIN processing_config p2
    WHERE p1.config_id > p2.config_id
    AND p1.config_key = p2.config_key
    AND p1.doc_category_id IS NULL
    AND p2.doc_category_id IS NULL
  `);

  console.log('Duplicates removed.');

  // Now populate values from python_processor/.env
  const envValues = {
    'OCR_PROVIDER': 'google',
    'LLM_PROVIDER': 'openai',
    'DOCAI_PROJECT_ID': 'optical-valor-477121-d0',
    'DOCAI_LOCATION': 'us',
    'DOCAI_PROCESSOR_ID': 'c159d8b2fb74ffc9',
    'DOCAI_COST_PER_PAGE': '0.015',
    'OPENAI_MODEL': 'gpt-4o',
    'OPENAI_MAX_TOKENS': '16384',
    'OPENAI_TEMPERATURE': '0',
    'OPENAI_INPUT_COST_PER_1K': '0.00015',
    'OPENAI_OUTPUT_COST_PER_1K': '0.0006',
    'MISTRAL_MODEL': 'pixtral-large-latest',
    'MISTRAL_INPUT_COST_PER_1K': '0.002',
    'MISTRAL_OUTPUT_COST_PER_1K': '0.006',
    'MAX_PAGES_PER_SPLIT': '15',
    'MAX_PARALLEL_WORKERS': '8',
    'DOCUMENT_AI_TIMEOUT': '300000',
    'USE_BATCH_PROCESSING': 'YES'
  };

  console.log('\nUpdating default config values from .env...');

  for (const [key, value] of Object.entries(envValues)) {
    await conn.execute(
      'UPDATE processing_config SET config_value = ? WHERE doc_category_id IS NULL AND config_key = ?',
      [value, key]
    );
    console.log('  Updated:', key, '=', value);
  }

  console.log('\nDone! Current config values:');
  const [configs] = await conn.execute(
    'SELECT config_key, config_value FROM processing_config WHERE doc_category_id IS NULL ORDER BY config_key'
  );
  configs.forEach(c => console.log('  ', c.config_key, ':', c.config_value || '(empty)'));

  await conn.end();
}

fixDatabase().catch(console.error);
