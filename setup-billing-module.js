/**
 * Billing Module Setup Script
 * Automates the installation and configuration of the Billing & Invoice Module
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 ${description}...`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr && !stderr.includes('npm WARN')) {
        console.log(stderr);
      }
      if (stdout) {
        console.log(stdout);
      }
      console.log(`✅ ${description} completed`);
      resolve();
    });
  });
}

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function updateEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const envExists = await checkFileExists(envPath);
  
  if (!envExists) {
    console.log('❌ .env file not found. Please create one first.');
    return;
  }

  console.log('\n📝 Updating .env file with billing configuration...');
  
  const envContent = await fs.promises.readFile(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  // Check if billing config already exists
  const hasBillingConfig = lines.some(line => line.includes('APP_URL'));
  
  if (!hasBillingConfig) {
    const billingConfig = `
# Billing Module Configuration
APP_URL=http://localhost:3000

# SMTP Configuration (for sending invoice emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Payment Gateway (Optional - for Stripe integration)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
`;
    
    await fs.promises.appendFile(envPath, billingConfig);
    console.log('✅ Billing configuration added to .env file');
    console.log('⚠️  Please update SMTP settings in .env file before sending emails');
  } else {
    console.log('ℹ️  Billing configuration already exists in .env');
  }
}

async function runDatabaseMigration() {
  console.log('\n🗄️  Running database migration...');
  
  const answer = await question('Do you want to run the database migration now? (y/n): ');
  
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbName = process.env.DB_NAME || 'eob_extraction';
    
    const password = await question(`Enter MySQL password for ${dbUser}@${dbHost}: `);
    
    const command = `mysql -h ${dbHost} -u ${dbUser} -p${password} ${dbName} < database/billing_invoice_schema.sql`;
    const permissionsCommand = `mysql -h ${dbHost} -u ${dbUser} -p${password} ${dbName} < database/add_billing_permissions.sql`;
    
    try {
      await executeCommand(command, 'Applying database schema');
      console.log('✅ Database migration completed successfully');
      
      await executeCommand(permissionsCommand, 'Adding billing permissions');
      console.log('✅ Billing permissions added successfully');
    } catch (error) {
      console.log('❌ Database migration failed. You can run it manually later using:');
      console.log(`   mysql -u ${dbUser} -p ${dbName} < database/billing_invoice_schema.sql`);
    }
  } else {
    console.log('⏭️  Skipping database migration. Run it manually later using:');
    console.log('   mysql -u root -p eob_extraction < database/billing_invoice_schema.sql');
  }
}

async function createDirectories() {
  console.log('\n📁 Creating required directories...');
  
  const dirs = [
    path.join(__dirname, 'invoices'),
  ];
  
  for (const dir of dirs) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      console.log(`✅ Created directory: ${path.basename(dir)}`);
    } catch (error) {
      console.log(`ℹ️  Directory already exists: ${path.basename(dir)}`);
    }
  }
}

async function displayNextSteps() {
  console.log('\n' + '='.repeat(70));
  console.log('🎉 BILLING MODULE SETUP COMPLETE!');
  console.log('='.repeat(70));
  
  console.log('\n📋 NEXT STEPS:');
  console.log('\n1. Configure SMTP Settings:');
  console.log('   - Edit .env file');
  console.log('   - Set SMTP_HOST, SMTP_USER, SMTP_PASS');
  console.log('   - For Gmail: Enable 2FA and create an App Password');
  
  console.log('\n2. Configure Payment Gateway (Optional):');
  console.log('   - Sign up for Stripe: https://stripe.com');
  console.log('   - Get API keys from Stripe Dashboard');
  console.log('   - Add STRIPE_SECRET_KEY to .env');
  
  console.log('\n3. Test the Installation:');
  console.log('   - Restart the server: npm start');
  console.log('   - Test API: GET http://localhost:5000/api/billing/config');
  console.log('   - Check if billing routes are accessible');
  
  console.log('\n4. Access Admin Panel:');
  console.log('   - Login as admin/superadmin');
  console.log('   - Navigate to Billing Configuration');
  console.log('   - Set up billing parameters');
  
  console.log('\n5. Generate First Invoice:');
  console.log('   - POST http://localhost:5000/api/billing/invoices/generate');
  console.log('   - Or use the Admin Panel UI');
  
  console.log('\n📚 Documentation:');
  console.log('   - Read BILLING_MODULE_IMPLEMENTATION.md for detailed guide');
  console.log('   - API endpoints documentation in routes/billing.js');
  
  console.log('\n💡 Tips:');
  console.log('   - Use Ethereal Email for testing (no SMTP config needed)');
  console.log('   - Set up cron jobs for automated invoice generation');
  console.log('   - Monitor mail_log table for email status');
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  EOB EXTRACTION SYSTEM - BILLING MODULE SETUP                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  
  console.log('\nThis script will:');
  console.log('  1. Install required npm packages');
  console.log('  2. Update .env configuration');
  console.log('  3. Create necessary directories');
  console.log('  4. Run database migration');
  console.log('  5. Display next steps');
  
  const proceed = await question('\nDo you want to continue? (y/n): ');
  
  if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
    console.log('Setup cancelled.');
    rl.close();
    process.exit(0);
  }
  
  try {
    // Step 1: Install dependencies
    await executeCommand(
      'npm install uuid pdfkit nodemailer stripe node-cron',
      'Installing npm packages'
    );
    
    // Step 2: Update .env
    await updateEnvFile();
    
    // Step 3: Create directories
    await createDirectories();
    
    // Step 4: Database migration
    await runDatabaseMigration();
    
    // Step 5: Display next steps
    await displayNextSteps();
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\nPlease resolve the error and run the script again.');
  } finally {
    rl.close();
  }
}

// Run the setup
main().catch(error => {
  console.error('Setup error:', error);
  process.exit(1);
});
