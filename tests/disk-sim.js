const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/task_manager',
});

async function runBenchmark() {
  console.log('🚀 Starting Performance Benchmark (Disk Simulation Scale: 2.5M Tasks)\n');

  let targetOrgId, targetProjectId;
  const NOISE_ORGS = 10;
  const TASKS_PER_ORG = 250000; 
  const PROJECTS_PER_ORG = 5;

  try {
    // 1. SETUP: Create "Noise" Orgs and "Target" Org
    console.log('🏗️  Setting up test environment...');
    
    // Create Target Org + User + Project
    const targetOrgRes = await pool.query("INSERT INTO organizations (name) VALUES ('Target Org') RETURNING id");
    targetOrgId = targetOrgRes.rows[0].id;
    const targetUserRes = await pool.query("INSERT INTO users (organization_id, name, email, password_hash) VALUES ($1, 'Target', 'target@test.com', 'hash') RETURNING id", [targetOrgId]);
    const targetUserId = targetUserRes.rows[0].id;
    
    // Create Projects for Target Org
    const targetProjRes = await pool.query(
        "INSERT INTO projects (organization_id, name, created_by) VALUES ($1, 'Target Project 1', $2) RETURNING id", 
        [targetOrgId, targetUserId]
    );
    targetProjectId = targetProjRes.rows[0].id;

    for(let i=0; i<4; i++) {
        await pool.query("INSERT INTO projects (organization_id, name, created_by) VALUES ($1, $2, $3)", [targetOrgId, `Target Extra ${i}`, targetUserId]);
    }

    // 2. SEEDING NOISE DATA
    console.log(`🌱 Seeding Noise Data (${NOISE_ORGS} Orgs, ${TASKS_PER_ORG} tasks each)...`);
    const startTimeSeed = Date.now();
    
    for (let i = 0; i < NOISE_ORGS; i++) {
        const orgRes = await pool.query("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [`Noise Org ${i}`]);
        const orgId = orgRes.rows[0].id;
        const userRes = await pool.query("INSERT INTO users (organization_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id", [orgId, `Noise ${i}`, `noise${i}@test.com`, 'hash']);
        const userId = userRes.rows[0].id;

        const projIds = [];
        for(let p=0; p<PROJECTS_PER_ORG; p++) {
            const r = await pool.query("INSERT INTO projects (organization_id, name, created_by) VALUES ($1, $2, $3) RETURNING id", [orgId, `Noise Proj ${p}`, userId]);
            projIds.push(r.rows[0].id);
        }

        await seedTasksForProjects(projIds, TASKS_PER_ORG / PROJECTS_PER_ORG, userId);
        process.stdout.write(`   Org ${i+1}/${NOISE_ORGS+1} seeded\r`);
    }

    // 3. SEEDING TARGET DATA
    console.log('\n🌱 Seeding Target Data...');
    const allTargetProjs = await pool.query("SELECT id FROM projects WHERE organization_id = $1", [targetOrgId]);
    const targetProjIds = allTargetProjs.rows.map(r => r.id);
    
    await seedTasksForProjects(targetProjIds, TASKS_PER_ORG / PROJECTS_PER_ORG, targetUserId);
    console.log(`\n✅ Seeding complete in ${((Date.now() - startTimeSeed) / 1000).toFixed(2)}s`);

    console.log('📊 Updating PostgreSQL statistics...');
    await pool.query('ANALYZE tasks');
    await pool.query('ANALYZE projects');
    
    console.log('🔥 Warming up buffer cache...');
    await pool.query('SELECT count(*) FROM tasks'); // Ensure table is partially in cache

    const results = {
      optimized: { direct: null, paranoid: null },
      unoptimized: { direct: null, paranoid: null }
    };

    // 4. BENCHMARK WITH INDEXES
    console.log('\n🧪 Testing with INDEXES (Optimized)...');
    results.optimized.direct = await measureQuery(
        'Direct Filter', 
        targetProjectId, 
        'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50'
    );
    results.optimized.paranoid = await measureQuery(
        'Join Filter', 
        targetProjectId,
        `SELECT t.* 
         FROM tasks t 
         JOIN projects p ON t.project_id = p.id 
         WHERE p.organization_id = (SELECT organization_id FROM projects WHERE id = $1) 
           AND p.id = $1 
         ORDER BY t.created_at DESC 
         LIMIT 50`
    );

    // 5. REMOVE INDEXES
    console.log('\n🗑️  Dropping ALL indexes for unoptimized test...');
    const indexesToDrop = [
        'idx_tasks_project_active_created',
        'idx_tasks_active_assigned',
        'tasks_project_id_status_index',
        'tasks_assigned_to_index'
    ];
    for (const idx of indexesToDrop) {
        await pool.query(`DROP INDEX IF EXISTS ${idx}`);
    }
    await pool.query('ANALYZE tasks');

    // 6. BENCHMARK WITHOUT INDEXES
    console.log('🧪 Testing without INDEXES (Unoptimized)...');
    results.unoptimized.direct = await measureQuery(
        'Direct Filter', 
        targetProjectId, 
        'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50'
    );
    results.unoptimized.paranoid = await measureQuery(
        'Join Filter', 
        targetProjectId,
        `SELECT t.* 
         FROM tasks t 
         JOIN projects p ON t.project_id = p.id 
         WHERE p.organization_id = (SELECT organization_id FROM projects WHERE id = $1) 
           AND p.id = $1 
         ORDER BY t.created_at DESC 
         LIMIT 50`
    );

    // 7. REPORT
    printReport(results);

  } catch (err) {
    console.error('❌ Benchmark failed:', err);
  } finally {
    console.log('\n🛠️  Cleaning up...');
    // We already deleted orgs, but let's be safe
    if (targetOrgId) {
        await pool.query("DELETE FROM organizations WHERE name LIKE 'Noise Org%' OR name = 'Target Org'");
    }
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tasks_project_active_created
        ON tasks (project_id, status, created_at DESC)
        WHERE is_deleted = false
    `);
    // Restore the other one we found
    await pool.query(`
        CREATE INDEX IF NOT EXISTS tasks_project_id_status_index
        ON tasks (project_id, status)
    `);
    await pool.end();
  }
}

async function seedTasksForProjects(projectIds, tasksPerProject, userId) {
    const batchSize = 2500;
    // Removed padding logic as requested
    for (const pid of projectIds) {
        for (let i = 0; i < tasksPerProject; i += batchSize) {
            const values = [];
            const placeholders = [];
            for (let j = 0; j < batchSize; j++) {
                const offset = i + j;
                const pIdx = j * 4; // Adjusted index since we removed one param
                placeholders.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, NOW() - interval '${offset} seconds')`);
                values.push(pid, `Task ${offset}`, 'Desc', userId);
            }
            await pool.query(`
                INSERT INTO tasks (project_id, title, description, assigned_to, created_at) 
                VALUES ${placeholders.join(',')}
            `, values);
        }
    }
}

