# HTTP Testing Guide

## Overview
Manual HTTP testing with realistic large dataset (5,000+ records) for testing pagination, filtering, and query performance.

## Prerequisites
- VS Code with **REST Client** extension installed
- Server running: `npm run dev`
- Database accessible

## Setup

### 1. Seed Database
```bash
npm run test:http:setup
```

This will:
- Reset the database (delete all data)
- Create 5 organizations
- Create 500 users (admins, managers, members)
- Create 250 projects
- Create 5,000 tasks
- Show sample credentials

### 2. Open HTTP File
Open `tests/http/api-tests.http` in VS Code

### 3. Login
Click "Send Request" on the login sections at the top of the file.

The responses will automatically populate variables:
- `@token` - Admin token
- `@managerToken` - Manager token
- `@memberToken` - Member token

### 4. Test Endpoints
Continue clicking "Send Request" on any endpoint you want to test.

All tokens and IDs flow automatically - no manual copying needed!

## How It Works

### Automatic Variable Capture
```http
### Login
# @name loginAdmin
POST /auth/login
{ "email": "admin-1@org1.com", "password": "password123" }

###
@token = {{loginAdmin.response.body.data.token}}

### Use immediately
GET /users
Authorization: Bearer {{token}}
```

The `@token` variable is automatically set from the login response and used in subsequent requests.

## Sample Credentials

After running `npm run test:http:setup`, use these credentials:

```
Admin:    admin-1@org1.com     / password123
Manager:  manager-1@org1.com   / password123
Member:   member-1@org1.com    / password123
```

## Testing Sections

The HTTP file contains the following sections:

1. **Authentication** - Login as different user types
2. **Users** - Query, filter, search users
3. **Projects** - Query, filter, search projects
4. **Tasks** - Query, filter by status/priority/assignee
5. **Audit Logs** - Query, trace by correlation ID
6. **Organizations** - View org details
7. **RBAC Testing** - Test permission violations
8. **Performance Testing** - Large result sets
9. **Edge Cases** - Invalid inputs, no results

## Tips

### VS Code Shortcuts
- `Ctrl/Cmd + Alt + R` - Send request
- Click on `###` to collapse/expand sections
- Hover over `{{variable}}` to see its value

### Testing Filters
Each section has multiple filter examples. Try combining them:
```http
GET /tasks?status=in_progress&priority=high&limit=100
```

### Testing Pagination
Get first page, then use the cursor from the response:
```http
GET /users?limit=100
# Copy next_cursor from response
GET /users?limit=100&cursor={"created_at":"...","id":"..."}
```

### Performance Testing
Test with large limits to see pagination performance:
```http
GET /tasks?limit=1000
```

## Cleanup

To reset the database:
```bash
npm run test:http:reset --force
```

## npm Scripts

```bash
npm run test:http:setup    # Reset + Seed (full setup)
npm run test:http:seed     # Seed only (add more data)
npm run test:http:reset    # Reset only (requires confirmation)
```

## Troubleshooting

### "401 Unauthorized"
- Make sure you ran the login requests first
- Tokens might have expired (re-run login)

### "No data returned"
- Run `npm run test:http:setup` to seed the database
- Check if server is running (`npm run dev`)

### Variables not working
- Make sure the request has `# @name requestName`
- Check variable syntax: `@var = {{requestName.response.body.path}}`
- Variable assignments must be on separate lines with `###`

## Dataset Size

After seeding:
- **5 Organizations**
- **500 Users** (100 per org)
  - 50 admins
  - 150 managers
  - 300 members
- **250 Projects** (50 per org)
- **5,000 Tasks** (1,000 per org)
- **~10,000+ Audit Logs**

Perfect for testing pagination and filter performance!
