Task Manager API – Test Cases by Role & Feature
===============================================

Assumptions
-----------

*   Roles: admin, manager, member
    
*   JWT-based auth (Authorization: Bearer )
    
*   Organization status: active | suspended
    
*   Users belong to **one organization**
    
*   Managers & members must belong to an organization to access most routes
    
*   Soft delete means deleted\_at IS NOT NULL
    

1\. Authentication (/auth)
--------------------------

### POST /auth/login

#### ✅ Success

*   Admin logs in with valid credentials → **200 + JWT**
    
*   Manager logs in → **200 + JWT**
    
*   Member logs in → **200 + JWT**
    

#### 🚫 Unauthorized

*   Wrong password → **401**
    
*   Non-existent email → **401**
    

#### ⚠️ Edge

*   Missing email or password → **400**
    
*   Suspended organization user tries login
    
    *   Either:
        
        *   ❌ **403 Forbidden**
            
        *   or ✅ login allowed but blocked later👉 **Be consistent & document this**
            

2\. Organizations (/organizations)
----------------------------------

### Global Middleware

*   authenticate
    
*   validateOrganizationStatus
    

### POST /organizations (Admin only)

#### ✅ Success

*   Admin creates organization → **201**
    

#### 🚫 Forbidden

*   Manager attempts → **403**
    
*   Member attempts → **403**
    

#### 🚫 Unauthorized

*   No token → **401**
    

#### ⚠️ Edge

*   Duplicate organization name → **409**
    
*   Missing required fields → **400**
    

### GET /organizations/:id

#### ✅ Success

*   Admin fetches own org → **200**
    
*   Manager fetches own org → **200**
    
*   Member fetches own org → **200**
    

#### 🚫 Forbidden

*   User fetches another organization’s ID → **403**
    

#### ⚠️ Edge

*   Invalid UUID → **400**
    
*   Organization does not exist → **404**
    

### PATCH /organizations/:id/suspend (Admin only)

#### ✅ Success

*   Admin suspends active org → **200**
    

#### 🚫 Forbidden

*   Manager or member attempts → **403**
    

#### ⚠️ Edge

*   Suspend already suspended org → **409**
    
*   Suspend another org → **403**
    

### PATCH /organizations/:id/activate (Admin only)

Same structure as suspend:

*   Activate suspended org → **200**
    
*   Activate active org → **409**
    

3\. Projects (/projects)
------------------------

### Global Middleware

*   authenticate
    
*   validateOrganizationStatus
    
*   requireOrganization
    

### POST /projects

#### ✅ Success

*   Admin creates project → **201**
    
*   Manager creates project → **201**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

#### 🚫 Unauthorized

*   No token → **401**
    
*   Org suspended → **403**
    

#### ⚠️ Edge

*   Missing name → **400**
    
*   Duplicate project name in same org → **409**
    

### GET /projects

#### ✅ Success

*   Admin → sees all org projects
    
*   Manager → sees all org projects
    
*   Member → sees only assigned projects (or all, depending on design)
    

#### 🚫 Unauthorized

*   No token → **401**
    
*   Suspended org → **403**
    

### GET /projects/:id

#### ✅ Success

*   Admin / Manager → **200**
    
*   Member assigned to project → **200**
    

#### 🚫 Forbidden

*   Member not assigned → **403**
    
*   Cross-org access → **403**
    

#### ⚠️ Edge

*   Invalid ID → **400**
    
*   Project not found → **404**
    

### PATCH /projects/:id

#### ✅ Success

*   Admin updates project → **200**
    
*   Manager updates project → **200**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

4\. Tasks (/tasks)
------------------

### Global Middleware

*   authenticate
    
*   validateOrganizationStatus
    
*   requireOrganization
    

### POST /tasks

#### ✅ Success

*   Admin creates task → **201**
    
*   Manager creates task → **201**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

#### ⚠️ Edge

*   Assign task to user outside org → **400 / 403**
    
*   Assign to non-existent project → **404**
    

### GET /tasks

#### ✅ Success

*   Admin → all org tasks
    
*   Manager → all org tasks
    
*   Member → only assigned tasks
    

### GET /tasks/:id

#### ✅ Success

*   Admin / Manager → **200**
    
*   Assigned member → **200**
    

#### 🚫 Forbidden

*   Member not assigned → **403**
    

### PATCH /tasks/:id

#### ✅ Success

*   Admin / Manager full update → **200**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

### PATCH /tasks/:id/status

#### ✅ Success

*   Admin updates status → **200**
    
*   Manager updates status → **200**
    
*   Member updates **own task** → **200**
    

#### 🚫 Forbidden

*   Member updates someone else’s task → **403**
    

### DELETE /tasks/:id (Soft delete)

#### ✅ Success

*   Admin deletes task → **200**
    
*   Manager deletes task → **200**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

#### ⚠️ Edge

*   Delete already deleted task → **409**
    

5\. Users (/users)
------------------

### POST /users (Registration)

#### ✅ Success

*   Create admin user → **201**
    
*   Create member user → **201**
    

#### ⚠️ Edge

*   Duplicate email → **409**
    
*   Invalid role → **400**
    

### PATCH /users/:id/organization (Admin only)

#### ✅ Success

*   Admin links user to org → **200**
    

#### 🚫 Forbidden

*   Manager or member → **403**
    

#### ⚠️ Edge

*   Link user already in org → **409**
    

### PATCH /users/:id/project

#### ✅ Success

*   Admin assigns user to project → **200**
    
*   Manager assigns member to project → **200**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    
*   Manager assigns admin → **403**
    

### DELETE /users/:id (Deactivate)

#### ✅ Success

*   Admin deactivates user → **200**
    

#### 🚫 Forbidden

*   Manager / Member → **403**
    

#### ⚠️ Edge

*   Deactivate already deactivated user → **409**
    

### GET /users/:id

#### ✅ Success

*   Admin → **200**
    
*   Manager → **200**
    

#### 🚫 Forbidden

*   Member attempts → **403**
    

### GET /users

#### ✅ Success

*   Admin → **200**
    
*   Manager → **200**
    
*   Member → **200** (limited fields)
    

6\. Cross-Cutting Security Tests (🔥 Important)
-----------------------------------------------

Run these on **every protected route**:

*   ❌ No token → **401**
    
*   ❌ Invalid token → **401**
    
*   ❌ Expired token → **401**
    
*   ❌ Org suspended → **403**
    
*   ❌ Access resource from another org → **403**