const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const EMAIL = 'admin_test@test2.com';
const PASSWORD = 'password123';

async function runTest() {
    try {
        console.log('--- Starting Transaction Verification ---');

        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = loginRes.data.data.token;
        const headers = { Authorization: `Bearer ${token}` };
        console.log('   Login successful.');

        // 2. Create Project
        console.log('2. Creating Project...');
        const projectRes = await axios.post(`${BASE_URL}/projects`, {
            name: 'Transaction Test Project 5',
            description: 'Temp project'
        }, { headers });
        const projectId = projectRes.data.data.id;
        console.log('   Project created:', projectId);

        // 3. Create Task (Normal Case)
        console.log('3. Creating Safe Task...');
        const taskRes = await axios.post(`${BASE_URL}/tasks`, {
            title: 'Safe Title',
            project_id: projectId
        }, { headers });
        const taskId = taskRes.data.data.id;
        const initialVersion = taskRes.data.data.version;
        console.log('   Task created:', taskId, 'Version:', initialVersion);

        // 4. Trigger Fault (Update to FORCE_ROLLBACK_ERROR)
        console.log('4. Attempting Update to "FORCE_ROLLBACK_ERROR"...');
        try {
            await axios.patch(`${BASE_URL}/tasks/${taskId}`, {
                title: 'FORCE_ROLLBACK_ERROR',
                version: initialVersion
            }, { headers });
            console.error('❌ ERROR: Update should have failed but succeeded!');
        } catch (error) {
            if (error.response && error.response.status === 500) { // Or whatever your global error handler returns for generic Errors
                console.log('✅ Update failed as expected (Simulated Error).');
            } else {
                console.error('❌ Unexpected error:', error.message);
            }
        }

        // 5. Verify Rollback
        console.log('5. Verifying Task State...');
        const verifyRes = await axios.get(`${BASE_URL}/tasks/${taskId}`, { headers });
        const currentTitle = verifyRes.data.data.title;
        const currentVersion = verifyRes.data.data.version;

        console.log(`   Current Title: "${currentTitle}"`);
        console.log(`   Current Version: ${currentVersion}`);

        if (currentTitle === 'Safe Title' && currentVersion === initialVersion) {
            console.log('✅ SUCCESS: Transaction rolled back! Task is unchanged.');
        } else {
            console.error('❌ FAILURE: Task was modified despite error!', { currentTitle, currentVersion });
        }

        // 6. Normal Success Case
        console.log('6. Testing Normal Transaction (Success Case)...');
        const successRes = await axios.patch(`${BASE_URL}/tasks/${taskId}`, {
            title: 'Valid Update',
            version: currentVersion
        }, { headers });
        
        console.log('   Update successful, checking data...');
        const successVersion = successRes.data.data.version;
        if (successRes.data.data.title === 'Valid Update' && successVersion === currentVersion + 1) {
             console.log('✅ SUCCESS: Normal transaction committed successfully.');
        } else {
             console.error('❌ FAILURE: Normal transaction failed check!', successRes.data.data);
        }

        let taskVersion = successVersion;

        // --- STATUS UPDATE TESTS ---
        console.log('\n--- Status Update Tests ---');
        
        // 7. Status Normal: todo -> in_progress
        console.log('7. Status Normal (in_progress)...');
        const stRes1 = await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'in_progress',
            version: taskVersion
        }, { headers });
        taskVersion = stRes1.data.data.version;
        console.log('   Status changed to in_progress. Version:', taskVersion);

        // 8. Status Normal: in_progress -> review
        console.log('8. Status Normal (review)...');
        const stRes2 = await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'review',
            version: taskVersion
        }, { headers });
        taskVersion = stRes2.data.data.version;
        console.log('   Status changed to review. Version:', taskVersion);

        // 9. Status Bad: review -> done (Trigger Fault)
        console.log('9. Status Bad (done) -> FORCE FAILURE...');
        try {
            await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
                status: 'done',
                version: taskVersion
            }, { headers });
            console.error('❌ ERROR: Status Update should have failed!');
        } catch (error) {
            console.log('✅ Update failed as expected (Simulated Error).');
        }
        
        // Verify Rollback (Status should still be review)
        const checkSt = await axios.get(`${BASE_URL}/tasks/${taskId}`, { headers });
        if (checkSt.data.data.status === 'review' && checkSt.data.data.version === taskVersion) {
            console.log('✅ SUCCESS: Status Rollback confirmed (Still "review").');
        } else {
            console.error('❌ FAILURE: Status changed despite error!', checkSt.data.data);
        }

        // 10. Status Normal Recovery: review -> in_progress
        console.log('10. Status Normal Recovery (in_progress)...');
        const stRes3 = await axios.patch(`${BASE_URL}/tasks/${taskId}/status`, {
            status: 'in_progress',
            version: taskVersion
        }, { headers });
        taskVersion = stRes3.data.data.version;
        if(stRes3.data.data.status === 'in_progress') {
             console.log('✅ SUCCESS: Normal status update successful after rollback.');
        }

        // --- DELETE TESTS ---
        console.log('\n--- Delete Tests ---');

        // 11. Delete Bad: Rename to FORCE_ROLLBACK_ERROR (Triggers Fault immediately due to title check)
        console.log('11. Delete Bad (Rename to Trigger)...');
        
        // 11a. Rename (THIS SHOULD FAIL)
        try {
            const renRes = await axios.patch(`${BASE_URL}/tasks/${taskId}`, {
                title: 'FORCE_ROLLBACK_ERROR',
                version: taskVersion
            }, { headers });
            taskVersion = renRes.data.data.version; // Should not reach here
            
            // 11b. Attempt Delete (If rename succeeded unexpectedly)
            await axios.delete(`${BASE_URL}/tasks/${taskId}`, { headers });
            console.error('❌ ERROR: Operation should have failed!');
        } catch (error) {
             console.log('✅ Operation failed as expected (Simulated Error).');
        }

        // Verify Exists (and title unchanged)
        try {
            const checkDel = await axios.get(`${BASE_URL}/tasks/${taskId}`, { headers });
            if (checkDel.status === 200 && checkDel.data.data.is_deleted === false && checkDel.data.data.title !== 'FORCE_ROLLBACK_ERROR') {
                 console.log('✅ SUCCESS: Rollback confirmed (Task exists, title unchanged).');
            }
        } catch (e) {
            console.error('❌ FAILURE: Task is gone!', e.message);
        }

        // 12. Delete Normal: Delete directly (Title is still safe)
        console.log('12. Delete Normal...');
        
        // 12b. Delete
        await axios.delete(`${BASE_URL}/tasks/${taskId}`, { headers });
        console.log('   Delete request sent.');

        // Verify Gone
        try {
            await axios.get(`${BASE_URL}/tasks/${taskId}`, { headers });
            console.error('❌ FAILURE: Task still exists!');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                 console.log('✅ SUCCESS: Task Deleted Successfully.');
            } else {
                 console.error('❌ Unexpected integrity check error:', error.message);
            }
        }

    } catch (err) {
        console.error('Test script failed:', err.message);
        if (err.response) console.error(err.response.data);
    }
}

runTest();
