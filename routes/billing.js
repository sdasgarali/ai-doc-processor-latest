const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const invoiceService = require('../services/invoiceService');
const emailService = require('../services/emailService');
const paymentService = require('../services/paymentService');
const { query } = require('../config/database');
const path = require('path');
const fs = require('fs');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.user_role !== 'superadmin' && req.user.user_role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// ==========================================
// BILLING CONFIGURATION ROUTES
// ==========================================

// Get billing configuration
router.get('/config', verifyToken, requireAdmin, async (req, res) => {
  try {
    const config = await invoiceService.getBillingConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get billing config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing configuration'
    });
  }
});

// Update billing configuration
router.put('/config', verifyToken, requireAdmin, async (req, res) => {
  try {
    const config = await invoiceService.updateBillingConfig(req.body, req.user.userid);
    res.json({
      success: true,
      message: 'Billing configuration updated successfully',
      data: config
    });
  } catch (error) {
    console.error('Update billing config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating billing configuration'
    });
  }
});

// ==========================================
// INVOICE MANAGEMENT ROUTES
// ==========================================

// Generate monthly invoices for all clients
router.post('/invoices/generate', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await invoiceService.generateMonthlyInvoices(req.user.userid);
    
    // Send invoice emails for newly generated invoices
    const emailResults = [];
    for (const invoice of result.generated) {
      try {
        const emailResult = await emailService.sendInvoiceEmail(invoice.invoice_id);
        emailResults.push({ invoice_id: invoice.invoice_id, ...emailResult });
      } catch (emailError) {
        console.error(`Error sending email for invoice ${invoice.invoice_id}:`, emailError);
        emailResults.push({ invoice_id: invoice.invoice_id, success: false, error: emailError.message });
      }
    }

    res.json({
      success: true,
      message: `Generated: ${result.summary.total_generated}, Updated: ${result.summary.total_updated}, Skipped: ${result.summary.total_skipped}`,
      data: {
        invoices: result.generated,
        updated: result.updated,
        skipped: result.skipped,
        summary: result.summary,
        emailResults
      }
    });
  } catch (error) {
    console.error('Generate invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoices: ' + error.message
    });
  }
});

// Get all invoices with optional filters
router.get('/invoices', verifyToken, async (req, res) => {
  try {
    const { client_id, status, month, year } = req.query;
    
    // If user is client, they can only see their own invoices
    const filters = {};
    if (req.user.user_role === 'client') {
      filters.client_id = req.user.client_id;
    } else if (client_id) {
      filters.client_id = client_id;
    }

    if (status) filters.status = status;
    if (month) filters.month = month;
    if (year) filters.year = year;

    const invoices = await invoiceService.getInvoices(filters);
    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices'
    });
  }
});

// Get specific invoice by ID
router.get('/invoices/:invoiceId', verifyToken, async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check access permission
    if (req.user.user_role === 'client' && invoice.client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice'
    });
  }
});

// Update invoice (admin only)
router.put('/invoices/:invoiceId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, notes, payment_method, payment_transaction_id } = req.body;
    
    const paymentDetails = {};
    if (payment_method) paymentDetails.payment_method = payment_method;
    if (payment_transaction_id) paymentDetails.payment_transaction_id = payment_transaction_id;

    const invoice = await invoiceService.updateInvoiceStatus(
      req.params.invoiceId,
      status,
      paymentDetails
    );

    // If manually marked as paid, send confirmation email
    if (status === 'paid') {
      try {
        await emailService.sendPaymentReceivedEmail(req.params.invoiceId);
      } catch (emailError) {
        console.error('Error sending payment confirmation:', emailError);
      }
    }

    // Update notes if provided
    if (notes) {
      await query(
        'UPDATE invoice SET notes = ? WHERE invoice_id = ?',
        [notes, req.params.invoiceId]
      );
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating invoice'
    });
  }
});

// Send or resend invoice email
router.post('/invoices/:invoiceId/send', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await emailService.sendInvoiceEmail(req.params.invoiceId);
    res.json({
      success: true,
      message: 'Invoice email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invoice email: ' + error.message
    });
  }
});

