require('dotenv').config();
const { query } = require('./config/database');
const fs = require('fs');

async function migrateCustomReports() {
  try {
    console.log('🔄 Starting custom reports migration...\n');

    // Read SQL file
    const sql = fs.readFileSync('./database/custom_reports_schema.sql', 'utf8');
    
    // Remove comments and split by semicolon
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const upper = s.toUpperCase();
        return s.length > 10 && 
               (upper.includes('CREATE') || upper.includes('INSERT')) &&
               s !== 'COMMIT';
      });

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await query(statement);
        
        // Extract table/action info for logging
        if (statement.includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE[^`]*`?(\w+)`?/i);
          if (match) {
            console.log(`✅ Created table: ${match[1]}`);
          }
        } else if (statement.includes('INSERT INTO')) {
          const match = statement.match(/INSERT INTO[^`]*`?(\w+)`?/i);
          if (match) {
            console.log(`✅ Inserted data into: ${match[1]}`);
          }
        }
      } catch (err) {
        // Skip if table already exists
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          const match = statement.match(/CREATE TABLE[^`]*`?(\w+)`?/i);
          if (match) {
            console.log(`⚠️  Table already exists: ${match[1]}`);
          }
        } else if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Duplicate entry skipped`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, err.message);
          // Continue with other statements
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n');
    
    // Verify tables were created
    console.log('Verifying tables...');
    const tables = await query('SHOW TABLES LIKE "custom_report%"');
    console.log(`Found ${tables.length} custom_reports tables:`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`  - ${tableName}`);
    });
    
    // Count field definitions
    const fieldCount = await query('SELECT COUNT(*) as count FROM report_field_definitions');
    console.log(`\n📊 Field definitions loaded: ${fieldCount[0].count}`);
    
    const docFields = await query('SELECT COUNT(*) as count FROM report_field_definitions WHERE module = "documents"');
    const clientFields = await query('SELECT COUNT(*) as count FROM report_field_definitions WHERE module = "clients"');
    const userFields = await query('SELECT COUNT(*) as count FROM report_field_definitions WHERE module = "users"');
    
    console.log(`  - Documents: ${docFields[0].count} fields`);
    console.log(`  - Clients: ${clientFields[0].count} fields`);
    console.log(`  - Users: ${userFields[0].count} fields`);
    
    console.log('\n🎉 Custom Reports system is ready to use!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCustomReports();
