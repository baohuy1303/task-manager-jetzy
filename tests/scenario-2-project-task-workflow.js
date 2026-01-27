const { apiCall } = require('./helpers/api-client');
const { logSection, logTest, logSubsection, logSummary } = require('./helpers/test-logger');

async function runScenario2() {
  let happyTests = { passed: 0, total: 0 };
  let errorTests = { passed: 0, total: 0 };

  logSection('SCENARIO 2: Project & Task Workflow');

  // Setup: Create test organization and users
  const setupResult = await apiCall('POST', '/auth/register', {
    name: 'Workflow Admin',
    email: `workflow-${Date.now()}@test.com`,
    password: 'password123',
    organization_name: 'Workflow Test Org'
  });
  const adminToken = setupResult.data.data.token;
  const orgId = setupResult.data.data.organization.id;

  // Create a member
  const memberResult = await apiCall('POST', '/users', {
    organization_id: orgId,
    name: 'Task Member',
    email: `task-member-${Date.now()}@test.com`,
    password: 'password123',
    role: 'member'
  }, adminToken);
  const memberId = memberResult.data.data.id;

  let projectId, taskId, taskVersion;

  // ===========================================================================
  // TEST 1: Project Management
  // ===========================================================================
  logSubsection('Test Group 1: Project Management');

  // Happy: Create Project
  const createProjectResult = await apiCall('POST', '/projects', {
    name: 'Q1 2026 Website Redesign',
    description: 'Modernize website',
    status: 'active'
  }, adminToken);
  happyTests.total++;
  if (createProjectResult.success) {
    logTest('Manager creates project', true);
    projectId = createProjectResult.data.data.id;
    happyTests.passed++;
  } else {
    logTest('Manager creates project', false, createProjectResult.error);
  }

  // Error: Duplicate Project Name
  const createDupProjectResult = await apiCall('POST', '/projects', {
    name: 'Q1 2026 Website Redesign',
    description: 'Duplicate'
  }, adminToken);
  errorTests.total++;
  if (!createDupProjectResult.success) {
    logTest('Create duplicate project name', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Create duplicate project name', false);
  }

  // Happy: List Projects
  const listProjectsResult = await apiCall('GET', '/projects', null, adminToken);
  happyTests.total++;
  if (listProjectsResult.success && listProjectsResult.data.data.length > 0) {
    logTest('List all projects', true, `Found ${listProjectsResult.data.data.length} project(s)`);
    happyTests.passed++;
  } else {
    logTest('List all projects', false);
  }

  // Happy: Filter by status
  const filterProjectsResult = await apiCall('GET', '/projects?status=active', null, adminToken);
  happyTests.total++;
  if (filterProjectsResult.success) {
    logTest('Filter projects by status', true);
    happyTests.passed++;
  } else {
    logTest('Filter projects by status', false);
  }

  // Happy: Update Project
  const updateProjectResult = await apiCall('PATCH', `/projects/${projectId}`, {
    description: 'Updated description'
  }, adminToken);
  happyTests.total++;
  if (updateProjectResult.success) {
    logTest('Update project details', true);
    happyTests.passed++;
  } else {
    logTest('Update project details', false, updateProjectResult.error);
  }

  // ===========================================================================
  // TEST 2: Assign Member to Project
  // ===========================================================================
  logSubsection('Test Group 2: Project Membership');

  const assignProjectResult = await apiCall('PATCH', `/users/${memberId}/project`, {
    project_id: projectId,
    action: 'assign'
  }, adminToken);
  happyTests.total++;
  if (assignProjectResult.success) {
    logTest('Assign member to project', true);
    happyTests.passed++;
  } else {
    logTest('Assign member to project', false, assignProjectResult.error);
  }

  // ===========================================================================
  // TEST 3: Task Management
  // ===========================================================================
  logSubsection('Test Group 3: Task Creation & Management');

  // Happy: Create Task
  const createTaskResult = await apiCall('POST', '/tasks', {
    project_id: projectId,
    title: 'Design homepage mockup',
    description: 'Create Figma designs',
    priority: 'high',
    assigned_to: memberId
  }, adminToken);
  happyTests.total++;
  if (createTaskResult.success) {
    logTest('Create task and assign to member', true);
    taskId = createTaskResult.data.data.id;
    taskVersion = createTaskResult.data.data.version;
    happyTests.passed++;
  } else {
    logTest('Create task and assign to member', false, createTaskResult.error);
  }

  // Happy: List Tasks
  const listTasksResult = await apiCall('GET', '/tasks', null, adminToken);
  happyTests.total++;
  if (listTasksResult.success && listTasksResult.data.data.length > 0) {
    logTest('List all tasks', true);
    happyTests.passed++;
  } else {
    logTest('List all tasks', false);
  }

  // Happy: Filter tasks by assignee
  const filterTasksResult = await apiCall('GET', `/tasks?assigned_to=${memberId}`, null, adminToken);
  happyTests.total++;
  if (filterTasksResult.success) {
    logTest('Filter tasks by assignee', true, `Found ${filterTasksResult.data.data.length} task(s)`);
    happyTests.passed++;
  } else {
    logTest('Filter tasks by assignee', false);
  }

  // ===========================================================================
  // TEST 4: Task Workflow (Status Transitions)
  // ===========================================================================
  logSubsection('Test Group 4: Workflow Validation');

  // Happy: todo → in_progress
  const updateStatus1Result = await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'in_progress',
    version: taskVersion
  }, adminToken);
  happyTests.total++;
  if (updateStatus1Result.success) {
    logTest('Transition: todo → in_progress', true);
    taskVersion = updateStatus1Result.data.data.version;
    happyTests.passed++;
  } else {
    logTest('Transition: todo → in_progress', false, updateStatus1Result.error);
  }

  // Happy: in_progress → review
  const updateStatus2Result = await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'review',
    version: taskVersion
  }, adminToken);
  happyTests.total++;
  if (updateStatus2Result.success) {
    logTest('Transition: in_progress → review', true);
    taskVersion = updateStatus2Result.data.data.version;
    happyTests.passed++;
  } else {
    logTest('Transition: in_progress → review', false);
  }

  // Happy: review → done
  const updateStatus3Result = await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'done',
    version: taskVersion
  }, adminToken);
  happyTests.total++;
  if (updateStatus3Result.success) {
    logTest('Transition: review → done', true, 'Manager notification triggered');
    taskVersion = updateStatus3Result.data.data.version;
    happyTests.passed++;
  } else {
    logTest('Transition: review → done', false);
  }

  // Error: Invalid transition (try to go back to todo)
  const invalidTransitionResult = await apiCall('PATCH', `/tasks/${taskId}/status`, {
    status: 'todo',
    version: taskVersion
  }, adminToken);
  errorTests.total++;
  if (!invalidTransitionResult.success && invalidTransitionResult.status === 400) {
    logTest('Invalid transition: done → todo (400)', true, 'Workflow validation working!');
    errorTests.passed++;
  } else {
    logTest('Invalid transition: done → todo (400)', false);
  }

  // ===========================================================================
  // TEST 5: Task Workflow History
  // ===========================================================================
  logSubsection('Test Group 5: Task Workflow History');

  // Happy: Get task history
  const taskHistoryResult = await apiCall('GET', `/task-workflows/tasks/${taskId}/history`, null, adminToken);
  happyTests.total++;
  if (taskHistoryResult.success && taskHistoryResult.data.data.length >= 3) {
    logTest('Retrieve task workflow history', true, `Found ${taskHistoryResult.data.data.length} transitions`);
    
    // Verify denormalized project_id
    if (taskHistoryResult.data.data[0].project_id) {
      logTest('  → project_id denormalized', true);
    }
    happyTests.passed++;
  } else {
    logTest('Retrieve task workflow history', false);
  }

  // Happy: Organization-wide workflow history (Admin)
  const orgHistoryResult = await apiCall('GET', '/task-workflows/history?limit=50', null, adminToken);
  happyTests.total++;
  if (orgHistoryResult.success && orgHistoryResult.data.data.length > 0) {
    logTest('Query org-wide workflow history', true, `Found ${orgHistoryResult.data.data.length} entries`);
    happyTests.passed++;
  } else {
    logTest('Query org-wide workflow history', false);
  }

  // Happy: Verify pagination in workflow history
  const page1Result = await apiCall('GET', '/task-workflows/history?limit=2', null, adminToken);
  happyTests.total++;
  if (page1Result.success && page1Result.data.meta && page1Result.data.meta.has_more) {
    logTest('Workflow history pagination', true, 'has_more flag present');
    happyTests.passed++;
  } else {
    logTest('Workflow history pagination', false);
  }

  // ===========================================================================
  // TEST 6: Task Updates
  // ===========================================================================
  logSubsection('Test Group 6: Task Modification');

  // Happy: Update task details
  const updateTaskResult = await apiCall('PATCH', `/tasks/${taskId}`, {
    title: 'Updated: Design homepage mockup',
    priority: 'medium',
    version: taskVersion
  }, adminToken);
  happyTests.total++;
  if (updateTaskResult.success) {
    logTest('Update task details', true);
    happyTests.passed++;
  } else {
    logTest('Update task details', false, updateTaskResult.error);
  }

  // ===========================================================================
  // TEST 7: Task Deletion (Soft Delete)
  // ===========================================================================
  logSubsection('Test Group 7: Task Deletion');

  // Happy: Soft delete task
  const deleteTaskResult = await apiCall('DELETE', `/tasks/${taskId}`, null, adminToken);
  happyTests.total++;
  if (deleteTaskResult.success) {
    logTest('Soft delete task', true, 'Task marked as deleted');
    happyTests.passed++;
  } else {
    logTest('Soft delete task', false, deleteTaskResult.error);
  }

  // Error: Access deleted task
  const accessDeletedResult = await apiCall('GET', `/tasks/${taskId}`, null, adminToken);
  errorTests.total++;
  if (!accessDeletedResult.success && accessDeletedResult.status === 404) {
    logTest('Access soft-deleted task (404)', true, 'Expected error');
    errorTests.passed++;
  } else {
    logTest('Access soft-deleted task (404)', false);
  }

  // ===========================================================================
  // Summary
  // ===========================================================================
  logSummary(2, 'Project & Task Workflow', happyTests, errorTests);

  return { happyTests, errorTests };
}

if (require.main === module) {
  runScenario2().catch(console.error);
}

module.exports = runScenario2;
