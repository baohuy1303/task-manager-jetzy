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
           `SELECT * FROM audit_logs WHERE entity_type = 'user' AND entity_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1`,
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
        console.log('--- User Audit Verification ---');
        const timestamp = Date.now();

        // 1. Setup
        const admin = await login('admin_test@test2.com', 'password123');
        const adminHeaders = { Authorization: `Bearer ${admin.token}` };
        
        // Create Manager & Member
        const mgrRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Audit Manager',
            email: `auditmgr_${timestamp}@test.com`,
            password: 'password123',
            role: 'manager',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const managerId = mgrRes.data.data.id;

        const memRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Audit Member',
            email: `auditmem_${timestamp}@test.com`,
            password: 'password123',
            role: 'member',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const memberId = memRes.data.data.id;

        const mgrSession = await login(`auditmgr_${timestamp}@test.com`, 'password123');
        const mgrHeaders = { Authorization: `Bearer ${mgrSession.token}` };

        // TEST 1: Admin changes Member role -> 'role_change'
        console.log('\n[Test 1] Admin changing Member Role...');
        await axios.patch(`${BASE_URL}/users/${memberId}`, { role: 'manager' }, { headers: adminHeaders });
        await verifyAuditLog('role_change', memberId, admin.user.id);
        
        // Revert Role for next test
        await axios.patch(`${BASE_URL}/users/${memberId}`, { role: 'member' }, { headers: adminHeaders });

        // TEST 2: Manager assigns Member to Project -> 'assign_project'
        // Need a project first
        const projRes = await axios.post(`${BASE_URL}/projects`, { name: `Audit Proj ${timestamp}` }, { headers: adminHeaders });
        const projectId = projRes.data.data.id;

        console.log('\n[Test 2] Manager assigning Member to Project...');
        await axios.patch(`${BASE_URL}/users/${memberId}/project`, { project_id: projectId, action: 'assign' }, { headers: mgrHeaders });
        await verifyAuditLog('assign_project', memberId, managerId);

        // TEST 3: Manager trying to assign OTHER Manager -> Should Fail
        // Create another manager
        const mgr2Res = await axios.post(`${BASE_URL}/users`, {
             name: 'Audit Manager 2',
             email: `auditmgr2_${timestamp}@test.com`,
             password: 'password123',
             role: 'manager',
             organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        
        console.log('\n[Test 3] Manager assigning another Manager to Project... (Expect Fail)');
        try {
             await axios.patch(`${BASE_URL}/users/${mgr2Res.data.data.id}/project`, { project_id: projectId, action: 'assign' }, { headers: mgrHeaders });
             console.error('❌ Failure: Manager was able to assign another Manager!');
        } catch (e) {
             if (e.response.status === 403 || e.response.status === 500) { // 500 if error thrown in service without specific code map, usually 403 preferred but check msg
                 console.log('✅ Success: Access Denied / Error Caught:', e.response.data.error);
             } else {
                 console.error('❌ Unexpected Error:', e.response.status);
             }
        }

        // TEST 4: Admin Deactivates Member -> 'deactivate'
        console.log('\n[Test 4] Admin deactivating Member...');
        await axios.delete(`${BASE_URL}/users/${memberId}`, { headers: adminHeaders });
        await verifyAuditLog('deactivate', memberId, admin.user.id);

    } catch (err) {
        console.error('Script failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTest();