async function measureQuery(label, param, sql) {
    let times = [];
    let blocksRead = 0;
    let strategy = '';

    for(let i=0; i<3; i++) {
        const res = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, [param]);
        const plan = res.rows.map(r => r['QUERY PLAN']).join('\n');
        
        const execMatch = plan.match(/Execution Time: ([\d.]+) ms/);
        times.push(execMatch ? parseFloat(execMatch[1]) : 0);

        // Extract Buffer metrics - fixed regex to be case insensitive and handle combined lines
        const hitMatch = plan.match(/shared hit=(\d+)/i);
        const readMatch = plan.match(/read=(\d+)/i);
        blocksRead = (hitMatch ? parseInt(hitMatch[1]) : 0) + (readMatch ? parseInt(readMatch[1]) : 0);
        
        strategy = plan.includes('Index Scan') ? 'Index Scan' : 'Seq Scan';
    }
    const meanTime = times.reduce((a,b)=>a+b,0) / times.length;
    console.log(`   - ${label}: ${meanTime.toFixed(2)}ms (Blocks: ${blocksRead}) [${strategy}]`);
    return { meanTime, blocksRead, strategy };
}

function printReport(results) {
  console.log('\n' + '='.repeat(90));
  console.log('📊 DISK SIMULATION BENCHMARK REPORT (2.75M Tasks + Padding)');
  console.log('='.repeat(90));
  console.log(`${'Query Scenario'.padEnd(30)} | ${'Index Scan (ms)'.padEnd(15)} | ${'Seq Scan (ms)'.padEnd(15)} | ${'Blocks Saved'.padEnd(12)}`);
  console.log('-'.repeat(90));

  const scenarios = [
      { key: 'direct', label: 'Direct Filter' },
      { key: 'paranoid', label: 'Paranoid Join' }
  ];

  for (const s of scenarios) {
      const opt = results.optimized[s.key].meanTime;
      const unopt = results.unoptimized[s.key].meanTime;
      const blocksOpt = results.optimized[s.key].blocksRead;
      const blocksUnopt = results.unoptimized[s.key].blocksRead;
      const saved = blocksUnopt - blocksOpt;
      
      console.log(
          `${s.label.padEnd(30)} | ` +
          `${opt.toFixed(2).padEnd(15)} | ` +
          `${unopt.toFixed(2).padEnd(15)} | ` +
          `${saved.toLocaleString().padEnd(12)}`
      );
  }
  console.log('\n💡 Virtual Disk Analysis (assuming 0.1ms per block read):');
  const seqBlocks = results.unoptimized.direct.blocksRead;
  const idxBlocks = results.optimized.direct.blocksRead;
  console.log(`   Seq Scan would wait: ${(seqBlocks * 0.1 / 1000).toFixed(2)}s for disk`);
  console.log(`   Index Scan would wait: ${(idxBlocks * 0.1 / 1000).toFixed(4)}s for disk`);
  console.log('='.repeat(90));
}

runBenchmark();
