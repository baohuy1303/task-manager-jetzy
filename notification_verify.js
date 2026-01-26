const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const EMAIL = 'admin_test@test2.com';
const PASSWORD = 'password123';

async function runTest() {
    try {
        console.log('--- Starting Notification Verification ---');
        console.log('NOTE: Check your "npm run dev" terminal for [EMAIL SENT] logs!');

        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.data.token;
        const orgId = loginRes.data.data.user.organization_id;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('   Login successful.');

        // 2. Create Project
        const timestamp = Date.now();
        console.log('2. Creating Project...');
        const projectRes = await axios.post(`${BASE_URL}/projects`, {
            name: `Notif Project ${timestamp}`,
            description: 'Testing notifications'
        }, { headers });
        const projectId = projectRes.data.data.id;
        console.log('   Project created:', projectId);

        // 3. Create Member (to assign)
        console.log('3. Creating Member to assign...');
        const memberRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Notif Member',
            email: `notifmember_${timestamp}@test.com`,
            password: 'password123',
            role: 'member',
            organization_id: orgId
        }, { headers });
        const memberId = memberRes.data.data.id;
        console.log('   Member created:', memberId);

        // 3b. Create Manager (Should receive Completion Email)
        console.log('3b. Creating Manager...');
        const managerRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Notif Manager',
            email: `notifmanager_${timestamp}@test.com`,
            password: 'password123',
            role: 'manager',
            organization_id: orgId
        }, { headers });
        const managerId = managerRes.data.data.id;
        console.log('   Manager created:', managerId);

        // 3c. Assign Manager to Project
        console.log('3c. Assigning Manager to Project...');
        await axios.patch(`${BASE_URL}/users/${managerId}/project`, {
            project_id: projectId,
            action: 'assign'
        }, { headers });
        console.log('   Manager assigned to project.');

        // 4. Create Task with Assignee (Trigger Assignment Email)
        console.log('4. Creating Task with Assignee (Expect Assignment Email)...');
        const taskRes = await axios.post(`${BASE_URL}/tasks`, {
            title: 'Notification Task',
            project_id: projectId,
            assigned_to: memberId,
            priority: 'medium'
        }, { headers });
        const taskId = taskRes.data.data.id;
        let version = taskRes.data.data.version;
        console.log('   Task created.');

        // 5. Member updates Status: todo -> in_progress -> review -> done (Trigger Completion Email)
        console.log('5. logging in as Member to complete task...');
        const memberLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: `notifmember_${timestamp}@test.com`,
            password: 'password123'
        });
        const memberToken = memberLogin.data.data.token;
        const memberHeaders = { Authorization: `Bearer ${memberToken}` };
        
        console.log('   Member logged in. Updating status...');

        // todo -> in_progress
        const step1 = await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'in_progress',
            version: version
        }, { headers: memberHeaders }); // Use Member Headers
        version = step1.data.data.version;

        // in_progress -> review
        const step2 = await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'review',
            version: version
        }, { headers: memberHeaders });
        version = step2.data.data.version;

        // review -> done
        await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'done',
            version: version
        }, { headers: memberHeaders });
        console.log('   Task marked as DONE by Member.');

        console.log('\n✅ Verification Script Completed.');
        console.log('👉 Please check your SERVER LOGS. You should see:');
        console.log('   1. "📧 [EMAIL SENT] ... Subject: Task Assignment: Notification Task"');
        console.log('   2. "📧 [EMAIL SENT] ... Subject: Task Completed: Notification Task"');

    } catch (err) {
        console.error('Test script failed:', err.message);
        if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
    }
}

runTest();
