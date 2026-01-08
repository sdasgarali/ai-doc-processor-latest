# Billing & Invoice Module Implementation Guide

## Overview
Complete implementation plan for the Billing & Invoice Module in the EOB Extraction System.

## Implementation Status

### ✅ Completed Components

#### 1. Database Schema (`database/billing_invoice_schema.sql`)
- client_usage table - tracks monthly usage per client
- invoice table - stores all invoice records with UUID primary keys
- billing_configuration table - system-wide billing settings
- mail_log table - tracks all outgoing emails with retry logic
- payment_transaction table - logs payment attempts and transactions
- invoice_reminder_schedule table - manages reminder scheduling
- Views: invoice_summary, monthly_revenue
- Stored Procedure: calculate_client_usage

#### 2. Backend Services
- **invoiceService.js** - Complete invoice generation and management
  - Generate monthly invoices
  - Calculate client usage from document_processed table
  - Create invoice PDFs
  - Manage invoice status
  - Payment link generation

- **emailService.js** - Complete email handling with retry logic
  - Send invoice emails with PDF attachments
  - Send payment reminders
  - Send payment confirmation emails
  - Automatic retry mechanism for failed emails
  - HTML email templates

### 📋 Remaining Components

#### 3. Backend Routes (`routes/billing.js`) - TO DO
Create API endpoints for:
- GET /api/billing/config - Get billing configuration
- PUT /api/billing/config - Update billing configuration
- POST /api/billing/invoices/generate - Generate monthly invoices
- GET /api/billing/invoices - List all invoices with filters
- GET /api/billing/invoices/:id - Get specific invoice
- PUT /api/billing/invoices/:id - Update invoice
- POST /api/billing/invoices/:id/send - Send/resend invoice email
- GET /api/billing/invoices/:id/pdf - Download invoice PDF
- GET /api/billing/payment/:paymentLink - Validate and display payment page
- POST /api/billing/payment/:paymentLink - Process payment
- POST /api/billing/reminders/send - Manually trigger reminders
- GET /api/billing/mail-logs - View email logs
- POST /api/billing/mail-logs/:id/retry - Retry failed email

#### 4. Payment Integration Service (`services/paymentService.js`) - TO DO
Implement payment gateway integration:
- Stripe integration for credit card payments
- Generate payment intent
- Handle payment webhooks
- Process payment callbacks
- Refund handling

#### 5. Cron Jobs / Scheduled Tasks - TO DO
Create automated tasks:
- Monthly invoice generation (1st of each month)
- Daily reminder checking and sending
- Daily overdue invoice marking
- Email retry processor (every 30 minutes)

Implementation files needed:
- `services/cronService.js` - Cron job management
- `services/reminderService.js` - Reminder scheduling logic

#### 6. Frontend Components - TO DO

**Admin Panel Pages:**
- `client/src/pages/Admin/BillingConfiguration.js`
  - Configure system mailer
  - Set invoice dates and due dates
  - Configure reminder settings
  - Manage payment gateway settings

- `client/src/pages/Admin/InvoiceManagement.js`
  - View all invoices
  - Filter by status, client, month
  - Generate invoices manually
  - Send/resend invoice emails
  - Download invoice PDFs
  - Mark as paid manually

- `client/src/pages/Admin/MailLogs.js`
  - View all sent emails
  - Retry failed emails
  - View email content

**Client Pages:**
- `client/src/pages/Client/MyInvoices.js`
  - View client's own invoices
  - Download PDFs
  - Pay invoices online

- `client/src/pages/Payment/PaymentPage.js`
  - Public payment page (accessible via payment link)
  - Display invoice details
  - Payment form integration
  - Payment confirmation

#### 7. Required npm Packages - TO DO
Install additional packages:
```bash
npm install uuid pdfkit nodemailer stripe node-cron
```

