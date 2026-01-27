# Complete API Endpoint Documentation

## Base URL
`http://localhost:3000/api/v1`

---

## 1. Authentication Endpoints

### POST `/auth/register`
**Description**: Register a new admin user and create an organization  
**Authorization**: None (Public)  
**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "organization_name": "ACME Corp"
}
```

**Use Cases**:
- New company signs up for the platform
- First admin user creation for an organization
- Multi-tenant onboarding

**Test Cases**:
- ✅ Happy: Valid registration with unique email
- ❌ Error: Duplicate email (409 Conflict)
- ❌ Error: Invalid email format (400 Bad Request)
- ❌ Error: Missing required fields (400 Bad Request)

---

### POST `/auth/login`
**Description**: Authenticate user and get JWT token  
**Authorization**: None (Public)  
**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Use Cases**:
- User logs into the application
- Getting JWT token for API access
- Session initiation

**Test Cases**:
- ✅ Happy: Valid credentials (200 OK with token)
- ❌ Error: Invalid password (401 Unauthorized)
- ❌ Error: Non-existent email (401 Unauthorized)
- ❌ Error: Deactivated user (401 Unauthorized)

---

## 2. Organization Endpoints

### POST `/organizations`
**Description**: Create a new organization (admin creates sub-org)  
**Authorization**: Admin only  
**Request Body**:
```json
{
  "name": "Sub Organization Name"
}
```

**Use Cases**:
- Admin creating a subsidiary organization
- Multi-org setup within platform

**Test Cases**:
- ✅ Happy: Admin creates org (201 Created)
- ❌ Error: Non-admin tries to create (403 Forbidden)
- ❌ Error: Duplicate organization name (409 Conflict)
- ❌ Error: Suspended organization blocks operation (403)

---

### GET `/organizations/:id`
**Description**: Get organization details  
**Authorization**: Authenticated users (org members)  
**Use Cases**:
- View organization profile
- Check organization status

**Test Cases**:
- ✅ Happy: User views their own org (200 OK)
- ❌ Error: User tries to view different org (403 Forbidden)
- ❌ Error: Organization not found (404 Not Found)

---

### PATCH `/organizations/:id/suspend`
**Description**: Suspend an organization  
**Authorization**: Admin only  
**Use Cases**:
- Suspend org for non-payment
- Security incident response
- Compliance violation

**Test Cases**:
- ✅ Happy: Admin suspends org (200 OK)
- ❌ Error: Non-admin tries to suspend (403 Forbidden)
- ❌ Error: Org not found (404 Not Found)

---

### PATCH `/organizations/:id/activate`
**Description**: Reactivate a suspended organization  
**Authorization**: Admin only  
**Use Cases**:
- Reactivate after payment received
- Restore access after issue resolved

**Test Cases**:
- ✅ Happy: Admin activates suspended org (200 OK)
- ❌ Error: Non-admin tries to activate (403 Forbidden)

---

## 3. User Endpoints

### POST `/users`
**Description**: Create a new user within organization  
**Authorization**: Admin only  
**Request Body**:
```json
{
  "organization_id": "uuid",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "role": "member"
}
```

**Use Cases**:
- Admin adds new team member
- Bulk user onboarding
- Creating manager accounts

**Test Cases**:
- ✅ Happy: Admin creates user (201 Created)
- ❌ Error: Duplicate email (409 Conflict)
- ❌ Error: Non-admin tries to create (403 Forbidden)
- ❌ Error: Invalid role (400 Bad Request)
- ❌ Error: Cross-org user creation attempt (403 Forbidden)

---

### GET `/users`
**Description**: List all users in organization with pagination  
**Authorization**: Admin, Manager, Member  
**Query Parameters**: `role`, `is_active`, `project_id`, `search`, `limit`, `cursor`  

**Use Cases**:
- View team directory
- Find users by role
- Search users by name
- Get users assigned to specific project

**Test Cases**:
- ✅ Happy: Get all users paginated (200 OK)
- ✅ Happy: Filter by role=member
- ✅ Happy: Search by name
- ✅ Happy: Pagination with cursor

---

### GET `/users/:id`
**Description**: Get user details by ID  
**Authorization**: Admin, Manager, Member (self)  
**Use Cases**:
- View user profile
- Check user assignments
- Verify user role

**Test Cases**:
- ✅ Happy: User views their own profile (200 OK)
- ✅ Happy: Admin views any user (200 OK)
- ❌ Error: Member views different user (may be restricted)
- ❌ Error: User not found (404 Not Found)

---

### PATCH `/users/:id`
**Description**: Update user details (name, email, role)  
**Authorization**: Admin (all), Manager (limited), Member (self)  
**Request Body**:
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "role": "manager"
}
```

**Use Cases**:
- Admin promotes user to manager
- User updates their profile
- Email change requests

**Test Cases**:
- ✅ Happy: Admin changes user role (200 OK)
- ✅ Happy: User updates own name (200 OK)
- ❌ Error: Member tries to change role (403 Forbidden)
- ❌ Error: Duplicate email (409 Conflict)

