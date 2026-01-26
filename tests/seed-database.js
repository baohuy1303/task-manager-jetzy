const { query } = require('../config/db');
const { runTransaction } = require('../config/db');
const bcrypt = require('bcrypt');

const PEPPER = process.env.PEPPER || '';

// Batch insert helper
async function batchInsert(tableName, records, batchSize = 100) {
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    // Insert logic here - using individual inserts for simplicity
    for (const record of batch) {
      await query(record.sql, record.values);
    }
    process.stdout.write(`\r   Progress: ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }
  console.log('');
}

async function seedDatabase() {
  console.log('🌱 Seeding database with large dataset...\n');

  const startTime = Date.now();

  try {
    // ========================================================================
    // 1. Create 5 Organizations
    // ========================================================================
    console.log('1️⃣  Creating organizations...');
    const orgs = [];
    
    for (let i = 1; i <= 5; i++) {
      const result = await query(`
        INSERT INTO organizations (name, status, created_at)
        VALUES ($1, $2, NOW())
        RETURNING *
      `, [`Organization ${i}`, 'active']);
      orgs.push(result.rows[0]);
    }
    console.log(`✅ Created ${orgs.length} organizations\n`);

    // ========================================================================
    // 2. Create 500 Users (100 per org)
    // ========================================================================
    console.log('2️⃣  Creating users (500 total)...');
    const users = [];
    const credentials = [];
    const hashedPassword = await bcrypt.hash('password123' + PEPPER, 10);

    for (const org of orgs) {
      const orgIndex = orgs.indexOf(org) + 1;
      
      // 10 admins per org
      for (let i = 1; i <= 10; i++) {
        const email = `admin-${i}@org${orgIndex}.com`;
        const result = await query(`
          INSERT INTO users (organization_id, name, email, password_hash, role, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW() + (interval '1 millisecond' * $7))
          RETURNING *
        `, [org.id, `Admin ${i} (Org ${orgIndex})`, email, hashedPassword, 'admin', true, i]);
        users.push(result.rows[0]);
        
        if (i === 1) credentials.push({ email, password: 'password123', role: 'admin', org: orgIndex });
      }

      // 30 managers per org
      for (let i = 1; i <= 30; i++) {
        const email = `manager-${i}@org${orgIndex}.com`;
        const result = await query(`
          INSERT INTO users (organization_id, name, email, password_hash, role, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW() + (interval '1 millisecond' * $7))
          RETURNING *
        `, [org.id, `Manager ${i} (Org ${orgIndex})`, email, hashedPassword, 'manager', true, i + 10]);
        users.push(result.rows[0]);
        
        if (i === 1) credentials.push({ email, password: 'password123', role: 'manager', org: orgIndex });
      }

      // 60 members per org
      for (let i = 1; i <= 60; i++) {
        const email = `member-${i}@org${orgIndex}.com`;
        const result = await query(`
          INSERT INTO users (organization_id, name, email, password_hash, role, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW() + (interval '1 millisecond' * $7))
          RETURNING *
        `, [org.id, `Member ${i} (Org ${orgIndex})`, email, hashedPassword, 'member', true, i + 40]);
        users.push(result.rows[0]);
        
        if (i === 1) credentials.push({ email, password: 'password123', role: 'member', org: orgIndex });
      }
    }
    console.log(`✅ Created ${users.length} users\n`);

    // ========================================================================
    // 3. Create 250 Projects (50 per org)
    // ========================================================================
    console.log('3️⃣  Creating projects (250 total)...');
    const projects = [];
    const statuses = ['draft', 'active', 'active', 'active', 'archived']; // More active projects

    for (const org of orgs) {
      const orgAdmins = users.filter(u => u.organization_id === org.id && u.role === 'admin');
      const orgIndex = orgs.indexOf(org) + 1;

      for (let i = 1; i <= 50; i++) {
        const creator = orgAdmins[i % orgAdmins.length];
        const status = statuses[i % statuses.length];
        
        const result = await query(`
          INSERT INTO projects (organization_id, name, description, created_by, status, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW() + (interval '1 millisecond' * $6))
          RETURNING *
        `, [
          org.id,
          `Project ${i} (Org ${orgIndex})`,
          `Description for project ${i}`,
          creator.id,
          status,
          i
        ]);
        projects.push(result.rows[0]);
      }
    }
    console.log(`✅ Created ${projects.length} projects\n`);

    // ========================================================================
    // 4. Assign Users to Projects
    // ========================================================================
    console.log('4️⃣  Assigning users to projects...');
    let assignmentCount = 0;

    for (const project of projects) {
      const orgUsers = users.filter(u => u.organization_id === project.organization_id && u.role !== 'admin');
      
      // Assign 2-5 users per project
      const numAssignments = Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < numAssignments && i < orgUsers.length; i++) {
        const user = orgUsers[i];
        
        await query(`
          INSERT INTO project_members (project_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [project.id, user.id]);
        
        assignmentCount++;
      }
    }
    console.log(`✅ Created ${assignmentCount} project assignments\n`);

    // ========================================================================
    // 5. Create 5,000 Tasks (1,000 per org)
    // ========================================================================
    console.log('5️⃣  Creating tasks (5,000 total)...');
    const taskStatuses = ['todo', 'in_progress', 'review', 'done'];
    const priorities = ['low', 'medium', 'high'];
    let taskCount = 0;

    for (const org of orgs) {
      const orgProjects = projects.filter(p => p.organization_id === org.id);
      const orgUsers = users.filter(u => u.organization_id === org.id && u.role !== 'admin');

      for (let i = 1; i <= 1000; i++) {
        const project = orgProjects[i % orgProjects.length];
        const assignee = Math.random() > 0.3 ? orgUsers[i % orgUsers.length] : null;
        const status = taskStatuses[Math.floor(Math.random() * taskStatuses.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        await query(`
          INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, is_deleted, version, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + (interval '1 millisecond' * $9))
        `, [
          project.id,
          `Task ${i} for ${project.name}`,
          `Description for task ${i}`,
          status,
          priority,
          assignee?.id,
          false,
          1,
          i
        ]);

        taskCount++;
        if (taskCount % 100 === 0) {
          process.stdout.write(`\r   Progress: ${taskCount}/5000`);
        }
      }
    }
    console.log(`\n✅ Created ${taskCount} tasks\n`);

    // ========================================================================
    // Statistics
    // ========================================================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE SEEDING COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📈 Statistics:`);
    console.log(`   Organizations: ${orgs.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Projects: ${projects.length}`);
    console.log(`   Project Assignments: ${assignmentCount}`);
    console.log(`   Tasks: ${taskCount}`);
    console.log(`   Time: ${elapsed}s`);

    console.log(`\n🔐 Sample Credentials (for HTTP testing):`);
    credentials.slice(0, 3).forEach(cred => {
      console.log(`   ${cred.role.padEnd(10)} (Org ${cred.org}): ${cred.email.padEnd(30)} / ${cred.password}`);
    });

    console.log('\n💡 Next Steps:');
    console.log('   1. Open tests/http/api-tests.http in VS Code');
    console.log('   2. Install REST Client extension (if not installed)');
    console.log('   3. Run login requests to get tokens');
    console.log('   4. Start testing!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDatabase();