// Download invoice PDF
router.get('/invoices/:invoiceId/pdf', verifyToken, async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check access permission
    if (req.user.user_role === 'client' && invoice.client_id !== req.user.client_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate PDF if not exists
    let pdfPath = invoice.pdf_attachment_path;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await invoiceService.generateInvoicePDF(req.params.invoiceId);
    }

    res.download(pdfPath, `Invoice_${invoice.invoice_number}.pdf`);
  } catch (error) {
    console.error('Download invoice PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading invoice PDF'
    });
  }
});

// ==========================================
// PAYMENT ROUTES (Public & Authenticated)
// ==========================================

// Validate payment link and get invoice details (public route)
router.get('/payment/:paymentLink', async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceByPaymentLink(req.params.paymentLink);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired payment link'
      });
    }

    res.json({
      success: true,
      data: {
        invoice_id: invoice.invoice_id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        amount_due: invoice.amount_due,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status
      }
    });
  } catch (error) {
    console.error('Validate payment link error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating payment link'
    });
  }
});

// Stripe webhook handler (public route - must be before other middleware)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    // Verify webhook signature
    const event = paymentService.verifyWebhookSignature(req.body, signature);
    
    // Handle the event
    await paymentService.handleWebhook(event);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook error: ' + error.message
    });
  }
});

// Create payment intent for an invoice (public route)
router.post('/payment/:paymentLink/intent', async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceByPaymentLink(req.params.paymentLink);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired payment link'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice already paid'
      });
    }

    const paymentIntent = await paymentService.createPaymentIntent(
      invoice.invoice_id,
      req.ip
    );

    res.json({
      success: true,
      data: paymentIntent
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent: ' + error.message
    });
  }
});

// Process payment (public route)
router.post('/payment/:paymentLink', async (req, res) => {
  try {
    const { payment_method_id, amount } = req.body;
    
    const invoice = await invoiceService.getInvoiceByPaymentLink(req.params.paymentLink);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired payment link'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice already paid'
      });
    }

    // Verify amount matches
    if (parseFloat(amount) !== parseFloat(invoice.amount_due)) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match invoice amount'
      });
    }

    // Log payment transaction
    const transactionResult = await query(
      `INSERT INTO payment_transaction (
        invoice_id, payment_link, amount, status, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoice.invoice_id,
        req.params.paymentLink,
        amount,
        'initiated',
        req.ip,
        req.get('user-agent')
      ]
    );

    const transactionId = transactionResult.insertId;

    // TODO: Integrate with actual payment gateway (Stripe, PayPal, etc.)
    // For now, simulate successful payment
    const paymentSuccess = true; // This would be replaced with actual payment processing

    if (paymentSuccess) {
      // Update transaction
      await query(
        `UPDATE payment_transaction 
         SET status = ?, completed_at = NOW(), payment_method = ?, gateway_transaction_id = ?
         WHERE transaction_id = ?`,
        ['success', 'card', payment_method_id || 'manual', transactionId]
      );

      // Update invoice status
      await invoiceService.updateInvoiceStatus(invoice.invoice_id, 'paid', {
        payment_method: 'card',
        payment_transaction_id: payment_method_id || 'manual'
      });

      // Send payment confirmation email
      try {
        await emailService.sendPaymentReceivedEmail(invoice.invoice_id);
      } catch (emailError) {
        console.error('Error sending payment confirmation:', emailError);
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          invoice_id: invoice.invoice_id,
          transaction_id: transactionId
        }
      });
    } else {
      // Update transaction as failed
      await query(
        `UPDATE payment_transaction 
         SET status = ?, error_message = ?
         WHERE transaction_id = ?`,
        ['failed', 'Payment processing failed', transactionId]
      );

      res.status(400).json({
        success: false,
        message: 'Payment processing failed'
      });
    }
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment: ' + error.message
    });
  }
});

// ==========================================
// REMINDER ROUTES
// ==========================================

// Manually trigger payment reminders (admin only)
router.post('/reminders/send', verifyToken, requireAdmin, async (req, res) => {
  try {
    const config = await invoiceService.getBillingConfig();
    
    // Get overdue invoices
    const overdueInvoices = await query(
      `SELECT * FROM invoice 
       WHERE status IN ('unpaid', 'overdue') 
       AND due_date < CURDATE()`
    );

    const results = [];
    for (const invoice of overdueInvoices) {
      try {
        // Check how many reminders already sent
        const reminders = await query(
          `SELECT COUNT(*) as count FROM mail_log 
           WHERE invoice_id = ? AND email_type = 'payment_reminder'`,
          [invoice.invoice_id]
        );
        
        const reminderCount = reminders[0].count;
        
        if (reminderCount < config.max_reminder_count) {
          const result = await emailService.sendReminderEmail(invoice.invoice_id, reminderCount + 1);
          results.push({ invoice_id: invoice.invoice_id, ...result });
          
          // Schedule next reminder
          const nextReminderDate = new Date();
          nextReminderDate.setDate(nextReminderDate.getDate() + config.reminder_frequency_days);
          
          await query(
            `INSERT INTO invoice_reminder_schedule (invoice_id, reminder_number, scheduled_for)
             VALUES (?, ?, ?)`,
            [invoice.invoice_id, reminderCount + 2, nextReminderDate]
          );
        }
      } catch (error) {
        console.error(`Error sending reminder for invoice ${invoice.invoice_id}:`, error);
        results.push({ invoice_id: invoice.invoice_id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Sent ${results.filter(r => r.success).length} reminders`,
      data: results
    });
  } catch (error) {
    console.error('Send reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending reminders'
    });
  }
});