---

### PATCH `/users/:id/project`
**Description**: Assign or remove user from project  
**Authorization**: Admin, Manager  
**Request Body**:
```json
{
  "project_id": "uuid",
  "action": "assign"  // or "remove"
}
```

**Use Cases**:
- Assign member to project
- Remove member from project
- Project team management

**Test Cases**:
- ✅ Happy: Manager assigns member to project (200 OK)
- ❌ Error: Member already assigned to another project (400 Bad Request)
- ❌ Error: Project not found (404 Not Found)
- ❌ Error: Member tries to assign (403 Forbidden)

---

### DELETE `/users/:id`
**Description**: Deactivate a user (soft delete)  
**Authorization**: Admin only  
**Use Cases**:
- Employee leaves company
- Revoke user access
- Security incident response

**Test Cases**:
- ✅ Happy: Admin deactivates user (200 OK)
- ❌ Error: Admin tries to deactivate self (403 Forbidden) **[Security Safeguard]**
- ❌ Error: Non-admin tries to deactivate (403 Forbidden)
- ❌ Error: User not found (404 Not Found)

---

### PATCH `/users/:id/activate`
**Description**: Reactivate a deactivated user  
**Authorization**: Admin only  
**Use Cases**:
- Rehire former employee
- Restore access after issue resolved

**Test Cases**:
- ✅ Happy: Admin reactivates user (200 OK)
- ❌ Error: Non-admin tries to activate (403 Forbidden)

---

## 4. Project Endpoints

### POST `/projects`
**Description**: Create a new project  
**Authorization**: Admin, Manager  
**Request Body**:
```json
{
  "name": "Website Redesign",
  "description": "Q1 2026 website refresh",
  "status": "active"
}
```

**Use Cases**:
- Start new project
- Create project for team
- Initialize project tracking

**Test Cases**:
- ✅ Happy: Manager creates project (201 Created)
- ❌ Error: Duplicate project name in org (409 Conflict)
- ❌ Error: Member tries to create (403 Forbidden)
- ❌ Error: Invalid status (400 Bad Request)

---

### GET `/projects`
**Description**: List projects with pagination and filters  
**Authorization**: All authenticated users  
**Query Parameters**: `status`, `search`, `created_by`, `created_after`, `created_before`, `limit`, `cursor`, `user_id`  

**Use Cases**:
- View all organization projects
- Filter projects by status
- Search projects by name
- Get projects a user is assigned to

**Test Cases**:
- ✅ Happy: Get all projects (200 OK)
- ✅ Happy: Filter by status=active
- ✅ Happy: Search by name
- ✅ Happy: Get projects for specific user

---

### GET `/projects/:id`
**Description**: Get project details  
**Authorization**: All authenticated users  
**Use Cases**:
- View project info
- Check project status
- See project members

**Test Cases**:
- ✅ Happy: User views project (200 OK)
- ❌ Error: Project not found (404 Not Found)
- ❌ Error: Cross-org access attempt (403 Forbidden)

---

### PATCH `/projects/:id`
**Description**: Update project details  
**Authorization**: Admin, Manager  
**Request Body**:
```json
{
  "name": "Updated Project Name",
  "description": "New description",
  "status": "archived"
}
```

**Use Cases**:
- Update project details
- Archive completed projects
- Change project status to draft/active

**Test Cases**:
- ✅ Happy: Manager updates project (200 OK)
- ❌ Error: Duplicate name (409 Conflict)
- ❌ Error: Member tries to update (403 Forbidden)

---

## 5. Task Endpoints

### POST `/tasks`
**Description**: Create a new task  
**Authorization**: Admin, Manager  
**Request Body**:
```json
{
  "project_id": "uuid",
  "title": "Fix login bug",
  "description": "Users can't login",
  "priority": "high",
  "assigned_to": "user_uuid",
  "due_date": "2026-02-01"
}
```

**Use Cases**:
- Create task for team member
- Track work items
- Assign work to users

**Test Cases**:
- ✅ Happy: Manager creates task (201 Created)
- ✅ Happy: Task creation triggers notification to assignee
- ❌ Error: Invalid project (404 Not Found)
- ❌ Error: Member tries to create (403 Forbidden)

---

### GET `/tasks`
**Description**: List tasks with pagination and filters  
**Authorization**: All authenticated users  
**Query Parameters**: `project_id`, `status`, `priority`, `assigned_to`, `due_before`, `due_after`, `limit`, `cursor`  

**Use Cases**:
- View all tasks
- Get tasks assigned to specific user
- Filter by status (todo, in_progress, etc.)
- Find high-priority tasks

**Test Cases**:
- ✅ Happy: Get all tasks (200 OK)
- ✅ Happy: Filter by assigned_to=user_id
- ✅ Happy: Filter by status=in_progress
- ✅ Happy: Get tasks due before date

---

