const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

/**
 * Invoice Service
 * Handles invoice generation, PDF creation, and invoice management
 */

class InvoiceService {
  /**
   * Get billing configuration
   */
  async getBillingConfig() {
    const results = await query(
      'SELECT * FROM billing_configuration WHERE config_id = 1'
    );
    return results[0] || null;
  }

  /**
   * Update billing configuration
   */
  async updateBillingConfig(config, userId) {
    const {
      system_mailer,
      system_mailer_name,
      invoice_date_day,
      due_date_day,
      reminder_frequency_days,
      max_reminder_count,
      auto_generate_enabled,
      payment_gateway,
      invoice_prefix,
      currency,
      tax_rate,
      company_name,
      company_address,
      company_phone
    } = config;

    await query(
      `UPDATE billing_configuration 
       SET system_mailer = ?,
           system_mailer_name = ?,
           invoice_date_day = ?,
           due_date_day = ?,
           reminder_frequency_days = ?,
           max_reminder_count = ?,
           auto_generate_enabled = ?,
           payment_gateway = ?,
           invoice_prefix = ?,
           currency = ?,
           tax_rate = ?,
           company_name = ?,
           company_address = ?,
           company_phone = ?,
           updated_by = ?
       WHERE config_id = 1`,
      [
        system_mailer,
        system_mailer_name,
        invoice_date_day,
        due_date_day,
        reminder_frequency_days,
        max_reminder_count,
        auto_generate_enabled,
        payment_gateway,
        invoice_prefix,
        currency,
        tax_rate,
        company_name,
        company_address,
        company_phone,
        userId
      ]
    );

    return await this.getBillingConfig();
  }

  /**
   * Calculate usage for a client for a given period
   */
  async calculateClientUsage(clientId, periodStart, periodEnd) {
    // Use stored procedure
    const results = await query(
      'CALL calculate_client_usage(?, ?, ?)',
      [clientId, periodStart, periodEnd]
    );
    
    return results[0][0];
  }

