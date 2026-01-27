exports.shorthands = undefined;

exports.up = (pgm) => {
  // ========================================================================
  // EXTENSIONS
  // ========================================================================
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('citext', { ifNotExists: true });

  // ========================================================================
  // ENUMS
  // ========================================================================
  pgm.createType('org_status', ['active', 'suspended']);
  pgm.createType('user_role', ['admin', 'manager', 'member']);
  pgm.createType('project_status', ['draft', 'active', 'archived']);
  pgm.createType('task_status', ['todo', 'in_progress', 'review', 'done']);
  pgm.createType('task_priority', ['low', 'medium', 'high', 'urgent']);

  // ========================================================================
  // TABLES
  // ========================================================================

  // Organizations
  pgm.createTable('organizations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)', notNull: true },
    status: { type: 'org_status', default: 'active' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // Users
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    email: { type: 'citext', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'user_role', default: 'member' },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('users', ['organization_id']);

  pgm.addColumn('organizations', {
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' }
  });

  pgm.addConstraint('users', 'unique_email_global', {
    unique: 'email'
  });
  pgm.sql(`
    CREATE INDEX idx_users_org_role_active 
    ON users (organization_id, role, created_at DESC, id DESC)
    WHERE is_active = true
  `);

  // Projects
  pgm.createTable('projects', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    status: { type: 'project_status', default: 'draft' },
    created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('projects', 
    [
      'organization_id', 
      { name: 'created_at', sort: 'DESC' }, 
      { name: 'id', sort: 'DESC' }
    ], 
    { name: 'idx_projects_org_created' }
  );
  pgm.sql(`
    CREATE INDEX idx_projects_org_status 
    ON projects (organization_id, status, created_at DESC)
    WHERE status != 'archived'
  `);

  // Project Members (junction table)
  pgm.createTable('project_members', {
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    assigned_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint('project_members', 'project_members_pkey', { primaryKey: ['user_id', 'project_id'] });
  pgm.createIndex('project_members', ['project_id']);

  // Tasks
  pgm.createTable('tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE' },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    status: { type: 'task_status', default: 'todo' },
    priority: { type: 'task_priority', default: 'medium' },
    assigned_to: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    due_date: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    is_deleted: { type: 'boolean', default: false },
    version: { type: 'integer', default: 1, notNull: true },
  });
  pgm.createIndex('tasks', ['project_id', 'status']);
  pgm.createIndex('tasks', ['assigned_to']);
  pgm.sql(`
    CREATE INDEX idx_tasks_active_assigned 
    ON tasks (assigned_to, status, created_at DESC) 
    WHERE is_deleted = false
  `);

  // Task Workflows
  pgm.createTable('task_workflows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: { type: 'uuid', references: 'tasks(id)', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE' },
    from_status: { type: 'task_status' },
    to_status: { type: 'task_status', notNull: true },
    changed_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    changed_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('task_workflows', ['project_id']);
  pgm.createIndex('task_workflows', 
    [
      'task_id', 
      'changed_by',
      { name: 'changed_at', sort: 'DESC' }
    ], 
    { name: 'idx_task_workflows_task_user_changed' }
  );

  // Audit Logs
  pgm.createTable('audit_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    entity_type: { type: 'varchar(50)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    action: { type: 'varchar(50)', notNull: true },
    performed_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.createIndex('audit_logs', ['organization_id', { name: 'created_at', sort: 'DESC' }], { name: 'idx_audit_org_created' });
  pgm.createIndex('audit_logs', ['entity_type', 'entity_id'], { name: 'idx_audit_entity' });
  pgm.sql(`CREATE INDEX idx_audit_correlation ON audit_logs ((metadata->>'request_id'))`);

  // ========================================================================
  // PERFORMANCE INDEXES
  // ========================================================================

  // Partial Index: Active Tasks (optimized for assigned_to queries)


  // Composite Index: Projects Pagination


  // Partial Index: Active Users Role Filter + Pagination  


  // Composite Index: Task Workflows History
  

  // Partial Index: Active Projects Status Filter
  
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('tasks', 'idx_tasks_active_assigned');
  pgm.dropIndex('projects', 'idx_projects_org_created');
  pgm.dropIndex('users', 'idx_users_org_role_active');
  pgm.dropIndex('task_workflows', 'idx_task_workflows_task_user_changed');
  pgm.dropIndex('projects', 'idx_projects_org_status');

  // Drop tables
  pgm.dropTable('audit_logs');
  pgm.dropTable('task_workflows');
  pgm.dropTable('tasks');
  pgm.dropTable('project_members');
  pgm.dropTable('projects');
  pgm.dropTable('users');
  pgm.dropTable('organizations');

  // Drop types
  pgm.dropType('task_priority');
  pgm.dropType('task_status');
  pgm.dropType('project_status');
  pgm.dropType('user_role');
  pgm.dropType('org_status');

  // Drop extensions
  pgm.dropExtension('pgcrypto');
  pgm.dropExtension('citext');
};
