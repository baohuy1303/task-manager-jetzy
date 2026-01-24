exports.shorthands = undefined;

exports.up = (pgm) => {
  // Extensions
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Enums
  pgm.createType('org_status', ['active', 'suspended']);
  pgm.createType('user_role', ['admin', 'manager', 'member']);
  pgm.createType('project_status', ['draft', 'active', 'archived']);
  pgm.createType('task_status', ['todo', 'in_progress', 'review', 'done']);
  pgm.createType('task_priority', ['low', 'medium', 'high', 'urgent']);

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
    email: { type: 'varchar(255)', notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: { type: 'user_role', default: 'member' },
    is_active: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
  pgm.addConstraint('users', 'unique_email_org', { unique: ['email', 'organization_id'] });

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
  });
  pgm.createIndex('tasks', ['project_id', 'status']);

  // Task Workflows
  pgm.createTable('task_workflows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    task_id: { type: 'uuid', references: 'tasks(id)', onDelete: 'CASCADE' },
    from_status: { type: 'task_status' },
    to_status: { type: 'task_status', notNull: true },
    changed_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    changed_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

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
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
  pgm.dropTable('task_workflows');
  pgm.dropTable('tasks');
  pgm.dropTable('projects');
  pgm.dropTable('users');
  pgm.dropTable('organizations');
  pgm.dropType('task_priority');
  pgm.dropType('task_status');
  pgm.dropType('project_status');
  pgm.dropType('user_role');
  pgm.dropType('org_status');
  pgm.dropExtension('pgcrypto');
};
