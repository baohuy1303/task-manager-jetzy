const { apiCall } = require('./helpers/api-client');
const { logSection, logTest, logSubsection, logSummary } = require('./helpers/test-logger');

async function runScenario3() {
  let happyTests = { passed: 0, total: 0 };
  let errorTests = { passed: 0, total: 0 };

  logSection('SCENARIO 3: Admin Operations & Audit Logs');

  // Setup: Create test organization
  const setupResult = await apiCall('POST', '/auth/register', {
    name: 'Admin Ops Admin',
    email: `admin-ops-${Date.now()}@test.com`,
    password: 'password123',
    organization_name: 'Admin Ops Org'
  });
  const adminToken = setupResult.data.data.token;
  const orgId = setupResult.data.data.organization.id;

  // Create some data to generate audit logs
  await apiCall('POST', '/projects', {
    name: 'Audit Test Project',
    description: 'For testing'
  }, adminToken);

  // ===========================================================================
  // TEST 1: Organization Management
  // ===========================================================================
  logSubsection('Test Group 1: Organization Management');

  // Happy: Get Organization
  const getOrgResult = await apiCall('GET', `/organizations/${orgId}`, null, adminToken);
  happyTests.total++;
  if (getOrgResult.success) {
    logTest('View organization details', true);
    happyTests.passed++;
  } else {
    logTest('View organization details', false, getOrgResult.error);
  }

  // Happy: Suspend Organization
  const suspendOrgResult = await apiCall('PATCH', `/organizations/${orgId}/suspend`, null, adminToken);
  happyTests.total++;
  if (suspendOrgResult.success) {
    logTest('Suspend organization', true);
    happyTests.passed++;
  } else {
    logTest('Suspend organization', false, suspendOrgResult.error);
  }

  // Happy: Activate Organization
  const activateOrgResult = await apiCall('PATCH', `/organizations/${orgId}/activate`, null, adminToken);
  happyTests.total++;
  if (activateOrgResult.success) {
    logTest('Reactivate organization', true);
    happyTests.passed++;
  } else {
    logTest('Reactivate organization', false, activateOrgResult.error);
  }

  // ===========================================================================
  // TEST 2: Audit Log Queries
  // ===========================================================================
  logSubsection('Test Group 2: Audit Log Queries');

  // Happy: Query all audit logs
  const queryAuditResult = await apiCall('GET', '/audit-logs', null, adminToken);
  happyTests.total++;
  if (queryAuditResult.success && queryAuditResult.data.data.length > 0) {
    logTest('Query all audit logs', true, `Found ${queryAuditResult.data.data.length} log entries`);
    happyTests.passed++;
  } else {
    logTest('Query all audit logs', false);
  }

  // Happy: Filter by entity type
  const filterByTypeResult = await apiCall('GET', '/audit-logs?entity_type=project', null, adminToken);
  happyTests.total++;
  if (filterByTypeResult.success) {
    const allProjects = filterByTypeResult.data.data.every(log => log.entity_type === 'project');
    if (allProjects) {
      logTest('Filter audit logs by entity_type', true, 'All results are project type');
      happyTests.passed++;
    } else {
      logTest('Filter audit logs by entity_type', false, 'Filter not working');
    }
  } else {
    logTest('Filter audit logs by entity_type', false);
  }

  // Happy: Filter by action
  const filterByActionResult = await apiCall('GET', '/audit-logs?action=create', null, adminToken);
  happyTests.total++;
  if (filterByActionResult.success) {
    logTest('Filter audit logs by action', true);
    happyTests.passed++;
  } else {
    logTest('Filter audit logs by action', false);
  }

  // Happy: Trace by correlation ID
  if (queryAuditResult.success && queryAuditResult.data.data.length > 0) {
    const sampleLog = queryAuditResult.data.data[0];
    const correlationId = sampleLog.metadata?.request_id;
    
    if (correlationId) {
      const traceResult = await apiCall('GET', `/audit-logs?correlation_id=${correlationId}`, null, adminToken);
      happyTests.total++;
      if (traceResult.success) {
        logTest('Trace request by correlation_id', true, `Found ${traceResult.data.data.length} log(s)`);
        happyTests.passed++;
      } else {
        logTest('Trace request by correlation_id', false);
      }
    }
  }

  // Happy: Pagination
  const paginateResult = await apiCall('GET', '/audit-logs?limit=2', null, adminToken);
  happyTests.total++;
  if (paginateResult.success && paginateResult.data.meta) {
    logTest('Paginate audit logs', true, `has_more: ${paginateResult.data.meta.has_more}`);
    happyTests.passed++;
  } else {
    logTest('Paginate audit logs', false);
  }

  // ===========================================================================
  // Summary
  // ===========================================================================
  logSummary(3, 'Admin Operations & Audit Logs', happyTests, errorTests);

  return { happyTests, errorTests };
}

if (require.main === module) {
  runScenario3().catch(console.error);
}

module.exports = runScenario3;
