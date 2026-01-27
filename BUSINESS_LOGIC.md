# Business Logic Rules

This document manages all the business rules that govern this task management system. These rules are enforced at the service layer to ensure data integrity, multi-tenancy, and security.

---

## 1. Multi-Tenancy & Organization Rules
- **Organization Creation**: Organizations are created only during registration (one admin = one organization).
- **Resource Scoping**: All resources (users, projects, tasks) are scoped to their organization.
- **Isolation**: Users cannot access or modify resources from other organizations.
- **Status Enforcement**: Organization status (`active` | `suspended`) affects all member access (except admins).
- **Immutability**: Organizations cannot be deleted (only suspended).

## 2. User Authentication & Status Rules
- **Unique Identity**: Email addresses are globally unique across all organizations.
- **Password Security**: Passwords are hashed with bcrypt + pepper for additional security.
- **Token Lifecycle**: JWT tokens expire after 1 day and include user id, role, and organization_id.
- **Login Restrictions**: Inactive users cannot log in.
- **Suspension Logic**: Users in suspended organizations cannot log in (except admins).

## 3. Role-Based Access Control (RBAC)

### Admin
- Create users within their organization
- Update any user in their organization (including roles)
- Assign/remove projects for managers and members
- Create, update, delete projects
- Create, update, delete tasks
- Suspend/activate their organization
- Bypass suspension restrictions

### Manager
- Assign/remove projects for members only (not admins or other managers)
- Create, update, delete projects
- Create, update, delete tasks
- Update own profile (except role)
- Can see all projects/tasks in organization

### Member
- Can only see projects they are assigned to
- Can update task status on any task in their projects
- Can view tasks in their assigned projects
- Update own profile (except role, is_active, organization_id)
- Cannot create/delete projects or tasks
- Can only be assigned to **ONE** project at a time

## 4. Task Workflow State Machine
Valid transitions are strictly enforced:
- `todo` → `in_progress`
- `in_progress` → `review` or `todo`
- `review` → `done` or `in_progress`
- `done` → `review`

*All status changes are validated and logged in the workflow history for audit queries.*

## 5. Project Management Rules
- **Naming**: Project names must be unique per creator.
- **Status**: Projects have status: `draft` | `active` | `archived`.
- **Archiving**: Archived projects cannot have tasks created or modified.
- **Reactivation**: Archived projects can only be reactivated (status changed to `active`).
- **Membership**: Project members are tracked via many-to-many relationship.
- **Visibility**: Members can only see projects they're assigned to; Admins/Managers see all.

## 6. Task Management Rules
- **Integrity**: Tasks cannot be created in archived projects.
- **Boundaries**: Tasks belong to one project (cannot be moved between projects).
- **Assignment**: Tasks can be assigned to any active user in the organization.
- **Defaults**: If no assignee is specified, task is auto-assigned to creator.
- **Optimistic Locking**: Task updates require version number; concurrent updates return 409 Conflict if version mismatch.
- **History**: Tasks use soft delete (`is_deleted` flag) to preserve audit history.
- **Permissions**: Members can update status on tasks in their assigned projects. Only Admin/Manager can fully update tasks (title, description, priority, etc.).

## 7. Data Validation Rules
Enforced via Joi schemas:
- **User Names**: Minimum 2 characters.
- **Emails**: Must be valid email format.
- **Passwords**: Minimum 6 characters.
- **Organization Names**: Minimum 3 characters.
- **Project Names**: Minimum 3 characters.
- **Task Priorities**: `low` | `medium` | `high` | `urgent` (default: `medium`).
- **Task Status**: `todo` | `in_progress` | `review` | `done` (default: `todo`).
- **User Roles**: `admin` | `manager` | `member`.
- **Primary Keys**: All IDs are UUIDs.

## 8. Assignment & Membership Rules
- **Admin Exemption**: Admins cannot be assigned to projects (they have global access).
- **Capacity**: Members can only be assigned to ONE project at a time.
- **Authority**: Managers can assign/remove members only. Admins can assign/remove both managers and members.
- **Operations**: Attempting to assign a member to a second project will fail. Must remove old project assignment before reassigning.

## 9. Update Permission Rules
- **Self-Update**: Users can update their own profile (name, email, password).
- **Role Control**: Users cannot change their own role or `is_active` status.
- **Immutability**: Users cannot change their `organization_id`.
- **Administrative Rights**: Only admins can change other users' roles or deactivate/reactivate users.
- **Scope**: Admins can only manage users in their own organization.

## 10. Audit & Transaction Rules
- **Auditability**: All write operations (create, update, delete, status changes) are audited.
- **Tracing**: Audit logs include correlation IDs for request tracing.
- **Consistency**: Multi-step operations use database transactions (all-or-nothing).
- **Atomic Workflows**: Task status updates are transactional (task update + workflow log + audit log).
- **Metadata**: Audit logs are immutable and stored as JSONB for flexible querying.

## 11. Notifications & Background Workers
The system uses a Redis-backed Bull queue for asynchronous processing of non-blocking tasks.

- **Orchestration**: `NotificationService` handles logic; `emailQueue` manages job distribution.
- **Event: Task Assigned**: Assignee receives an immediate email notification when a task is created or re-assigned.
- **Event: Task Completed**: When a task moves to `done`, all **Project Managers** assigned to that project are notified.
- **Event: User Deactivation**: 
  - If an **Admin/Manager** is deactivated, all active **Admins** in the org are notified with a list of unassigned projects and tasks.
  - If a **Member** is deactivated, **Managers** of their assigned projects are notified about the newly unassigned tasks.
- **Processing**: The `emailWorker` processes jobs with a concurrency of 5 and uses `nodemailer` for delivery.
- **Data Integrity**: Notification failures are caught, logged to the **Audit Logs** (`notification_failure`), and scheduled for retry by the queue manager without impacting the primary API response.

---
See [API_ENDPOINTS.md](./API_ENDPOINTS.md) for technical implementation details.
