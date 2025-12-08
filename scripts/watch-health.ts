// =============================================================================
// CONTINUOUS VALIDATION SERVICE - Real-time syntax protection
// =============================================================================
// Watches files for changes and validates syntax automatically

import * as chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

let validationInProgress = false;
const changedFiles = new Set<string>();
let validationTimeout: NodeJS.Timeout | null = null;

// Configuration
const CONFIG = {
  debounceMs: 1000, // Wait 1 second after last change before validating
  autoRevert: process.env.AUTO_REVERT === 'true', // Auto-revert broken files
  alertWebhook: process.env.ALERT_WEBHOOK || null, // Optional webhook URL
};

/**
 * Validate a single file
 */
async function validateFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
  try {
    // Quick syntax check using TypeScript compiler
    const { stdout, stderr } = await execAsync(
      `npx tsc --noEmit --skipLibCheck "${filePath}" 2>&1 || true`
    );
    
    const errors: string[] = [];
    
    // Parse TypeScript errors
    const errorLines = (stdout + stderr).split('\n').filter(line => 
      line.includes('error TS') || line.includes('Syntax error')
    );
    
    if (errorLines.length > 0) {
      errors.push(...errorLines);
    }
    
    // Also check for common syntax issues
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for unbalanced braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    // Check for unbalanced parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for incomplete template literals
    const backticks = (content.match(/`/g) || []).length;
    if (backticks % 2 !== 0) {
      errors.push('Incomplete template literal (odd number of backticks)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message],
    };
  }
}

/**
 * Validate all changed files
 */
async function validateChangedFiles(): Promise<void> {
  if (validationInProgress || changedFiles.size === 0) {
    return;
  }
  
  validationInProgress = true;
  const filesToValidate = Array.from(changedFiles);
  changedFiles.clear();
  
  console.log(`\n🔍 Validating ${filesToValidate.length} changed file(s)...`);
  
  const results: Array<{ file: string; valid: boolean; errors: string[] }> = [];
  
  for (const filePath of filesToValidate) {
    // Skip if file doesn't exist (might have been deleted)
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    const result = await validateFile(filePath);
    results.push({ file: filePath, ...result });
    
    if (!result.valid) {
      console.log(`\n🚨 SYNTAX ERROR DETECTED: ${filePath}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
      
      // Auto-revert if enabled
      if (CONFIG.autoRevert) {
        try {
          await execAsync(`git checkout HEAD -- "${filePath}"`);
          console.log(`✅ File reverted to last good version: ${filePath}`);
        } catch (revertError) {
          console.error(`⚠️  Failed to revert ${filePath}:`, revertError);
        }
      }
      
      // Send alert
      await sendAlert({
        type: 'SYNTAX_ERROR',
        file: filePath,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`✅ ${path.basename(filePath)} - Syntax valid`);
    }
  }
  
  const invalidFiles = results.filter(r => !r.valid);
  
  if (invalidFiles.length > 0) {
    console.log(`\n❌ ${invalidFiles.length} file(s) with syntax errors`);
  } else {
    console.log(`\n✅ All files validated successfully`);
  }
  
  validationInProgress = false;
}

/**
 * Send alert (webhook or console)
 */
async function sendAlert(data: {
  type: string;
  file: string;
  errors?: string[];
  timestamp: string;
}): Promise<void> {
  if (CONFIG.alertWebhook) {
    try {
      const fetch = (await import('node-fetch')).default;
      await fetch(CONFIG.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (error) {
      // Non-critical
    }
  }
  
  // Also log to file
  const logFile = path.join(process.cwd(), 'health-watcher.log');
  const logEntry = `[${data.timestamp}] ${data.type}: ${data.file}\n`;
  fs.appendFileSync(logFile, logEntry, 'utf-8');
}

/**
 * Debounced validation
 */
function scheduleValidation(filePath: string): void {
  changedFiles.add(filePath);
  
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }
  
  validationTimeout = setTimeout(() => {
    validateChangedFiles();
  }, CONFIG.debounceMs);
}

/**
 * Main watcher setup
 */
function startWatcher(): void {
  const watchDir = path.join(process.cwd(), 'agent-runner');
  
  console.log('👁️  Health watcher starting...');
  console.log(`   Watching: ${watchDir}`);
  console.log(`   Auto-revert: ${CONFIG.autoRevert ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   Debounce: ${CONFIG.debounceMs}ms\n`);
  
  const watcher = chokidar.watch(`${watchDir}/**/*.{ts,tsx}`, {
    ignored: [
      /(^|[\/\\])\../, // Ignore dotfiles
      /node_modules/,
      /dist/,
      /build/,
      /\.next/,
      /coverage/,
      /workspace\/sandbox/, // Ignore sandbox files
    ],
    persistent: true,
    ignoreInitial: true,
  });
  
  watcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${path.relative(process.cwd(), filePath)}`);
    scheduleValidation(filePath);
  });
  
  watcher.on('add', (filePath) => {
    console.log(`➕ File added: ${path.relative(process.cwd(), filePath)}`);
    scheduleValidation(filePath);
  });
  
  watcher.on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });
  
  console.log('✅ Health watcher active - monitoring for syntax errors...\n');
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down health watcher...');
    watcher.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down health watcher...');
    watcher.close();
    process.exit(0);
  });
}

// Start watcher
startWatcher();

