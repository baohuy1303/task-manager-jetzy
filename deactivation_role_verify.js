const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api/v1';

async function login(email, password) {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { token: res.data.data.token, user: res.data.data.user };
}

async function runTest() {
    try {
        console.log('--- Deactivation Role Verify ---');
        const timestamp = Date.now();
        const admin = await login('admin_test@test2.com', 'password123');
        const headers = { Authorization: `Bearer ${admin.token}` };

        // 1. Deactivate Manager -> Admin gets email
        console.log('\n[Test 1] Deactivating Manager...');
        // Create Manager
        const mgr = await axios.post(`${BASE_URL}/users`, {
            name: `RoleMgr ${timestamp}`,
            email: `rolemgr_${timestamp}@test.com`,
            password: 'password123',
            role: 'manager',
            organization_id: admin.user.organization_id
        }, { headers });
        const mgrId = mgr.data.data.id;

        // Assign to a project logic (to populate project list)
        const proj = await axios.post(`${BASE_URL}/projects`, { name: `RoleProj ${timestamp}` }, { headers });
        await axios.patch(`${BASE_URL}/users/${mgrId}/project`, { project_id: proj.data.data.id, action: 'assign' }, { headers });

        // Deactivate
        await axios.delete(`${BASE_URL}/users/${mgrId}`, { headers });
        console.log(`✅ Manager ${mgrId} deactivated.`);
        console.log('👉 Check logs for: "Queuing 1 admin alerts for manager deactivation..."');
        console.log('👉 Check logs for: "Associated Projects: RoleProj..."');

        // 2. Deactivate Admin -> Other Admin gets email
        console.log('\n[Test 2] Deactivating Admin...');
        // Create 2nd Admin
        const adm2 = await axios.post(`${BASE_URL}/users`, {
            name: `RoleAdmin2 ${timestamp}`,
            email: `roleadm2_${timestamp}@test.com`,
            password: 'password123',
            role: 'admin', // Requires org_id null usually if top-level, but here we simulate org admin
            organization_id: admin.user.organization_id // Assuming your schema supports org-bound admins
        }, { headers });
        const adm2Id = adm2.data.data.id;

        // Deactivate
        await axios.delete(`${BASE_URL}/users/${adm2Id}`, { headers });
        console.log(`✅ Admin ${adm2Id} deactivated.`);
        console.log('👉 Check logs for: "Queuing 1 admin alerts for admin deactivation..." (Should be sent to original Admin)');

    } catch (err) {
        console.error('Script failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTest();
