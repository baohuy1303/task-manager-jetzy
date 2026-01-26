const axios = require('axios');

async function verifyPaginationOrder() {
  console.log('🧪 Verifying Pagination Order (Users)...\n');

  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'admin-1@org1.com',
      password: 'password123'
    });
    const token = loginRes.data.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Fetch Page 1
    console.log('📄 Fetching Page 1 (limit 20)...');
    const p1 = await axios.get('http://localhost:3000/api/v1/users?limit=20', config);
    const p1Data = p1.data.data;
    const p1Meta = p1.data.meta;
    
    console.log(`   Page 1: First item: ${p1Data[0].name} | Last item: ${p1Data[19].name}`);
    
    // 3. Fetch Page 2
    console.log('\n📄 Fetching Page 2 (limit 20)...');
    const p2 = await axios.get(`http://localhost:3000/api/v1/users?limit=20&cursor=${p1Meta.next_cursor}`, config);
    const p2Data = p2.data.data;
    const p2Meta = p2.data.meta;
    
    console.log(`   Page 2: First item: ${p2Data[0].name} | Last item: ${p2Data[19].name}`);
    
    // 4. Verification logic
    const lastP1 = p1Data[19].name;
    const firstP2 = p2Data[0].name;
    
    console.log(`\n🧐 Comparing: Last item Page 1 [${lastP1}] vs First item Page 2 [${firstP2}]`);
    
    // Check for duplicates
    const p1Ids = new Set(p1Data.map(u => u.id));
    const duplicates = p2Data.filter(u => p1Ids.has(u.id));
    
    if (duplicates.length > 0) {
      console.log('❌ FAIL: Found duplicates on Page 2!');
      duplicates.forEach(d => console.log(`   - Duplicate ID found: ${d.name}`));
    } else {
      console.log('✅ SUCCESS: No duplicates found on Page 2.');
    }

    // Check sequence (Member X should be followed by Member X-1)
    const getNum = (name) => parseInt(name.match(/\d+/)[0]);
    if (getNum(firstP2) === getNum(lastP1) - 1) {
       console.log('✅ SUCCESS: Order sequence is correct (Member 41 followed by Member 40).');
    } else {
       console.log(`⚠️  WARNING: Sequence gap detected: ${getNum(lastP1)} -> ${getNum(firstP2)}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

verifyPaginationOrder();