#### 8. Environment Variables - TO DO
Add to `.env`:
```
# Billing Configuration
APP_URL=http://localhost:3000

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Payment Gateway
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 9. Database Migrations - TO DO
Run the schema:
```bash
mysql -u root -p eob_extraction < database/billing_invoice_schema.sql
```

#### 10. Testing Files - TO DO
Create test scripts:
- `test-billing-api.js` - Test invoice generation
- `test-email-service.js` - Test email sending
- `test-payment-flow.js` - Test payment processing

## Implementation Priority

### Phase 1 (High Priority)
1. ✅ Database schema
2. ✅ Invoice service
3. ✅ Email service
4. ⏳ Backend routes
5. ⏳ Install required packages

### Phase 2 (Medium Priority)
6. Payment service integration
7. Admin frontend - Billing Configuration
8. Admin frontend - Invoice Management
9. Cron jobs setup

### Phase 3 (Low Priority)
10. Client frontend - My Invoices
11. Public payment page
12. Mail logs UI
13. Comprehensive testing

## Quick Start Commands

### 1. Install Dependencies
```bash
npm install uuid pdfkit nodemailer stripe node-cron
```

### 2. Run Database Schema
```bash
mysql -u root -p eob_extraction < database/billing_invoice_schema.sql
```

### 3. Configure Environment
Add SMTP and Stripe keys to `.env` file

### 4. Start Server
The server will automatically load the new services when restarted

## API Endpoint Examples

### Generate Monthly Invoices
```http
POST /api/billing/invoices/generate
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "message": "Generated 5 invoices",
  "invoices": [...]
}
```

### Get All Invoices
```http
GET /api/billing/invoices?status=unpaid&month=2025-01
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": [
    {
      "invoice_id": "uuid",
      "invoice_number": "INV-2025-001",
      "client_name": "ABC Corp",
      "amount_due": 150.00,
      "status": "unpaid",
      ...
    }
  ]
}
```

### Process Payment
```http
POST /api/billing/payment/:paymentLink
Content-Type: application/json

{
  "payment_method_id": "pm_...",
  "amount": 150.00
}

Response:
{
  "success": true,
  "message": "Payment successful",
  "invoice_id": "uuid"
}
```

## Integration Points

### 1. Document Processing
- After document processing, costs are tracked in `document_processed.total_cost`
- Usage calculation aggregates from this table

### 2. User Authentication
- Admin users can manage all billing
- Client users can only view their own invoices
- Payment page is publicly accessible via payment link

### 3. Email Notifications
- Uses existing email configuration
- Falls back to Ethereal for testing

### 4. Permissions
- Add new permissions: 'billing:view', 'billing:manage', 'billing:configure'
- Integrate with existing permission system

## Security Considerations

1. **Payment Links**: UUID-based, time-limited, single-use
2. **PDF Storage**: Stored outside public directory
3. **Email Security**: SMTP authentication required
4. **Payment Gateway**: Server-side validation only
5. **Admin Access**: Role-based access control

## Testing Strategy

### Unit Tests
- Invoice calculation logic
- Email template generation
- Payment link validation

### Integration Tests
- End-to-end invoice generation
- Email sending with SMTP
- Payment processing flow

### Manual Testing Checklist
- [ ] Generate invoices for multiple clients
- [ ] Send invoice emails
- [ ] Receive and verify email
- [ ] Access payment page via link
- [ ] Process test payment
- [ ] Verify payment confirmation email
- [ ] Test reminder scheduling
- [ ] Test overdue marking
- [ ] Test email retry logic

## Monitoring & Logging

### Key Metrics to Track
- Invoices generated per month
- Payment success rate
- Email delivery rate
- Average payment time
- Outstanding balance

### Log Files
- Invoice generation logs
- Email sending logs
- Payment transaction logs
- Cron job execution logs

## Next Steps

1. Create `routes/billing.js` with all API endpoints
2. Install required npm packages
3. Run database migration
4. Create frontend admin components
5. Set up cron jobs
6. Integrate payment gateway
7. Test complete flow
8. Deploy to production

## Support & Documentation

For questions or issues:
- Review this implementation guide
- Check service method documentation
- Test with sample data first
- Monitor logs for errors

---

**Status**: Phase 1 Complete (Database + Core Services)
**Next Action**: Create backend routes (routes/billing.js)
**Estimated Time to Complete**: 4-6 hours for remaining components
