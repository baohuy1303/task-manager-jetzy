exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create Table
  pgm.createTable('project_members', {
      project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE', notNull: true },
      user_id: { type: 'uuid', references: 'users(id)', onDelete: 'CASCADE', notNull: true },
      assigned_at: { type: 'timestamptz', default: pgm.func('now()') }
  });

  // 2. Constraints & Indices
  // Primary Key (Composite) - Clusters by user_id first for fast "Get My Projects"
  pgm.addConstraint('project_members', 'pk_project_members', { primaryKey: ['user_id', 'project_id'] });
  
  // Secondary Index on project_id - Optimizes "Get Project Members"
  pgm.createIndex('project_members', ['project_id']);

  // 3. Migrate Data
  // Move existing assignments from users table to new table
  pgm.sql(`
      INSERT INTO project_members (project_id, user_id)
      SELECT project_id, id FROM users WHERE project_id IS NOT NULL
  `);

  // 4. Drop Old Column
  pgm.dropColumn('users', 'project_id');
};

exports.down = (pgm) => {
  // 1. Restore Column
  pgm.addColumn('users', {
      project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'SET NULL' }
  });

  // 2. Restore Data (Best Effort - takes one project per user if multiple exist)
  pgm.sql(`
      UPDATE users u
      SET project_id = pm.project_id
      FROM project_members pm
      WHERE u.id = pm.user_id
  `);

  // 3. Drop Table
  pgm.dropTable('project_members');
};
