const cron = require('node-cron');
const invoiceService = require('./invoiceService');
const emailService = require('./emailService');
const { query } = require('../config/database');

/**
 * Cron Service
 * Manages scheduled tasks for billing automation
 */

class CronService {
  constructor() {
    this.jobs = {};
  }

  /**
   * Initialize all cron jobs
   */
  async initialize() {
    console.log('🕐 Initializing billing cron jobs...');

    try {
      // Monthly invoice generation (1st of each month at 2 AM)
      this.jobs.invoiceGeneration = cron.schedule('0 2 1 * *', async () => {
        console.log('Running monthly invoice generation...');
        await this.generateMonthlyInvoices();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      // Daily reminder check (9 AM every day)
      this.jobs.reminderCheck = cron.schedule('0 9 * * *', async () => {
        console.log('Running daily reminder check...');
        await this.checkAndSendReminders();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      // Daily overdue marking (10 AM every day)
      this.jobs.overdueMarking = cron.schedule('0 10 * * *', async () => {
        console.log('Running overdue invoice check...');
        await this.markOverdueInvoices();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      // Email retry (every 30 minutes)
      this.jobs.emailRetry = cron.schedule('*/30 * * * *', async () => {
        console.log('Running email retry...');
        await this.retryFailedEmails();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      // Stale document check (every 15 minutes)
      this.jobs.staleDocumentCheck = cron.schedule('*/15 * * * *', async () => {
        console.log('Running stale document check...');
        await this.markStaleDocumentsAsFailed();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      console.log('✅ Billing cron jobs initialized');
      console.log('   - Invoice Generation: 1st of month at 2 AM');
      console.log('   - Reminder Check: Daily at 9 AM');
      console.log('   - Overdue Marking: Daily at 10 AM');
      console.log('   - Email Retry: Every 30 minutes');
      console.log('   - Stale Document Check: Every 15 minutes');

    } catch (error) {
      console.error('Error initializing cron jobs:', error);
    }
  }

  /**
   * Generate monthly invoices for all clients
   */
  async generateMonthlyInvoices() {
    try {
      console.log('Generating monthly invoices...');
      
      const config = await invoiceService.getBillingConfig();
      if (!config.auto_generate_enabled) {
        console.log('Auto-generation is disabled');
        return;
      }

      // Generate invoices (using system/admin user)
      const invoices = await invoiceService.generateMonthlyInvoices(1); // 1 = system user
      
      console.log(`Generated ${invoices.length} invoices`);

      // Send emails
      let emailsSent = 0;
      for (const invoice of invoices) {
        try {
          await emailService.sendInvoiceEmail(invoice.invoice_id);
          emailsSent++;
        } catch (error) {
          console.error(`Error sending email for invoice ${invoice.invoice_id}:`, error.message);
        }
      }

      console.log(`Sent ${emailsSent} invoice emails`);

      // Log the operation
      await this.logCronExecution('invoice_generation', {
        invoices_generated: invoices.length,
        emails_sent: emailsSent
      });

    } catch (error) {
      console.error('Error in monthly invoice generation:', error);
      await this.logCronExecution('invoice_generation', { error: error.message }, 'failed');
    }
  }

  /**
   * Check and send payment reminders
   */
  async checkAndSendReminders() {
    try {
      console.log('Checking for reminders to send...');
      
      const config = await invoiceService.getBillingConfig();
      
      // Get scheduled reminders that are due
      const dueReminders = await query(
        `SELECT irs.*, i.client_id, i.invoice_number, i.amount_due
         FROM invoice_reminder_schedule irs
         JOIN invoice i ON irs.invoice_id = i.invoice_id
         WHERE irs.status = 'scheduled'
         AND irs.scheduled_for <= NOW()
         AND i.status IN ('unpaid', 'overdue')`
      );

      console.log(`Found ${dueReminders.length} reminders to send`);

      let remindersSent = 0;
      for (const reminder of dueReminders) {
        try {
          // Send reminder email
          const result = await emailService.sendReminderEmail(
            reminder.invoice_id,
            reminder.reminder_number
          );

          // Update reminder status
          await query(
            `UPDATE invoice_reminder_schedule 
             SET status = 'sent', sent_at = NOW(), mail_log_id = ?
             WHERE schedule_id = ?`,
            [result.mailLogId, reminder.schedule_id]
          );

          remindersSent++;

          // Schedule next reminder if not at max
          if (reminder.reminder_number < config.max_reminder_count) {
            const nextScheduledDate = new Date();
            nextScheduledDate.setDate(nextScheduledDate.getDate() + config.reminder_frequency_days);
            
            await query(
              `INSERT INTO invoice_reminder_schedule (invoice_id, reminder_number, scheduled_for)
               VALUES (?, ?, ?)`,
              [reminder.invoice_id, reminder.reminder_number + 1, nextScheduledDate]
            );
          }

        } catch (error) {
          console.error(`Error sending reminder ${reminder.schedule_id}:`, error.message);
          
          // Mark as skipped
          await query(
            'UPDATE invoice_reminder_schedule SET status = \'skipped\' WHERE schedule_id = ?',
            [reminder.schedule_id]
          );
        }
      }

      console.log(`Sent ${remindersSent} reminders`);

      await this.logCronExecution('reminder_check', {
        reminders_due: dueReminders.length,
        reminders_sent: remindersSent
      });

    } catch (error) {
      console.error('Error in reminder check:', error);
      await this.logCronExecution('reminder_check', { error: error.message }, 'failed');
    }
  }

  /**
   * Mark invoices as overdue
   */
  async markOverdueInvoices() {
    try {
      console.log('Checking for overdue invoices...');
      
      const overdueInvoices = await invoiceService.markOverdueInvoices();
      
      console.log(`Marked ${overdueInvoices.length} invoices as overdue`);

      // Send overdue notifications
      let notificationsSent = 0;
      for (const invoice of overdueInvoices) {
        try {
          // Check if we haven't already sent too many reminders
          const reminderCount = await query(
            `SELECT COUNT(*) as count FROM mail_log 
             WHERE invoice_id = ? AND email_type = 'payment_reminder'`,
            [invoice.invoice_id]
          );

          const config = await invoiceService.getBillingConfig();
          
          if (reminderCount[0].count < config.max_reminder_count) {
            await emailService.sendReminderEmail(invoice.invoice_id, reminderCount[0].count + 1);
            notificationsSent++;
          }
        } catch (error) {
          console.error(`Error sending overdue notification for ${invoice.invoice_id}:`, error.message);
        }
      }

      console.log(`Sent ${notificationsSent} overdue notifications`);

      await this.logCronExecution('overdue_marking', {
        invoices_marked: overdueInvoices.length,
        notifications_sent: notificationsSent
      });

    } catch (error) {
      console.error('Error in overdue marking:', error);
      await this.logCronExecution('overdue_marking', { error: error.message }, 'failed');
    }
  }

  /**
   * Mark stale in-progress documents as failed
   * Documents in "In-Progress" status for more than 1 hour are marked as "Failed"
   */
  async markStaleDocumentsAsFailed() {
    try {
      // Find documents that have been in progress for more than 1 hour
      const staleDocuments = await query(
        `SELECT process_id, original_filename, time_initiated, 
                TIMESTAMPDIFF(MINUTE, time_initiated, NOW()) as minutes_elapsed
         FROM document_processed
         WHERE processing_status = 'In-Progress'
         AND time_initiated < DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      );

      if (staleDocuments.length === 0) {
        return; // No stale documents
      }

      console.log(`Found ${staleDocuments.length} stale documents to mark as failed`);

      let markedCount = 0;
      for (const doc of staleDocuments) {
        try {
          // Update status to Failed
          await query(
            `UPDATE document_processed 
             SET processing_status = 'Failed',
                 time_finished = NOW()
             WHERE process_id = ?`,
            [doc.process_id]
          );

          console.log(`Marked document ${doc.process_id} (${doc.original_filename}) as Failed after ${doc.minutes_elapsed} minutes`);
          markedCount++;

        } catch (error) {
          console.error(`Error marking document ${doc.process_id} as failed:`, error.message);
        }
      }

      console.log(`Marked ${markedCount} stale documents as Failed`);

      await this.logCronExecution('stale_document_check', {
        stale_documents_found: staleDocuments.length,
        documents_marked_failed: markedCount
      });

    } catch (error) {
      console.error('Error in stale document check:', error);
      await this.logCronExecution('stale_document_check', { error: error.message }, 'failed');
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails() {
    try {
      const results = await emailService.retryFailedEmails();
      
      const successful = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'failed').length;

      if (results.length > 0) {
        console.log(`Email retry: ${successful} successful, ${failed} failed`);
      }

      await this.logCronExecution('email_retry', {
        total_retries: results.length,
        successful,
        failed
      });

    } catch (error) {
      console.error('Error in email retry:', error);
      await this.logCronExecution('email_retry', { error: error.message }, 'failed');
    }
  }

  /**
   * Log cron job execution
   */
  async logCronExecution(jobName, details = {}, status = 'success') {
    try {
      await query(
        `INSERT INTO cron_execution_log (job_name, execution_time, status, details)
         VALUES (?, NOW(), ?, ?)`,
        [jobName, status, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Error logging cron execution:', error.message);
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    console.log('Stopping all cron jobs...');
    Object.keys(this.jobs).forEach(jobName => {
      if (this.jobs[jobName]) {
        this.jobs[jobName].stop();
        console.log(`Stopped: ${jobName}`);
      }
    });
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return Object.keys(this.jobs).map(jobName => ({
      name: jobName,
      running: this.jobs[jobName] ? true : false
    }));
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(jobName) {
    switch (jobName) {
      case 'invoiceGeneration':
        return await this.generateMonthlyInvoices();
      case 'reminderCheck':
        return await this.checkAndSendReminders();
      case 'overdueMarking':
        return await this.markOverdueInvoices();
      case 'emailRetry':
        return await this.retryFailedEmails();
      case 'staleDocumentCheck':
        return await this.markStaleDocumentsAsFailed();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

// Create cron execution log table if it doesn't exist
async function ensureCronLogTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS cron_execution_log (
        log_id INT PRIMARY KEY AUTO_INCREMENT,
        job_name VARCHAR(50) NOT NULL,
        execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('success', 'failed') DEFAULT 'success',
        details JSON,
        INDEX idx_job_time (job_name, execution_time)
      )
    `);
  } catch (error) {
    console.error('Error creating cron log table:', error);
  }
}

// Initialize the table when module loads
ensureCronLogTable();

module.exports = new CronService();
