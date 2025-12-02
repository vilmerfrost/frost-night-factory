// =============================================================================
// PATH LOGGER - Log all path operations for debugging
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(process.cwd(), 'path-operations.log');

/**
 * Log a path operation
 */
export function logPathOperation(
  operation: 'WRITE' | 'READ' | 'DELETE' | 'MOVE' | 'CREATE_DIR' | 'VERIFY',
  targetPath: string,
  details?: {
    size?: number;
    exists?: boolean;
    success?: boolean;
    error?: string;
    source?: string;
  }
): void {
  const timestamp = new Date().toISOString();
  const relativePath = path.relative(process.cwd(), targetPath);
  
  const logEntry = {
    timestamp,
    operation,
    path: relativePath,
    fullPath: targetPath,
    exists: details?.exists ?? fs.existsSync(targetPath),
    success: details?.success ?? true,
    ...details,
  };
  
  // Console log (colorized)
  const emoji = {
    WRITE: '✍️',
    READ: '📖',
    DELETE: '🗑️',
    MOVE: '📦',
    CREATE_DIR: '📁',
    VERIFY: '✅',
  }[operation];
  
  const status = logEntry.success ? '✅' : '❌';
  console.log(`[PATH] ${emoji} ${operation} ${status}: ${relativePath}`);
  
  if (details?.size !== undefined) {
    console.log(`      Size: ${details.size} bytes`);
  }
  
  if (details?.error) {
    console.error(`      Error: ${details.error}`);
  }
  
  // File log for debugging
  try {
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify(logEntry) + '\n',
      'utf-8'
    );
  } catch (e) {
    // Ignore log file errors (don't crash on logging)
    console.warn(`⚠️ Failed to write to log file: ${e}`);
  }
}

/**
 * Clear log file
 */
export function clearPathLog(): void {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
      console.log(`🧹 Cleared path log: ${LOG_FILE}`);
    }
  } catch (e) {
    console.warn(`⚠️ Failed to clear log file: ${e}`);
  }
}

/**
 * Get recent path operations
 */
export function getRecentPathOperations(limit: number = 50): any[] {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }
    
    const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(l => l.trim());
    const entries = lines
      .slice(-limit)
      .map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(e => e !== null);
    
    return entries;
  } catch (e) {
    console.warn(`⚠️ Failed to read log file: ${e}`);
    return [];
  }
}

