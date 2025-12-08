#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY v9.0 - Generate Domain Types
// =============================================================================
// Run: npm run generate-domain-types

import * as path from 'path';
import { generateDomainFiles, DOMAIN_ADAPTERS } from '../lib/nightFactory/domain-type-adapter';

const TARGET_DIR = process.argv[2] || path.join(__dirname, '..', 'workspace', 'sandbox', 'generated-project');

async function main() {
  console.log('\n🔧 Generating Domain Types\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${TARGET_DIR}`);
  console.log('');
  
  console.log('📋 Domain Adapters:');
  for (const adapter of DOMAIN_ADAPTERS) {
    console.log(`  - ${adapter.name} (from ${adapter.sourceTable})`);
    console.log(`    Fields: ${adapter.pickedFields.join(', ')}`);
    console.log(`    Additional: ${Object.keys(adapter.additionalFields).join(', ')}`);
    console.log('');
  }
  
  try {
    const { types, mocks } = await generateDomainFiles(TARGET_DIR);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ Generated src/lib/types.ts');
    console.log('  ✅ Generated src/lib/mock-data.ts');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Types file preview:');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(types.split('\n').slice(0, 30).join('\n'));
    console.log('...');
    console.log('');
  } catch (error: any) {
    console.error('❌ Failed to generate:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

