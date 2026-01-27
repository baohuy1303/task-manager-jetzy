# Manual API Testing Guide (REST Client)

This guide provides instructions for manually testing the API using a realistic large dataset (5,000+ records) and the VS Code REST Client.

## Prerequisites
- **VS Code Extension**: [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
- **Local Environment**: Server running (`npm run dev`) and PostgreSQL/Redis active.

## Quick Setup
Run the following command to reset and seed the database with 5 organizations, 500 users, and 5,000 tasks:

```bash
npm run db:rebuild
```

## How to Test
1. Open `tests/http/api-tests.http` in VS Code.
2. **Login First**: Click "Send Request" on the login blocks at the top (Admin, Manager, or Member).
3. **Variables**: The file automatically captures tokens and IDs into variables (e.g., `{{token}}`).
4. **Execute**: Click "Send Request" above any endpoint to see the response.

## Key Test Areas
- **Authentication**: Login as different roles to receive JWT tokens.
- **RBAC**: Verify that `Members` cannot create projects while `Managers` can.
- **Pagination**: All list endpoints (Users, Projects, Tasks) use cursor-based pagination.
- **Task Workflow**:
  - Update task status via `PATCH /tasks/:id/status`.
  - View status transition history via `GET /task-workflows/tasks/:id/history`.
- **Audit Logs**: Trace operations using `correlation_id` to see exactly how requests were processed.
- **Performance**: Test large limits (e.g., `limit=1000`) to verify query speeds.

## Sample Credentials
*Seed data uses these defaults across 5 organizations:*
- **Admin**: `admin-1@org1.com` / `password123`
- **Manager**: `manager-1@org1.com` / `password123`
- **Member**: `member-1@org1.com` / `password123`

---
> [!TIP]
> Use `Ctrl+Alt+R` (Windows) or `Cmd+Alt+R` (Mac) as a shortcut to send requests in the `.http` file.
