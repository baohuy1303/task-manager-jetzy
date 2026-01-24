const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function runTest() {
    try {
        // 1. Setup: Create Org, Admin, Member, Project
        console.log('--- Setup ---');
        
        // Register Admin
        const adminEmail = `admin_${Date.now()}@test.com`;
        const adminRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Admin User',
            email: adminEmail,
            password: 'password123',
            role: 'admin',
            organization_name: `Org_${Date.now()}`
        });
        const adminToken = adminRes.data.token;
        const orgId = adminRes.data.user.organization_id;
        const adminId = adminRes.data.user.id;
        console.log(`Created Admin: ${adminEmail} (ID: ${adminId})`);

        // Register Member
        const memberEmail = `member_${Date.now()}@test.com`;
        const memberRes = await axios.post(`${BASE_URL}/users`, {
            organization_id: orgId, // Using the same Organization
            name: 'Member User',
            email: memberEmail,
            password: 'password123',
            role: 'member'
        }, { headers: { Authorization: `Bearer ${adminToken}` } }); // Creating via Admin API to ensure correct Org
        const memberId = memberRes.data.data.id;
        console.log(`Created Member: ${memberEmail} (ID: ${memberId})`);
        
        // Admin creates Project
        const projectRes = await axios.post(`${BASE_URL}/projects`, {
            name: `Project_${Date.now()}`,
            description: 'Test Project',
            status: 'active'
        }, { headers: { Authorization: `Bearer ${adminToken}` } });
        const projectId = projectRes.data.data.id;
        console.log(`Created Project: ${projectId}`);

        // Member creates a Task (assigned to themselves)
        const taskRes = await axios.post(`${BASE_URL}/tasks`, {
            project_id: projectId,
            title: 'Task by Member',
            assigned_to: memberId
        }, { headers: { Authorization: `Bearer ${adminToken}` } }); // Using Admin token to assign to member easily, or we could login as member
        const taskId = taskRes.data.data.id;
        console.log(`Created Task: ${taskId} assigned to Member (${memberId})`);

        // 2. Action: Deactivate Member
        console.log('\n--- Action: Deactivate Member ---');
        const deactivateRes = await axios.delete(`${BASE_URL}/users/${memberId}`, {
             headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('Deactivation Result:', deactivateRes.data);

        // 3. Verification
        console.log('\n--- Verification ---');
        
        // Check User Status
        const userCheckRes = await axios.get(`${BASE_URL}/users/${memberId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const userIsActive = userCheckRes.data.data.is_active;
        console.log(`User Active Status: ${userIsActive} (Expected: false)`);

        // Check Task Assignment
        const taskCheckRes = await axios.get(`${BASE_URL}/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const taskAssignedTo = taskCheckRes.data.data.assigned_to;
        console.log(`Task Assigned To: ${taskAssignedTo}`);
        console.log(`Expected (Admin ID): ${adminId}`);

        if (userIsActive === false && taskAssignedTo === adminId) {
            console.log('\n✅ TEST PASSED');
        } else {
            console.log('\n❌ TEST FAILED');
        }

    } catch (error) {
        console.error('Test Failed with Error:', error.response?.data || error.message);
    }
}

runTest();
