const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const invoiceService = require('./invoiceService');

/**
 * Email Service
 * Handles sending emails for invoices with retry logic
 */

class EmailService {
  constructor() {
    this.transporter = null;
  }

  /**
   * Initialize email transporter with current configuration
   */
  async initializeTransporter() {
    const config = await invoiceService.getBillingConfig();
    
    // For development, use ethereal email or configure SMTP
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Fallback to ethereal for testing
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    return this.transporter;
  }

  /**
   * Create mail log entry
   */
  async createMailLog(invoiceId, emailType, recipientEmail, recipientName, subject, body, attachments = []) {
    const result = await query(
      `INSERT INTO mail_log (
        invoice_id, email_type, recipient_email, recipient_name,
        subject, body, attachments, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        emailType,
        recipientEmail,
        recipientName,
        subject,
        body,
        JSON.stringify(attachments),
        'pending'
      ]
    );

    return result.insertId;
  }

  /**
   * Update mail log status
   */
  async updateMailLog(mailLogId, status, errorMessage = null) {
    const updates = {
      status,
      updated_at: new Date()
    };

    if (status === 'success') {
      updates.sent_at = new Date();
    }

    if (status === 'failed' || status === 'retry_pending') {
      if (errorMessage) {
        updates.error_message = errorMessage;
      }
      
      // Get current retry count
      const logs = await query(
        'SELECT retry_count, max_retries FROM mail_log WHERE mail_log_id = ?',
        [mailLogId]
      );
      
      if (logs.length > 0) {
        const log = logs[0];
        const newRetryCount = log.retry_count + 1;
        
        updates.retry_count = newRetryCount;
        
        if (newRetryCount < log.max_retries) {
          updates.status = 'retry_pending';
          // Schedule retry in 30 minutes
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + 30);
          updates.next_retry_at = nextRetry;
        } else {
          updates.status = 'failed';
        }
      }
    }

    const sets = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(mailLogId);

    await query(
      `UPDATE mail_log SET ${sets} WHERE mail_log_id = ?`,
      values
    );
  }

  /**
   * Send invoice generation email
   */
  async sendInvoiceEmail(invoiceId) {
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const config = await invoiceService.getBillingConfig();
    
    // Generate PDF if not exists
    let pdfPath = invoice.pdf_attachment_path;
    if (!pdfPath) {
      pdfPath = await invoiceService.generateInvoicePDF(invoiceId);
    }

    const paymentUrl = `${process.env.APP_URL || 'http://localhost:3000'}/payment/${invoice.payment_link}`;

    const subject = `Invoice ${invoice.invoice_number} - ${config.company_name}`;
    const body = `
Dear ${invoice.client_name},

Thank you for your business! Please find attached your invoice for the period ${invoice.period_start} to ${invoice.period_end}.

Invoice Number: ${invoice.invoice_number}
Invoice Date: ${invoice.invoice_date}
Due Date: ${invoice.due_date}
Amount Due: $${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}

You can pay this invoice online by clicking the link below:
${paymentUrl}

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
${config.company_name}
${config.company_phone || ''}
    `;

    // Create mail log
    const mailLogId = await this.createMailLog(
      invoiceId,
      'invoice_generated',
      invoice.client_email,
      invoice.client_name,
      subject,
      body,
      [pdfPath]
    );

    // Send email
    try {
      await this.initializeTransporter();
      
      const info = await this.transporter.sendMail({
        from: `"${config.system_mailer_name}" <${config.system_mailer}>`,
        to: invoice.client_email,
        subject: subject,
        text: body,
        html: this.generateInvoiceHTML(invoice, config, paymentUrl),
        attachments: [
          {
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            path: pdfPath
          }
        ]
      });

      await this.updateMailLog(mailLogId, 'success');
      
      console.log('Email sent:', info.messageId);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return { success: true, mailLogId, messageId: info.messageId };
    } catch (error) {
      console.error('Email send error:', error);
      await this.updateMailLog(mailLogId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Send payment reminder email
   */
  async sendReminderEmail(invoiceId, reminderNumber) {
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const config = await invoiceService.getBillingConfig();
    const paymentUrl = `${process.env.APP_URL || 'http://localhost:3000'}/payment/${invoice.payment_link}`;

    const daysOverdue = Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
    
    const subject = `Payment Reminder: Invoice ${invoice.invoice_number} - ${config.company_name}`;
    const body = `
Dear ${invoice.client_name},

This is a friendly reminder that invoice ${invoice.invoice_number} is currently ${daysOverdue > 0 ? daysOverdue + ' days overdue' : 'due'}.

Invoice Number: ${invoice.invoice_number}
Due Date: ${invoice.due_date}
Amount Due: $${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}

Please make payment at your earliest convenience:
${paymentUrl}

If you have already made payment, please disregard this notice.

Best regards,
${config.company_name}
    `;

    const mailLogId = await this.createMailLog(
      invoiceId,
      'payment_reminder',
      invoice.client_email,
      invoice.client_name,
      subject,
      body,
      invoice.pdf_attachment_path ? [invoice.pdf_attachment_path] : []
    );

    try {
      await this.initializeTransporter();
      
      const mailOptions = {
        from: `"${config.system_mailer_name}" <${config.system_mailer}>`,
        to: invoice.client_email,
        subject: subject,
        text: body,
        html: this.generateReminderHTML(invoice, config, paymentUrl, daysOverdue)
      };

      if (invoice.pdf_attachment_path) {
        mailOptions.attachments = [
          {
            filename: `Invoice_${invoice.invoice_number}.pdf`,
            path: invoice.pdf_attachment_path
          }
        ];
      }

      const info = await this.transporter.sendMail(mailOptions);
      await this.updateMailLog(mailLogId, 'success');
      
      return { success: true, mailLogId, messageId: info.messageId };
    } catch (error) {
      console.error('Reminder email error:', error);
      await this.updateMailLog(mailLogId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Send payment received email
   */
  async sendPaymentReceivedEmail(invoiceId) {
    const invoice = await invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const config = await invoiceService.getBillingConfig();

    const subject = `Payment Received - Invoice ${invoice.invoice_number}`;
    const body = `
Dear ${invoice.client_name},

Thank you! We have received your payment for invoice ${invoice.invoice_number}.

Invoice Number: ${invoice.invoice_number}
Amount Paid: $${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}
Payment Date: ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'Today'}

A receipt is attached for your records.

We appreciate your business!

Best regards,
${config.company_name}
    `;

    const mailLogId = await this.createMailLog(
      invoiceId,
      'payment_received',
      invoice.client_email,
      invoice.client_name,
      subject,
      body,
      invoice.pdf_attachment_path ? [invoice.pdf_attachment_path] : []
    );

    try {
      await this.initializeTransporter();
      
      // Regenerate PDF with PAID status
      const pdfPath = await invoiceService.generateInvoicePDF(invoiceId);

      const info = await this.transporter.sendMail({
        from: `"${config.system_mailer_name}" <${config.system_mailer}>`,
        to: invoice.client_email,
        subject: subject,
        text: body,
        html: this.generatePaymentReceivedHTML(invoice, config),
        attachments: [
          {
            filename: `Receipt_${invoice.invoice_number}.pdf`,
            path: pdfPath
          }
        ]
      });

      await this.updateMailLog(mailLogId, 'success');
      
      return { success: true, mailLogId, messageId: info.messageId };
    } catch (error) {
      console.error('Payment confirmation email error:', error);
      await this.updateMailLog(mailLogId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails() {
    const failedEmails = await query(
      `SELECT * FROM mail_log 
       WHERE status = 'retry_pending' 
       AND next_retry_at <= NOW()
       AND retry_count < max_retries`
    );

    const results = [];
    for (const email of failedEmails) {
      try {
        switch (email.email_type) {
          case 'invoice_generated':
            await this.sendInvoiceEmail(email.invoice_id);
            break;
          case 'payment_reminder':
            // Get reminder number from schedule
            const schedule = await query(
              'SELECT reminder_number FROM invoice_reminder_schedule WHERE mail_log_id = ?',
              [email.mail_log_id]
            );
            const reminderNumber = schedule[0]?.reminder_number || 1;
            await this.sendReminderEmail(email.invoice_id, reminderNumber);
            break;
          case 'payment_received':
            await this.sendPaymentReceivedEmail(email.invoice_id);
            break;
        }
        results.push({ mail_log_id: email.mail_log_id, status: 'success' });
      } catch (error) {
        results.push({ mail_log_id: email.mail_log_id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * Generate HTML for invoice email
   */
  generateInvoiceHTML(invoice, config, paymentUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .amount { font-size: 24px; font-weight: bold; color: #1976d2; }
        .button { display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.company_name}</h1>
            <p>Invoice ${invoice.invoice_number}</p>
        </div>
        <div class="content">
            <p>Dear ${invoice.client_name},</p>
            <p>Thank you for your business! Please find attached your invoice for the period <strong>${invoice.period_start}</strong> to <strong>${invoice.period_end}</strong>.</p>
            
            <div class="invoice-details">
                <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                <p><strong>Invoice Date:</strong> ${invoice.invoice_date}</p>
                <p><strong>Due Date:</strong> ${invoice.due_date}</p>
                <p><strong>Amount Due:</strong> <span class="amount">$${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}</span></p>
            </div>
            
            <div style="text-align: center;">
                <a href="${paymentUrl}" class="button">Pay Invoice Online</a>
            </div>
            
            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
            <p>${config.company_name}<br>
            ${config.company_address || ''}<br>
            ${config.company_phone || ''}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for reminder email
   */
  generateReminderHTML(invoice, config, paymentUrl, daysOverdue) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f57c00; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .amount { font-size: 24px; font-weight: bold; color: #f57c00; }
        .overdue { color: #d32f2f; font-weight: bold; }
        .button { display: inline-block; padding: 12px 24px; background-color: #f57c00; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Reminder</h1>
        </div>
        <div class="content">
            <p>Dear ${invoice.client_name},</p>
            <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> is ${daysOverdue > 0 ? `<span class="overdue">${daysOverdue} days overdue</span>` : 'due'}.</p>
            
            <div class="invoice-details">
                <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                <p><strong>Due Date:</strong> ${invoice.due_date}</p>
                <p><strong>Amount Due:</strong> <span class="amount">$${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}</span></p>
            </div>
            
            <div style="text-align: center;">
                <a href="${paymentUrl}" class="button">Pay Now</a>
            </div>
            
            <p>If you have already made payment, please disregard this notice.</p>
        </div>
        <div class="footer">
            <p>${config.company_name}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for payment received email
   */
  generatePaymentReceivedHTML(invoice, config) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4caf50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .payment-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .amount { font-size: 24px; font-weight: bold; color: #4caf50; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .checkmark { font-size: 48px; color: #4caf50; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="checkmark">✓</div>
            <h1>Payment Received</h1>
        </div>
        <div class="content">
            <p>Dear ${invoice.client_name},</p>
            <p>Thank you! We have received your payment for invoice <strong>${invoice.invoice_number}</strong>.</p>
            
            <div class="payment-details">
                <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                <p><strong>Amount Paid:</strong> <span class="amount">$${parseFloat(invoice.amount_due).toFixed(2)} ${config.currency}</span></p>
                <p><strong>Payment Date:</strong> ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'Today'}</p>
            </div>
            
            <p>A receipt is attached for your records.</p>
            <p>We appreciate your business!</p>
        </div>
        <div class="footer">
            <p>${config.company_name}</p>
        </div>
    </div>
</body>
</html>
    `;
  }
}

module.exports = new EmailService();
