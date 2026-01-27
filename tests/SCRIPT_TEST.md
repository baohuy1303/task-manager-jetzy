# API Test Suite

## Overview
Comprehensive scenario-based test suite covering all 25 API endpoints with happy paths and error cases.

## Running Tests

### First, ensure the database is clean and seeded
```bash
npm run db:rebuild
```

### Run All Scenarios
```bash
npm run test:full
```

### Run Individual Scenarios
```bash
node tests/scenario-1-user-lifecycle.js
node tests/scenario-2-project-task-workflow.js
node tests/scenario-3-admin-operations.js
node tests/scenario-4-security-edge-cases.js
node tests/scenario-5-email-notifications.js
```

## Test Scenarios

### Scenario 1: User Lifecycle & Authentication
**Endpoints**: 8 (2 Auth + 6 User)  
**Tests**: 15 total (happy + error)

**Coverage**:
- Registration (happy + duplicate email)
- Login (happy + invalid password)
- User creation (happy + errors)
- List/filter users
- Update user roles
- Deactivate/Reactivate users
- **Security**: Admin self-deactivation prevention

### Scenario 2: Project & Task Workflow
**Endpoints**: 11 (4 Project + 5 Task + 1 User + 1 Workflow)  
**Tests**: 19 total (happy + error)

**Coverage**:
- Project CRUD operations
- Task CRUD operations
- **Workflow validation**: Valid and invalid status transitions
- **Task Workflow History**: History retrieval, pagination, and project_id denormalization
- Project member assignment
- Task filtering and pagination
- **Soft delete** verification

### Scenario 3: Admin Operations & Audit Logs
**Endpoints**: 5 (4 Organization + 1 Audit)  
**Tests**: 8 total

**Coverage**:
- Organization suspend/activate
- Audit log queries
- Filter by entity_type, action
- **Correlation ID tracing**
- Audit log pagination

### Scenario 4: Security & Edge Cases
**Endpoints**: All (security layer)  
**Tests**: 9 total

**Coverage**:
- **RBAC**: Member access restrictions
- **Organization scoping**: Cross-org isolation
- **Optimistic locking**: Concurrent update protection
- **Workflow validation**: Invalid transitions

### Scenario 5: Email Notifications & Background Worker
**Endpoints**: Mix (Notification + Org + User + Task)  
**Tests**: 10 total

**Coverage**:
- **Task Assignment**: Notifications queued to Bull on creation/reassignment
- **Task Completion**: Manager notifications for finished tasks
- **User Deactivation**: Admin/Manager notification of unassigned residue
- **Organization Suspension**: Impact on non-admin login and operations
- **Audit Trail**: Verification of successful notification jobs and failure logging
- **Correlation ID**: Propagation through background workers

## Test Output

The test suite provides color-coded output:
- ✅ Green: Tests passed
- ❌ Red: Tests failed (or expected errors)
- 🔵 Blue: Section headers
- ⚪ Gray: Correlation IDs

## Total Coverage

- **Endpoints**: 25/25 (100%)
- **Tests**: 61 total
- **Happy Paths**: 43 tests
- **Error Cases**: 18 tests
- **Security Tests**: 9 specific security validations

## Features Demonstrated

✅ **Authentication**: JWT tokens, bcrypt + pepper  
✅ **Authorization**: RBAC (Admin, Manager, Member)  
✅ **Multi-tenancy**: Organization scoping  
✅ **Workflow Engine**: Status transition validation  
✅ **Audit Logging**: Complete activity tracking  
✅ **Correlation ID**: End-to-end request tracing  
✅ **Pagination**: Cursor-based pagination  
✅ **Optimistic Locking**: Version-based conflict detection  
✅ **Soft Delete**: Data preservation  
✅ **Security**: Self-deactivation prevention, cross-org isolation  

## Requirements

- Server must be running: `npm run dev`
- PostgreSQL database must be accessible
- Redis must be running (for background jobs)
