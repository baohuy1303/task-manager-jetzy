### 🚫 Organizations

*   **NO querying orgs** (private, implicit via organization\_id)
    

### 📁 Query all projects (Only for Admins, Managers)

**Scope:** projects.organization\_id = current\_user.organization\_id

**Filter by:**

*   status
    
*   name (ILIKE)
    
*   created\_by
    
*   created\_at (range)
    

### 👤 Query all users (Only for Admins, Managers)

**Scope:** users.organization\_id = current\_user.organization\_id

**Filter by:**

*   role
    
*   is\_active
    
*   project\_id
    
*   name (ILIKE)
    
*   email (Admins only)
    

### 👥 Query people in projects (All roles)

**Scope:** same organization\_id **AND** users.project\_id = :project\_id

**Filter by:**

*   role
    
*   is\_active
    
*   name (ILIKE)
    

### 📝 Query all tasks (Admins, Managers)

**Scope:**projects.organization\_id = current\_user.organization\_id(join via project\_id)

**Filter by:**

*   status
    
*   priority
    
*   project\_id
    
*   assigned\_to
    
*   due\_date (range)
    
*   is\_deleted = false
    

### ✅ Query tasks assigned to them (All roles)

**Scope:**tasks.assigned\_to = current\_user.id

**Filter by:**

*   status
    
*   priority
    
*   project\_id
    
*   due\_date (range)
    
*   is\_deleted = false
    

### 🧠 Implicit rules (no endpoints needed)

*   Members **never** query:
    
    *   all users
        
    *   all projects
        
    *   all tasks