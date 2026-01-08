const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateProcessRecord() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Fetching current record for process_id=98...\n');
    
    // Get current record
    const [rows] = await connection.execute(
      'SELECT * FROM document_processed WHERE process_id = ?',
      [98]
    );

    if (rows.length === 0) {
      console.log('❌ No record found with process_id=98');
      return;
    }

    console.log('📋 Current Record:');
    console.log(JSON.stringify(rows[0], null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    // Calculate previous month dates
    const currentDate = new Date();
    const previousMonth = new Date(currentDate);
    previousMonth.setMonth(currentDate.getMonth() - 1);
    
    console.log(`📅 Updating dates to previous month: ${previousMonth.toISOString().split('T')[0]}`);
    console.log('\n⚠️  WARNING: This will update the following date/timestamp fields:');
    console.log('   - time_initiated');
    console.log('   - time_finished');
    console.log('   - created_at');
    console.log('   - updated_at');
    console.log('\n' + '='.repeat(80) + '\n');

    // Update the record with previous month's date
    const updateQuery = `
      UPDATE document_processed 
      SET 
        time_initiated = DATE_SUB(time_initiated, INTERVAL 1 MONTH),
        time_finished = DATE_SUB(time_finished, INTERVAL 1 MONTH),
        created_at = DATE_SUB(created_at, INTERVAL 1 MONTH),
        updated_at = DATE_SUB(updated_at, INTERVAL 1 MONTH)
      WHERE process_id = ?
    `;

    const [updateResult] = await connection.execute(updateQuery, [98]);
    console.log('✅ Updated document_processed record');
    console.log(`   Rows affected: ${updateResult.affectedRows}`);

    console.log('\n' + '='.repeat(80) + '\n');

    // Fetch and display updated record
    const [updatedRows] = await connection.execute(
      'SELECT * FROM document_processed WHERE process_id = ?',
      [98]
    );

    console.log('📋 Updated Record:');
    console.log(JSON.stringify(updatedRows[0], null, 2));

    console.log('\n✅ Record successfully updated to previous month!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the update
updateProcessRecord()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
