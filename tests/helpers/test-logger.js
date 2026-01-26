// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function logSection(title) {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bold + colors.cyan + title + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function logTest(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  console.log(`${icon} ${color}${testName}${colors.reset}`);
  if (details) {
    console.log(`   ${colors.yellow}${details}${colors.reset}`);
  }
}

function logSubsection(title) {
  console.log(`\n${colors.blue}${title}${colors.reset}`);
}

function logResult(label, value, isSuccess = true) {
  const color = isSuccess ? colors.green : colors.red;
  console.log(`   ${label}: ${color}${value}${colors.reset}`);
}

function logSummary(scenarioNumber, scenarioName, happyTests, errorTests) {
  console.log(`\n${colors.blue}${'─'.repeat(80)}${colors.reset}`);
  console.log(`${colors.bold}Scenario ${scenarioNumber} Results:${colors.reset}`);
  console.log(`  Happy Path Tests: ${colors.green}${happyTests.passed}/${happyTests.total} ✅${colors.reset}`);
  console.log(`  Error Case Tests: ${colors.green}${errorTests.passed}/${errorTests.total} ✅${colors.reset}`);
  const totalPassed = happyTests.passed + errorTests.passed;
  const totalTests = happyTests.total + errorTests.total;
  console.log(`  ${colors.bold}Total: ${totalPassed}/${totalTests}${colors.reset}`);
}

module.exports = {
  logSection,
  logTest,
  logSubsection,
  logResult,
  logSummary,
  colors
};
