const axios = require('axios');

(async () => {
  try {
    // Login first
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@eobsystem.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    console.log('Login OK');

    // Fetch document metadata for process_id=116
    const docRes = await axios.get('http://localhost:5000/api/documents/116', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('\nDocument metadata:');
    console.log(JSON.stringify(docRes.data, null, 2));

    // Check if processing_status is exactly 'Processed'
    const status = docRes.data.data?.processing_status;
    console.log('\nprocessing_status:', JSON.stringify(status));
    console.log('Is Processed:', status === 'Processed');
    console.log('doc_category:', docRes.data.data?.doc_category);
    console.log('doc_category type:', typeof docRes.data.data?.doc_category);

    // Now fetch extracted-data
    console.log('\n--- Fetching extracted-data ---');
    const dataRes = await axios.get('http://localhost:5000/api/documents/116/extracted-data', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Extracted data success:', dataRes.data.success);
    console.log('Records count:', dataRes.data.data?.length || 0);
    if (dataRes.data.data?.length > 0) {
      console.log('First record keys:', Object.keys(dataRes.data.data[0]));
    }

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
