# Email Setup Guide

## Current Status

Emails are currently being sent to **Ethereal Email** (test mode) which is why you can see them in the preview URLs but they don't arrive in real inboxes.

## Setting Up Real Gmail Email Delivery

### Step 1: Create Gmail App Password

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Enable 2-Step Verification** (if not already enabled):
   - Go to Security → 2-Step Verification
   - Follow the prompts to enable it

3. **Create an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Or navigate: Security → 2-Step Verification → App passwords
   - Select "Mail" and "Windows Computer" (or "Other")
   - Click "Generate"
   - **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### Step 2: Update .env File

Open your `.env` file and uncomment/update the SMTP settings:

```env
# SMTP Configuration (for sending invoice emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password-here
```

**Important:**
- Replace `your-email@gmail.com` with your actual Gmail address
- Replace `your-16-char-app-password-here` with the App Password you generated (remove spaces)
- Do NOT use your regular Gmail password - use the App Password

### Step 3: Restart the Server

After updating .env, restart your server:
```bash
# Stop the current server (Ctrl+C)
npm run dev
```

### Step 4: Test Email Delivery

Run the test script to verify emails are being sent to real inboxes:
```bash
node test-email-sending.js
```

You should now see emails delivered to the actual email addresses instead of Ethereal.

## Troubleshooting

### Issue: "Invalid login: 535 Username and Password not accepted"

**Solutions:**
1. Make sure you're using the App Password, not your regular password
2. Ensure 2-Step Verification is enabled on your Google Account
3. Remove any spaces from the App Password in .env
4. Try generating a new App Password

### Issue: Emails still going to Ethereal

**Solution:**
- Make sure SMTP_HOST is uncommented in .env
- Restart the server after changing .env
- Check that all SMTP settings are properly configured

### Issue: "Less secure app access" error

**Solution:**
- This is an old error message. Google now requires App Passwords
- Follow Step 1 to create an App Password
- Do NOT enable "Less secure app access" (deprecated by Google)

## Email Configuration in Admin Panel

Once Gmail is configured, you can also update email settings in the Admin Panel:

1. Go to **Admin Panel → Billing Configuration**
2. Update:
   - **System Mailer**: your-email@gmail.com
   - **System Mailer Name**: Universal Document Processing System (or your company name)
3. Save changes

## Testing Email Types

The system sends three types of emails:

1. **Invoice Generated** - Sent when new invoices are created
2. **Payment Reminder** - Sent for overdue invoices  
3. **Payment Received** - Sent when payment is confirmed

All will use your Gmail configuration once SMTP is properly set up.

## Production Recommendations

For production use, consider:

1. **Dedicated Email Service**: Use services like SendGrid, Mailgun, or AWS SES for better deliverability
2. **Email Limits**: Gmail has sending limits (500 emails/day for free accounts)
3. **Domain Email**: Use your own domain email for professional appearance
4. **Email Tracking**: Consider services that provide open/click tracking

## Alternative: SendGrid Setup

If you prefer SendGrid over Gmail:

1. Sign up at https://sendgrid.com/
2. Create an API key
3. Update .env:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## Support

If you continue to have issues:
- Check server logs for detailed error messages
- Verify your Gmail account settings
- Ensure your network allows SMTP connections
- Try with a different Gmail account
