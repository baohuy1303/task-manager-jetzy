const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api/v1';

async function login(email, password) {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { token: res.data.data.token, user: res.data.data.user };
}

async function createProject(headers, name) {
    const res = await axios.post(`${BASE_URL}/projects`, { name }, { headers });
    return res.data.data.id;
}

async function createUser(headers, name, role, emailOverride = null) {
    const timestamp = Date.now();
    const email = emailOverride || `${role}_${timestamp}_${Math.floor(Math.random()*1000)}@test.com`;
    const res = await axios.post(`${BASE_URL}/users`, {
        name,
        email,
        password: 'password123',
        role,
        organization_id: (await headers).user.organization_id // Wait, headers is promise? No, usually passed object.
    }, { headers });
    return res.data.data;
}

async function assignProject(headers, userId, projectId) {
    await axios.patch(`${BASE_URL}/users/${userId}/project`, {
        project_id: projectId, action: 'assign'
    }, { headers });
}

async function createTask(headers, projectId, assignedTo, title) {
    await axios.post(`${BASE_URL}/tasks`, {
        project_id: projectId,
        title,
        assigned_to: assignedTo,
        priority: 'medium'
    }, { headers });
}

async function runTest() {
    try {
        console.log('--- Comprehensive Deactivation Verification ---');
        const adminSession = await login('admin_test@test2.com', 'password123');
        const adminHeaders = { Authorization: `Bearer ${adminSession.token}` };
        // Pass user obj for org_id reading
        adminHeaders.user = adminSession.user; 

        // ---------------------------------------------------------
        // Scenario 1: Member assigned to > 1 task gets deactivated
        // ---------------------------------------------------------
        console.log('\n[Scenario 1] Member (>1 Task) Deactivation');
        const p1 = await createProject(adminHeaders, `Proj_MemTests_${Date.now()}`);
        
        // Need a Manager to receive email
        const mgr1 = await createUser(adminHeaders, 'Manager for MemTest', 'manager');
        await assignProject(adminHeaders, mgr1.id, p1);

        const mem1 = await createUser(adminHeaders, 'Member MultiTask', 'member');
        await assignProject(adminHeaders, mem1.id, p1);

        await createTask(adminHeaders, p1, mem1.id, 'Task A');
        await createTask(adminHeaders, p1, mem1.id, 'Task B');
        await createTask(adminHeaders, p1, mem1.id, 'Task C');

        console.log('Deactivating Member...');
        const memRes = await axios.delete(`${BASE_URL}/users/${mem1.id}`, { headers: adminHeaders });
        console.log(`✅ Member Deactivated. Unassigned Tasks: ${memRes.data.data.unassignedTasksCount}`);
        console.log('👉 EXPECT: Email to Manager with list of 3 tasks.');


        // ---------------------------------------------------------
        // Scenario 2: Manager in > 1 project, > 1 task, deactivated
        // ---------------------------------------------------------
        console.log('\n[Scenario 2] Manager (>1 Project, >1 Task) Deactivation');
        const p2 = await createProject(adminHeaders, `Proj_Mgr_A_${Date.now()}`);
        const p3 = await createProject(adminHeaders, `Proj_Mgr_B_${Date.now()}`);

        const mgr2 = await createUser(adminHeaders, 'Manager MultiProj', 'manager');
        await assignProject(adminHeaders, mgr2.id, p2);
        await assignProject(adminHeaders, mgr2.id, p3);

        await createTask(adminHeaders, p2, mgr2.id, 'Mgr Task 1');
        await createTask(adminHeaders, p3, mgr2.id, 'Mgr Task 2');

        console.log('Deactivating Manager...');
        const mgrRes = await axios.delete(`${BASE_URL}/users/${mgr2.id}`, { headers: adminHeaders });
        console.log(`✅ Manager Deactivated. Unassigned Tasks: ${mgrRes.data.data.unassignedTasksCount}`);
        console.log('👉 EXPECT: Email to Admin. Associated Projects: [Proj_Mgr_A..., Proj_Mgr_B...]. Tasks: [Mgr Task 1, Mgr Task 2].');


        // ---------------------------------------------------------
        // Scenario 3: Admin (Clean - No Proj, No Task) Deactivation
        // ---------------------------------------------------------
        console.log('\n[Scenario 3] Admin (Clean) Deactivation');
        // We need a secondary admin to be the victim, primary admin executes command
        const admClean = await createUser(adminHeaders, 'Admin Clean', 'admin');
        
        console.log('Deactivating Clean Admin...');
        const admCleanRes = await axios.delete(`${BASE_URL}/users/${admClean.id}`, { headers: adminHeaders });
        console.log(`✅ Admin Deactivated.`);
        console.log('👉 EXPECT: Email to Admin (Self/Primary). Project List: Empty/None. Unassigned Tasks: 0.');


        // ---------------------------------------------------------
        // Scenario 4: Admin (Active - 2 Projs, Few Tasks) Deactivation
        // ---------------------------------------------------------
        console.log('\n[Scenario 4] Admin (Active) Deactivation');
        const p4 = await createProject(adminHeaders, `Proj_Adm_Active_${Date.now()}`);
        const p5 = await createProject(adminHeaders, `Proj_Adm_Sec_${Date.now()}`);

        const admActive = await createUser(adminHeaders, 'Admin Active', 'admin');

        await createTask(adminHeaders, p4, admActive.id, 'Admin Task Alpha');
        await createTask(adminHeaders, p4, admActive.id, 'Admin Task Beta');
        await createTask(adminHeaders, p5, admActive.id, 'Admin Task Gamma');

        console.log('Deactivating Active Admin...');
        const admActiveRes = await axios.delete(`${BASE_URL}/users/${admActive.id}`, { headers: adminHeaders });
        console.log(`✅ Admin Deactivated. Unassigned Tasks: ${admActiveRes.data.data.unassignedTasksCount}`);
        console.log('👉 EXPECT: Email to Admin (Primary). Associated Projects: [Proj_Adm_Active..., Proj_Adm_Sec...]. Tasks: 3 items.');

    } catch (err) {
        console.error('Script failed:', err.message);
        if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
    }
}

runTest();
