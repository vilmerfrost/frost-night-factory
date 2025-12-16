// =============================================================================
// AUTOMATIC BACKUP SYSTEM - Time machine for code
// =============================================================================
// Creates hourly backups of the codebase

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { toUtf8 } from '@/lib/utils/bytes';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), '.backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '20', 10);
const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_MS || '3600000', 10); // 1 hour default

interface BackupInfo {
  name: string;
  path: string;
  timestamp: Date;
  size: number;
}

/**
 * Create a backup
 */
async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `frost-backup-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  console.log(`\n📦 Creating backup: ${backupName}`);
  
  try {
    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });
    
    // Check if we're in a git repository
    const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
    
    if (isGitRepo) {
      try {
        // Git archive (only committed files)
        console.log('   📋 Archiving committed files...');
        execSync(
          `git archive --format=tar HEAD | tar -x -C "${backupPath}"`,
          { cwd: process.cwd(), stdio: 'pipe' }
        );
        
        // Also backup uncommitted changes
        console.log('   📝 Saving uncommitted changes...');
        try {
          const diff = execSync('git diff', { cwd: process.cwd(), encoding: 'utf-8' });
          const diffStr = toUtf8(diff);
          if (diffStr.trim()) {
            fs.writeFileSync(path.join(backupPath, 'uncommitted.patch'), diffStr, 'utf-8');
          }
        } catch {
          // No uncommitted changes or git error
        }
        
        // Save git status
        try {
          const status = execSync('git status --short', { cwd: process.cwd(), encoding: 'utf-8' });
          fs.writeFileSync(path.join(backupPath, 'git-status.txt'), status, 'utf-8');
        } catch {
          // Ignore
        }
      } catch (gitError: any) {
        console.warn(`   ⚠️  Git backup failed: ${gitError.message}`);
        console.log('   📁 Falling back to file copy...');
        
        // Fallback: Copy important files
        await copyImportantFiles(backupPath);
      }
    } else {
      // Not a git repo, copy files directly
      console.log('   📁 Copying files (not a git repository)...');
      await copyImportantFiles(backupPath);
    }
    
    // Create backup metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      backupName,
      gitCommit: isGitRepo ? toUtf8(execSync('git rev-parse HEAD', { encoding: 'utf-8', cwd: process.cwd() })).trim() : null,
      gitBranch: isGitRepo ? toUtf8(execSync('git branch --show-current', { encoding: 'utf-8', cwd: process.cwd() })).trim() : null,
    };
    
    fs.writeFileSync(
      path.join(backupPath, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );
    
    // Calculate backup size
    const size = calculateDirSize(backupPath);
    console.log(`   ✅ Backup created: ${backupPath}`);
    console.log(`   📊 Size: ${formatBytes(size)}`);
    
    return backupPath;
  } catch (error: any) {
    console.error(`   ❌ Backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Copy important files (fallback when git not available)
 */
async function copyImportantFiles(targetDir: string): Promise<void> {
  const importantDirs = [
    'agent-runner',
    'lib',
    'scripts',
    'supabase/migrations',
  ];
  
  const importantFiles = [
    'package.json',
    'tsconfig.json',
    '.eslintrc.cjs',
  ];
  
  for (const dir of importantDirs) {
    const sourcePath = path.join(process.cwd(), dir);
    const targetPath = path.join(targetDir, dir);
    
    if (fs.existsSync(sourcePath)) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      copyDir(sourcePath, targetPath);
    }
  }
  
  for (const file of importantFiles) {
    const sourcePath = path.join(process.cwd(), file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Copy directory recursively
 */
function copyDir(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    
    // Skip node_modules, dist, build, etc.
    if (['node_modules', 'dist', 'build', '.next', 'coverage', '.git'].includes(entry.name)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Calculate directory size
 */
function calculateDirSize(dirPath: string): number {
  let size = 0;
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += calculateDirSize(fullPath);
      } else {
        const stats = fs.statSync(fullPath);
        size += stats.size;
      }
    }
  } catch {
    // Ignore errors
  }
  
  return size;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Cleanup old backups
 */
function cleanupOldBackups(): void {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }
    
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('frost-backup-'))
      .map(name => {
        const backupPath = path.join(BACKUP_DIR, name);
        const stats = fs.statSync(backupPath);
        return {
          name,
          path: backupPath,
          timestamp: stats.mtime,
          size: calculateDirSize(backupPath),
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      let freedSpace = 0;
      
      for (const backup of toDelete) {
        freedSpace += backup.size;
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log(`   🗑️  Deleted old backup: ${backup.name} (${formatBytes(backup.size)})`);
      }
      
      console.log(`   💾 Freed space: ${formatBytes(freedSpace)}`);
    }
  } catch (error: any) {
    console.warn(`   ⚠️  Cleanup failed: ${error.message}`);
  }
}

/**
 * List available backups
 */
function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('frost-backup-'))
    .map(name => {
      const backupPath = path.join(BACKUP_DIR, name);
      const stats = fs.statSync(backupPath);
      return {
        name,
        path: backupPath,
        timestamp: stats.mtime,
        size: calculateDirSize(backupPath),
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🔄 Automatic Backup System');
  console.log('==========================\n');
  console.log(`Backup directory: ${BACKUP_DIR}`);
  console.log(`Max backups: ${MAX_BACKUPS}`);
  console.log(`Interval: ${BACKUP_INTERVAL_MS / 1000 / 60} minutes\n`);
  
  // Create backup directory
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  // Create initial backup
  await createBackup();
  cleanupOldBackups();
  
  // List existing backups
  const backups = listBackups();
  console.log(`\n📚 Existing backups: ${backups.length}`);
  if (backups.length > 0) {
    console.log('   Latest backups:');
    backups.slice(0, 5).forEach(backup => {
      console.log(`   - ${backup.name} (${formatBytes(backup.size)}, ${backup.timestamp.toISOString()})`);
    });
  }
  
  // Schedule periodic backups
  console.log(`\n⏰ Scheduling backups every ${BACKUP_INTERVAL_MS / 1000 / 60} minutes...`);
  
  setInterval(async () => {
    try {
      await createBackup();
      cleanupOldBackups();
    } catch (error: any) {
      console.error(`❌ Scheduled backup failed: ${error.message}`);
    }
  }, BACKUP_INTERVAL_MS);
  
  console.log('✅ Backup system running\n');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down backup system...');
    process.exit(0);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { createBackup, listBackups, cleanupOldBackups };

