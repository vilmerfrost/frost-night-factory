#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY v9.0 - Generate Fortress Files
// =============================================================================
// Run: npm run generate-fortress

import * as fs from 'fs/promises';
import * as path from 'path';
import { FORTRESS_FILES, FortressTier, getFortressSummary } from '../lib/nightFactory/fortress-files';

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'fortress');
const TARGET_DIR = process.argv[2] || path.join(__dirname, '..', 'workspace', 'sandbox', 'generated-project');

async function main() {
  console.log('\n🏰 Generating Fortress Files\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Templates: ${TEMPLATES_DIR}`);
  console.log(`Target: ${TARGET_DIR}`);
  console.log('');
  
  // Show fortress summary
  console.log(getFortressSummary());
  
  // Get golden files with templates
  const goldenFiles = FORTRESS_FILES.filter(
    f => f.tier === FortressTier.GOLDEN && f.template
  );
  
  console.log(`\n📦 Copying ${goldenFiles.length} golden templates...\n`);
  
  let copied = 0;
  let failed = 0;
  
  for (const fortress of goldenFiles) {
    if (!fortress.template) continue;
    
    const templateName = path.basename(fortress.template);
    const sourcePath = path.join(TEMPLATES_DIR, templateName);
    const destPath = path.join(TARGET_DIR, fortress.pattern);
    
    try {
      // Check if template exists
      await fs.access(sourcePath);
      
      // Create destination directory
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(sourcePath, destPath);
      
      console.log(`  ✅ ${fortress.pattern}`);
      copied++;
    } catch (error: any) {
      console.log(`  ⚠️ ${fortress.pattern} - ${error.message}`);
      failed++;
    }
  }
  
  // Copy regenerate-only templates
  const regenFiles = FORTRESS_FILES.filter(
    f => f.tier === FortressTier.REGENERATE_ONLY && f.template
  );
  
  console.log(`\n📦 Copying ${regenFiles.length} regenerate-only templates...\n`);
  
  for (const fortress of regenFiles) {
    if (!fortress.template) continue;
    
    const templateName = path.basename(fortress.template);
    const sourcePath = path.join(TEMPLATES_DIR, templateName);
    const destPath = path.join(TARGET_DIR, fortress.pattern);
    
    try {
      await fs.access(sourcePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
      
      console.log(`  ✅ ${fortress.pattern}`);
      copied++;
    } catch (error: any) {
      console.log(`  ⚠️ ${fortress.pattern} - ${error.message}`);
      // Not counting as failed since these are optional
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Copied: ${copied}`);
  console.log(`  ⚠️ Skipped: ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  if (failed > 0) {
    console.log('⚠️ Some templates were not found. Create them in templates/fortress/');
  }
}

main().catch(console.error);

