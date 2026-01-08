const axios = require('axios');

async function testUserAPI() {
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful\n');
    
    // Test GET users
    console.log('Testing GET /api/admin/users...');
    const getResponse = await axios.get('http://localhost:5000/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ GET users successful');
    console.log('Number of users:', getResponse.data.data?.length || 0);
    console.log('\nSample user:', JSON.stringify(getResponse.data.data[0], null, 2));
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testUserAPI();
