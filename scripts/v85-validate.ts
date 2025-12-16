#!/usr/bin/env tsx
// =============================================================================
// FROST NIGHT FACTORY v8.5 - VALIDATION SCRIPT
// =============================================================================
// Run: npm run v85:validate [projectPath]

import * as path from 'path';
import { runFrameworkGuardrails } from '../lib/nightFactory/v85-ast-validators';
import { classifyViolations } from '../lib/nightFactory/v85-error-classifier';
import { printFeatureFlagStatus } from '../lib/nightFactory/v85-feature-flags';
import { getV85Version } from '../lib/nightFactory/v85-index';

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const resolvedPath = path.resolve(projectPath);
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧊 FROST NIGHT FACTORY v8.5 - VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const version = getV85Version();
  console.log(`📦 Version: ${version.version}`);
  console.log(`📁 Project: ${resolvedPath}`);
  console.log('');
  
  printFeatureFlagStatus();
  
  console.log('🔍 Running AST guardrails...\n');
  
  try {
    const violations = runFrameworkGuardrails(resolvedPath);
    
    if (violations.length === 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✅ ALL VALIDATIONS PASSED!');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log('Your project follows all v8.5 rules:');
      console.log('  ✅ No JSX in .ts files');
      console.log('  ✅ No React imports in API routes');
      console.log('  ✅ All API routes export HTTP handlers');
      console.log('  ✅ No deep relative imports');
      console.log('  ✅ No lazy code patterns');
      console.log('');
      process.exit(0);
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ❌ FOUND ${violations.length} VIOLATIONS`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    
    // Classify violations
    const classified = classifyViolations(violations, 0);
    
    // Group by severity
    const bySeverity = {
      CRITICAL: classified.filter(e => e.severity === 'CRITICAL'),
      HIGH: classified.filter(e => e.severity === 'HIGH'),
      MEDIUM: classified.filter(e => e.severity === 'MEDIUM'),
      LOW: classified.filter(e => e.severity === 'LOW'),
    };
    
    // Print by severity
    for (const [severity, errors] of Object.entries(bySeverity)) {
      if (errors.length === 0) continue;
      
      const icon = severity === 'CRITICAL' ? '🔴' : 
                   severity === 'HIGH' ? '🟠' :
                   severity === 'MEDIUM' ? '🟡' : '🟢';
      
      console.log(`\n${icon} ${severity} (${errors.length}):`);
      console.log('───────────────────────────────────────────────────────────────');
      
      for (const error of errors) {
        const relPath = error.file.replace(resolvedPath, '').replace(/^[/\\]/, '');
        console.log(`\n  📄 ${relPath}`);
        console.log(`     Category: ${error.category}`);
        console.log(`     Message: ${error.errorMessage}`);
        console.log(`     Root Cause: ${error.rootCause}`);
        
        if (error.suggestedFixes.length > 0) {
          const firstFix = error.suggestedFixes[0];
          if (firstFix) {
            console.log(`     Suggested Fix: ${firstFix.strategy}`);
            console.log(`     Success Probability: ${(firstFix.probability * 100).toFixed(0)}%`);
          }
        }
      }
    }
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  🔴 Critical: ${bySeverity.CRITICAL.length}`);
    console.log(`  🟠 High: ${bySeverity.HIGH.length}`);
    console.log(`  🟡 Medium: ${bySeverity.MEDIUM.length}`);
    console.log(`  🟢 Low: ${bySeverity.LOW.length}`);
    console.log('');
    
    if (bySeverity.CRITICAL.length > 0) {
      console.log('⚠️  Fix CRITICAL errors before proceeding!');
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    console.error('');
    console.error('This might be because:');
    console.error('  1. tsconfig.json is missing');
    console.error('  2. Project path is incorrect');
    console.error('  3. TypeScript is not installed');
    console.error('');
    process.exit(1);
  }
}

main();

