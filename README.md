# Mutl-tenant Task Manager Platform - Backend System

A production-ready, multi-tenant task management platform built with Node.js, Express, PostgreSQL, Redis, and Bull. This system includes role-based access control, workflow state machines, audit logging, async job processing, optimistic locking, optimization, and more.

---

## Architecture Overview

### Technology Stack
- **Runtime**: Node.js v22+ with ES6+ features
- **Framework**: Express 5
- **Database**: PostgreSQL 16+
- **Queue**: Bull (Redis-backed) + Docker (optional) for async job processing
- **Auth**: JWT with bcrypt password hashing
- **Migrations**: node-pg-migrate for schema versioning

### Layered Architecture
The codebase follows strict **separation of concerns** with zero business logic in controllers:

```
src/
├── routes/          # Endpoint definitions & middleware chaining
├── controllers/     # HTTP request/response handling
├── services/        # Business logic & orchestration
├── repositories/    # Database queries & data access
├── middlewares/     # Auth, validation, error handling
├── workers/         # Background job processors
├── queues/          # Job queue definitions
└── validations/     # Joi schemas for input validation
```

### Business Logic

This system enforces strict business rules for multi-tenancy, role-based access control, task workflow state machines, and data integrity. For complete documentation of all business rules, see **[BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md)**.

**Key highlights**:
- **Multi-tenant isolation**: All resources scoped to organization, zero cross-tenant access
- **RBAC**: Three roles (Admin, Manager, Member) with hierarchical permissions
- **Task workflow**: State machine with validated transitions (`todo` → `in_progress` → `review` → `done`)
- **Optimistic locking**: Version-based concurrency control prevents lost updates
- **Audit trail**: All write operations logged with correlation IDs for debugging
- **Notifications**: Asynchronous email notifications for task assignments, completions, and user deactivations with retries on failure

---

## Setup & Running

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+ (for Bull queue)
- Ensure Reids is running for notification

### Environment Variables (check .env. example)
Create `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=task_manager
DATABASE_URL=postgres://postgres:password@localhost:5432/task-manager
JWT_SECRET=your-secret-key
PEPPER=additional-password-pepper
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GMAIL_USER=your-gmail@gmail.com
GMAIL_PASSWORD=your-gmail-password # App password on gmail (search inside manage google account)
TEST_EMAIL=your-test-email@gmail.com
```

### Installation & Seed
```bash
npm install
npm run db:rebuild  # Wipes DB, runs migrations, seeds 5k records with accounts to test
npm run dev         # Start dev server
```

### Running Tests
```bash
npm run test:full   # Runs all 25+ endpoint tests

Read [SCRIPT_TEST.md](tests/SCRIPT_TEST.md) and [MANUAL_API_TEST.md](tests/http/MANUAL_API_TEST.md) for more information
```

### Available NPM Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with hot-reload (nodemon) |
| `npm run migrate:up` | Run pending migrations |
| `npm run db:rebuild` | **Clean slate**: Drop all tables → migrate → seed |
| `npm test:full` | Execute full test suite |


## Schema Design Strategies

**Extensions**: `pgcrypto` (UUID generation), `citext` (case-insensitive email lookups)  
**Enums**: `org_status`, `user_role`, `project_status`, `task_status`, `task_priority` → Type safety + readability

### Key Table Designs

| Table | Key Decisions | Why |
|-------|---------------|-----|
| **Users** | Partial index `(org_id, role, created_at DESC, id) WHERE is_active = true` | 60% index size reduction, optimizes active user queries |
| **Projects** | Partial index `WHERE status != 'archived'` | Skip dead records, enhances performance in most queries |
| **Tasks** | `version` column + partial index `WHERE is_deleted = false` | Optimistic locking + soft delete support |
| **Task Workflows** | Denormalized `project_id` | Eliminates JOIN for org-wide audit queries (2x faster) |
| **Audit Logs** | Expression index `(metadata->>'request_id')` | Fast correlation ID lookups in JSONB |
| **Project Members** | Composite PK `(user_id, project_id)` | Enforces uniqueness in many-to-many |

### Indexing Strategy

**Decision**: Composite indexes for pagination (`created_at DESC, id DESC`).  
**Why**: Tie-breaking with `id` ensures stable cursor-based pagination.

**Decision**: Partial indexes on filtered queries (`WHERE is_active = true`).  
**Why**: Smaller index size (60-80% reduction) without sacrificing query speed.

**Decision**: Expression indexes for JSONB fields.  
**Why**: Makes flexible metadata queryable without schema migrations.

### Foreign Key Cascades

| Delete Trigger | Rule | Reasoning |
|----------------|------|-----------|
| User → Tasks | `SET NULL` | Preserve history even after user deletion |
| Organization → Users | `CASCADE` | Clean org removal |
| Task → Workflows | `CASCADE` | Workflow meaningless without task |

---

