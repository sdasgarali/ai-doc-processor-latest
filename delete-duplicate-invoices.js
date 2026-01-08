const { query } = require('./config/database');
require('dotenv').config();

async function deleteDuplicateInvoices() {
  try {
    console.log('🔍 Finding and Deleting Duplicate Invoices\n');
    console.log('=' .repeat(80));
    
    // Find duplicates: same client_id and same usage_id (which represents same period)
    console.log('\n1. Finding duplicate invoices...');
    const duplicates = await query(`
      SELECT 
        client_id,
        usage_id,
        COUNT(*) as count,
        GROUP_CONCAT(invoice_id ORDER BY created_at DESC) as invoice_ids,
        GROUP_CONCAT(invoice_number ORDER BY created_at DESC) as invoice_numbers,
        GROUP_CONCAT(created_at ORDER BY created_at DESC) as created_dates
      FROM invoice
      WHERE usage_id IS NOT NULL
      GROUP BY client_id, usage_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate invoices found!');
      return;
    }
    
    console.log(`\n⚠️  Found ${duplicates.length} sets of duplicate invoices:\n`);
    
    let totalDeleted = 0;
    
    for (const dup of duplicates) {
      const invoiceIds = dup.invoice_ids.split(',');
      const invoiceNumbers = dup.invoice_numbers.split(',');
      const createdDates = dup.created_dates.split(',');
      
      console.log(`\nClient ID: ${dup.client_id}, Usage ID: ${dup.usage_id}`);
      console.log(`  Total duplicates: ${dup.count}`);
      console.log(`  Keeping newest: ${invoiceNumbers[0]} (ID: ${invoiceIds[0]})`);
      console.log(`  Deleting ${dup.count - 1} older invoice(s):`);
      
      // Keep the first one (newest), delete the rest
      for (let i = 1; i < invoiceIds.length; i++) {
        console.log(`    - ${invoiceNumbers[i]} (ID: ${invoiceIds[i]}, Created: ${createdDates[i]})`);
        
        // Delete the invoice
        await query('DELETE FROM invoice WHERE invoice_id = ?', [invoiceIds[i]]);
        totalDeleted++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`✅ Successfully deleted ${totalDeleted} duplicate invoice(s)!`);
    console.log(`✅ Kept ${duplicates.length} invoice(s) (newest for each client/period)`);
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error);
  } finally {
    process.exit(0);
  }
}

deleteDuplicateInvoices();