  /**
   * Generate next invoice number
   */
  async generateInvoiceNumber() {
    const config = await this.getBillingConfig();
    const prefix = config.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    
    // Get the last invoice number for this year
    const lastInvoice = await query(
      `SELECT invoice_number FROM invoice 
       WHERE invoice_number LIKE ? 
       ORDER BY invoice_number DESC LIMIT 1`,
      [`${prefix}-${year}-%`]
    );

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = parseInt(lastInvoice[0].invoice_number.split('-')[2]);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${year}-${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * Generate payment link (UUID token)
   */
  generatePaymentLink() {
    return uuidv4();
  }

  /**
   * Create invoice for a client
   */
  async createInvoice(clientId, usageId, generatedBy) {
    const config = await this.getBillingConfig();
    const usage = await query(
      'SELECT * FROM client_usage WHERE usage_id = ?',
      [usageId]
    );

    if (usage.length === 0) {
      throw new Error('Usage record not found');
    }

    const invoiceId = uuidv4();
    const invoiceNumber = await this.generateInvoiceNumber();
    const paymentLink = this.generatePaymentLink();
    
    // Calculate invoice and due dates
    const now = new Date();
    const invoiceDate = new Date(now.getFullYear(), now.getMonth(), config.invoice_date_day);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), config.due_date_day);
    
    // If due date is before invoice date, move to next month
    if (dueDate < invoiceDate) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    // Payment link expires in 90 days
    const paymentLinkExpiresAt = new Date();
    paymentLinkExpiresAt.setDate(paymentLinkExpiresAt.getDate() + 90);

    const amountDue = usage[0].total_cost * (1 + config.tax_rate / 100);

    await query(
      `INSERT INTO invoice (
        invoice_id, client_id, usage_id, invoice_number,
        invoice_date, due_date, amount_due, status,
        payment_link, payment_link_expires_at, generated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        clientId,
        usageId,
        invoiceNumber,
        invoiceDate.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        amountDue.toFixed(2),
        'unpaid',
        paymentLink,
        paymentLinkExpiresAt,
        generatedBy
      ]
    );

    return await this.getInvoiceById(invoiceId);
  }

  /**
   * Generate invoices for all clients for the current month
   */
  async generateMonthlyInvoices(generatedBy) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    
    // Calculate period (previous month)
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // Last day of previous month
    
    // Get current month start for comparison
    const currentMonthStart = new Date(year, month, 1);

    // Get all clients
    const clients = await query(
      `SELECT client_id FROM client`
    );

    const invoices = [];
    const skipped = [];
    const updated = [];
    
    for (const client of clients) {
      try {
        // Calculate usage
        const usage = await this.calculateClientUsage(
          client.client_id,
          periodStart.toISOString().split('T')[0],
          periodEnd.toISOString().split('T')[0]
        );

        // Only proceed if there's usage
        if (usage && usage.usage_id) {
          // Check if invoice already exists for this usage_id
          const existingInvoices = await query(
            `SELECT invoice_id, invoice_date, status 
             FROM invoice 
             WHERE usage_id = ?`,
            [usage.usage_id]
          );
          
          if (existingInvoices.length > 0) {
            const existingInvoice = existingInvoices[0];
            const invoiceDate = new Date(existingInvoice.invoice_date);
            
            // If invoice is for a previous month (not current), skip
            if (invoiceDate < currentMonthStart) {
              console.log(`Skipping: Invoice already exists for client ${client.client_id} for period ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
              skipped.push({
                client_id: client.client_id,
                invoice_id: existingInvoice.invoice_id,
                reason: 'Previous month invoice already exists'
              });
              continue;
            }
            
            // If invoice is for current month, delete old and create new
            console.log(`Updating: Replacing existing invoice ${existingInvoice.invoice_id} for client ${client.client_id}`);
            
            // Delete the old invoice (if not paid)
            if (existingInvoice.status !== 'paid') {
              await query(
                'DELETE FROM invoice WHERE invoice_id = ?',
                [existingInvoice.invoice_id]
              );
              
              // Create new invoice
              const invoice = await this.createInvoice(
                client.client_id,
                usage.usage_id,
                generatedBy
              );
              invoices.push(invoice);
              updated.push({
                client_id: client.client_id,
                old_invoice_id: existingInvoice.invoice_id,
                new_invoice_id: invoice.invoice_id
              });
            } else {
              console.log(`Skipping: Invoice ${existingInvoice.invoice_id} for client ${client.client_id} is already paid`);
              skipped.push({
                client_id: client.client_id,
                invoice_id: existingInvoice.invoice_id,
                reason: 'Invoice already paid'
              });
            }
          } else {
            // No existing invoice, create new one
            const invoice = await this.createInvoice(
              client.client_id,
              usage.usage_id,
              generatedBy
            );
            invoices.push(invoice);
          }
        }
      } catch (error) {
        console.error(`Error generating invoice for client ${client.client_id}:`, error);
      }
    }

    return {
      generated: invoices,
      updated: updated,
      skipped: skipped,
      summary: {
        total_generated: invoices.length,
        total_updated: updated.length,
        total_skipped: skipped.length
      }
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId) {
    const results = await query(
      `SELECT i.*, 
              c.client_name, c.email as client_email,
              u.total_documents, u.total_pages, u.period_start, u.period_end
       FROM invoice i
       JOIN client c ON i.client_id = c.client_id
       LEFT JOIN client_usage u ON i.usage_id = u.usage_id
       WHERE i.invoice_id = ?`,
      [invoiceId]
    );

    return results[0] || null;
  }

  /**
   * Get invoice by payment link
   */
  async getInvoiceByPaymentLink(paymentLink) {
    const results = await query(
      `SELECT i.*, 
              c.client_name, c.email as client_email
       FROM invoice i
       JOIN client c ON i.client_id = c.client_id
       WHERE i.payment_link = ? 
       AND i.payment_link_expires_at > NOW()
       AND i.status != 'paid'`,
      [paymentLink]
    );

    return results[0] || null;
  }

  /**
   * Get all invoices with filters
   */
  async getInvoices(filters = {}) {
    let sql = `
      SELECT i.*, 
             c.client_name, c.email as client_email,
             u.total_documents, u.total_pages, u.period_start, u.period_end
      FROM invoice i
      JOIN client c ON i.client_id = c.client_id
      LEFT JOIN client_usage u ON i.usage_id = u.usage_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.client_id) {
      sql += ' AND i.client_id = ?';
      params.push(filters.client_id);
    }

    if (filters.status) {
      sql += ' AND i.status = ?';
      params.push(filters.status);
    }

    if (filters.month) {
      sql += ' AND DATE_FORMAT(i.invoice_date, "%Y-%m") = ?';
      params.push(filters.month);
    }

    if (filters.year) {
      sql += ' AND YEAR(i.invoice_date) = ?';
      params.push(filters.year);
    }

    sql += ' ORDER BY i.invoice_date DESC';

    return await query(sql, params);
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId, status, paymentDetails = {}) {
    const updateData = {
      status,
      updated_at: new Date()
    };

    if (status === 'paid') {
      updateData.paid_at = new Date();
      if (paymentDetails.payment_method) {
        updateData.payment_method = paymentDetails.payment_method;
      }
      if (paymentDetails.payment_transaction_id) {
        updateData.payment_transaction_id = paymentDetails.payment_transaction_id;
      }
    }

    const sets = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(invoiceId);

    await query(
      `UPDATE invoice SET ${sets} WHERE invoice_id = ?`,
      values
    );

    return await this.getInvoiceById(invoiceId);
  }

  /**
   * Generate PDF invoice
   */
  async generateInvoicePDF(invoiceId) {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const config = await this.getBillingConfig();
    
    // Ensure invoices directory exists
    const invoicesDir = path.join(__dirname, '../invoices');
    try {
      await fs.access(invoicesDir);
    } catch {
      await fs.mkdir(invoicesDir, { recursive: true });
    }

    // Create a safe filename by formatting the date properly
    const invoiceDate = new Date(invoice.invoice_date);
    const formattedDate = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}-${String(invoiceDate.getDate()).padStart(2, '0')}`;
    const filename = `${invoice.client_name.replace(/[^a-z0-9]/gi, '_')}_${invoice.invoice_number}_${formattedDate}.pdf`;
    const filepath = path.join(invoicesDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = require('fs').createWriteStream(filepath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(config.company_name, 50, 50);
      if (config.company_address) {
        doc.fontSize(10).text(config.company_address, 50, 75);
      }
      if (config.company_phone) {
        doc.fontSize(10).text(`Phone: ${config.company_phone}`, 50, 90);
      }

      // Invoice title
      doc.fontSize(25).text('INVOICE', 400, 50);
      doc.fontSize(10).text(`Invoice #: ${invoice.invoice_number}`, 400, 80);
      doc.text(`Date: ${invoice.invoice_date}`, 400, 95);
      doc.text(`Due Date: ${invoice.due_date}`, 400, 110);

      // Bill to
      doc.fontSize(12).text('Bill To:', 50, 150);
      doc.fontSize(10).text(invoice.client_name, 50, 170);
      doc.text(invoice.client_email, 50, 185);

      // Line
      doc.moveTo(50, 220).lineTo(550, 220).stroke();

      // Table header
      doc.fontSize(10)
        .text('Description', 50, 240)
        .text('Documents', 300, 240)
        .text('Pages', 400, 240)
        .text('Amount', 480, 240);

      doc.moveTo(50, 255).lineTo(550, 255).stroke();

      // Line item
      const periodText = `Services for period ${invoice.period_start} to ${invoice.period_end}`;
      doc.text(periodText, 50, 270)
        .text(invoice.total_documents || '0', 300, 270)
        .text(invoice.total_pages || '0', 400, 270)
        .text(`$${parseFloat(invoice.amount_due / (1 + config.tax_rate / 100)).toFixed(2)}`, 480, 270);

      // Subtotal and tax
      let yPos = 320;
      doc.text('Subtotal:', 400, yPos)
        .text(`$${parseFloat(invoice.amount_due / (1 + config.tax_rate / 100)).toFixed(2)}`, 480, yPos);
      
      if (config.tax_rate > 0) {
        yPos += 20;
        doc.text(`Tax (${config.tax_rate}%):`, 400, yPos)
          .text(`$${(invoice.amount_due - (invoice.amount_due / (1 + config.tax_rate / 100))).toFixed(2)}`, 480, yPos);
      }

      // Total
      yPos += 30;
      doc.fontSize(12)
        .text('Total Due:', 400, yPos)
        .text(`$${parseFloat(invoice.amount_due).toFixed(2)}`, 480, yPos);

      // Payment link
      if (invoice.payment_link && invoice.status !== 'paid') {
        doc.fontSize(10).text(
          `Pay online: ${process.env.APP_URL || 'http://localhost:3000'}/payment/${invoice.payment_link}`,
          50,
          yPos + 50
        );
      }

      // Status
      if (invoice.status === 'paid') {
        doc.fontSize(16).fillColor('green').text('PAID', 250, yPos + 80);
      }

      // Footer
      doc.fontSize(8).fillColor('gray').text(
        'Thank you for your business!',
        50,
        700,
        { align: 'center', width: 500 }
      );

      doc.end();

      stream.on('finish', () => {
        // Update invoice with PDF path
        query(
          'UPDATE invoice SET pdf_attachment_path = ? WHERE invoice_id = ?',
          [filepath, invoiceId]
        ).then(() => {
          resolve(filepath);
        });
      });

      stream.on('error', reject);
    });
  }

  /**
   * Mark overdue invoices
   */
  async markOverdueInvoices() {
    await query(
      `UPDATE invoice 
       SET status = 'overdue' 
       WHERE status IN ('unpaid') 
       AND due_date < CURDATE()`
    );

    return await query(
      `SELECT * FROM invoice WHERE status = 'overdue'`
    );
  }
}

module.exports = new InvoiceService();
