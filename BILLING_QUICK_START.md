# Billing Module - Quick Start Guide

## 🚀 Fast Setup (5 Minutes)

### Step 1: Run Setup Script
```bash
node setup-billing-module.js
```

This will automatically:
- Install all required npm packages
- Update .env with billing configuration
- Create necessary directories
- Offer to run database migration

### Step 2: Manual Installation (Alternative)

If you prefer manual setup:

```bash
# Install dependencies
npm install uuid pdfkit nodemailer stripe node-cron

# Run database migration
mysql -u root -p eob_extraction < database/billing_invoice_schema.sql

# Create invoices directory
mkdir invoices
```

### Step 3: Configure Environment

Add to your `.env` file:

```env
# Billing Module
APP_URL=http://localhost:3000

# SMTP (for testing, these will be auto-created)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# For Production: Use real SMTP
# SMTP_HOST=smtp.gmail.com
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

### Step 4: Restart Server

```bash
npm start
```

## ✅ Verify Installation

### Test API Endpoints

```bash
# Get billing configuration (requires admin token)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5000/api/billing/config

# Expected response:
{
  "success": true,
  "data": {
    "config_id": 1,
    "system_mailer": "ali.aitechs@gmail.com",
    "invoice_date_day": 1,
    ...
  }
}
```

### Check Database Tables

```sql
-- Verify tables were created
SHOW TABLES LIKE '%invoice%';
SHOW TABLES LIKE '%billing%';

-- Check default configuration
SELECT * FROM billing_configuration;
```

## 🎯 Quick Usage Examples

### Generate Monthly Invoices

```bash
POST /api/billing/invoices/generate
Authorization: Bearer YOUR_ADMIN_TOKEN

# This will:
# 1. Calculate usage for all clients
# 2. Generate invoices
# 3. Send email notifications
```

### View All Invoices

```bash
GET /api/billing/invoices?status=unpaid
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Download Invoice PDF

```bash
GET /api/billing/invoices/:invoiceId/pdf
Authorization: Bearer YOUR_TOKEN
```

### Process Payment (Public)

```bash
POST /api/billing/payment/:paymentLink
Content-Type: application/json

{
  "payment_method_id": "manual",
  "amount": 150.00
}
```

## 📧 Email Configuration

### For Testing (No Configuration Needed)
The system will automatically use Ethereal Email for testing. Check console logs for preview URLs.

### For Production (Gmail Example)

1. Enable 2-Factor Authentication on your Google Account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Update .env:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

## 🔧 Configuration via Admin Panel

Once frontend components are built:

1. Login as admin
2. Navigate to **Admin → Billing Configuration**
3. Set:
   - System mailer email
   - Invoice generation day (1-28)
   - Due date day
   - Reminder frequency
   - Tax rate
   - Company details

## 📊 Available Reports

### Revenue Summary
```bash
GET /api/billing/reports/revenue
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Invoice Summary
```bash
GET /api/billing/reports/summary?month=2025-01
Authorization: Bearer YOUR_ADMIN_TOKEN
```

## 🐛 Troubleshooting

### Issue: Database migration fails
```bash
# Check MySQL credentials
mysql -u root -p

# Run migration manually
mysql -u root -p eob_extraction < database/billing_invoice_schema.sql
```

### Issue: Email not sending
- Check SMTP settings in .env
- Look for Ethereal preview URL in console (for testing)
- Check mail_log table for error messages:
```sql
SELECT * FROM mail_log WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;
```

### Issue: Invoice PDF not generating
- Check if 'invoices' directory exists and is writable
- Check server logs for pdfkit errors
- Verify pdfkit package is installed: `npm list pdfkit`

## 🔐 Security Notes

- Payment links are UUID-based and expire after 90 days
- All admin endpoints require authentication
- Client users can only view their own invoices
- Payment transactions are logged with IP addresses
- Email retries are limited to prevent spam

## 📝 Next Steps

1. **Install Frontend Components** (Phase 2)
   - Billing Configuration UI
   - Invoice Management UI
   - Payment Page

2. **Set Up Cron Jobs** (Phase 2)
   - Monthly invoice generation
   - Daily reminder checks
   - Email retry processor

3. **Integrate Payment Gateway** (Phase 2)
   - Stripe integration
   - Webhook handling
   - Real payment processing

4. **Testing**
   - Create test invoices
   - Test email delivery
   - Test payment flow

## 📚 Documentation

- **Full Guide**: `BILLING_MODULE_IMPLEMENTATION.md`
- **API Endpoints**: `routes/billing.js` (with comments)
- **Database Schema**: `database/billing_invoice_schema.sql`
- **Services**: 
  - `services/invoiceService.js`
  - `services/emailService.js`

## 💬 Support

For issues or questions:
1. Check the full implementation guide
2. Review API endpoint documentation
3. Check mail_log and payment_transaction tables
4. Enable debug logging in services

---

**Status**: Backend Ready ✅  
**Next**: Frontend Components & Automation  
**Estimated Setup Time**: 5-10 minutes
