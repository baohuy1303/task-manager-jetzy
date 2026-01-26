const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      status: error.response?.status 
    };
  }
}

async function testSelfDeactivation() {
  console.log('🧪 Testing Admin Self-Deactivation Prevention\n');

  // 1. Register an admin
  console.log('1️⃣  Registering admin user...');
  const regResult = await apiCall('POST', '/auth/register', {
    name: 'Self Deactivation Test Admin',
    email: `self-test-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Self Test Org'
  });

  if (!regResult.success) {
    console.log('❌ Registration failed:', regResult.error);
    return;
  }

  const adminToken = regResult.data.data.token;
  const adminId = regResult.data.data.user.id;
  console.log(`✅ Admin created: ${adminId}\n`);

  // 2. Try to deactivate self (should FAIL)
  console.log('2️⃣  Attempting admin self-deactivation (should be blocked)...');
  const deactivateResult = await apiCall('DELETE', `/users/${adminId}`, null, adminToken);

  if (deactivateResult.success) {
    console.log('❌ SECURITY ISSUE: Admin was able to deactivate themselves!');
    console.log('   This should have been blocked.\n');
    return;
  }

  if (deactivateResult.error === 'Access denied: Admins cannot deactivate themselves') {
    console.log('✅ SUCCESS: Self-deactivation was correctly blocked!');
    console.log(`   Error: ${deactivateResult.error}`);
    console.log(`   Status: ${deactivateResult.status}`);
  } else {
    console.log('⚠️  Request failed, but with unexpected error:');
    console.log(`   Error: ${deactivateResult.error}`);
    console.log(`   Status: ${deactivateResult.status}`);
  }

  console.log('\n✅ Test Complete!');
  console.log('---');
  console.log('Expected: 403 Forbidden with message "Admins cannot deactivate themselves"');
  console.log(`Actual: ${deactivateResult.status} with message "${deactivateResult.error}"`);
}

testSelfDeactivation();
