const { query } = require('../config/db');

async function resetDatabase() {
  console.log('🗑️  Resetting database...\n');

  const force = process.argv.includes('--force');
  const fullWipe = process.argv.includes('--full');

  if (!force) {
    console.log('⚠️  WARNING: This will delete ALL data from the database!');
    console.log('   Run with --force flag to proceed without confirmation.\n');
    process.exit(0);
  }

  if (fullWipe) {
    console.log('🚮  Wiping Database Schema (Clean Slate)...\n');
    try {
      const tables = ['audit_logs', 'task_workflows', 'tasks', 'project_members', 'projects', 'users', 'organizations', 'pgmigrations'];
      for (const table of tables) {
        await query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      }
      const types = ['org_status', 'user_role', 'project_status', 'task_status', 'task_priority'];
      for (const type of types) {
        await query(`DROP TYPE IF EXISTS "${type}" CASCADE`);
      }
      console.log('✅ Database schema wiped successfully');
      return;
    } catch (error) {
      console.error('❌ Error wiping database:', error.message);
      process.exit(1);
    }
  }

  console.log('🗑️  Resetting database data...\n');
  try {
    // Delete in correct order (respect FK constraints)
    console.log('Deleting data...');
    
    await query('DELETE FROM task_workflows');
    console.log('✅ Cleared task_workflows');
    
    await query('DELETE FROM audit_logs');
    console.log('✅ Cleared audit_logs');
    
    await query('DELETE FROM tasks');
    console.log('✅ Cleared tasks');
    
    await query('DELETE FROM project_members');
    console.log('✅ Cleared project_members');
    
    await query('DELETE FROM projects');
    console.log('✅ Cleared projects');
    
    await query('DELETE FROM users');
    console.log('✅ Cleared users');
    
    await query('DELETE FROM organizations');
    console.log('✅ Cleared organizations');

    console.log('\n✅ Database reset complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  }
}

resetDatabase().then(() => {
  if (process.argv.includes('--full')) {
     console.log('💡 Note: Schema was wiped. You need to run migrations before seeding.');
  }
  process.exit(0);
});
