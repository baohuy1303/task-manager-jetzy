**Evaluation Task**

**Technology Stack:** Node.js, Express.js, PostgreSQL

**Task Objective**

Design & implement a scalable, secure, multi-tenant backend system that supports projects,
workflows, role-based access control, audit logging, & asynchronous processing, using
PostgreSQL as the core data store. The solution must reflect real-world backend engineering
decisions, not tutorial-level CRUD.

**System Overview**

Build a Project & Workflow Management Platform where organizations manage projects, tasks,
approvals, and activity history. The system must support:

- Multiple organizations (tenants)
- Role-based permissions
- Workflow states & transitions
- Auditing & traceability
- Asynchronous background jobs
- Strict data integrity

**Database Design (PostgreSQL – Mandatory)**

You must design the schema yourself.

**Core Entities (Minimum)**

- **Organizations:** id, name, status (active, suspended), created_at
- **Users:** id, organization_id (FK), name, email (unique per organization), role (admin,
    manager, member), is_active, created_at


- **Projects:** id, organization_id (FK), name, description, created_by (FK → users), status
    (draft, active, archived), created_at
- **Tasks:** id, project_id (FK), title, description, status (todo, in_progress, review, done),
    priority, assigned_to (FK → users), due_date, created_at
- **Task_Workflows:** id, task_id (FK), from_status, to_status, changed_by (FK → users),
    changed_at
- **Audit_Logs:** id, organization_id (FK), entity_type, entity_id, action, performed_by (FK →
    users), metadata (JSONB), created_at

**Database Requirements**

- Proper normalization
- Composite unique constraints where applicable
- Indexing strategy justified
- Foreign key cascading rules explicitly defined
- Use of transactions for multi-step operations
- SQL migrations must be provided

**API Requirements**

**Authentication & Authorization**

- Token-based authentication (JWT or similar)
- Role-based access control:
    o **Admin:** full access
    o **Manager:** project & task control
    o **Member:** task-level access only

**Core APIs (Non-Exhaustive)**

- **Organizations:** Create organization, Suspend / activate organization
- **Users:** Create user under organization, Assign / change roles, Deactivate user
- **Projects:** Create project, Update project, Archive project, List projects (pagination +
    filters)


- **Tasks:** Create task, Assign / reassign task, Update status (must follow workflow rules),
    Delete task (soft delete only)

**Workflow Engine (Critical)**

- Task status transitions must be validated
- Invalid transitions must be rejected
- Every status change must:
    o Be transactional
    o Write to Task_Workflows
    o Write to Audit_Logs

**Asynchronous Processing**

Implement a background worker for:

- Sending notifications on: Task assignment, Status change
- Logging long-running operations

**Use:** Queue-based approach (Bull, RabbitMQ, or custom PostgreSQL queue)

**Error Handling & Observability**

- Centralized error handling
- Structured error responses
- Request correlation ID
- Graceful handling of database failures

**Data Integrity & Edge Cases**

The system must correctly handle:

- Deleting users with assigned tasks
- Organization suspension impact
- Concurrent updates on same task
- Partial failures (rollback behavior)

**Performance Expectations**


- Pagination mandatory for list endpoints
- Prevent N+1 query problems
- Use efficient joins & indexes
- Avoid ORM anti-patterns

**Security Requirements**

- Input validation everywhere
- No mass assignment vulnerabilities
- SQL injection prevention
- Sensitive data excluded from logs

**Architecture Expectations**

- Clear separation: routes, controllers, services, repositories / data access layer
- No business logic in controllers
- Environment-based configuration
- Clean, readable, maintainable code

**Deliverables**

- Complete backend source code
- PostgreSQL schema & migrations
- Clear README explaining:
    o Architecture decisionsp
    o How to run the system
    o Trade-offs made


