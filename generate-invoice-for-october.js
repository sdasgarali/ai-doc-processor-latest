const { query } = require('./config/database');
const invoiceService = require('./services/invoiceService');
require('dotenv').config();

async function generateInvoiceForOctober() {
  try {
    console.log('🔍 Generating Invoice for October 2025\n');
    console.log('=' .repeat(80));
    
    // Get the document that was updated to October
    console.log('\n1. Checking document from process_id=98...');
    const [doc] = await query(
      'SELECT * FROM document_processed WHERE process_id = 98'
    );
    
    if (!doc) {
      console.log('❌ Document not found');
      return;
    }
    
    console.log(`✅ Found document for client_id: ${doc.client_id}`);
    console.log(`   Time initiated: ${doc.time_initiated}`);
    console.log(`   Time finished: ${doc.time_finished}`);
    console.log(`   Cost: $${doc.cost}`);
    
    // Define October period
    const periodStart = '2025-10-01';
    const periodEnd = '2025-10-31';
    
    console.log(`\n2. Calculating usage for period: ${periodStart} to ${periodEnd}...`);
    
    // Call stored procedure to calculate usage
    const usageResult = await query(
      'CALL calculate_client_usage(?, ?, ?)',
      [doc.client_id, periodStart, periodEnd]
    );
    
    const usage = usageResult[0][0];
    console.log('✅ Usage calculated:');
    console.log(`   Usage ID: ${usage.usage_id}`);
    console.log(`   Total Documents: ${usage.total_documents}`);
    console.log(`   Total Pages: ${usage.total_pages}`);
    console.log(`   Total Cost: $${usage.total_cost}`);
    
    // Check if invoice already exists for this usage
    console.log('\n3. Checking if invoice already exists...');
    const existingInvoices = await query(
      'SELECT * FROM invoice WHERE usage_id = ?',
      [usage.usage_id]
    );
    
    if (existingInvoices.length > 0) {
      console.log('⚠️  Invoice already exists:');
      console.log(`   Invoice Number: ${existingInvoices[0].invoice_number}`);
      console.log(`   Status: ${existingInvoices[0].status}`);
      console.log(`   Amount Due: $${existingInvoices[0].amount_due}`);
      return;
    }
    
    // Generate invoice
    console.log('\n4. Generating invoice...');
    const invoice = await invoiceService.createInvoice(
      doc.client_id,
      usage.usage_id,
      doc.userid // Use the userid from the document
    );
    
    console.log('✅ Invoice generated successfully!');
    console.log(`   Invoice ID: ${invoice.invoice_id}`);
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Invoice Date: ${invoice.invoice_date}`);
    console.log(`   Due Date: ${invoice.due_date}`);
    console.log(`   Amount Due: $${invoice.amount_due}`);
    console.log(`   Status: ${invoice.status}`);
    
    // Generate PDF
    console.log('\n5. Generating PDF...');
    const pdfPath = await invoiceService.generateInvoicePDF(invoice.invoice_id);
    console.log(`✅ PDF generated: ${pdfPath}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Invoice generation completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Run the script
generateInvoiceForOctober();
