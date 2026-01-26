const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// Helpers
async function login(email, password) {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return { token: res.data.data.token, user: res.data.data.user };
}

async function runTest() {
    try {
        console.log('--- User Update Verification ---');
        const timestamp = Date.now();

        // 1. Setup: Admin creates a Manager and a Member
        console.log('1. Setting up users...');
        const admin = await login('admin_test@test2.com', 'password123'); // Assume existing admin
        const adminHeaders = { Authorization: `Bearer ${admin.token}` };
        
        // Create Manager
        const mgrRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Test Manager',
            email: `mgr_${timestamp}@test.com`,
            password: 'password123',
            role: 'manager',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const manager = mgrRes.data.data;

        // Create Member
        const memRes = await axios.post(`${BASE_URL}/users`, {
            name: 'Test Member',
            email: `mem_${timestamp}@test.com`,
            password: 'password123',
            role: 'member',
            organization_id: admin.user.organization_id
        }, { headers: adminHeaders });
        const member = memRes.data.data;

        // Login as Manager & Member
        const mgrSession = await login(manager.email, 'password123');
        const memSession = await login(member.email, 'password123');

        // TEST 1: Member Updates Self (Name) -> Should SUCCEED
        console.log('\n[Test 1] Member updating own name...');
        try {
            const res = await axios.patch(`${BASE_URL}/users/${member.id}`, {
                name: 'Updated Member Name'
            }, { headers: { Authorization: `Bearer ${memSession.token}` } });
            
            if (res.data.data.name === 'Updated Member Name') {
                console.log('✅ Success: Member name updated.');
            } else {
                console.error('❌ Failure: Name mismatch', res.data.data);
            }
        } catch (e) {
            console.error('❌ Error:', e.response?.data || e.message);
        }

        // TEST 2: Member Updates Self (Role) -> Should FAIL
        console.log('\n[Test 2] Member updating own role to admin...');
        try {
            await axios.patch(`${BASE_URL}/users/${member.id}`, {
                role: 'admin'
            }, { headers: { Authorization: `Bearer ${memSession.token}` } });
            console.error('❌ Failure: Member was able to update role!');
        } catch (e) {
            if (e.response?.status === 403) {
                console.log('✅ Success: Update blocked (403 Forbidden).');
            } else {
                console.error('❌ Unexpected Error:', e.response?.status, e.response?.data);
            }
        }

        // TEST 3: Manager Updates Member -> Should FAIL
        console.log('\n[Test 3] Manager updating Member name...');
        try {
            await axios.patch(`${BASE_URL}/users/${member.id}`, {
                name: 'Manager Hacked Name'
            }, { headers: { Authorization: `Bearer ${mgrSession.token}` } });
            console.error('❌ Failure: Manager was able to update Member!');
        } catch (e) {
            if (e.response?.status === 403) {
                console.log('✅ Success: Update blocked (403 Forbidden).');
            } else {
                console.error('❌ Unexpected Error:', e.response?.status, e.response?.data);
            }
        }

        // TEST 4: Admin Updates Member (Role) -> Should SUCCEED
        console.log('\n[Test 4] Admin updating Member role to Manager...');
        try {
            const res = await axios.patch(`${BASE_URL}/users/${member.id}`, {
                role: 'manager'
            }, { headers: adminHeaders });
            
            if (res.data.data.role === 'manager') {
                console.log('✅ Success: Role updated by Admin.');
            } else {
                console.error('❌ Failure: Role not updated', res.data.data);
            }
        } catch (e) {
            console.error('❌ Error:', e.response?.data || e.message);
        }

    } catch (err) {
        console.error('Script failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTest();
