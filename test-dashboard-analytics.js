const axios = require('axios');
require('dotenv').config();

async function testDashboardAnalytics() {
  try {
    console.log('🔍 Testing Dashboard Analytics Endpoint\n');
    console.log('=' .repeat(80));
    
    // First, login to get a token
    console.log('\n1. Logging in to get authentication token...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Now test the analytics endpoint
    console.log('\n2. Fetching dashboard analytics...');
    const analyticsResponse = await axios.get('http://localhost:5000/api/admin/dashboard/analytics', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Analytics fetched successfully\n');
    console.log('=' .repeat(80));
    console.log('\n📊 Analytics Data:');
    console.log(JSON.stringify(analyticsResponse.data, null, 2));
    console.log('\n=' .repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error occurred:\n');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error Message:', error.message);
    }
    
    console.error('\nFull Error:', error);
  }
}

// Run the test
testDashboardAnalytics()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
