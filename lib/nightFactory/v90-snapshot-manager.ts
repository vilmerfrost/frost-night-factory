// =============================================================================
// FROST NIGHT FACTORY v9.0 - SNAPSHOT MANAGER
// =============================================================================
// Transaction rollback system - snapshot before repair, rollback if worse

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * File snapshot
 */
export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  timestamp: Date;
}

/**
 * Project snapshot
 */
export interface ProjectSnapshot {
  id: string;
  pipelineId: string;
  projectRoot: string;
  files: Map<string, FileSnapshot>;
  timestamp: Date;
  errorCount: number;
  description: string;
}

/**
 * Snapshot comparison result
 */
export interface SnapshotComparison {
  isBetter: boolean;
  isWorse: boolean;
  isSame: boolean;
  errorDelta: number;
  changedFiles: string[];
  addedFiles: string[];
  removedFiles: string[];
}

/**
 * Snapshot manager for rollback support
 */
export class SnapshotManager {
  private snapshots: Map<string, ProjectSnapshot> = new Map();
  private history: string[] = [];
  private maxSnapshots: number;
  
  constructor(maxSnapshots: number = 10) {
    this.maxSnapshots = maxSnapshots;
  }
  
  /**
   * Create a new snapshot
   */
  async createSnapshot(
    pipelineId: string,
    projectRoot: string,
    errorCount: number,
    description: string
  ): Promise<ProjectSnapshot> {
    const id = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const files = await this.captureFiles(projectRoot);
    
    const snapshot: ProjectSnapshot = {
      id,
      pipelineId,
      projectRoot,
      files,
      timestamp: new Date(),
      errorCount,
      description,
    };
    
    // Store snapshot
    this.snapshots.set(id, snapshot);
    this.history.push(id);
    
    // Prune old snapshots
    while (this.history.length > this.maxSnapshots) {
      const oldId = this.history.shift();
      if (oldId) this.snapshots.delete(oldId);
    }
    
    console.log(`📸 Snapshot created: ${id} (${files.size} files, ${errorCount} errors)`);
    return snapshot;
  }
  
  /**
   * Capture all source files
   */
  private async captureFiles(projectRoot: string): Promise<Map<string, FileSnapshot>> {
    const files = new Map<string, FileSnapshot>();
    const srcDir = path.join(projectRoot, 'src');
    
    async function walkDir(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectRoot, fullPath);
          
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.next') {
              await walkDir(fullPath);
            }
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const hash = crypto.createHash('md5').update(content).digest('hex');
              
