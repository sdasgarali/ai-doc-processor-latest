const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../config/database');
const invoiceService = require('./invoiceService');
const emailService = require('./emailService');

/**
 * Payment Service
 * Handles payment gateway integration (Stripe)
 */

class PaymentService {
  constructor() {
    this.stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
    if (this.stripeEnabled) {
      console.log('✅ Stripe payment gateway enabled');
    } else {
      console.log('⚠️  Stripe not configured - using test mode');
    }
  }

  /**
   * Create a payment intent for an invoice
   */
  async createPaymentIntent(invoiceId, clientIp = null) {
    try {
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('Invoice already paid');
      }

      // Get billing config
      const config = await invoiceService.getBillingConfig();

      // If Stripe is not enabled, return test payment intent
      if (!this.stripeEnabled) {
        return {
          clientSecret: 'test_client_secret_' + invoiceId,
          paymentIntentId: 'test_pi_' + invoiceId,
          amount: Math.round(parseFloat(invoice.amount_due) * 100),
          currency: config.currency.toLowerCase(),
          testMode: true
        };
      }

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(invoice.amount_due) * 100), // Convert to cents
        currency: config.currency.toLowerCase(),
        metadata: {
          invoice_id: invoice.invoice_id,
          invoice_number: invoice.invoice_number,
          client_id: invoice.client_id,
          client_name: invoice.client_name
        },
        description: `Invoice ${invoice.invoice_number} - ${config.company_name}`,
        receipt_email: invoice.client_email,
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Log the payment intent creation
      await query(
        `INSERT INTO payment_transaction (
          invoice_id, payment_link, amount, currency, status, 
          gateway_transaction_id, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          invoice.invoice_id,
          invoice.payment_link,
          invoice.amount_due,
          config.currency,
          'initiated',
          paymentIntent.id,
          clientIp
        ]
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        testMode: false
      };

    } catch (error) {
      console.error('Create payment intent error:', error);
      throw error;
    }
  }

  /**
   * Confirm a payment
   */
  async confirmPayment(paymentIntentId, paymentMethodId = null) {
    try {
      // Test mode - simulate successful payment
      if (!this.stripeEnabled) {
        return {
          success: true,
          status: 'succeeded',
          testMode: true
        };
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // If payment method provided, confirm the payment
      if (paymentMethodId && paymentIntent.status === 'requires_payment_method') {
        await stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethodId
        });
      }

      return {
        success: paymentIntent.status === 'succeeded',
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        testMode: false
      };

    } catch (error) {
      console.error('Confirm payment error:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event) {
    try {
      console.log('Processing Stripe webhook:', event.type);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };

    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    try {
      const invoiceId = paymentIntent.metadata.invoice_id;
      
      if (!invoiceId) {
        console.error('No invoice_id in payment intent metadata');
        return;
      }

      console.log(`Payment successful for invoice: ${invoiceId}`);

      // Update transaction
      await query(
        `UPDATE payment_transaction 
         SET status = 'success', completed_at = NOW(), 
             payment_method = ?, gateway_response = ?
         WHERE gateway_transaction_id = ?`,
        [
          paymentIntent.payment_method,
          JSON.stringify(paymentIntent),
          paymentIntent.id
        ]
      );

      // Update invoice status
      await invoiceService.updateInvoiceStatus(invoiceId, 'paid', {
        payment_method: 'stripe',
        payment_transaction_id: paymentIntent.id
      });

      // Send payment confirmation email
      try {
        await emailService.sendPaymentReceivedEmail(invoiceId);
      } catch (emailError) {
        console.error('Error sending payment confirmation:', emailError);
      }

      // Cancel any scheduled reminders
      await query(
        `UPDATE invoice_reminder_schedule 
         SET status = 'cancelled' 
         WHERE invoice_id = ? AND status = 'scheduled'`,
        [invoiceId]
      );

      console.log(`Invoice ${invoiceId} marked as paid`);

    } catch (error) {
      console.error('Handle payment success error:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailure(paymentIntent) {
    try {
      const invoiceId = paymentIntent.metadata.invoice_id;
      
      if (!invoiceId) {
        console.error('No invoice_id in payment intent metadata');
        return;
      }

      console.log(`Payment failed for invoice: ${invoiceId}`);

      // Update transaction
      await query(
        `UPDATE payment_transaction 
         SET status = 'failed', 
             error_message = ?,
             gateway_response = ?
         WHERE gateway_transaction_id = ?`,
        [
          paymentIntent.last_payment_error?.message || 'Payment failed',
          JSON.stringify(paymentIntent),
          paymentIntent.id
        ]
      );

    } catch (error) {
      console.error('Handle payment failure error:', error);
      throw error;
    }
  }

  /**
   * Handle canceled payment
   */
  async handlePaymentCanceled(paymentIntent) {
    try {
      const invoiceId = paymentIntent.metadata.invoice_id;
      
      if (!invoiceId) {
        return;
      }

      console.log(`Payment canceled for invoice: ${invoiceId}`);

      // Update transaction
      await query(
        `UPDATE payment_transaction 
         SET status = 'failed', 
             error_message = 'Payment canceled by user'
         WHERE gateway_transaction_id = ?`,
        [paymentIntent.id]
      );

    } catch (error) {
      console.error('Handle payment canceled error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.stripeEnabled) {
      return true; // Skip verification in test mode
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Create a refund
   */
  async createRefund(invoiceId, amount = null, reason = 'requested_by_customer') {
    try {
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      
      if (!invoice || invoice.status !== 'paid') {
        throw new Error('Invoice not found or not paid');
      }

      // Test mode
      if (!this.stripeEnabled) {
        return {
          refundId: 'test_refund_' + invoiceId,
          amount: amount || invoice.amount_due,
          status: 'succeeded',
          testMode: true
        };
      }

      // Get the payment transaction
      const transactions = await query(
        `SELECT * FROM payment_transaction 
         WHERE invoice_id = ? AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1`,
        [invoiceId]
      );

      if (transactions.length === 0) {
        throw new Error('No successful payment transaction found');
      }

      const transaction = transactions[0];

      // Create refund in Stripe
      const refund = await stripe.refunds.create({
        payment_intent: transaction.gateway_transaction_id,
        amount: amount ? Math.round(parseFloat(amount) * 100) : undefined,
        reason: reason
      });

      // Log refund transaction
      await query(
        `INSERT INTO payment_transaction (
          invoice_id, payment_link, amount, currency, status, 
          payment_method, gateway_transaction_id, gateway_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          invoice.payment_link,
          refund.amount / 100,
          refund.currency.toUpperCase(),
          'refunded',
          'stripe_refund',
          refund.id,
          JSON.stringify(refund)
        ]
      );

