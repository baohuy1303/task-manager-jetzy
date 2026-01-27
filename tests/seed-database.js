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

    for (const org of orgs) {
      const orgProjects = projects.filter(p => p.organization_id === org.id);
      if (orgProjects.length === 0) continue;

      const orgManagers = users.filter(u => u.organization_id === org.id && u.role === 'manager');
      const orgMembers = users.filter(u => u.organization_id === org.id && u.role === 'member');
      const orgIndex = orgs.indexOf(org) + 1;

      // 4a. Handle Members: Exactly 1 project each (if projects exist)
      for (const member of orgMembers) {
        let targetProject;
        
        // Special: Guarantee member-1@org1.com is in Project 1 (Org 1)
        if (member.email === 'member-1@org1.com') {
          targetProject = orgProjects.find(p => p.name === 'Project 1 (Org 1)');
        } else {
          // Pick 1 random project for other members
          targetProject = orgProjects[Math.floor(Math.random() * orgProjects.length)];
        }

        if (targetProject) {
          await query(`
            INSERT INTO project_members (project_id, user_id)
            VALUES ($1, $2)
          `, [targetProject.id, member.id]);
          assignmentCount++;
        }
      }

      // 4b. Handle Managers: Can have multiple projects
      for (const project of orgProjects) {
        // Shuffle managers for this project
        const shuffledManagers = [...orgManagers].sort(() => Math.random() - 0.5);
        
        // Assign 1-2 managers per project
        const numManagers = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < numManagers && i < shuffledManagers.length; i++) {
          const manager = shuffledManagers[i];
          await query(`
            INSERT INTO project_members (project_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [project.id, manager.id]);
          assignmentCount++;
        }
      }
    }
    console.log(`✅ Created ${assignmentCount} project assignments (Restricted Members to 1 project)\n`);

    // ========================================================================
    // 5. Create 5,000 Tasks (1,000 per org)
    // ========================================================================
    console.log('5️⃣  Creating tasks (5,000 total)...');
    const taskStatuses = ['todo', 'in_progress', 'review', 'done'];
    const priorities = ['low', 'medium', 'high'];
    let taskCount = 0;

    for (const org of orgs) {
      const orgProjects = projects.filter(p => p.organization_id === org.id);
      
      // Mapping: projectId -> Array of userId
      const projectMembersMap = {};
      for (const project of orgProjects) {
        const membersResult = await query('SELECT user_id FROM project_members WHERE project_id = $1', [project.id]);
        projectMembersMap[project.id] = membersResult.rows.map(r => r.user_id);
      }

      for (let i = 1; i <= 1000; i++) {
        const project = orgProjects[i % orgProjects.length];
        const validAssignees = projectMembersMap[project.id] || [];
        
        // Pick an assignee from the project members (or null)
        const assigneeId = (Math.random() > 0.3 && validAssignees.length > 0) 
          ? validAssignees[Math.floor(Math.random() * validAssignees.length)] 
          : null;
          
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
          assigneeId,
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
    console.log('');

    // ========================================================================
    // 5.5. Create Task Workflow Histories
    // ========================================================================
    console.log('5️⃣ -a Creating task workflow histories...');
    
    // Get all tasks that have transitioned from todo
    const tasksWithHistory = await query(`
      SELECT id, project_id, status, created_at 
      FROM tasks 
      WHERE status != 'todo' 
      ORDER BY created_at
      LIMIT 1000
    `);
    
    let workflowCount = 0;
    for (const task of tasksWithHistory.rows) {
      // Get a random user from the project as the changer
      const projectMembers = await query(
        'SELECT user_id FROM project_members WHERE project_id = $1 LIMIT 5',
        [task.project_id]
      );
      
      if (projectMembers.rows.length === 0) continue;
      
      const changerId = projectMembers.rows[0].user_id;
      
      // Simulate workflow: todo -> in_progress
      await query(`
        INSERT INTO task_workflows (task_id, project_id, from_status, to_status, changed_by, changed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [task.id, task.project_id, 'todo', 'in_progress', changerId, new Date(task.created_at.getTime() + 3600000)]);
      workflowCount++;
      
      // If task is in review or done, add more history
      if (task.status === 'review' || task.status === 'done') {
        await query(`
          INSERT INTO task_workflows (task_id, project_id, from_status, to_status, changed_by, changed_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [task.id, task.project_id, 'in_progress', 'review', changerId, new Date(task.created_at.getTime() + 7200000)]);
        workflowCount++;
      }
      
      // If task is done, complete the workflow
      if (task.status === 'done') {
        await query(`
          INSERT INTO task_workflows (task_id, project_id, from_status, to_status, changed_by, changed_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [task.id, task.project_id, 'review', 'done', changerId, new Date(task.created_at.getTime() + 10800000)]);
        workflowCount++;
      }
    }
    console.log(`✅ Created ${workflowCount} workflow history entries\n`);

    // ========================================================================
    // 6. Create 10,000 Audit Logs
    // ========================================================================
    console.log('6️⃣  Creating audit logs (10,000 total)...');
    const entityTypes = ['user', 'task', 'project', 'organization'];
    const actions = ['create', 'update', 'delete', 'assign', 'status_change'];
    let logCount = 0;

    for (const org of orgs) {
      const orgUsers = users.filter(u => u.organization_id === org.id);
      const orgTasks = projects.filter(p => p.organization_id === org.id); // Tasks actually belong to projects
      // Get some actual task IDs for this org
      const actualTasks = await query('SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE organization_id = $1) LIMIT 100', [org.id]);
      const orgTaskIds = actualTasks.rows.map(r => r.id);
      const orgProjectIds = projects.filter(p => p.organization_id === org.id).map(p => p.id);
      const orgUserIds = orgUsers.map(u => u.id);

      for (let i = 1; i <= 2000; i++) {
        const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
        let entityId;
        
        switch(entityType) {
          case 'user': entityId = orgUserIds[Math.floor(Math.random() * orgUserIds.length)]; break;
          case 'task': entityId = orgTaskIds[Math.floor(Math.random() * orgTaskIds.length)] || org.id; break;
          case 'project': entityId = orgProjectIds[Math.floor(Math.random() * orgProjectIds.length)]; break;
          default: entityId = org.id;
        }

        const action = actions[Math.floor(Math.random() * actions.length)];
        const performer = orgUserIds[Math.floor(Math.random() * orgUserIds.length)];
        
        // Randomly add correlation ID to some logs
        const metadata = { 
          source: 'seed_script',
          details: `Automatic seed log ${i}`
        };
        if (Math.random() > 0.7) {
          metadata.request_id = `req-${Math.random().toString(36).substring(2, 15)}`;
        }

        await query(`
          INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, performed_by, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW() - (interval '1 second' * $7))
        `, [
          org.id,
          entityType,
          entityId,
          action,
          performer,
          JSON.stringify(metadata),
          logCount
        ]);

        logCount++;
        if (logCount % 500 === 0) {
          process.stdout.write(`\r   Progress: ${logCount}/10000`);
        }
      }
    }
    console.log(`\n✅ Created ${logCount} audit logs\n`);

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
