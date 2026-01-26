const { apiCall } = require('./helpers/api-client');
const { logSection, logTest, logSubsection, logSummary } = require('./helpers/test-logger');

async function runScenario1() {
  let happyTests = { passed: 0, total: 0 };
  let errorTests = { passed: 0, total: 0 };

  logSection('SCENARIO 1: User Lifecycle & Authentication');

  let adminToken, admin2Token, orgId, org2Id, adminId, memberId;

  // ===========================================================================
  // TEST 1: User Registration
  // ===========================================================================
  logSubsection('Test Group 1: Registration');

  // Happy Path
  const regResult = await apiCall('POST', '/auth/register', {
    name: 'Test Admin',
    email: `admin-${Date.now()}@test.com`,
    password: 'password123',
    organization_name: 'Test Organization'
  });
  happyTests.total++;
  if (regResult.success && regResult.data.data.token) {
    logTest('Register new organization', true, 'Admin + Org created');
    adminToken = regResult.data.data.token;
    orgId = regResult.data.data.organization.id;
    adminId = regResult.data.data.user.id;
    happyTests.passed++;
  } else {
    logTest('Register new organization', false, regResult.error);
  }

  await new Promise(resolve => setTimeout(resolve, 100)); // Slight delay

  // Error: Duplicate Email
  const regErrorResult = await apiCall('POST', '/auth/register', {
    name: 'Duplicate User',
    email: regResult.data.data.user.email,
    password: 'password123',
    organization_name: 'Another Org'
  });
  errorTests.total++;
  if (!regErrorResult.success && regErrorResult.status === 409) {
    logTest('Registration with duplicate email (409)', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Registration with duplicate email (409)', false, 'Should have failed');
  }

  // ===========================================================================
  // TEST 2: Login
  // ===========================================================================
  logSubsection('Test Group 2: Login');

  // Happy Path
  const loginResult = await apiCall('POST', '/auth/login', {
    email: regResult.data.data.user.email,
    password: 'password123'
  });
  happyTests.total++;
  if (loginResult.success && loginResult.data.data.token) {
    logTest('Login with valid credentials', true);
    happyTests.passed++;
  } else {
    logTest('Login with valid credentials', false, loginResult.error);
  }

  // Error: Invalid Password
  const loginErrorResult = await apiCall('POST', '/auth/login', {
    email: regResult.data.data.user.email,
    password: 'wrongpassword'
  });
  errorTests.total++;
  if (!loginErrorResult.success && loginErrorResult.status === 401) {
    logTest('Login with invalid password (401)', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Login with invalid password (401)', false, 'Should have failed');
  }

  // ===========================================================================
  // TEST 3: Create User
  // ===========================================================================
  logSubsection('Test Group 3: User Creation');

  // Happy Path
  const createUserResult = await apiCall('POST', '/users', {
    organization_id: orgId,
    name: 'Test Member',
    email: `member-${Date.now()}@test.com`,
    password: 'password123',
    role: 'member'
  }, adminToken);
  happyTests.total++;
  if (createUserResult.success) {
    logTest('Admin creates new user', true);
    memberId = createUserResult.data.data.id;
    happyTests.passed++;
  } else {
    logTest('Admin creates new user', false, createUserResult.error);
  }

  // Error: Duplicate Email
  const createUserErrorResult = await apiCall('POST', '/users', {
    organization_id: orgId,
    name: 'Another User',
    email: createUserResult.data.data.email,
    password: 'password123',
    role: 'member'
  }, adminToken);
  errorTests.total++;
  if (!createUserErrorResult.success && createUserErrorResult.status === 409) {
    logTest('Create user with duplicate email (409)', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Create user with duplicate email (409)', false, 'Should have failed');
  }

  // Error: Invalid Role
  const createUserInvalidRoleResult = await apiCall('POST', '/users', {
    organization_id: orgId,
    name: 'Invalid Role User',
    email: `invalid-${Date.now()}@test.com`,
    password: 'password123',
    role: 'superadmin' // Invalid role
  }, adminToken);
  errorTests.total++;
  if (!createUserInvalidRoleResult.success && createUserInvalidRoleResult.status === 400) {
    logTest('Create user with invalid role (400)', true, 'Expected validation error');
    errorTests.passed++;
  } else {
    logTest('Create user with invalid role (400)', false, 'Should have failed validation');
  }

  // ===========================================================================
  // TEST 4: List/Get Users
  // ===========================================================================
  logSubsection('Test Group 4: User Queries');

  // Happy Path: Get All Users
  const getUsersResult = await apiCall('GET', '/users', null, adminToken);
  happyTests.total++;
  if (getUsersResult.success && getUsersResult.data.data.length > 0) {
    logTest('List all users with pagination', true, `Found ${getUsersResult.data.data.length} users`);
    happyTests.passed++;
  } else {
    logTest('List all users with pagination', false);
  }

  // Happy Path: Filter by Role
  const getUsersByRoleResult = await apiCall('GET', '/users?role=member', null, adminToken);
  happyTests.total++;
  if (getUsersByRoleResult.success) {
    logTest('Filter users by role', true, `Found ${getUsersByRoleResult.data.data.length} members`);
    happyTests.passed++;
  } else {
    logTest('Filter users by role', false);
  }

  // Happy Path: Get User by ID
  const getUserByIdResult = await apiCall('GET', `/users/${memberId}`, null, adminToken);
  happyTests.total++;
  if (getUserByIdResult.success) {
    logTest('Get user by ID', true);
    happyTests.passed++;
  } else {
    logTest('Get user by ID', false);
  }

  // Error: User Not Found
  const getUserNotFoundResult = await apiCall('GET', '/users/00000000-0000-0000-0000-000000000000', null, adminToken);
  errorTests.total++;
  if (!getUserNotFoundResult.success && getUserNotFoundResult.status === 404) {
    logTest('Get non-existent user (404)', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Get non-existent user (404)', false);
  }

  // ===========================================================================
  // TEST 5: Update User
  // ===========================================================================
  logSubsection('Test Group 5: User Updates');

  // Happy Path: Admin updates user role
  const updateUserResult = await apiCall('PATCH', `/users/${memberId}`, {
    role: 'manager'
  }, adminToken);
  happyTests.total++;
  if (updateUserResult.success) {
    logTest('Admin promotes user to manager', true);
    happyTests.passed++;
  } else {
    logTest('Admin promotes user to manager', false, updateUserResult.error);
  }

  // ===========================================================================
  // TEST 6: Deactivate User
  // ===========================================================================
  logSubsection('Test Group 6: User Deactivation');

  // Happy Path: Admin deactivates user
  const deactivateUserResult = await apiCall('DELETE', `/users/${memberId}`, null, adminToken);
  happyTests.total++;
  if (deactivateUserResult.success) {
    logTest('Admin deactivates user', true);
    happyTests.passed++;
  } else {
    logTest('Admin deactivates user', false, deactivateUserResult.error);
  }

  // Error: Admin tries to deactivate self (security safeguard)
  const deactivateSelfResult = await apiCall('DELETE', `/users/${adminId}`, null, adminToken);
  errorTests.total++;
  if (!deactivateSelfResult.success && deactivateSelfResult.status === 403) {
    logTest('Admin tries to deactivate self (403)', true, 'Security safeguard working!');
    errorTests.passed++;
  } else {
    logTest('Admin tries to deactivate self (403)', false, 'Security issue!');
  }

  // ===========================================================================
  // TEST 7: Reactivate User
  // ===========================================================================
  logSubsection('Test Group 7: User Reactivation');

  // Happy Path: Admin reactivates user
  const reactivateUserResult = await apiCall('PATCH', `/users/${memberId}/activate`, null, adminToken);
  happyTests.total++;
  if (reactivateUserResult.success) {
    logTest('Admin reactivates user', true);
    happyTests.passed++;
  } else {
    logTest('Admin reactivates user', false, reactivateUserResult.error);
  }

  // ===========================================================================
  // Summary
  // ===========================================================================
  logSummary(1, 'User Lifecycle & Authentication', happyTests, errorTests);

  return { happyTests, errorTests };
}

// Run if executed directly
if (require.main === module) {
  runScenario1().catch(console.error);
}

module.exports = runScenario1;
