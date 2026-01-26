const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

// Helper to make API calls and track correlation IDs
async function apiCall(method, endpoint, data = null, token = null, customCorrelationId = null) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (customCorrelationId) headers['X-Correlation-ID'] = customCorrelationId;

  try {
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers
    });

    const correlationId = response.headers['x-correlation-id'];
    console.log(`✅ SUCCESS [${correlationId}]: ${method} ${endpoint}`);
    if (response.data.data) {
      console.log(`   Response:`, JSON.stringify(response.data.data).substring(0, 100) + '...');
    }
    return { success: true, data: response.data, correlationId, status: response.status };
  } catch (error) {
    const correlationId = error.response?.headers?.['x-correlation-id'];
    const requestId = error.response?.data?.request_id;
    console.log(`❌ ERROR [${correlationId || requestId || 'unknown'}]: ${method} ${endpoint}`);
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error: ${error.response?.data?.error}`);
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      correlationId,
      requestId,
      status: error.response?.status 
    };
  }
}

async function runCorrelationTests() {
  console.log('🧪 CORRELATION ID TRACING TEST SUITE\n');
  console.log('=' .repeat(80));
  console.log('This script demonstrates end-to-end correlation ID tracing.');
  console.log('Watch the console logs to see the same ID flow through all operations.');
  console.log('=' .repeat(80) + '\n');

  let adminToken, orgId;

  // =============================================================================
  // TEST 1: USER REGISTRATION
  // =============================================================================
  console.log('\n📋 TEST 1: User Registration\n' + '-'.repeat(80));

  // Happy Path
  console.log('\n🟢 Happy Path: Successful Registration');
  const customId1 = 'test-reg-' + Date.now();
  const regResult = await apiCall('POST', '/auth/register', {
    name: 'Correlation Admin',
    email: `corr-admin-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Correlation Test Org'
  }, null, customId1);

  if (regResult.success) {
    adminToken = regResult.data.data.token;
    orgId = regResult.data.data.organization.id;
    console.log(`   🔑 Admin Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   📊 Check audit_logs for request_id: ${customId1}`);
  }

  // Error Path
  console.log('\n🔴 Error Path: Duplicate Email Registration');
  const customId2 = 'test-reg-error-' + Date.now();
  await apiCall('POST', '/auth/register', {
    name: 'Duplicate User',
    email: regResult.data.data.user.email, // Same email!
    password: 'password123',
    organization_name: 'Another Org'
  }, null, customId2);
  console.log(`   📊 Check error logs for request_id: ${customId2}`);

  // Wait a bit for the server to process
  await new Promise(resolve => setTimeout(resolve, 500));

  // =============================================================================
  // TEST 2: USER CREATION
  // =============================================================================
  console.log('\n\n📋 TEST 2: User Creation\n' + '-'.repeat(80));

  // Happy Path
  console.log('\n🟢 Happy Path: Create New User');
  const customId3 = 'test-user-create-' + Date.now();
  const userResult = await apiCall('POST', '/users', {
    name: 'Test Member',
    email: `member-${Date.now()}@example.com`,
    password: 'password123',
    role: 'member',
    organization_id: orgId
  }, adminToken, customId3);
  console.log(`   📊 Check audit_logs for request_id: ${customId3}`);

  // Error Path
  console.log('\n🔴 Error Path: Create User with Duplicate Email');
  const customId4 = 'test-user-error-' + Date.now();
  await apiCall('POST', '/users', {
    name: 'Another User',
    email: userResult.data.data.email, // Same email!
    password: 'password123',
    role: 'member',
    organization_id: orgId
  }, adminToken, customId4);
  console.log(`   📊 Check error logs for request_id: ${customId4}`);

  await new Promise(resolve => setTimeout(resolve, 500));

  // =============================================================================
  // TEST 3: PROJECT & TASK OPERATIONS
  // =============================================================================
  console.log('\n\n📋 TEST 3: Project & Task Operations\n' + '-'.repeat(80));

  // Create Project (Happy)
  console.log('\n🟢 Happy Path: Create Project');
  const customId5 = 'test-project-' + Date.now();
  const projectResult = await apiCall('POST', '/projects', {
    name: 'Correlation Test Project',
    description: 'Testing correlation ID flow',
    status: 'active'
  }, adminToken, customId5);
  
  const projectId = projectResult.data?.data?.id;
  console.log(`   📊 Check audit_logs for request_id: ${customId5}`);

  // Create Task (Happy)
  console.log('\n🟢 Happy Path: Create Task');
  const customId6 = 'test-task-create-' + Date.now();
  const taskResult = await apiCall('POST', '/tasks', {
    project_id: projectId,
    title: 'Test Correlation Task',
    description: 'This task will demonstrate correlation ID tracing',
    priority: 'high'
  }, adminToken, customId6);
  
  if (!taskResult.success) {
    console.log('   ⚠️  Skipping remaining task tests due to creation failure');
    return;
  }

  const taskId = taskResult.data?.data?.id;
  console.log(`   📊 Check audit_logs for request_id: ${customId6}`);

  // Update Task (Happy)
  console.log('\n🟢 Happy Path: Update Task Status');
  const customId7 = 'test-task-update-' + Date.now();
  await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'in_progress',
    version: taskResult.data.data.version
  }, adminToken, customId7);
  console.log(`   📊 Check audit_logs for request_id: ${customId7}`);

  // Update Task (Error - Invalid Transition)
  console.log('\n🔴 Error Path: Invalid Status Transition');
  const customId8 = 'test-task-error-' + Date.now();
  await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'todo', // Can't go back from in_progress to todo
    version: taskResult.data.data.version + 1
  }, adminToken, customId8);
  console.log(`   📊 Check error logs for request_id: ${customId8}`);

  await new Promise(resolve => setTimeout(resolve, 500));

  // =============================================================================
  // TEST 4: ORGANIZATION SUSPENSION
  // =============================================================================
  console.log('\n\n📋 TEST 4: Organization Status\n' + '-'.repeat(80));

  // Suspend (Happy)
  console.log('\n🟢 Happy Path: Suspend Organization');
  const customId9 = 'test-org-suspend-' + Date.now();
  await apiCall('PATCH', `/organizations/${orgId}/suspend`, {}, adminToken, customId9);
  console.log(`   📊 Check audit_logs for request_id: ${customId9}`);

  // Activate (Happy)
  console.log('\n🟢 Happy Path: Activate Organization');
  const customId10 = 'test-org-activate-' + Date.now();
  await apiCall('PATCH', `/organizations/${orgId}/activate`, {}, adminToken, customId10);
  console.log(`   📊 Check audit_logs for request_id: ${customId10}`);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ CORRELATION ID TEST SUITE COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📊 To trace operations in the database:\n');
  console.log('Example Query:');
  console.log(`  SELECT action, entity_type, metadata->>'request_id' as correlation_id`);
  console.log(`  FROM audit_logs`);
  console.log(`  WHERE metadata->>'request_id' = '${customId6}'`);
  console.log(`  ORDER BY created_at;`);
  console.log('\n📝 Console Logs:');
  console.log('  Check the server console for log entries with the same correlation IDs.');
  console.log('  Format: [correlation-id] METHOD /endpoint STATUS - TIME');
  console.log('\n🔍 Error Tracing Example:');
  console.log(`  All operations with ID: ${customId2} should show the duplicate email error`);
  console.log('  You can trace the entire request flow in both console and database.\n');
}

// Run the tests
runCorrelationTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