      // Update invoice status if full refund
      if (!amount || parseFloat(amount) >= parseFloat(invoice.amount_due)) {
        await query(
          'UPDATE invoice SET status = ?, notes = CONCAT(COALESCE(notes, ""), "\nRefunded on ", NOW()) WHERE invoice_id = ?',
          ['cancelled', invoiceId]
        );
      }

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        testMode: false
      };

    } catch (error) {
      console.error('Create refund error:', error);
      throw error;
    }
  }

  /**
   * Get payment methods for a customer
   */
  async getPaymentMethods(customerId) {
    if (!this.stripeEnabled) {
      return [];
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Get payment methods error:', error);
      return [];
    }
  }

  /**
   * Create or retrieve Stripe customer
   */
  async getOrCreateCustomer(clientId) {
    if (!this.stripeEnabled) {
      return { id: 'test_customer_' + clientId, testMode: true };
    }

    try {
      // Check if customer already exists in database
      const results = await query(
        'SELECT stripe_customer_id FROM client WHERE client_id = ?',
        [clientId]
      );

      if (results.length > 0 && results[0].stripe_customer_id) {
        return { id: results[0].stripe_customer_id, testMode: false };
      }

      // Get client details
      const clients = await query(
        'SELECT * FROM client WHERE client_id = ?',
        [clientId]
      );

      if (clients.length === 0) {
        throw new Error('Client not found');
      }

      const client = clients[0];

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: client.email,
        name: client.client_name,
        metadata: {
          client_id: client.client_id
        }
      });

      // Save customer ID
      await query(
        'UPDATE client SET stripe_customer_id = ? WHERE client_id = ?',
        [customer.id, clientId]
      );

      return { id: customer.id, testMode: false };

    } catch (error) {
      console.error('Get or create customer error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
