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

async function runAuditTests() {
  console.log('🧪 Testing Enhanced Auditing Flow\n');

  // Test 1: User Registration
  console.log('✅ TEST 1: User Registration Auditing');
  const regResult = await apiCall('POST', '/auth/register', {
    name: 'Audit Admin',
    email: `audit-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Audit Org'
  });
  
  if (!regResult.success) {
    console.log('❌ FAILED: Registration failed', regResult.error);
    return;
  }
  
  const adminToken = regResult.data.data.token;
  const adminId = regResult.data.data.user.id;
  const orgId = regResult.data.data.organization.id;
  console.log('✅ Registration successful. Org ID:', orgId);

  // Test 2: User Creation
  console.log('\n✅ TEST 2: User Creation Auditing');
  const createResult = await apiCall('POST', '/users', {
    name: 'Audit User',
    email: `user-audit-${Date.now()}@example.com`,
    password: 'password123',
    role: 'member',
    organization_id: orgId
  }, adminToken);
  
  if (!createResult.success) {
    console.log('❌ FAILED: User creation failed', createResult.error);
    return;
  }
  console.log('✅ User created successfully.');

  // Test 3: Org Suspension
  console.log('\n✅ TEST 3: Organization Suspension Auditing');
  const suspendResult = await apiCall('PATCH', `/organizations/${orgId}/suspend`, {}, adminToken);
  
  if (!suspendResult.success) {
    console.log('❌ FAILED: Org suspension failed', suspendResult.error);
    return;
  }
  console.log('✅ Organization suspended successfully.');

  // Test 4: Org Activation
  console.log('\n✅ TEST 4: Organization Activation Auditing');
  const activateResult = await apiCall('PATCH', `/organizations/${orgId}/activate`, {}, adminToken);
  
  if (!activateResult.success) {
    console.log('❌ FAILED: Org activation failed', activateResult.error);
    return;
  }
  console.log('✅ Organization activated successfully.');
  
  console.log('\n⚠️ Note: Manual database check recommended for audit log metadata verification.');
  console.log('Run: SELECT action, metadata FROM audit_logs ORDER BY created_at DESC LIMIT 5;');
}

runAuditTests();
