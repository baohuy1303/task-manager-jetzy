const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api/v1';

async function login(email, password) {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { token: res.data.data.token, user: res.data.data.user };
}

async function runTest() {
    try {
        console.log('--- Deactivation Notification Verification ---');
        const timestamp = Date.now();
        
        // 1. Setup Admin
        const admin = await login('admin_test@test2.com', 'password123');
        const adminHeaders = { Authorization: `Bearer ${admin.token}` };

        // 2. Create Project
        const proj = await axios.post(`${BASE_URL}/projects`, { name: `DeactProj ${timestamp}` }, { headers: adminHeaders });
        const projectId = proj.data.data.id;

        // 3. Create Manager & Assign to Project
        const mgr = await axios.post(`${BASE_URL}/users`, {
            name: 'Deact Manager',
            email: `deactmgr_${timestamp}@test.com`,
            password: 'password123',
            role: 'manager',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const managerId = mgr.data.data.id;
        
        // Assign Manager to Project using Admin
        // Wait, repository method checks role. 'admin' can assign.
        // We use the new user route for project assignment or just direct insert? 
        // Let's use the route we tested before: PATCH /users/:id/project
        await axios.patch(`${BASE_URL}/users/${managerId}/project`, {
            project_id: projectId, action: 'assign'
        }, { headers: adminHeaders });

        // 4. Create Member & Assign to Project
        const mem = await axios.post(`${BASE_URL}/users`, {
            name: 'Deact Member',
            email: `deactmem_${timestamp}@test.com`,
            password: 'password123',
            role: 'member',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const memberId = mem.data.data.id;
        await axios.patch(`${BASE_URL}/users/${memberId}/project`, {
            project_id: projectId, action: 'assign'
        }, { headers: adminHeaders });

        // 5. Create Task assigned to Member
        const task = await axios.post(`${BASE_URL}/tasks`, {
            project_id: projectId,
            title: 'Critical Deactivation Task',
            assigned_to: memberId
        }, { headers: adminHeaders });
        console.log(`Task Created: ${task.data.data.id} for User ${memberId}`);

        // 6. Deactivate Member (Trigger Notification)
        console.log('6. Deactivating Member...');
        const deactRes = await axios.delete(`${BASE_URL}/users/${memberId}`, { headers: adminHeaders });
        console.log('Deactivation Result:', deactRes.data.data);

        console.log('✅ Request Sent. Please check server logs for [EMAIL SENT] to Manager.');
        console.log(`Expected Subject: "Action Required: User Deactivated"`);
        console.log(`Expected Content: Includes Task ID ${task.data.data.id}`);

    } catch (err) {
        console.error('Script failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTest();
