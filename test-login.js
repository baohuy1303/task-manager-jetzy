const { query } = require('./config/db');
const axios = require('axios');

async function testLogin() {
  console.log('🔐 Testing login with seeded accounts...\n');

  try {
    // 1. Check if users exist
    const usersCheck = await query(`
      SELECT email, role, organization_id, is_active 
      FROM users 
      WHERE email IN ('admin-1@org1.com', 'manager-1@org1.com', 'member-1@org1.com')
      ORDER BY role
    `);

    console.log('📊 Users in database:');
    if (usersCheck.rows.length === 0) {
      console.log('  ❌ No users found! Seeding may have failed.\n');
      process.exit(1);
    }

    usersCheck.rows.forEach(user => {
      console.log(`  ✅ ${user.email.padEnd(30)} | Role: ${user.role.padEnd(10)} | Active: ${user.is_active}`);
    });

    // 2. Test login for each account
    console.log('\n🧪 Testing login via API...\n');

    const accounts = [
      { email: 'admin-1@org1.com', password: 'password123', role: 'admin' },
      { email: 'manager-1@org1.com', password: 'password123', role: 'manager' },
      { email: 'member-1@org1.com', password: 'password123', role: 'member' }
    ];

    for (const account of accounts) {
      try {
        const response = await axios.post('http://localhost:3000/api/v1/auth/login', {
          email: account.email,
          password: account.password
        });

        if (response.status === 200 && response.data.data.token) {
          console.log(`  ✅ ${account.role.toUpperCase().padEnd(10)} login successful`);
          console.log(`     Token: ${response.data.data.token.substring(0, 30)}...`);
        } else {
          console.log(`  ❌ ${account.role.toUpperCase()} login failed: Unexpected response`);
        }
      } catch (error) {
        console.log(`  ❌ ${account.role.toUpperCase().padEnd(10)} login failed: ${error.response?.data?.error || error.message}`);
      }
    }

    console.log('\n✅ Login test complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogin();
