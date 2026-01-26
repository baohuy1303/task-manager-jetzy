const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/api/v1';

async function login(email, password) {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { token: res.data.data.token, user: res.data.data.user };
}

async function verifyAuditLog(action, entityId, performedBy) {
   // Direct DB Check
   const client = new Client({
       connectionString: process.env.DATABASE_URL
   });
   await client.connect();
   try {
       const res = await client.query(
           `SELECT * FROM audit_logs WHERE entity_type = 'project' AND entity_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1`,
           [entityId, action]
       );
       if (res.rows.length > 0) {
           console.log(`✅ Audit Log Found: [${action}] by User ${performedBy}`);
           return true;
       } else {
           console.error(`❌ Audit Log MISSING for [${action}]`);
           return false;
       }
   } catch(e) { console.error(e); } finally { await client.end(); }
}

async function runTest() {
    try {
        console.log('--- Project Audit Verification ---');
        const timestamp = Date.now();
        const admin = await login('admin_test@test2.com', 'password123');
        const headers = { Authorization: `Bearer ${admin.token}` };

        // 1. Create Project -> Audit: 'create'
        console.log('\n[Test 1] Create Project...');
        const projRes = await axios.post(`${BASE_URL}/projects`, {
            name: `AuditProj ${timestamp}`,
            description: 'Audit Test'
        }, { headers });
        const projectId = projRes.data.data.id;
        
        await verifyAuditLog('create', projectId, admin.user.id);

        // 2. Update Project (Name) -> Audit: 'update'
        console.log('\n[Test 2] Update Project Name...');
        await axios.patch(`${BASE_URL}/projects/${projectId}`, {
            name: `AuditProj Updated ${timestamp}`
        }, { headers });

        await verifyAuditLog('update', projectId, admin.user.id);

        // 3. Update Project (Status) -> Audit: 'update'
        console.log('\n[Test 3] Update Project Status...');
        await axios.patch(`${BASE_URL}/projects/${projectId}`, {
            status: 'active'
        }, { headers });

        await verifyAuditLog('update', projectId, admin.user.id);

    } catch (err) {
        console.error('Script failed:', err.message);
        if(err.response) console.error(err.response.data);
    }
}

runTest();
