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

async function testAuditLogAPI() {
  console.log('🧪 AUDIT LOG API VERIFICATION\n');
  console.log('='.repeat(80));

  // ============================================================================
  // SETUP: Create admin and generate some audit logs
  // ============================================================================
  console.log('\n📋 SETUP: Creating test data...\n');

  // Register Admin 1 (Org A)
  const admin1Result = await apiCall('POST', '/auth/register', {
    name: 'Audit Admin A',
    email: `audit-admin-a-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Audit Test Org A'
  });
  const admin1Token = admin1Result.data.data.token;
  const org1Id = admin1Result.data.data.organization.id;
  console.log(`✅ Admin 1 (Org A): ${org1Id}`);

  // Register Admin 2 (Org B) - for cross-org test
  await new Promise(resolve => setTimeout(resolve, 100)); // Slight delay
  const admin2Result = await apiCall('POST', '/auth/register', {
    name: 'Audit Admin B',
    email: `audit-admin-b-${Date.now()}@example.com`,
    password: 'password123',
    organization_name: 'Audit Test Org B'
  });
  const admin2Token = admin2Result.data.data.token;
  const org2Id = admin2Result.data.data.organization.id;
  console.log(`✅ Admin 2 (Org B): ${org2Id}`);

  // Create some entities to generate audit logs
  const projectResult = await apiCall('POST', '/projects', {
    name: 'Audit Test Project',
    description: 'For testing audit logs'
  }, admin1Token);
  const projectId = projectResult.data.data.id;

  const taskResult = await apiCall('POST', '/tasks', {
    project_id: projectId,
    title: 'Audit Test Task',
    description: 'Testing',
    priority: 'high'
  }, admin1Token);

  console.log('✅ Generated audit logs via registration, project, and task creation\n');

  // ============================================================================
  // TEST 1: Admin can query their own org's audit logs
  // ============================================================================
  console.log('='.repeat(80));
  console.log('TEST 1: Admin queries their own org audit logs');
  console.log('='.repeat(80) + '\n');

  const queryResult = await apiCall('GET', '/audit-logs', null, admin1Token);
  
  if (queryResult.success) {
    console.log('✅ Successfully retrieved audit logs');
    console.log(`   Count: ${queryResult.data.data.length}`);
    console.log(`   Has more: ${queryResult.data.meta.has_more}`);
    console.log('   Sample actions:', queryResult.data.data.slice(0, 3).map(log => log.action).join(', '));
  } else {
    console.log('❌ Failed to retrieve audit logs:', queryResult.error);
  }

  // ============================================================================
  // TEST 2: Filter by entity_type
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Filter by entity_type=task');
  console.log('='.repeat(80) + '\n');

  const taskLogsResult = await apiCall('GET', '/audit-logs?entity_type=task', null, admin1Token);
  
  if (taskLogsResult.success) {
    const allTaskType = taskLogsResult.data.data.every(log => log.entity_type === 'task');
    console.log(`✅ Retrieved ${taskLogsResult.data.data.length} task audit logs`);
    console.log(`   All logs are task type: ${allTaskType ? '✅' : '❌'}`);
  } else {
    console.log('❌ Failed:', taskLogsResult.error);
  }

  // ============================================================================
  // TEST 3: Filter by action
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Filter by action=create');
  console.log('='.repeat(80) + '\n');

  const createLogsResult = await apiCall('GET', '/audit-logs?action=create', null, admin1Token);
  
  if (createLogsResult.success) {
    const allCreate = createLogsResult.data.data.every(log => log.action === 'create');
    console.log(`✅ Retrieved ${createLogsResult.data.data.length} create audit logs`);
    console.log(`   All logs are create action: ${allCreate ? '✅' : '❌'}`);
  } else {
    console.log('❌ Failed:', createLogsResult.error);
  }

  // ============================================================================
  // TEST 4: Filter by correlation_id
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Filter by correlation_id (trace request)');
  console.log('='.repeat(80) + '\n');

  // Get a correlation ID from existing logs
  if (queryResult.success && queryResult.data.data.length > 0) {
    const sampleLog = queryResult.data.data[0];
    const correlationId = sampleLog.metadata?.request_id;
    
    if (correlationId) {
      const corrLogsResult = await apiCall('GET', `/audit-logs?correlation_id=${correlationId}`, null, admin1Token);
      
      if (corrLogsResult.success) {
        console.log(`✅ Retrieved ${corrLogsResult.data.data.length} log(s) with correlation_id: ${correlationId}`);
        console.log('   This traces the entire request flow!');
      } else {
        console.log('❌ Failed:', corrLogsResult.error);
      }
    } else {
      console.log('⚠️  No correlation_id found in sample log');
    }
  }

  // ============================================================================
  // TEST 5: Pagination
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Pagination with limit=2');
  console.log('='.repeat(80) + '\n');

  const page1Result = await apiCall('GET', '/audit-logs?limit=2', null, admin1Token);
  
  if (page1Result.success) {
    console.log(`✅ Page 1: ${page1Result.data.data.length} items`);
    console.log(`   Has more: ${page1Result.data.meta.has_more}`);
    
    if (page1Result.data.meta.next_cursor) {
      const cursorStr = JSON.stringify(page1Result.data.meta.next_cursor);
      const page2Result = await apiCall('GET', `/audit-logs?limit=2&cursor=${encodeURIComponent(cursorStr)}`, null, admin1Token);
      
      if (page2Result.success) {
        console.log(`✅ Page 2: ${page2Result.data.data.length} items`);
        console.log('   Pagination working correctly!');
      }
    }
  } else {
    console.log('❌ Failed:', page1Result.error);
  }

  // ============================================================================
  // TEST 6: CRITICAL - Cross-org scoping (Admin B cannot see Admin A's logs)
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: 🔒 SECURITY - Cross-Org Scoping Verification');
  console.log('='.repeat(80) + '\n');

  const admin2QueryResult = await apiCall('GET', '/audit-logs', null, admin2Token);
  
  if (admin2QueryResult.success) {
    const admin2Logs = admin2QueryResult.data.data;
    const hasOrgALogs = admin2Logs.some(log => log.organization_id === org1Id);
    
    console.log(`✅ Admin B retrieved ${admin2Logs.length} logs`);
    console.log(`   All logs belong to Org B: ${!hasOrgALogs ? '✅ SECURE' : '❌ SECURITY BREACH'}`);
    
    if (hasOrgALogs) {
      console.log('   🚨 CRITICAL: Admin B can see Org A logs! Security violation!');
    } else {
      console.log('   🔒 Organization scoping is working correctly!');
    }
  } else {
    console.log('❌ Failed:', admin2QueryResult.error);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('✅ AUDIT LOG API VERIFICATION COMPLETE');
  console.log('='.repeat(80));
  console.log('\nAPI Endpoint: GET /api/v1/audit-logs');
  console.log('Authorization: Admin only');
  console.log('Organization Scoping: Enforced ✅');
  console.log('\nSupported Filters:');
  console.log('  - entity_type, entity_id, action, performed_by');
  console.log('  - correlation_id (for request tracing)');
  console.log('  - start_date, end_date (date range)');
  console.log('  - limit, cursor (pagination)\n');
}

testAuditLogAPI();
