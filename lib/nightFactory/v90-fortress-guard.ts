// =============================================================================
// FROST NIGHT FACTORY v9.0 - FORTRESS GUARD
// =============================================================================
// Enforces immutable zones - repair loop CANNOT touch fortress files

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  FortressTier,
  FORTRESS_FILES,
  getFortressFile,
  getFileTier,
  isInFortress,
  canRepair,
  getFailAction,
  getFortressSummary,
} from './fortress-files';

/**
 * Fortress violation error
 */
export class FortressViolationError extends Error {
  constructor(
    public filePath: string,
    public tier: FortressTier,
    public attemptedAction: 'WRITE' | 'MODIFY' | 'DELETE',
    public reason: string
  ) {
    super(`FORTRESS VIOLATION: ${reason}`);
    this.name = 'FortressViolationError';
  }
}

/**
 * Fortress guard result
 */
export interface FortressGuardResult {
  allowed: boolean;
  tier: FortressTier;
  reason: string;
  action: 'ALLOW' | 'BLOCK' | 'REGENERATE';
  template?: string;
}

/**
 * Repair request
 */
export interface RepairRequest {
  filePath: string;
  content: string;
  attemptCount: number;
  errorType: string;
}

/**
 * Check if a repair request is allowed
 */
export function checkRepairAllowed(request: RepairRequest): FortressGuardResult {
  const fortress = getFortressFile(request.filePath);
  const tier = fortress?.tier ?? FortressTier.NORMAL;
  
  // TIER 0: GOLDEN - NEVER allow any modification
  if (tier === FortressTier.GOLDEN) {
    return {
      allowed: false,
      tier,
      reason: `GOLDEN file - repair loop CANNOT touch: ${request.filePath}`,
      action: 'BLOCK',
    };
  }
  
  // TIER 1: REGENERATE_ONLY - Can only regenerate from template
  if (tier === FortressTier.REGENERATE_ONLY) {
    if (fortress?.template) {
      return {
        allowed: true,
        tier,
        reason: `REGENERATE_ONLY - will regenerate from template`,
        action: 'REGENERATE',
        template: fortress.template,
      };
    }
    return {
      allowed: false,
      tier,
      reason: `REGENERATE_ONLY file without template - cannot repair: ${request.filePath}`,
      action: 'BLOCK',
    };
  }
  
  // TIER 2+: Check attempt count
  if (!canRepair(request.filePath, request.attemptCount)) {
    const maxAttempts = fortress?.maxAttempts ?? 3;
    return {
      allowed: false,
      tier,
      reason: `Max attempts (${maxAttempts}) exceeded for: ${request.filePath}`,
      action: 'BLOCK',
    };
  }
  
  return {
    allowed: true,
    tier,
    reason: `Repair allowed (attempt ${request.attemptCount + 1}/${fortress?.maxAttempts ?? 3})`,
    action: 'ALLOW',
  };
}

/**
 * Fortress-aware file write
 */
