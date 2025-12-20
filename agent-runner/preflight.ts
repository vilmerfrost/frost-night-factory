/**
 * CLI tool to run pre-flight checks
 * Usage: npm run preflight
 */

import 'dotenv/config';
import { runPreflightChecks, displayPreflightResults } from '../lib/nightFactory/preflightCheck.js';

async function main() {
  console.log('\n🌙 Frost Night Factory v10 - Pre-Flight Check\n');
  
  const summary = await runPreflightChecks();
  displayPreflightResults(summary);
  
  const passed = summary.overallPass;
  
  if (passed) {
    console.log('✅ All systems go! Run: npm start\n');
  } else {
    console.log('❌ Fix issues above before running pipeline\n');
  }
  
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('\n❌ Pre-flight check crashed:', err);
  process.exit(1);
});

