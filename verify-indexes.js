const { query } = require('./config/db');

async function verifyIndexes() {
  console.log('🔍 Verifying audit_logs indexes...\n');

  try {
    // 1. Check if indexes exist
    const indexCheck = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'audit_logs' 
      ORDER BY indexname
    `);

    console.log('📊 Existing Indexes on audit_logs:');
    indexCheck.rows.forEach(idx => {
      console.log(`  ✅ ${idx.indexname}`);
      console.log(`     ${idx.indexdef}\n`);
    });

    // 2. Test query plan for common query
    const explainResult = await query(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM audit_logs 
      WHERE organization_id = '00000000-0000-0000-0000-000000000000'
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    const plan = explainResult.rows[0]['QUERY PLAN'][0];
    console.log('📈 Query Plan for org scoping + pagination:');
    console.log(`  Execution Time: ${plan['Execution Time'].toFixed(2)}ms`);
    console.log(`  Planning Time: ${plan['Planning Time'].toFixed(2)}ms`);
    
    const usesIndex = JSON.stringify(plan).includes('idx_audit_org_created');
    console.log(`  ${usesIndex ? '✅' : '❌'} Uses idx_audit_org_created: ${usesIndex}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyIndexes();