// ==========================================
// MAIL LOG ROUTES
// ==========================================

// Get mail logs (admin only)
router.get('/mail-logs', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { invoice_id, status, email_type } = req.query;
    
    let sql = `
      SELECT ml.*, i.invoice_number, i.client_id, c.client_name
      FROM mail_log ml
      JOIN invoice i ON ml.invoice_id = i.invoice_id
      JOIN client c ON i.client_id = c.client_id
      WHERE 1=1
    `;
    const params = [];

    if (invoice_id) {
      sql += ' AND ml.invoice_id = ?';
      params.push(invoice_id);
    }

    if (status) {
      sql += ' AND ml.status = ?';
      params.push(status);
    }

    if (email_type) {
      sql += ' AND ml.email_type = ?';
      params.push(email_type);
    }

    sql += ' ORDER BY ml.created_at DESC LIMIT 100';

    const logs = await query(sql, params);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Get mail logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching mail logs'
    });
  }
});

// Retry failed email (admin only)
router.post('/mail-logs/:mailLogId/retry', verifyToken, requireAdmin, async (req, res) => {
  try {
    const log = await query(
      'SELECT * FROM mail_log WHERE mail_log_id = ?',
      [req.params.mailLogId]
    );

    if (log.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mail log not found'
      });
    }

    const mailLog = log[0];
    
    let result;
    switch (mailLog.email_type) {
      case 'invoice_generated':
        result = await emailService.sendInvoiceEmail(mailLog.invoice_id);
        break;
      case 'payment_reminder':
        result = await emailService.sendReminderEmail(mailLog.invoice_id, 1);
        break;
      case 'payment_received':
        result = await emailService.sendPaymentReceivedEmail(mailLog.invoice_id);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported email type'
        });
    }

    res.json({
      success: true,
      message: 'Email retry initiated',
      data: result
    });
  } catch (error) {
    console.error('Retry email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrying email: ' + error.message
    });
  }
});

// ==========================================
// REPORTING ROUTES
// ==========================================

// Get revenue summary (admin only)
router.get('/reports/revenue', verifyToken, requireAdmin, async (req, res) => {
  try {
    const revenue = await query('SELECT * FROM monthly_revenue');
    res.json({
      success: true,
      data: revenue
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue report'
    });
  }
});

// Get invoice summary (admin only)
router.get('/reports/summary', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let sql = 'SELECT * FROM invoice_summary WHERE 1=1';
    const params = [];

    if (month) {
      sql += ' AND DATE_FORMAT(invoice_date, "%Y-%m") = ?';
      params.push(month);
    }

    if (year) {
      sql += ' AND YEAR(invoice_date) = ?';
      params.push(year);
    }

    sql += ' ORDER BY invoice_date DESC';

    const summary = await query(sql, params);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get invoice summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice summary'
    });
  }
});

module.exports = router;
