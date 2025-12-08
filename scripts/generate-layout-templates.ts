#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY - Generate Layout Templates from Contracts
// =============================================================================
// Run: npm run generate-layout-templates

import * as fs from 'fs/promises';
import * as path from 'path';
import { LAYOUT_CONTRACTS } from '../lib/nightFactory/layout-contract';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'core-layout');

async function main() {
  console.log('\n🧱 Generating Layout Templates from Contracts\n');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Ensure directory exists
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  
  let generated = 0;
  
  for (const contract of LAYOUT_CONTRACTS) {
    const fileName = `${contract.name}.tsx`;
    const filePath = path.join(TEMPLATES_DIR, fileName);
    
    // Generate file content with header comment
    const content = `// =============================================================================
// ${contract.name} - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

${contract.example}
`;
    
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`  ✅ ${fileName}`);
    generated++;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Generated ${generated} layout templates`);
  console.log(`  📁 Output: ${TEMPLATES_DIR}`);
  console.log('');
}

main().catch(console.error);

