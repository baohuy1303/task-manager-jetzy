### **Authorization & Business Rules**

#### Roles

*   **Admin**
    
*   **Manager**
    
*   **Member**
    

#### Organization Rules

*   Each user belongs to at most one organization.
    
*   org\_id is required for Manager and Member.
    
*   Admins may have org\_id = NULL. Admins must eventually belong to an org; org\_id is temporarily nullable at creation only
    
*   All data access must be scoped by organization\_id.
    

#### User Management

*   Only Admin can:
    
    *   Create organizations
        
    *   Update or delete organizations
        
    *   Change user roles
        
    *   Deactivate users
        
*   Managers may not change roles or deactivate users.
    
*   User responses must never include password or password hashes.
    

#### Project Management

*   Projects belong to exactly one organization.
    
*   Only Admin and Manager can create, update, or delete projects.
    
*   Updatable project fields:
    
    *   name
        
    *   description
        
    *   status
        
*   organization\_id is immutable.
    

#### Task Management

*   Tasks belong to a project and organization.
    
*   Only Admin and Manager can create, update, or delete tasks.
    
*   Updatable task fields:
    
    *   title
        
    *   description
        
    *   status
        
    *   priority
        
    *   assigned\_to
        
    *   due\_date
        
    *   is\_deleted
        
*   Members:
    
    *   Can only read tasks assigned to them
        
    *   Can only update task status
        
    *   Cannot view projects, users, or org data