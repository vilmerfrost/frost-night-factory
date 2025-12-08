// =============================================================================
// FROST NIGHT FACTORY v9.0 - UNIFIED ENTRY POINT
// =============================================================================
// Emergency Architecture Reset - 3 Pillars Implementation

// ============================================================================
// PILLAR 1: FORTRESS PATTERN
// ============================================================================
export {
  FortressTier,
  FORTRESS_FILES,
  getFortressFile,
  getFileTier,
  isInFortress,
  canRepair,
  getFailAction as getFortressFailAction,
  getFilesByTier,
  getFortressSummary,
  matchesFortressPattern,
  type FortressFile,
} from './fortress-files';

export {
  FortressViolationError,
  checkRepairAllowed,
  fortressWrite,
  checkBatchRepairAllowed,
  filterRepairableErrors,
  getViolationAction,
  copyGoldenTemplates,
  validateFortressIntegrity,
  printFortressStatus,
  type FortressGuardResult,
  type RepairRequest,
} from './v90-fortress-guard';

// ============================================================================
// PILLAR 2: UNIDIRECTIONAL TYPE HIERARCHY
// ============================================================================
export {
  DOMAIN_ADAPTERS,
  LOCKED_ENUMS,
  generateTypesFile,
  generateMockDataFile,
  generateDomainFiles,
  validateMockDataTypes,
  type SupabaseTableType,
  type DomainTypeAdapter,
} from './domain-type-adapter';

// ============================================================================
// PILLAR 3: REPAIR LOOP GOVERNANCE
// ============================================================================
export {
  RepairAuthority,
  AUTHORITY_MATRIX,
  getAuthorityConfig,
  authorizeRepair,
  createRepairSession,
  recordAttempt,
  getFailAction as getAuthorityFailAction,
  getSessionSummary,
  isWithinBudget,
  getRecommendedModel,
  type AuthorityConfig,
  type RepairAttempt,
  type RepairSession,
  type RepairAuthorization,
} from './v90-repair-authority';

export {
  SnapshotManager,
  withTransaction,
  snapshotManager,
  type FileSnapshot,
  type ProjectSnapshot,
  type SnapshotComparison,
} from './v90-snapshot-manager';

export {
  ValidationTier,
  runZoneValidation,
  quickValidation,
  type ValidationCheck,
  type ZoneValidationResult,
} from './v90-zone-validator';

// ============================================================================
// VERSION INFO
// ============================================================================

export interface V90VersionInfo {
  version: string;
  pillars: string[];
  features: string[];
  expectedROI: {
    repairCostReduction: string;
    passRateIncrease: string;
    humanEscalationReduction: string;
  };
}

