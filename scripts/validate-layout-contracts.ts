#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY - Validate Layout Contracts
// =============================================================================
// Run: npm run validate-layout-contracts

import * as fs from 'fs/promises';
import * as path from 'path';
import { LAYOUT_CONTRACTS, validatePropsAgainstContract } from '../lib/nightFactory/layout-contract';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'core-layout');

async function main() {
  console.log('\n🔍 Validating Layout Contracts\n');
  console.log('═══════════════════════════════════════════════════════════════');
  
  let passed = 0;
  let failed = 0;
  
  for (const contract of LAYOUT_CONTRACTS) {
    const fileName = `${contract.name}.tsx`;
    const filePath = path.join(TEMPLATES_DIR, fileName);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const validation = validatePropsAgainstContract(content, contract);
      
      if (validation.valid) {
        console.log(`  ✅ ${contract.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${contract.name}`);
        for (const error of validation.errors) {
          console.log(`     - ${error}`);
        }
        failed++;
      }
    } catch (err) {
      console.log(`  ⚠️ ${contract.name} - Template not found`);
      console.log(`     Run: npm run generate-layout-templates`);
      failed++;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  
  if (failed > 0) {
    console.log('⚠️ Some contracts are invalid. Run:');
    console.log('   npm run generate-layout-templates');
    process.exit(1);
  } else {
    console.log('✅ All layout contracts are valid!');
    process.exit(0);
  }
}

main().catch(console.error);

