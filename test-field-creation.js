const axios = require('axios');

async function testFieldCreation() {
  try {
    // First login to get token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    
    // Test field creation
    const fieldData = {
      field_name: 'test_field_' + Date.now(),
      field_display_name: 'Test Field',
      field_type: 'string', // ENUM: string, number, date, boolean
      doc_category: 1, // EOB category
      is_required: false,
      default_value: null,
      validation_regex: null,
      keywords: ['test', 'field']
    };
    
    console.log('Attempting to create field with data:', JSON.stringify(fieldData, null, 2));
    
    const fieldResponse = await axios.post(
      'http://localhost:5000/api/admin/fields',
      fieldData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('✓ Field created successfully!');
    console.log('Response:', JSON.stringify(fieldResponse.data, null, 2));
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testFieldCreation();
