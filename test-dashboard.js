const axios = require('axios');

async function testDashboard() {
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful\n');
    
    // Test GET dashboard analytics
    console.log('Testing GET /api/admin/dashboard/analytics...');
    const response = await axios.get('http://localhost:5000/api/admin/dashboard/analytics', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Dashboard analytics successful\n');
    console.log('Analytics Data:');
    console.log('===============');
    console.log('Totals:', response.data.data.totals);
    console.log('\nUser Stats:', response.data.data.userStats);
    console.log('\nClient Stats:', response.data.data.clientStats);
    console.log('\nRecent Users:', response.data.data.recent.users.length);
    console.log('Recent Clients:', response.data.data.recent.clients.length);
    console.log('\nFields by Category:', response.data.data.fieldsByCategory);
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testDashboard();
