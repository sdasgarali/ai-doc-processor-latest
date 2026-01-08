const axios = require('axios');

async function testModelAPI() {
  try {
    // First login to get token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    
    // Test model-versions endpoint
    const modelResponse = await axios.get('http://localhost:5000/api/admin/model-versions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Model API working!');
    console.log('Models found:', modelResponse.data.data.length);
    console.log('Models:', JSON.stringify(modelResponse.data.data, null, 2));
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Backend server is not running on port 5000!');
    }
  }
}

testModelAPI();