              files.set(relativePath, {
                path: relativePath,
                content,
                hash,
                timestamp: new Date(),
              });
            } catch {
              // Skip unreadable files
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }
    
    await walkDir(srcDir);
    
    // Also capture root config files
    const configFiles = ['tsconfig.json', 'package.json', 'next.config.mjs', 'next.config.js'];
    for (const configFile of configFiles) {
      const fullPath = path.join(projectRoot, configFile);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        files.set(configFile, {
          path: configFile,
          content,
          hash,
          timestamp: new Date(),
        });
      } catch {
        // File doesn't exist
      }
    }
    
    return files;
  }
  
  /**
   * Rollback to a snapshot
   */
  async rollback(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    
    if (!snapshot) {
      console.error(`❌ Snapshot not found: ${snapshotId}`);
      return false;
    }
    
    console.log(`⏪ Rolling back to snapshot: ${snapshotId}`);
    
    let restored = 0;
    let failed = 0;
    
    for (const [relativePath, fileSnapshot] of snapshot.files.entries()) {
      const fullPath = path.join(snapshot.projectRoot, relativePath);
      
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileSnapshot.content, 'utf-8');
        restored++;
      } catch (error) {
        console.error(`Failed to restore ${relativePath}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ Rollback complete: ${restored} restored, ${failed} failed`);
    return failed === 0;
  }
  
  /**
   * Rollback to last snapshot
   */
  async rollbackToLast(): Promise<boolean> {
    if (this.history.length === 0) {
      console.error('❌ No snapshots available');
      return false;
    }
    
    const lastId = this.history[this.history.length - 1];
    return this.rollback(lastId);
  }
  
  /**
   * Compare current state to snapshot
   */
  async compare(
    snapshotId: string,
    currentErrorCount: number
  ): Promise<SnapshotComparison> {
    const snapshot = this.snapshots.get(snapshotId);
    
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    const currentFiles = await this.captureFiles(snapshot.projectRoot);
    
    const changedFiles: string[] = [];
    const addedFiles: string[] = [];
    const removedFiles: string[] = [];
    
    // Find changed and added files
    for (const [path, current] of currentFiles.entries()) {
      const original = snapshot.files.get(path);
      
      if (!original) {
        addedFiles.push(path);
      } else if (original.hash !== current.hash) {
        changedFiles.push(path);
      }
    }
    
    // Find removed files
    for (const path of snapshot.files.keys()) {
      if (!currentFiles.has(path)) {
        removedFiles.push(path);
      }
    }
    
    const errorDelta = currentErrorCount - snapshot.errorCount;
    
    return {
      isBetter: errorDelta < 0,
      isWorse: errorDelta > 0,
      isSame: errorDelta === 0,
      errorDelta,
      changedFiles,
      addedFiles,
      removedFiles,
    };
  }
  
  /**
   * Get snapshot by ID
   */
  getSnapshot(id: string): ProjectSnapshot | undefined {
    return this.snapshots.get(id);
  }
  
  /**
   * Get last snapshot
   */
  getLastSnapshot(): ProjectSnapshot | undefined {
    if (this.history.length === 0) return undefined;
    return this.snapshots.get(this.history[this.history.length - 1]);
  }
  
  /**
   * Get snapshot history
   */
  getHistory(): ProjectSnapshot[] {
    return this.history
      .map(id => this.snapshots.get(id))
      .filter((s): s is ProjectSnapshot => s !== undefined);
  }
  
  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
    this.history = [];
    console.log('🧹 All snapshots cleared');
  }
  
  /**
   * Get summary
   */
  getSummary(): string {
    const snapshots = this.getHistory();
    
    if (snapshots.length === 0) {
      return '📸 No snapshots';
    }
    
    const lines = [
      '📸 SNAPSHOT HISTORY',
      '═══════════════════════════════════════════════════════════════',
    ];
    
    for (const snapshot of snapshots) {
      const age = Math.round((Date.now() - snapshot.timestamp.getTime()) / 1000);
      lines.push(`  ${snapshot.id}`);
      lines.push(`    Files: ${snapshot.files.size} | Errors: ${snapshot.errorCount} | Age: ${age}s`);
      lines.push(`    ${snapshot.description}`);
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    
    return lines.join('\n');
  }
}

/**
 * Transaction wrapper for repair operations
 */
export async function withTransaction<T>(
  snapshotManager: SnapshotManager,
  pipelineId: string,
  projectRoot: string,
  description: string,
  getErrorCount: () => Promise<number>,
  operation: () => Promise<T>
): Promise<{ result: T | null; rolledBack: boolean; error?: string }> {
  // Get initial error count
  const initialErrors = await getErrorCount();
  
  // Create snapshot
  const snapshot = await snapshotManager.createSnapshot(
    pipelineId,
    projectRoot,
    initialErrors,
    description
  );
  
  try {
    // Execute operation
    const result = await operation();
    
    // Get new error count
    const newErrors = await getErrorCount();
    
    // Compare
    const comparison = await snapshotManager.compare(snapshot.id, newErrors);
    
    if (comparison.isWorse) {
      console.log(`⚠️ Operation made things worse (${comparison.errorDelta} more errors)`);
      console.log(`⏪ Rolling back...`);
      
      await snapshotManager.rollback(snapshot.id);
      
      return {
        result: null,
        rolledBack: true,
        error: `Operation increased errors by ${comparison.errorDelta}`,
      };
    }
    
    if (comparison.isSame && comparison.changedFiles.length > 0) {
      console.log(`⚠️ Operation changed files but didn't reduce errors`);
      // Don't rollback, but log warning
    }
    
    if (comparison.isBetter) {
      console.log(`✅ Operation improved errors by ${Math.abs(comparison.errorDelta)}`);
    }
    
    return { result, rolledBack: false };
    
  } catch (error: any) {
    console.error(`❌ Operation failed: ${error.message}`);
    console.log(`⏪ Rolling back...`);
    
    await snapshotManager.rollback(snapshot.id);
    
    return {
      result: null,
      rolledBack: true,
      error: error.message,
    };
  }
}

// Default instance
export const snapshotManager = new SnapshotManager();