export function getV90Version(): V90VersionInfo {
  return {
    version: '9.0.0',
    pillars: [
      'PILLAR 1: Fortress Pattern - Immutable zones repair loop CANNOT touch',
      'PILLAR 2: Unidirectional Type Hierarchy - One-way flow prevents oscillation',
      'PILLAR 3: Repair Loop Governance - 5-Tier authority matrix with budgets',
    ],
    features: [
      'Fortress files (TIER 0-4 authority levels)',
      'Golden templates (tsconfig, next.config, tailwind, etc.)',
      'Domain type adapters (database.ts → types.ts → mock-data.ts)',
      'Repair authority matrix (per-file budgets and model restrictions)',
      'Transaction rollback (snapshot before repair, rollback if worse)',
      'Zone validation (graduated success tiers)',
      'Cost tracking and budget enforcement',
    ],
    expectedROI: {
      repairCostReduction: '90% ($2.00 → $0.20 per run)',
      passRateIncrease: '4.25x (20% → 85%)',
      humanEscalationReduction: '88% (80% → 10%)',
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { FortressTier, getFileTier, isInFortress } from './fortress-files';
import { checkRepairAllowed, validateFortressIntegrity } from './v90-fortress-guard';
import { createRepairSession, authorizeRepair, getSessionSummary } from './v90-repair-authority';
import { snapshotManager, withTransaction } from './v90-snapshot-manager';
import { runZoneValidation } from './v90-zone-validator';

/**
 * Quick check if a repair is allowed
 */
export function canRepairFile(filePath: string, attemptCount: number = 0): boolean {
  const result = checkRepairAllowed({
    filePath,
    content: '',
    attemptCount,
    errorType: 'CHECK',
  });
  return result.allowed;
}

/**
 * Get file security level
 */
export function getFileSecurityLevel(filePath: string): string {
  const tier = getFileTier(filePath);
  const labels = {
    [FortressTier.GOLDEN]: '🔒 GOLDEN (UNTOUCHABLE)',
    [FortressTier.REGENERATE_ONLY]: '🔄 REGENERATE ONLY',
    [FortressTier.RESTRICTED_FIX]: '⚠️ RESTRICTED FIX',
    [FortressTier.NORMAL]: '📝 NORMAL',
    [FortressTier.DISPOSABLE]: '♻️ DISPOSABLE',
  };
  return labels[tier];
}

/**
 * Run full v9.0 validation pipeline
 */
export async function runV90Validation(projectRoot: string): Promise<{
  fortressValid: boolean;
  zoneValid: boolean;
  summary: string;
}> {
  console.log('\n🏰 FROST NIGHT FACTORY v9.0 - VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Check fortress integrity
  const fortressResult = await validateFortressIntegrity(projectRoot);
  console.log(`Fortress Integrity: ${fortressResult.valid ? '✅ VALID' : '❌ INVALID'}`);
  
  if (!fortressResult.valid) {
    if (fortressResult.missing.length > 0) {
      console.log(`  Missing: ${fortressResult.missing.join(', ')}`);
    }
    if (fortressResult.corrupted.length > 0) {
      console.log(`  Corrupted: ${fortressResult.corrupted.join(', ')}`);
    }
  }
  
  // Run zone validation
  const zoneResult = await runZoneValidation(projectRoot);
  console.log(zoneResult.summary);
  
  return {
    fortressValid: fortressResult.valid,
    zoneValid: zoneResult.passed,
    summary: `Fortress: ${fortressResult.valid ? 'OK' : 'FAIL'} | Zone: ${zoneResult.passed ? 'OK' : 'FAIL'}`,
  };
}

/**
 * Create a protected repair session
 */
export async function createProtectedRepairSession(
  pipelineId: string,
  projectRoot: string,
  budget: number = 2.0
) {
  const session = createRepairSession(pipelineId, budget);
  
  // Create initial snapshot
  const getErrorCount = async () => {
    const result = await runZoneValidation(projectRoot);
    return result.tier1Checks.filter(c => !c.passed).length;
  };
  
  const initialErrors = await getErrorCount();
  await snapshotManager.createSnapshot(
    pipelineId,
    projectRoot,
    initialErrors,
    'Initial state before repairs'
  );
  
  return {
    session,
    snapshotManager,
    
    async attemptRepair<T>(
      filePath: string,
      model: string,
      operation: () => Promise<T>
    ): Promise<{ success: boolean; result?: T; reason?: string }> {
      // Check authorization
      const auth = authorizeRepair(filePath, session, model);
      
      if (!auth.allowed) {
        return { success: false, reason: auth.reason };
      }
      
      // Run with transaction
      const txResult = await withTransaction(
        snapshotManager,
        pipelineId,
        projectRoot,
        `Repair ${filePath} with ${model}`,
        getErrorCount,
        operation
      );
      
      return {
        success: !txResult.rolledBack,
        result: txResult.result ?? undefined,
        reason: txResult.error,
      };
    },
    
    getSummary() {
      return getSessionSummary(session);
    },
  };
}

console.log('✅ Frost Night Factory v9.0 loaded');

