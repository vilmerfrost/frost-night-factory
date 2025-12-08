// =============================================================================
// KIMI API KEY TEST - TypeScript Version
// =============================================================================
// Tests Kimi/Moonshot API key validity

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env files (check multiple locations)
const scriptDir = __dirname || path.dirname(process.argv[1] || '');
const rootDir = path.resolve(scriptDir, '..');
const agentRunnerDir = path.join(rootDir, 'agent-runner');

const envPaths = [
  path.join(rootDir, '.env'),
  path.join(agentRunnerDir, '.env'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`📄 Loaded .env from: ${envPath}`);
  }
}

async function testKimiAPI(): Promise<void> {
  const kimiKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;

  if (!kimiKey) {
    console.error('❌ ERROR: MOONSHOT_API_KEY or KIMI_API_KEY not set');
    console.error('');
    console.error('Set it with:');
    console.error('  PowerShell: $env:MOONSHOT_API_KEY = "your-api-key"');
    console.error('  Bash: export MOONSHOT_API_KEY=your-api-key');
    console.error('  Or add to .env file: MOONSHOT_API_KEY=your-api-key');
    console.error('');
    console.error('Checked .env files at:');
    envPaths.forEach(p => console.error(`  - ${p}`));
    process.exit(1);
  }

  console.log('🔍 Testing Kimi/Moonshot API Key...\n');
  console.log(`✅ API Key found: ${kimiKey.substring(0, 10)}***`);
  console.log(`   Length: ${kimiKey.length} characters\n`);

  console.log(`📡 Endpoint: https://api.moonshot.ai/v1/models\n`);

  try {
    const response = await fetch('https://api.moonshot.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${kimiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Test FAILED`);
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}\n`);
      
      if (response.status === 401) {
        console.error('🔑 Authentication Error - Check:');
        console.error('   1. API key is correct (starts with "sk-")');
        console.error('   2. API key is not expired');
        console.error('   3. No extra spaces in API key');
        console.error('   4. Account is active at: https://platform.moonshot.ai');
      } else if (response.status === 429) {
        console.error('⏱️  Rate Limit Error - Wait before retrying');
      }
      
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ API Key is VALID!\n');
    console.log('Available models:');
    data.data?.forEach((model: any) => {
      console.log(`  - ${model.id}`);
    });
    
    // Check for K2 models specifically
    const k2Models = data.data?.filter((m: any) => m.id.includes('k2'));
    if (k2Models && k2Models.length > 0) {
      console.log('\n✅ K2 models available:');
      k2Models.forEach((model: any) => {
        console.log(`  - ${model.id}`);
      });
    } else {
      console.log('\n⚠️  No K2 models found in response');
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.error(`❌ API Test FAILED: ${error.message}`);
    console.error('');
    console.error('Check:');
    console.error('   1. Internet connection');
    console.error('   2. API endpoint is accessible');
    console.error('   3. API key format is correct');
    process.exit(1);
  }
}

// Run the test
testKimiAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

