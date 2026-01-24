const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ORG_CONFIGS = [
    { name: 'Alpha Corp', domain: 'alpha.com' },
    { name: 'Beta Industries', domain: 'beta.com' }
];

const TASKS_IN_MEGA_PROJECT = 2000;
const MEMBER_TASK_COUNT = 200;

const createData = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🧹 Cleaning existing data...');
    await client.query('TRUNCATE audit_logs, task_workflows, tasks, projects, users, organizations CASCADE');

    console.log('🌱 Starting Realistic Seed...');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123' + process.env.PEPPER, salt);

    for (const orgConfig of ORG_CONFIGS) {
        // 1. Create Org
        const orgRes = await client.query(
            'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
            [orgConfig.name]
        );
        const orgId = orgRes.rows[0].id;
        console.log(`  🏢 Org: ${orgConfig.name}`);

        // 2. Create Core Users (Admin, Manager, Target Member)
        const adminRes = await client.query(
            `INSERT INTO users (organization_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
            [orgId, `Admin ${orgConfig.name}`, `admin@${orgConfig.domain}`, hash]
        );
        const adminId = adminRes.rows[0].id;

        const managerRes = await client.query(
            `INSERT INTO users (organization_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'manager') RETURNING id`,
            [orgId, `Manager ${orgConfig.name}`, `manager@${orgConfig.domain}`, hash]
        );
        const managerId = managerRes.rows[0].id;

        const targetMemberRes = await client.query(
            `INSERT INTO users (organization_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'member') RETURNING id`,
            [orgId, `Member ${orgConfig.name}`, `member@${orgConfig.domain}`, hash]
        );
        const targetMemberId = targetMemberRes.rows[0].id;

        // Create Noise Users (20 extra members)
        const noiseMembers = [];
        for (let i = 0; i < 20; i++) {
            const res = await client.query(
                `INSERT INTO users (organization_id, name, email, password_hash, role) 
                 VALUES ($1, $2, $3, $4, 'member') RETURNING id`,
                [orgId, faker.person.fullName(), `${faker.internet.username()}${i}@${orgConfig.domain}`, hash]
            );
            noiseMembers.push(res.rows[0].id);
        }

        // 3. Create Projects (30 projects)
        // Project 0 is the MEGA PROJECT
        for (let p = 0; p < 30; p++) {
            const isMegaProject = p === 0;
            const projName = isMegaProject ? `${orgConfig.name} Mega Project` : `Project ${faker.word.adjective()} ${p}`;
            
            const projRes = await client.query(
                `INSERT INTO projects (organization_id, name, description, status, created_by)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                    orgId,
                    projName,
                    faker.company.catchPhrase(),
                    'active',
                    managerId
                ]
            );
            const projectId = projRes.rows[0].id;

            // Assign Core Users to Mega Project (so they all see the same big data)
            if (isMegaProject) {
                await client.query('UPDATE users SET project_id = $1 WHERE id = $2', [projectId, targetMemberId]);
                await client.query('UPDATE users SET project_id = $1 WHERE id = $2', [projectId, adminId]);
                await client.query('UPDATE users SET project_id = $1 WHERE id = $2', [projectId, managerId]);
                // Assign noise members to other projects
            } else {
               // Assign a random noise member to this project
               const randomNoiseMember = noiseMembers[p % noiseMembers.length];
               await client.query('UPDATE users SET project_id = $1 WHERE id = $2', [projectId, randomNoiseMember]);
            }

            // 4. Create Tasks
            console.log(`    Creating tasks for ${projName}...`);
            
            const taskCount = isMegaProject ? TASKS_IN_MEGA_PROJECT : 50; // 2000 vs 50
            const tasksData = [];

            for (let t = 0; t < taskCount; t++) {
                let assignee;
                if (isMegaProject) {
                    // Assign 200 to target member, rest to noise
                    if (t < MEMBER_TASK_COUNT) {
                        assignee = targetMemberId;
                    } else {
                        assignee = noiseMembers[t % noiseMembers.length];
                    }
                } else {
                    assignee = noiseMembers[p % noiseMembers.length]; // Owner of that project
                }

                tasksData.push([
                    projectId,
                    faker.hacker.verb() + ' ' + faker.hacker.noun(),
                    faker.lorem.sentence(),
                    faker.helpers.arrayElement(['todo', 'in_progress', 'review', 'done']),
                    faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
                    assignee,
                    faker.date.future()
                ]);
            }

            // Batch Insertion for Speed
            // Postgres supports multi-row insert: VALUES ($1, $2...), ($8, $9...)
            // But strict parameter limit (65535). 2000 rows * 7 params = 14000. Safe.
            
            // Construct the huge query string
            const insertQuery = `
                INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date)
                VALUES 
            ` + tasksData.map((row, idx) => {
                const offset = idx * 7;
                return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7})`;
            }).join(',');

            // Flatten logic
            const flatValues = tasksData.reduce((acc, val) => acc.concat(val), []);
            
            await client.query(insertQuery, flatValues);
        }
    }

    await client.query('COMMIT');
    console.log('✅ Realistic Seeding Complete!');
    console.log('🔑 Logins (All assigned to Alpha Corp Mega Project):');
    console.log('   admin@alpha.com / password123');
    console.log('   manager@alpha.com / password123');
    console.log('   member@alpha.com / password123');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding Failed:', e);
  } finally {
    client.release();
    pool.end();
  }
};

createData();
