// =============================================================================
// PRE-START VALIDATION - Checks for common issues before running npm start
// =============================================================================

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

const checks: CheckResult[] = [];

function addCheck(name: string, passed: boolean, message: string, critical = false) {
  checks.push({ name, passed, message, critical });
}

// Check 1: Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 20) {
  addCheck('Node.js version', true, `Node.js ${nodeVersion} (>= 20 required)`);
} else {
  addCheck('Node.js version', false, `Node.js ${nodeVersion} (>= 20 required)`, true);
}

// Check 2: Environment file exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  addCheck('.env file', true, '.env file found');
} else {
  addCheck('.env file', false, '.env file not found - create one from .env.example', true);
}

// Check 3: Critical environment variables
const requiredEnvVars = [
  { key: 'SUPABASE_URL', alt: 'NEXT_PUBLIC_SUPABASE_URL', name: 'Supabase URL' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', alt: 'SUPABASE_SERVICE_KEY', name: 'Supabase Service Role Key' },
];

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar.key] || process.env[envVar.alt];
  if (value && value !== 'placeholder-key' && !value.includes('placeholder')) {
    addCheck(envVar.name, true, `${envVar.name} is set`);
  } else {
    addCheck(envVar.name, false, `${envVar.name} is missing or invalid`, true);
  }
}

// Check 4: Optional but recommended API keys
const optionalApiKeys = [
  { key: 'ANTHROPIC_API_KEY', name: 'Anthropic API Key (for Coder)' },
  { key: 'OPENAI_API_KEY', name: 'OpenAI API Key' },
  { key: 'DEEPSEEK_API_KEY', name: 'DeepSeek API Key (for Planner)' },
  { key: 'GROQ_API_KEY', name: 'Groq API Key (for Code Reviewer)' },
  { key: 'KIMI_API_KEY', alt: 'MOONSHOT_API_KEY', name: 'Kimi/Moonshot API Key (for Research)' },
];

for (const apiKey of optionalApiKeys) {
  const value = process.env[apiKey.key] || process.env[apiKey.alt || ''];
  if (value && value.startsWith('sk-')) {
    addCheck(apiKey.name, true, `${apiKey.name} is set`);
  } else {
    addCheck(apiKey.name, false, `${apiKey.name} is missing (optional but recommended)`);
  }
}

// Check 5: Dependencies installed
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  addCheck('Dependencies', true, 'node_modules directory exists');
} else {
  addCheck('Dependencies', false, 'node_modules not found - run npm install', true);
}

// Check 6: TypeScript compilation
const tsconfigPath = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  addCheck('TypeScript config', true, 'tsconfig.json found');
} else {
  addCheck('TypeScript config', false, 'tsconfig.json not found', true);
}

// Check 7: Workspace directory exists
const workspacePath = path.join(__dirname, '..', 'workspace', 'sandbox');
if (fs.existsSync(workspacePath)) {
  addCheck('Workspace directory', true, 'Workspace sandbox directory exists');
} else {
  addCheck('Workspace directory', false, 'Workspace sandbox directory will be created automatically', false);
}

// Check 8: Supabase client file exists
const supabaseClientPath = path.join(__dirname, 'supabase-client.ts');
if (fs.existsSync(supabaseClientPath)) {
  addCheck('Supabase client', true, 'supabase-client.ts exists');
} else {
  addCheck('Supabase client', false, 'supabase-client.ts not found', true);
}

// Check 9: Required files exist
const requiredFiles = [
  'index.ts',
  'dispatcher.ts',
  'pipeline-runner.ts',
  'ai-client.ts',
];

for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    addCheck(`File: ${file}`, true, `${file} exists`);
  } else {
    addCheck(`File: ${file}`, false, `${file} not found`, true);
  }
}

// Check 10: Port availability (if PORT env var is set)
const port = process.env.PORT ? parseInt(process.env.PORT) : null;
if (port) {
  addCheck('Port availability', true, `PORT=${port} (will be checked at runtime)`);
}

// Print results
console.log('\n🔍 PRE-START VALIDATION CHECK\n');
console.log('=' .repeat(60));

let hasErrors = false;
let hasCriticalErrors = false;

for (const check of checks) {
  const icon = check.passed ? '✅' : (check.critical ? '❌' : '⚠️');
  const status = check.passed ? 'PASS' : (check.critical ? 'FAIL' : 'WARN');
  console.log(`${icon} [${status}] ${check.name}`);
  console.log(`   ${check.message}`);
  
  if (!check.passed && check.critical) {
    hasCriticalErrors = true;
  }
  if (!check.passed) {
    hasErrors = true;
  }
}

console.log('=' .repeat(60));

if (hasCriticalErrors) {
  console.log('\n❌ CRITICAL ERRORS FOUND - Fix these before starting!\n');
  process.exit(1);
} else if (hasErrors) {
  console.log('\n⚠️  WARNINGS FOUND - Some features may not work correctly\n');
  console.log('You can still start, but some functionality may be limited.\n');
  process.exit(0);
} else {
  console.log('\n✅ ALL CHECKS PASSED - Ready to start!\n');
  process.exit(0);
}