### GET `/tasks/:id`
**Description**: Get task details  
**Authorization**: All authenticated users  
**Use Cases**:
- View task information
- Check task status
- See assignment details

**Test Cases**:
- ✅ Happy: User views task (200 OK)
- ❌ Error: Task not found (404 Not Found)
- ❌ Error: Soft-deleted task (404 Not Found)

---

### PATCH `/tasks/:id`
**Description**: Update task fields (Admin/Manager full update)  
**Authorization**: Admin, Manager  
**Request Body**:
```json
{
  "title": "Updated title",
  "description": "New description",
  "priority": "medium",
  "assigned_to": "new_user_uuid",
  "version": 1
}
```

**Use Cases**:
- Reassign task
- Update task details
- Change priority

**Test Cases**:
- ✅ Happy: Manager updates task (200 OK)
- ❌ Error: Version mismatch (409 Conflict) **[Optimistic Locking]**
- ❌ Error: Invalid assigned_to user (404 Not Found)

---

### PATCH `/tasks/:id/status`
**Description**: Update task status with workflow validation  
**Authorization**: All authenticated users (including Members)  
**Request Body**:
```json
{
  "status": "in_progress",
  "version": 1
}
```

**Use Cases**:
- Member updates status of assigned task
- Progress tracking
- Workflow transitions

**Test Cases**:
- ✅ Happy: Update todo → in_progress (200 OK)
- ✅ Happy: Update review → done (triggers manager notifications)
- ❌ Error: Invalid transition todo → done (400 Bad Request) **[Workflow Validation]**
- ❌ Error: Version mismatch (409 Conflict)

---

### DELETE `/tasks/:id`
**Description**: Soft delete a task  
**Authorization**: Admin, Manager  
**Use Cases**:
- Remove cancelled tasks
- Clean up duplicate tasks
- Archive old tasks

**Test Cases**:
- ✅ Happy: Manager deletes task (200 OK)
- ❌ Error: Task not found (404 Not Found)
- ❌ Error: Member tries to delete (403 Forbidden)

---

## 6. Task Workflow History Endpoints

### GET `/task-workflows/tasks/:taskId/history`
**Description**: Get status change history for a specific task  
**Authorization**: All authenticated users  
**Query Parameters**: `changed_by`, `from_status`, `to_status`, `limit`, `cursor`  

**Use Cases**:
- View complete timeline of task status transitions
- Check who moved task to specific status
- Audit workflow compliance

**Test Cases**:
- ✅ Happy: Task history retrieved (200 OK)
- ✅ Happy: Filter by changed_by user
- ✅ Happy: Pagination with cursor
- ❌ Error: Task not found (404 Not Found)
- ❌ Error: Non-member accessing project task (403 Forbidden)

---

### GET `/task-workflows/history`
**Description**: Organization-wide task status change history  
**Authorization**: Admin, Manager  
**Query Parameters**: `task_id`, `project_id`, `changed_by`, `from_status`, `to_status`, `limit`, `cursor`  

**Use Cases**:
- Monitor team activity and velocity
- Audit all status changes across organization
- Track productivity patterns

**Test Cases**:
- ✅ Happy: Org-wide history retrieved (200 OK)
- ✅ Happy: Filter by project or user
- ✅ Happy: Pagination support
- ❌ Error: Member tries to access (403 Forbidden)

---

## 7. Audit Log Endpoints


### GET `/audit-logs`
**Description**: Query audit logs with advanced filtering  
**Authorization**: Admin only  
**Query Parameters**: `entity_type`, `entity_id`, `action`, `performed_by`, `correlation_id`, `start_date`, `end_date`, `limit`, `cursor`  

**Use Cases**:
- Security investigations (who changed what)
- Compliance audits
- Request tracing via correlation_id
- User activity monitoring

**Test Cases**:
- ✅ Happy: Admin queries all logs (200 OK)
- ✅ Happy: Filter by entity_type=task
- ✅ Happy: Trace request by correlation_id
- ✅ Happy: Get logs in date range
- ❌ Error: Non-admin tries to query (403 Forbidden)
- ❌ Error: Admin from Org A cannot see Org B logs **[Security: Org Scoping]**

---

## Total Endpoints: 27

### By Category:
- **Authentication**: 2 endpoints
- **Organizations**: 4 endpoints
- **Users**: 7 endpoints
- **Projects**: 4 endpoints
- **Tasks**: 7 endpoints
- **Task Workflow History**: 2 endpoints
- **Audit Logs**: 1 endpoint

### By Authorization:
- **Public**: 2 (register, login)
- **Admin Only**: 9
- **Admin + Manager**: 8
- **All Users**: 6

### Key Features:
- ✅ Pagination on all list endpoints
- ✅ Advanced filtering
- ✅ Workflow validation (tasks)
- ✅ Optimistic locking (concurrent updates)
- ✅ Soft delete (tasks)
- ✅ Organization scoping (all endpoints)
- ✅ Correlation ID tracing (all endpoints)
