const axios = require('axios');

async function testDocumentsAPI() {
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful\n');
    
    // Test GET documents without filters
    console.log('Testing GET /api/documents (no filters)...');
    try {
      const response1 = await axios.get('http://localhost:5000/api/documents?page=1&limit=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✓ GET documents successful');
      console.log('Number of documents:', response1.data.data?.length || 0);
      if (response1.data.data && response1.data.data.length > 0) {
        console.log('Sample document columns:', Object.keys(response1.data.data[0]));
      }
    } catch (err) {
      console.error('✗ Error without filters:', err.response?.data || err.message);
    }
    
    // Test with status filter
    console.log('\nTesting GET /api/documents with status filter...');
    try {
      const response2 = await axios.get('http://localhost:5000/api/documents?page=1&limit=10&status=Processed', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✓ GET documents with filter successful');
      console.log('Number of documents:', response2.data.data?.length || 0);
    } catch (err) {
      console.error('✗ Error with status filter:', err.response?.data || err.message);
      if (err.response) {
        console.error('Status:', err.response.status);
      }
    }
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testDocumentsAPI();
