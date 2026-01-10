// Create test client and test user for UAT
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://hzzsunmbnhjfgbloyaan.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enN1bm1ibmhqZmdibG95YWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjA0MDcsImV4cCI6MjA4MzYzNjQwN30.s4ST0UNO3gBGs8xFe1kEvR_Ts5wc930wugQrWTKq1R4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user credentials
// Using existing Demo Client (client_id: 7)
const DEMO_CLIENT_ID = 7;

const TEST_USER = {
  email: 'testclient@docuparse.com',
  password: 'TestClient123!',
  first_name: 'Test',
  last_name: 'Client',
  user_role: 'client',
  is_active: true,
  timezone: 'UTC'
};

async function createTestUser() {
  console.log('Creating test client user for UAT...\n');

  try {
    // Use the existing Demo Client (ID: 7)
    const clientId = DEMO_CLIENT_ID;

    // Verify the client exists
    const { data: clientData, error: clientError } = await supabase
      .from('client')
      .select('client_id, client_name')
      .eq('client_id', clientId)
      .single();

    if (clientError || !clientData) {
      console.error('Demo Client not found. Please ensure client_id 7 exists.');
      return;
    }

    console.log(`Using existing client: ${clientData.client_name} (ID: ${clientData.client_id})`)

    // Step 2: Create or update test user
    // Check if test user exists
    const { data: existingUser, error: userSelectError } = await supabase
      .from('user_profile')
      .select('userid')
      .eq('email', TEST_USER.email);

    if (userSelectError) {
      console.error('Error checking for existing user:', userSelectError.message);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);

    if (existingUser && existingUser.length > 0) {
      // Update existing user
      const { error: userUpdateError } = await supabase
        .from('user_profile')
        .update({
          password: hashedPassword,
          first_name: TEST_USER.first_name,
          last_name: TEST_USER.last_name,
          user_role: TEST_USER.user_role,
          client_id: clientId,
          is_active: TEST_USER.is_active,
          timezone: TEST_USER.timezone
        })
        .eq('userid', existingUser[0].userid);

      if (userUpdateError) {
        console.error('Error updating test user:', userUpdateError.message);
        return;
      }

      console.log(`Updated existing test user (ID: ${existingUser[0].userid})`);
    } else {
      // Create new user
      const { data: newUser, error: userInsertError } = await supabase
        .from('user_profile')
        .insert({
          email: TEST_USER.email,
          password: hashedPassword,
          first_name: TEST_USER.first_name,
          last_name: TEST_USER.last_name,
          user_role: TEST_USER.user_role,
          client_id: clientId,
          is_active: TEST_USER.is_active,
          timezone: TEST_USER.timezone
        })
        .select('userid')
        .single();

      if (userInsertError) {
        console.error('Error creating test user:', userInsertError.message);
        return;
      }

      console.log(`Created new test user (ID: ${newUser.userid})`);
    }

    console.log('\n=== Test User Credentials ===');
    console.log(`Client Name: Demo Client`);
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log(`Role: ${TEST_USER.user_role}`);
    console.log('\nUse these credentials to log in at https://docuparse.vercel.app/login');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createTestUser().catch(console.error);
