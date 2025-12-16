// =============================================================================
// VERSION CONTROL / UNDO - Snapshot system for safety
// =============================================================================
// Creates snapshots before risky operations and allows rollback
// Prevents catastrophic failures from destroying the project

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Snapshot {
  id: string;
  timestamp: Date;
  description: string;
  path: string;
}

/**
 * Create a snapshot of the project before risky operations
 */
export function createSnapshot(
  projectPath: string,
  description: string = 'Auto-snapshot'
): string {
  const snapshotId = `snapshot-${Date.now()}`;
  const snapshotsDir = path.join(projectPath, '.nightfactory-snapshots');
  
  // Create snapshots directory
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
  
  const snapshotPath = path.join(snapshotsDir, snapshotId);
  
  console.log(`📸 Creating snapshot: ${snapshotId} (${description})`);
  
  // Copy entire src/ directory
  const srcPath = path.join(projectPath, 'src');
  const appPath = path.join(projectPath, 'app');
  const componentsPath = path.join(projectPath, 'components');
  const libPath = path.join(projectPath, 'lib');
  
  if (!fs.existsSync(snapshotPath)) {
    fs.mkdirSync(snapshotPath, { recursive: true });
  }
  
  // Copy directories
  const dirsToCopy = [
    { src: srcPath, name: 'src' },
    { src: appPath, name: 'app' },
    { src: componentsPath, name: 'components' },
    { src: libPath, name: 'lib' },
  ];
  
  for (const dir of dirsToCopy) {
    if (fs.existsSync(dir.src)) {
      const destPath = path.join(snapshotPath, dir.name);
      copyDirectory(dir.src, destPath);
    }
  }
  
  // Also copy package.json and tsconfig.json
  const configFiles = ['package.json', 'tsconfig.json', 'next.config.mjs', 'tailwind.config.ts'];
  for (const configFile of configFiles) {
    const srcFile = path.join(projectPath, configFile);
    if (fs.existsSync(srcFile)) {
      const destFile = path.join(snapshotPath, configFile);
      fs.copyFileSync(srcFile, destFile);
    }
  }
  
  // Save snapshot metadata
  const metadata = {
    id: snapshotId,
    timestamp: new Date().toISOString(),
    description,
    path: snapshotPath,
  };
  
  fs.writeFileSync(
    path.join(snapshotPath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`   ✅ Snapshot created: ${snapshotId}`);
  
  return snapshotId;
}

/**
 * Copy directory recursively
 */
function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // Skip node_modules, .next, etc.
    if (
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * List all snapshots
 */
export function listSnapshots(projectPath: string): Snapshot[] {
  const snapshotsDir = path.join(projectPath, '.nightfactory-snapshots');
  
  if (!fs.existsSync(snapshotsDir)) {
    return [];
  }
  
  const snapshots: Snapshot[] = [];
  const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const snapshotPath = path.join(snapshotsDir, entry.name);
    const metadataPath = path.join(snapshotPath, 'metadata.json');
    
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        snapshots.push({
          id: metadata.id,
          timestamp: new Date(metadata.timestamp),
          description: metadata.description,
          path: snapshotPath,
        });
      } catch (e) {
        // Skip invalid snapshots
      }
    }
  }
  
  return snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Restore project from snapshot
 */
export function restoreFromSnapshot(projectPath: string, snapshotId: string): boolean {
  const snapshotsDir = path.join(projectPath, '.nightfactory-snapshots');
  const snapshotPath = path.join(snapshotsDir, snapshotId);
  
  if (!fs.existsSync(snapshotPath)) {
    console.error(`❌ Snapshot ${snapshotId} not found`);
    return false;
  }
  
  console.log(`🔄 Restoring from snapshot: ${snapshotId}`);
  
  // Restore directories
  const dirsToRestore = ['src', 'app', 'components', 'lib'];
  
  for (const dirName of dirsToRestore) {
    const snapshotDir = path.join(snapshotPath, dirName);
    const projectDir = path.join(projectPath, dirName);
    
    if (fs.existsSync(snapshotDir)) {
      // Remove existing directory
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
      
      // Copy from snapshot
      copyDirectory(snapshotDir, projectDir);
      console.log(`   ✅ Restored ${dirName}/`);
    }
  }
  
  // Restore config files
  const configFiles = ['package.json', 'tsconfig.json', 'next.config.mjs', 'tailwind.config.ts'];
  for (const configFile of configFiles) {
    const snapshotFile = path.join(snapshotPath, configFile);
    const projectFile = path.join(projectPath, configFile);
    
    if (fs.existsSync(snapshotFile)) {
      fs.copyFileSync(snapshotFile, projectFile);
      console.log(`   ✅ Restored ${configFile}`);
    }
  }
  
  console.log(`   ✅ Project restored from snapshot`);
  return true;
}

/**
 * Get the latest snapshot
 */
export function getLatestSnapshot(projectPath: string): Snapshot | null {
  const snapshots = listSnapshots(projectPath);
  return snapshots.length > 0 ? (snapshots[0] ?? null) : null;
}

/**
 * Clean up old snapshots (keep only last N)
 */
export function cleanupSnapshots(projectPath: string, keepCount: number = 5): void {
  const snapshots = listSnapshots(projectPath);
  
  if (snapshots.length <= keepCount) {
    return;
  }
  
  const toDelete = snapshots.slice(keepCount);
  
  console.log(`🧹 Cleaning up ${toDelete.length} old snapshots...`);
  
  for (const snapshot of toDelete) {
    const snapshotPath = snapshot.path;
    if (fs.existsSync(snapshotPath)) {
      fs.rmSync(snapshotPath, { recursive: true, force: true });
      console.log(`   🗑️ Deleted snapshot: ${snapshot.id}`);
    }
  }
}

/**
 * Create snapshot before tester step (risky operation)
 */
export function snapshotBeforeTester(projectPath: string): string {
  return createSnapshot(projectPath, 'Before tester step');
}

/**
 * Create snapshot before fixer operations
 */
export function snapshotBeforeFixer(projectPath: string): string {
  return createSnapshot(projectPath, 'Before fixer operation');
}

