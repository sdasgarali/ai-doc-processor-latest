const emailService = require('./services/emailService');
require('dotenv').config();

async function testEmailSending() {
  try {
    console.log('📧 Testing Email Sending Functionality\n');
    console.log('=' .repeat(80));
    
    // Test invoice ID (from the one we just created)
    const invoiceId = 'ee9a1a44-cb09-4b41-aa81-3a4f94254021';
    
    console.log('\n1. Attempting to send invoice email...');
    console.log(`   Invoice ID: ${invoiceId}`);
    
    const result = await emailService.sendInvoiceEmail(invoiceId);
    
    console.log('\n✅ Email sent successfully!');
    console.log(`   Mail Log ID: ${result.mailLogId}`);
    console.log(`   Message ID: ${result.messageId}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Email functionality test completed successfully!');
    console.log('\nNote: Check the console output for the preview URL if using Ethereal email.');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error.message);
    console.error('\nFull error:', error);
  } finally {
    process.exit(0);
  }
}

testEmailSending();