## Transaction Management & Async Operations

**Decision**: Wrap multi-step operations in database transactions with background worker queues.
**Problem**: Task status updates require 3 writes (task, workflow, audit) - partial failures would corrupt state. Background workers could slow down operation.
**Why**: All-or-nothing semantics ensure consistency, while keeping background jobs on separate queues.

---

## Concurrency & Data Integrity

### Optimistic Locking
**Decision**: Add `version` column to tasks table.  
**Problem**: Concurrent updates overwrite each other (lost update problem).  
**Why**: Version check in WHERE clause (`WHERE id = $1 AND version = $2`) prevents conflicts without blocking. Returns 409 on mismatch.

---

## Pagination Strategy

**Decision**: Cursor-based pagination using `{sortValue, id}`.  
**Problem**: OFFSET pagination has inconsistent results when data mutates + O(n) performance.  
**Why**: Cursors guarantee stable results and O(log n) seek performance.

---

## Background Workers & Notifications

**Decision**: Bull queue (Redis-backed) for async email notifications.  
**Problem**: Email latency (200-500ms) blocks API responses.  
**Why**: Decouples I/O from request cycle. Built-in retries (3x exponential backoff) and crash recovery.

```
Task Update → Service → Queue.add(job) → Bull Worker → Send Email
```

---

## Security Measures

**Organization Scoping**  
**Decision**: Filter all queries by `user.organization_id`.  
**Why**: Architectural isolation prevents cross-tenant data leaks.

**Role-Based Access Control**  
**Decision**: Middleware chains (`authorize('admin', 'manager')`).  
**Why**: Declarative auth at route level, zero business logic in services.

**Input Validation**  
**Decision**: Joi schemas validate before service layer.  
**Why**: Fail-fast validation catches malformed input before DB queries.

**SQL Injection Prevention**  
**Decision**: 100% parameterized queries (`$1`, `$2` placeholders).  
**Why**: Zero string concatenation eliminates attack vector.

**Mass Assignment Protection**  
**Decision**: Explicit field extraction (`const { title, priority } = req.body`).  
**Why**: Whitelist approach prevents unauthorized field updates.

---

## Observability & Debugging

**Correlation ID Tracing**  
**Decision**: Inject `X-Correlation-ID` header into every request.  
**Problem**: Tracing user actions across logs, DB writes, and external calls.  
**Why**: Single ID links request → audit_logs → email jobs.

**Audit Logging**  
**Decision**: Log all write operations to `audit_logs` table.  
**Problem**: Compliance requirements and debugging "who changed what."  
**Why**: Immutable trail + JSONB metadata for flexible queries.

```sql
CREATE INDEX idx_audit_correlation ON audit_logs ((metadata->>'request_id'));
```

---

## API Design Patterns

### Consistent Response Format
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "has_more": true,
    "next_cursor": "encoded_cursor"
  }
}
```

### Error Responses
```json
{
  "success": false,
  "error": "Task not found",
  "request_id": "correlation-id"
}
```

---

## Key Trade-offs

### 1. **Raw SQL vs ORM**
**Choice**: Raw SQL via `pg` library.

**Pros**: 
- Full control over query optimization
- No hidden N+1 queries
- Explicit transaction handling

**Cons**: 
- Manual SQL writing
- No automatic migrations from models

**Verdict**: Complex joints and performance + learning SQL experience.

### 2. **Cursor Pagination**
**Choice**: Cursor-based (not OFFSET).

**Pros**: 
- Consistent results during data mutations
- O(log n) seek vs O(n) scan

**Cons**: 
- Can't jump to arbitrary page numbers
- Slightly more complex client logic

**Verdict**: Consistency and speed > convenience

### 3. **Denormalized project_id in Workflows**
**Choice**: Add redundant `project_id` to `task_workflows`.

**Pros**: 
- Skip JOIN for org-wide history queries
- Way faster queries

**Cons**: 
- Storage overhead (~5% for typical workload)
- Potential inconsistency if not maintained

**Verdict**: Audit systems query history FAR more than they write. Read optimization justified.

---

## Performance Characteristics

### Query Performance
All operations have an average response time of 2-5ms.
Stress tested with 1000 task retrieval request and response only went up to 10ms.

---

## Testing Strategy

### Automated Test Coverage
- **27 endpoints** tested across 5 scenarios
- **RBAC enforcement** verified (Admin/Manager/Member scoping)
- **Workflow validation** edge cases (invalid transitions)
- **Optimistic locking** conflict simulation
- **Pagination** cursor stability checks

See `tests/run-all-tests.js` for all testing scenarios (5 scenarios that tests all endpoints/features)

---

## API Documentation

See [`API_ENDPOINTS.md`](./API_ENDPOINTS.md) for complete endpoint reference (27 endpoints across 7 categories).

---

## Author

Huy B. Huynh: [EMAIL_ADDRESS]
