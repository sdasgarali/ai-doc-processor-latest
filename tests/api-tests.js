/**
 * DocuParse API Regression Test Suite
 *
 * Run: node tests/api-tests.js
 *
 * Tests all critical API endpoints for the Vercel deployment
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.TEST_URL || 'https://docuparse.vercel.app';
const ADMIN_EMAIL = 'admin@docuparse.com';
const ADMIN_PASSWORD = 'Admin123!';
const CLIENT_EMAIL = 'testclient@docuparse.com';
const CLIENT_PASSWORD = 'TestClient123!';

let adminToken = null;
let clientToken = null;

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper functions
async function test(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'PASSED' });
  } catch (error) {
    console.log(`  \u2717 ${name}: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAILED', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ============================================
// Authentication Tests
// ============================================
async function runAuthTests() {
  console.log('\n== Authentication Tests ==');

  await test('AUTH-01: Login with admin credentials', async () => {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.token, 'Expected token in response');
    assert(response.data.user, 'Expected user in response');
    assert(response.data.user.user_role === 'superadmin', 'Expected superadmin role');
    adminToken = response.data.token;
  });

  await test('AUTH-02: Login with client credentials', async () => {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.token, 'Expected token in response');
    assert(response.data.user.user_role === 'client', 'Expected client role');
    clientToken = response.data.token;
  });

  await test('AUTH-03: Login with invalid credentials', async () => {
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'invalid@test.com',
        password: 'wrongpassword'
      });
      throw new Error('Should have returned 401');
    } catch (error) {
      assert(error.response?.status === 401, 'Expected 401 status');
    }
  });

  await test('AUTH-04: Verify token', async () => {
    const response = await axios.get(`${BASE_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.user, 'Expected user in response');
  });
}

// ============================================
// Dashboard Tests
// ============================================
async function runDashboardTests() {
  console.log('\n== Dashboard Tests ==');

  await test('DASH-01: Get dashboard analytics', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/dashboard/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(response.data.data.totals, 'Expected totals in response');
    assert(typeof response.data.data.totals.users === 'number', 'Expected users count');
    assert(typeof response.data.data.totals.clients === 'number', 'Expected clients count');
  });
}

// ============================================
// User Management Tests
// ============================================
async function runUserTests() {
  console.log('\n== User Management Tests ==');

  await test('USER-01: List all users', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
    assert(response.data.pagination, 'Expected pagination');
  });

  await test('USER-02: Filter users by role', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/users?role=client`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    // All returned users should be client role
    response.data.data.forEach(user => {
      assert(user.user_role === 'client', 'Expected all users to be clients');
    });
  });
}

// ============================================
// Client Management Tests
// ============================================
async function runClientTests() {
  console.log('\n== Client Management Tests ==');

  await test('CLIENT-01: List all clients', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });

  await test('CLIENT-02: Filter clients by status', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/clients?status=active`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    response.data.data.forEach(client => {
      assert(client.status === 'active', 'Expected all clients to be active');
    });
  });
}

// ============================================
// Category Tests
// ============================================
async function runCategoryTests() {
  console.log('\n== Category Tests ==');

  await test('CAT-01: List all categories', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Field Tests
// ============================================
async function runFieldTests() {
  console.log('\n== Field Tests ==');

  await test('FIELD-01: List all fields', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/fields`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Output Profile Tests
// ============================================
async function runOutputProfileTests() {
  console.log('\n== Output Profile Tests ==');

  await test('PROFILE-01: List all output profiles', async () => {
    const response = await axios.get(`${BASE_URL}/api/output-profiles`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Processing Config Tests
// ============================================
async function runConfigTests() {
  console.log('\n== Processing Config Tests ==');

  await test('CONFIG-01: Get all configurations', async () => {
    const response = await axios.get(`${BASE_URL}/api/processing-config`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(response.data.data, 'Expected data in response');
    assert(response.data.data.default, 'Expected default configs');
  });
}

// ============================================
// Document Tests
// ============================================
async function runDocumentTests() {
  console.log('\n== Document Tests ==');

  await test('DOC-01: List documents (admin)', async () => {
    const response = await axios.get(`${BASE_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
    assert(response.data.pagination, 'Expected pagination');
  });

  await test('DOC-02: List documents (client)', async () => {
    const response = await axios.get(`${BASE_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${clientToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Report Tests
// ============================================
async function runReportTests() {
  console.log('\n== Report Tests ==');

  await test('REPORT-01: Client usage report', async () => {
    const response = await axios.get(`${BASE_URL}/api/reports/client-usage`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
    assert(response.data.totals, 'Expected totals');
  });
}

// ============================================
// Model Version Tests
// ============================================
async function runModelTests() {
  console.log('\n== Model Version Tests ==');

  await test('MODEL-01: List all model versions', async () => {
    const response = await axios.get(`${BASE_URL}/api/admin/model-versions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Permission Tests
// ============================================
async function runPermissionTests() {
  console.log('\n== Permission Tests ==');

  await test('PERM-01: List all permissions', async () => {
    const response = await axios.get(`${BASE_URL}/api/permissions/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });

  await test('PERM-02: Get role permissions', async () => {
    const response = await axios.get(`${BASE_URL}/api/permissions/roles/admin/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(response.status === 200, 'Expected status 200');
    assert(response.data.success === true, 'Expected success true');
    assert(Array.isArray(response.data.data), 'Expected data array');
  });
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('DocuParse API Regression Test Suite');
  console.log(`Testing: ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);

  try {
    await runAuthTests();
    await runDashboardTests();
    await runUserTests();
    await runClientTests();
    await runCategoryTests();
    await runFieldTests();
    await runOutputProfileTests();
    await runConfigTests();
    await runDocumentTests();
    await runReportTests();
    await runModelTests();
    await runPermissionTests();
  } catch (error) {
    console.error('\nFatal error during tests:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log(`Finished: ${new Date().toISOString()}`);

  // Failed tests detail
  if (results.failed > 0) {
    console.log('\n== Failed Tests ==');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
