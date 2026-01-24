const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const NUM_ORGS = 10;
const PROJECTS_PER_ORG = 5;
const TASKS_PER_PROJECT = 20;

const createData = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🧹 Cleaning existing data...');
    // Order matters due to FKs
    await client.query('TRUNCATE audit_logs, task_workflows, tasks, projects, users, organizations CASCADE');

    console.log('🌱 Starting Seed...');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123' + process.env.PEPPER, salt);

    for (let i = 0; i < NUM_ORGS; i++) {
        const orgName = faker.company.name();
        const orgRes = await client.query(
            'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
            [orgName]
        );
        const orgId = orgRes.rows[0].id;
        console.log(`  🏢 Org: ${orgName}`);

        // 1. Create Users
        // Admin
        const adminRes = await client.query(
            `INSERT INTO users (organization_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
            [orgId, faker.person.fullName(), faker.internet.email(), hash]
        );
        const adminId = adminRes.rows[0].id;

        // Manager
        const managerRes = await client.query(
            `INSERT INTO users (organization_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'manager') RETURNING id`,
            [orgId, faker.person.fullName(), faker.internet.email(), hash]
        );
        const managerId = managerRes.rows[0].id;

        // Members (Pool of potential assignees)
        const members = [];
        for (let m = 0; m < 5; m++) {
            const memberRes = await client.query(
                `INSERT INTO users (organization_id, name, email, password_hash, role) 
                 VALUES ($1, $2, $3, $4, 'member') RETURNING id`,
                [orgId, faker.person.fullName(), faker.internet.email(), hash]
            );
            members.push(memberRes.rows[0].id);
        }

        // 2. Create Projects
        for (let p = 0; p < PROJECTS_PER_ORG; p++) {
            const projRes = await client.query(
                `INSERT INTO projects (organization_id, name, description, status, created_by)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                    orgId,
                    faker.commerce.productName() + ' Project',
                    faker.lorem.sentence(),
                    faker.helpers.arrayElement(['draft', 'active', 'archived']),
                    managerId
                ]
            );
            const projectId = projRes.rows[0].id;

            // 3. Assign Members to Project (The "One Project" Rule)
            // We'll pick 1 random member to assign to this project exclusively
            const assignee = members[p % members.length]; // Distribute members
            await client.query('UPDATE users SET project_id = $1 WHERE id = $2', [projectId, assignee]);

            // 4. Create Tasks
            for (let t = 0; t < TASKS_PER_PROJECT; t++) {
                await client.query(
                    `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        projectId,
                        faker.hacker.verb() + ' ' + faker.hacker.noun(),
                        faker.lorem.sentence(),
                        faker.helpers.arrayElement(['todo', 'in_progress', 'review', 'done']),
                        faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
                        assignee, // Assign to the member working on this project
                        faker.date.future()
                    ]
                );
            }
        }
    }

    await client.query('COMMIT');
    console.log('✅ Seeding Complete!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding Failed:', e);
  } finally {
    client.release();
    pool.end();
  }
};

createData();
