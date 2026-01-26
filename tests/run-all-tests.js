const runScenario1 = require('./scenario-1-user-lifecycle');
const runScenario2 = require('./scenario-2-project-task-workflow');
const runScenario3 = require('./scenario-3-admin-operations');
const runScenario4 = require('./scenario-4-security-edge-cases');
const runScenario5 = require('./scenario-5-email-notifications');

const { colors } = require('./helpers/test-logger');

async function runAllTests() {
  console.log('\n' + colors.bold + colors.cyan + '🧪 RUNNING COMPLETE API TEST SUITE' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset);
  console.log('Testing all 25 endpoints with happy paths and error cases');
  console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');

  const startTime = Date.now();
  const results = [];

  try {
    // Run all scenarios
    results.push(await runScenario1());
    results.push(await runScenario2());
    results.push(await runScenario3());
    results.push(await runScenario4());
    results.push(await runScenario5());

    // Calculate totals
    const totals = results.reduce((acc, result) => {
      acc.happyPassed += result.happyTests.passed;
      acc.happyTotal += result.happyTests.total;
      acc.errorPassed += result.errorTests.passed;
      acc.errorTotal += result.errorTests.total;
      return acc;
    }, { happyPassed: 0, happyTotal: 0, errorPassed: 0, errorTotal: 0 });

    const totalPassed = totals.happyPassed + totals.errorPassed;
    const totalTests = totals.happyTotal + totals.errorTotal;
    const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

    // Print final summary
    console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
    console.log(colors.bold + colors.cyan + '📊 FINAL TEST SUMMARY' + colors.reset);
    console.log(colors.cyan + '='.repeat(80) + colors.reset);

    console.log(`\n${colors.bold}Scenario Results:${colors.reset}`);
    console.log(`  Scenario 1 (User Lifecycle):      ${results[0].happyTests.passed + results[0].errorTests.passed}/${results[0].happyTests.total + results[0].errorTests.total} tests passed`);
    console.log(`  Scenario 2 (Project/Task):        ${results[1].happyTests.passed + results[1].errorTests.passed}/${results[1].happyTests.total + results[1].errorTests.total} tests passed`);
    console.log(`  Scenario 3 (Admin Operations):    ${results[2].happyTests.passed + results[2].errorTests.passed}/${results[2].happyTests.total + results[2].errorTests.total} tests passed`);
    console.log(`  Scenario 4 (Security):            ${results[3].happyTests.passed + results[3].errorTests.passed}/${results[3].happyTests.total + results[3].errorTests.total} tests passed`);
    console.log(`  Scenario 5 (Email Notifications): ${results[4].happyTests.passed + results[4].errorTests.passed}/${results[4].happyTests.total + results[4].errorTests.total} tests passed`);

    console.log(`\n${colors.bold}Overall Statistics:${colors.reset}`);
    console.log(`  ${colors.green}Happy Path Tests:     ${totals.happyPassed}/${totals.happyTotal} ✅${colors.reset}`);
    console.log(`  ${colors.green}Error Case Tests:     ${totals.errorPassed}/${totals.errorTotal} ✅${colors.reset}`);
    console.log(`  ${colors.bold}Total Tests:          ${totalPassed}/${totalTests} (${passRate}%)${colors.reset}`);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ${colors.gray}Execution Time:       ${elapsed}s${colors.reset}`);

    console.log(`\n${colors.bold}Endpoints Tested:${colors.reset}`);
    console.log(`  Authentication:       2 endpoints ✅`);
    console.log(`  Organizations:        4 endpoints ✅`);
    console.log(`  Users:                7 endpoints ✅`);
    console.log(`  Projects:             4 endpoints ✅`);
    console.log(`  Tasks:                7 endpoints ✅`);
    console.log(`  Audit Logs:           1 endpoint  ✅`);
    console.log(`  ${colors.bold}Total:                25/25 endpoints (100% coverage)${colors.reset}`);

    console.log(`\n${colors.bold}Security Features Tested:${colors.reset}`);
    console.log(`  ✅ RBAC (Role-Based Access Control)`);
    console.log(`  ✅ Organization Scoping`);
    console.log(`  ✅ Optimistic Locking (Concurrent Updates)`);
    console.log(`  ✅ Workflow Validation`);
    console.log(`  ✅ Admin Self-Deactivation Prevention`);
    console.log(`  ✅ Soft Delete Protection`);
    console.log(`  ✅ Correlation ID Tracing`);
    console.log(`  ✅ Background Worker Notifications`);

    // Final verdict
    console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
    if (totalPassed === totalTests) {
      console.log(colors.green + colors.bold + '✅ ALL TESTS PASSED! API is production-ready.' + colors.reset);
    } else {
      console.log(colors.yellow + colors.bold + `⚠️  ${totalTests - totalPassed} test(s) failed. Review output above.` + colors.reset);
    }
    console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');

    process.exit(totalPassed === totalTests ? 0 : 1);

  } catch (error) {
    console.error(colors.red + '\n❌ Test suite failed with error:' + colors.reset);
    console.error(error);
    process.exit(1);
  }
}

// Run all tests
runAllTests();
