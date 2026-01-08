const axios = require('axios');

async function testClientAPI() {
  try {
    // First login to get token
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful\n');
    
    // Test GET clients
    console.log('Testing GET /api/admin/clients...');
    const getResponse = await axios.get('http://localhost:5000/api/admin/clients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ GET clients successful');
    console.log('Response:', JSON.stringify(getResponse.data, null, 2));
    console.log('\nNumber of clients:', getResponse.data.data?.length || 0);
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testClientAPI();