export async function fortressWrite(
  projectRoot: string,
  relativePath: string,
  content: string,
  attemptCount: number = 0
): Promise<{ success: boolean; result: FortressGuardResult }> {
  const request: RepairRequest = {
    filePath: relativePath,
    content,
    attemptCount,
    errorType: 'REPAIR',
  };
  
  const result = checkRepairAllowed(request);
  
  if (!result.allowed) {
    console.log(`🏰 FORTRESS BLOCKED: ${result.reason}`);
    return { success: false, result };
  }
  
  if (result.action === 'REGENERATE' && result.template) {
    // Use template instead of AI-generated content
    console.log(`🔄 REGENERATING from template: ${result.template}`);
    
    try {
      const templatePath = path.join(projectRoot, '..', result.template);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const fullPath = path.join(projectRoot, relativePath);
      
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, templateContent, 'utf-8');
      
      return { success: true, result };
    } catch (error) {
      console.error(`❌ Failed to regenerate from template:`, error);
      return { success: false, result };
    }
  }
  
  // Normal write
  try {
    const fullPath = path.join(projectRoot, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    
    console.log(`📝 FORTRESS ALLOWED: ${relativePath} (Tier ${result.tier})`);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Write failed:`, error);
    return { success: false, result };
  }
}

/**
 * Batch check for multiple files
 */
export function checkBatchRepairAllowed(
  files: Array<{ path: string; attemptCount: number }>
): Map<string, FortressGuardResult> {
  const results = new Map<string, FortressGuardResult>();
  
  for (const file of files) {
    const result = checkRepairAllowed({
      filePath: file.path,
      content: '',
      attemptCount: file.attemptCount,
      errorType: 'REPAIR',
    });
    results.set(file.path, result);
  }
  
  return results;
}

/**
 * Filter errors to only repairable files
 */
export function filterRepairableErrors(
  errors: Array<{ file: string; message: string }>,
  attemptCounts: Map<string, number>
): {
  repairable: Array<{ file: string; message: string }>;
  blocked: Array<{ file: string; message: string; reason: string }>;
} {
  const repairable: Array<{ file: string; message: string }> = [];
  const blocked: Array<{ file: string; message: string; reason: string }> = [];
  
  for (const error of errors) {
    const attemptCount = attemptCounts.get(error.file) || 0;
    const result = checkRepairAllowed({
      filePath: error.file,
      content: '',
      attemptCount,
      errorType: 'ERROR',
    });
    
    if (result.allowed) {
      repairable.push(error);
    } else {
      blocked.push({ ...error, reason: result.reason });
    }
  }
  
  return { repairable, blocked };
}

/**
 * Get recommended action for a fortress violation
 */
export function getViolationAction(filePath: string): {
  action: 'HALT' | 'ROLLBACK' | 'RESTART_CODER' | 'CONTINUE';
  description: string;
} {
  const action = getFailAction(filePath);
  
  const descriptions = {
    'HALT': 'Pipeline must stop. Human intervention required.',
    'ROLLBACK': 'Rollback to last good state and skip this file.',
    'RESTART_CODER': 'Restart coder phase with stricter constraints.',
    'CONTINUE': 'Log warning and continue with other files.',
  };
  
  return {
    action,
    description: descriptions[action],
  };
}

/**
 * Copy golden templates to project
 */
export async function copyGoldenTemplates(
  templateRoot: string,
  projectRoot: string
): Promise<{ copied: string[]; failed: string[] }> {
  const copied: string[] = [];
  const failed: string[] = [];
  
  const goldenFiles = FORTRESS_FILES.filter(
    f => f.tier === FortressTier.GOLDEN && f.template
  );
  
  for (const fortress of goldenFiles) {
    if (!fortress.template) continue;
    
    const sourcePath = path.join(templateRoot, fortress.template.replace('templates/', ''));
    const destPath = path.join(projectRoot, fortress.pattern);
    
    try {
      await fs.access(sourcePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
      copied.push(fortress.pattern);
      console.log(`✅ Copied golden: ${fortress.pattern}`);
    } catch {
      failed.push(fortress.pattern);
      console.log(`⚠️ Template not found: ${fortress.template}`);
    }
  }
  
  return { copied, failed };
}

/**
 * Validate fortress integrity
 */
export async function validateFortressIntegrity(
  projectRoot: string
): Promise<{
  valid: boolean;
  missing: string[];
  corrupted: string[];
}> {
  const missing: string[] = [];
  const corrupted: string[] = [];
  
  const criticalFiles = FORTRESS_FILES.filter(
    f => f.tier <= FortressTier.REGENERATE_ONLY
  );
  
  for (const fortress of criticalFiles) {
    // Skip glob patterns
    if (fortress.pattern.includes('*')) continue;
    
    const filePath = path.join(projectRoot, fortress.pattern);
    
    try {
      const stat = await fs.stat(filePath);
      
      if (!stat.isFile()) {
        corrupted.push(fortress.pattern);
      }
    } catch {
      // File might not exist yet - check if it's GOLDEN (required)
      if (fortress.tier === FortressTier.GOLDEN) {
        missing.push(fortress.pattern);
      }
    }
  }
  
  return {
    valid: missing.length === 0 && corrupted.length === 0,
    missing,
    corrupted,
  };
}

/**
 * Print fortress status
 */
export function printFortressStatus(): void {
  console.log(getFortressSummary());
}

/**
 * Export for external use
 */
export {
  FortressTier,
  FORTRESS_FILES,
  getFortressFile,
  getFileTier,
  isInFortress,
  canRepair,
  getFailAction,
};

