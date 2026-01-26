const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
let adminToken = null;
let adminUser = null;
let orgId = null;

// Helper function for API calls
async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    };
    if (data) config.data = data;
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      error: error.response?.data?.error || error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Testing New Authentication Flow\n');
  console.log('=' .repeat(60));

  // Test 1: Atomic Registration - Creates User AND Organization
  console.log('\n✅ TEST 1: Atomic Registration (POST /auth/register)');
  const orgName = `Test Org ${Date.now()}`;
  const registerResult = await apiCall('POST', '/auth/register', {
    name: 'Test Admin',
    email: `admin-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: orgName
  });
  
  if (!registerResult.success) {
    console.log('❌ FAILED: Could not register user');
    console.log('Error:', registerResult.error);
    return;
  }
  
  adminToken = registerResult.data.data.token;
  adminUser = registerResult.data.data.user;
  const organization = registerResult.data.data.organization;
  orgId = organization?.id;
  
  console.log('✅ User and organization created successfully');
  console.log('   - User ID:', adminUser.id);
  console.log('   - Role:', adminUser.role);
  console.log('   - Organization ID:', adminUser.organization_id);
  console.log('   - Org Name:', organization?.name);
  console.log('   - Org Created:', organization?.id);
  
  if (adminUser.role !== 'admin') {
    console.log('❌ FAILED: Default role should be admin, got:', adminUser.role);
    return;
  }
  
  if (!adminUser.organization_id) {
    console.log('❌ FAILED: organization_id should be set during registration, got:', adminUser.organization_id);
    return;
  }
  
  if (!organization) {
    console.log('❌ FAILED: organization should be returned in response');
    return;
  }
  
  if (organization.name !== orgName) {
    console.log('❌ FAILED: organization name mismatch. Expected:', orgName, 'Got:', organization.name);
    return;
  }
  
  if (adminUser.organization_id !== organization.id) {
    console.log('❌ FAILED: user org_id should match created organization id');
    return;
  }

  // Test 2: Public Registration Strictly Blocks org_id and role
  console.log('\n✅ TEST 2: Public Registration Strictly Blocks org_id and role');
  const fakeOrgId = '00000000-0000-0000-0000-000000000000';
  const registerWithOrgResult = await apiCall('POST', '/auth/register', {
    name: 'Hacker Admin',
    email: `hacker-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Hacker Org', // This is required now
    organization_id: fakeOrgId, // Forbidden on public route
    role: 'member' // Forbidden on public route
  });
  
  if (registerWithOrgResult.success) {
    console.log('❌ FAILED: Registration should have been blocked due to forbidden fields');
    return;
  }
  
  console.log('✅ Correctly blocked registration with forbidden fields');
  console.log('   - Status:', registerWithOrgResult.status);
  console.log('   - Error:', registerWithOrgResult.error);
  
  if (registerWithOrgResult.status !== 400) {
    console.log('❌ FAILED: Expected 400 status code, got:', registerWithOrgResult.status);
    return;
  }

  // Test 3: POST /organizations route is disabled
  console.log('\n✅ TEST 3: POST /organizations Route is Disabled');
  const createOrgResult = await apiCall('POST', '/organizations', {
    name: `Another Org ${Date.now()}`
  }, adminToken);
  
  if (createOrgResult.success) {
    console.log('❌ FAILED: Should not be able to create organizations via POST /organizations');
    return;
  }
  console.log('✅ Correctly blocked manual organization creation');
  console.log('   - Status:', createOrgResult.status);
  console.log('   - Error:', createOrgResult.error);

  // Test 4: Admin Creates Manager User
  console.log('\n✅ TEST 4: Admin Creates Manager User (POST /users)');
  const createManagerResult = await apiCall('POST', '/users', {
    name: 'Manager User',
    email: `manager-${Date.now()}@example.com`,
    password: 'password123',
    role: 'manager',
    organization_id: orgId
  }, adminToken);
  
  if (!createManagerResult.success) {
    console.log('❌ FAILED: Admin should be able to create users');
    console.log('Error:', createManagerResult.error);
    return;
  }
  
  const managerUser = createManagerResult.data.data;
  console.log('✅ Manager user created successfully');
  console.log('   - User ID:', managerUser.id);
  console.log('   - Role:', managerUser.role);
  console.log('   - Organization ID:', managerUser.organization_id);

  // Test 7: Admin Creates Member User
  console.log('\n✅ TEST 7: Admin Creates Member User (POST /users)');
  const createMemberResult = await apiCall('POST', '/users', {
    name: 'Member User',
    email: `member-${Date.now()}@example.com`,
    password: 'password123',
    role: 'member',
    organization_id: orgId
  }, adminToken);
  
  if (!createMemberResult.success) {
    console.log('❌ FAILED: Admin should be able to create member users');
    console.log('Error:', createMemberResult.error);
    return;
  }
  
  const memberUser = createMemberResult.data.data;
  console.log('✅ Member user created successfully');
  console.log('   - User ID:', memberUser.id);
  console.log('   - Role:', memberUser.role);
  console.log('   - Organization ID:', memberUser.organization_id);

  // Test 8: Global Email Uniqueness
  console.log('\n✅ TEST 8: Global Email Uniqueness');
  const duplicateEmailResult = await apiCall('POST', '/auth/register', {
    name: 'Duplicate Admin',
    email: adminUser.email, // Use same email
    password: 'password123'
  });
  
  if (duplicateEmailResult.success) {
    console.log('❌ FAILED: Should not allow duplicate emails globally');
    return;
  }
  console.log('✅ Correctly blocked duplicate email registration');
  console.log('   - Status:', duplicateEmailResult.status);
  console.log('   - Error:', duplicateEmailResult.error);

  // Test 9: Cannot create users without authentication
  console.log('\n✅ TEST 9: Cannot Create Users Without Authentication');
  const noAuthResult = await apiCall('POST', '/users', {
    name: 'Unauthorized User',
    email: `unauth-${Date.now()}@example.com`,
    password: 'password123',
    role: 'member',
    organization_id: orgId
  });
  
  if (noAuthResult.success) {
    console.log('❌ FAILED: Should not allow user creation without auth');
    return;
  }
  console.log('✅ Correctly blocked unauthenticated user creation');
  console.log('   - Status:', noAuthResult.status);
  console.log('   - Error:', noAuthResult.error);

  // Test 10: Admin cannot create users in different organization
  console.log('\n✅ TEST 10: Admin Cannot Create Users in Different Org');
  const differentOrgId = '00000000-0000-0000-0000-000000000000';
  const wrongOrgResult = await apiCall('POST', '/users', {
    name: 'Wrong Org User',
    email: `wrongorg-${Date.now()}@example.com`,
    password: 'password123',
    role: 'member',
    organization_id: differentOrgId
  }, adminToken);
  
  if (wrongOrgResult.success) {
    console.log('❌ FAILED: Should not allow creating users in different org');
    return;
  }
  console.log('✅ Correctly blocked cross-org user creation');
  console.log('   - Status:', wrongOrgResult.status);
  console.log('   - Error:', wrongOrgResult.error);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 ALL TESTS PASSED!');
  console.log('='.repeat(60));
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});

