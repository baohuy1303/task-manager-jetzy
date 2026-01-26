# Correlation ID Testing Guide

## Running the Test

```bash
node correlation_test.js
```

## What the Test Does

This script demonstrates end-to-end correlation ID tracing by:
1. Creating custom correlation IDs for each request
2. Performing both successful (happy path) and error operations
3. Displaying the correlation ID in the output
4. Showing you how to trace them in logs and database

## Test Coverage

### Happy Paths (Successful Operations)
- ✅ User Registration
- ✅ User Creation  
- ✅ Project Creation
- ✅ Task Creation
- ✅ Task Status Update
- ✅ Organization Suspension
- ✅ Organization Activation

### Error Paths (Failed Operations)
- ❌ Duplicate Email Registration
- ❌ Duplicate Email User Creation
- ❌ Invalid Task Status Transition

## Tracing in Console Logs

After running the test, check your server console (`npm run dev` terminal) for log entries like:

```
[test-reg-1769427129802] POST /auth/register 201 - 145ms
[test-reg-error-1769427129943] POST /auth/register 409 - 12ms
[test-user-create-1769427130452] POST /users 201 - 89ms
```

**Each operation with the same correlation ID can be traced across all log entries.**

## Tracing in Database

Use the correlation IDs from the test output to query the audit logs:

```sql
-- Example: Trace a specific operation
SELECT 
  action, 
  entity_type,
  metadata->>'request_id' as correlation_id,
  created_at
FROM audit_logs 
WHERE metadata->>'request_id' = 'test-task-create-1769427131045'
ORDER BY created_at;
```

**Expected Result**:
```
action | entity_type | correlation_id              | created_at
-------+-------------+-----------------------------+------------
create | task        | test-task-create-1769427131045 | 2026-01-26...
```

## Trace an Error Flow

1. **Find the Error ID** from test output (e.g., `test-reg-error-1769427129943`)
2. **Check Server Console** for that ID:
   ```
   [test-reg-error-1769427129943] POST /auth/register 409 - 12ms
   [test-reg-error-1769427129943] ERROR: Error: Email already exists
   ```
3. **Check Error Response** returned to client includes same ID:
   ```json
   {
     "success": false,
     "error": "Email already exists",
     "request_id": "test-reg-error-1769427129943"
   }
   ```

## Complete Trace Example

For a task creation request:

**1. Client sees correlation ID in response header:**
```
X-Correlation-ID: test-task-create-1769427131045
```

**2. Server console shows the request:**
```
[test-task-create-1769427131045] POST /tasks 201 - 45ms
```

**3. Database audit log has the same ID:**
```sql
SELECT * FROM audit_logs 
WHERE metadata->>'request_id' = 'test-task-create-1769427131045';
```

**Result**: You can trace the entire lifecycle from HTTP request → Application processing → Database persistence using a single UUID!

## Simulating Issues

To test error tracing:
1. Run the test script (it includes intentional errors)
2. Copy one of the error correlation IDs
3. Search for it in:
   - Server console logs
   - Database audit_logs
   - Test script output

You'll see the same ID appear everywhere the operation was processed, making debugging trivial.
