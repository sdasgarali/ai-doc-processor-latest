const invoiceService = require('./services/invoiceService');
require('dotenv').config();

async function generatePDF() {
  try {
    const invoiceId = 'ee9a1a44-cb09-4b41-aa81-3a4f94254021';
    
    console.log('📄 Generating PDF for invoice:', invoiceId);
    const pdfPath = await invoiceService.generateInvoicePDF(invoiceId);
    console.log('✅ PDF generated successfully!');
    console.log('   Path:', pdfPath);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

generatePDF();
