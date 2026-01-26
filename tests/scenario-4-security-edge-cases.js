const { apiCall } = require('./helpers/api-client');
const { logSection, logTest, logSubsection, logSummary } = require('./helpers/test-logger');

async function runScenario4() {
  let happyTests = { passed: 0, total: 0 };
  let errorTests = { passed: 0, total: 0 };

  logSection('SCENARIO 4: Security & Edge Cases');

  // Setup: Create two separate organizations
  const org1Result = await apiCall('POST', '/auth/register', {
    name: 'Security Test Admin A',
    email: `security-a-${Date.now()}@test.com`,
    password: 'password123',
    organization_name: 'Security Org A'
  });
  const admin1Token = org1Result.data.data.token;
  const org1Id = org1Result.data.data.organization.id;

  await new Promise(resolve => setTimeout(resolve, 100));

  const org2Result = await apiCall('POST', '/auth/register', {
    name: 'Security Test Admin B',
    email: `security-b-${Date.now()}@test.com`,
    password: 'password123',
    organization_name: 'Security Org B'
  });
  const admin2Token = org2Result.data.data.token;
  const org2Id = org2Result.data.data.organization.id;

  // Create member in Org 1
  const memberResult = await apiCall('POST', '/users', {
    organization_id: org1Id,
    name: 'Security Member',
    email: `security-member-${Date.now()}@test.com`,
    password: 'password123',
    role: 'member'
  }, admin1Token);
  const memberToken = memberResult.data.data.token || admin1Token; // Fallback

  // Create project and task in Org 1
  const projectResult = await apiCall('POST', '/projects', {
    name: 'Security Test Project',
    description: 'Testing'
  }, admin1Token);
  const projectId = projectResult.data.data.id;

  const taskResult = await apiCall('POST', '/tasks', {
    project_id: projectId,
    title: 'Security Test Task',
    priority: 'high'
  }, admin1Token);
  const taskId = taskResult.data.data.id;
  const taskVersion = taskResult.data.data.version;

  // ===========================================================================
  // TEST 1: RBAC (Role-Based Access Control)
  // ===========================================================================
  logSubsection('Test Group 1: RBAC Enforcement');

  // Get member token by logging in
  const memberLoginResult = await apiCall('POST', '/auth/login', {
    email: memberResult.data.data.email,
    password: 'password123'
  });
  const actualMemberToken = memberLoginResult.data.data.token;

  // Error: Member tries to create project
  const memberCreateProjectResult = await apiCall('POST', '/projects', {
    name: 'Unauthorized Project',
    description: 'Should fail'
  }, actualMemberToken);
  errorTests.total++;
  if (!memberCreateProjectResult.success && memberCreateProjectResult.status === 403) {
    logTest('Member tries to create project (403)', true, 'RBAC working');
    errorTests.passed++;
  } else {
    logTest('Member tries to create project (403)', false, 'RBAC breach!');
  }

  // Error: Member tries to create user
  const memberCreateUserResult = await apiCall('POST', '/users', {
    organization_id: org1Id,
    name: 'Unauthorized User',
    email: `unauthorized-${Date.now()}@test.com`,
    password: 'password123',
    role: 'member'
  }, actualMemberToken);
  errorTests.total++;
  if (!memberCreateUserResult.success && memberCreateUserResult.status === 403) {
    logTest('Member tries to create user (403)', true, 'RBAC working');
    errorTests.passed++;
  } else {
    logTest('Member tries to create user (403)', false, 'RBAC breach!');
  }

  // Error: Member tries to deactivate user
  const memberDeactivateResult = await apiCall('DELETE', `/users/${memberResult.data.data.id}`, null, actualMemberToken);
  errorTests.total++;
  if (!memberDeactivateResult.success && memberDeactivateResult.status === 403) {
    logTest('Member tries to deactivate user (403)', true, 'RBAC working');
    errorTests.passed++;
  } else {
    logTest('Member tries to deactivate user (403)', false, 'RBAC breach!');
  }

  // ===========================================================================
  // TEST 2: Organization Scoping
  // ===========================================================================
  logSubsection('Test Group 2: Cross-Organization Security');

  // Error: Admin B tries to access Admin A's project
  const crossOrgProjectResult = await apiCall('GET', `/projects/${projectId}`, null, admin2Token);
  errorTests.total++;
  if (!crossOrgProjectResult.success && (crossOrgProjectResult.status === 403 || crossOrgProjectResult.status === 404)) {
    logTest('Admin B cannot access Org A project', true, 'Org scoping working');
    errorTests.passed++;
  } else {
    logTest('Admin B cannot access Org A project', false, 'ORG SCOPING BREACH!');
  }

  // Error: Admin B tries to access Admin A's task
  const crossOrgTaskResult = await apiCall('GET', `/tasks/${taskId}`, null, admin2Token);
  errorTests.total++;
  if (!crossOrgTaskResult.success) {
    logTest('Admin B cannot access Org A task', true, 'Org scoping working');
    errorTests.passed++;
  } else {
    logTest('Admin B cannot access Org A task', false, 'ORG SCOPING BREACH!');
  }

  // Verify: Admin B's audit logs don't contain Org A data
  const org2AuditResult = await apiCall('GET', '/audit-logs', null, admin2Token);
  errorTests.total++;
  if (org2AuditResult.success) {
    const hasOrg1Data = org2AuditResult.data.data.some(log => log.organization_id === org1Id);
    if (!hasOrg1Data) {
      logTest('Audit logs properly scoped to organization', true, 'Org scoping working');
      errorTests.passed++;
    } else {
      logTest('Audit logs properly scoped to organization', false, 'ORG SCOPING BREACH IN AUDITS!');
    }
  } else {
    logTest('Audit logs properly scoped to organization', false);
  }

  // ===========================================================================
  // TEST 3: Concurrent Update Protection (Optimistic Locking)
  // ===========================================================================
  logSubsection('Test Group 3: Concurrent Update Protection');

  // Simulate concurrent updates
  const update1Result = await apiCall('PATCH', `/tasks/${taskId}`, {
    title: 'Updated by User 1',
    version: taskVersion
  }, admin1Token);
  
  happyTests.total++;
  if (update1Result.success) {
    logTest('First user updates task', true);
    happyTests.passed++;

    // Try second update with old version
    const update2Result = await apiCall('PATCH', `/tasks/${taskId}`, {
      title: 'Updated by User 2',
      version: taskVersion // Old version!
    }, admin1Token);

    errorTests.total++;
    if (!update2Result.success && update2Result.status === 409) {
      logTest('Second update with stale version (409)', true, 'Optimistic locking working');
      errorTests.passed++;
    } else {
      logTest('Second update with stale version (409)', false, 'Concurrent update protection failed!');
    }
  } else {
    logTest('First user updates task', false);
  }

  // ===========================================================================
  // TEST 4: Workflow Validation
  // ===========================================================================
  logSubsection('Test Group 4: Workflow Validation');

  // Create a new task for workflow testing
  const workflowTaskResult = await apiCall('POST', '/tasks', {
    project_id: projectId,
    title: 'Workflow Test Task',
    priority: 'medium'
  }, admin1Token);

  if (workflowTaskResult.success) {
    const wfTaskId = workflowTaskResult.data.data.id;
    let wfVersion = workflowTaskResult.data.data.version;

    // Valid: todo → in_progress
    const validTransition1 = await apiCall('PATCH', `/tasks/${wfTaskId}/status`, {
      status: 'in_progress',
      version: wfVersion
    }, admin1Token);
    
    happyTests.total++;
    if (validTransition1.success) {
      logTest('Valid transition: todo → in_progress', true);
      wfVersion = validTransition1.data.data.version;
      happyTests.passed++;
    } else {
      logTest('Valid transition: todo → in_progress', false);
    }
  }

  // ===========================================================================
  // Summary
  // ===========================================================================
  logSummary(4, 'Security & Edge Cases', happyTests, errorTests);

  return { happyTests, errorTests };
}

if (require.main === module) {
  runScenario4().catch(console.error);
}

module.exports = runScenario4;
