// =============================================================================
// FROST NIGHT FACTORY v9.0 - REPAIR AUTHORITY MATRIX
// =============================================================================
// Pillar 3: 5-Tier Authority Matrix for repair loop governance

import { FortressTier, getFileTier, getFortressFile, canRepair } from './fortress-files';

/**
 * Authority level for repair operations
 */
export enum RepairAuthority {
  NONE = 'NONE',           // Cannot touch
  REGENERATE = 'REGENERATE', // Can only regenerate from template
  AI_FIX = 'AI_FIX',       // AI can attempt fix
  AI_FIX_REGEN = 'AI_FIX_REGEN', // AI fix then regenerate fallback
  UNLIMITED = 'UNLIMITED', // No restrictions
}

/**
 * Repair authority configuration
 */
export interface AuthorityConfig {
  tier: FortressTier;
  authority: RepairAuthority;
  maxAttempts: number;
  onFail: 'HALT' | 'ROLLBACK' | 'RESTART_CODER' | 'SKIP';
  budget: number; // Max cost in dollars
  models: string[]; // Allowed AI models
}

/**
 * 5-TIER AUTHORITY MATRIX
 */
export const AUTHORITY_MATRIX: AuthorityConfig[] = [
  {
    tier: FortressTier.GOLDEN,
    authority: RepairAuthority.NONE,
    maxAttempts: 0,
    onFail: 'HALT',
    budget: 0,
    models: [],
  },
  {
    tier: FortressTier.REGENERATE_ONLY,
    authority: RepairAuthority.REGENERATE,
    maxAttempts: 1,
    onFail: 'HALT',
    budget: 0,
    models: [],
  },
  {
    tier: FortressTier.RESTRICTED_FIX,
    authority: RepairAuthority.AI_FIX,
    maxAttempts: 2,
    onFail: 'ROLLBACK',
    budget: 0.10, // 10 cents max
    models: ['groq', 'deepseek_v3'],
  },
  {
    tier: FortressTier.NORMAL,
    authority: RepairAuthority.AI_FIX_REGEN,
    maxAttempts: 3,
    onFail: 'RESTART_CODER',
    budget: 0.50, // 50 cents max
    models: ['groq', 'deepseek_v3', 'deepseek_r1'],
  },
  {
    tier: FortressTier.DISPOSABLE,
    authority: RepairAuthority.UNLIMITED,
    maxAttempts: Infinity,
    onFail: 'SKIP',
    budget: Infinity,
    models: ['groq', 'deepseek_v3', 'deepseek_r1', 'claude'],
  },
];

/**
 * Get authority config for a file
 */
export function getAuthorityConfig(filePath: string): AuthorityConfig {
  const tier = getFileTier(filePath);
  const config = AUTHORITY_MATRIX.find(a => a.tier === tier);
  if (!config) {
    const defaultConfig = AUTHORITY_MATRIX[3];
    if (!defaultConfig) throw new Error("AUTHORITY_MATRIX is empty");
    return defaultConfig;
  }
  return config;
}

/**
 * Repair request with cost tracking
 */
export interface RepairAttempt {
  filePath: string;
  attemptNumber: number;
  model: string;
  cost: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Repair session tracking
 */
export interface RepairSession {
  pipelineId: string;
  startTime: Date;
  attempts: RepairAttempt[];
  totalCost: number;
  budget: number;
}

/**
 * Repair authorization result
 */
export interface RepairAuthorization {
  allowed: boolean;
  authority: RepairAuthority;
  reason: string;
  allowedModels: string[];
  remainingAttempts: number;
  remainingBudget: number;
}

/**
 * Check if repair is authorized
 */
export function authorizeRepair(
  filePath: string,
  session: RepairSession,
  requestedModel: string
): RepairAuthorization {
  const config = getAuthorityConfig(filePath);
  
  // Count previous attempts for this file
  const fileAttempts = session.attempts.filter(a => a.filePath === filePath);
  const attemptCount = fileAttempts.length;
  
  // Calculate spent budget for this file
  const fileSpent = fileAttempts.reduce((sum, a) => sum + a.cost, 0);
  const remainingBudget = config.budget - fileSpent;
  
  // Check authority level
  if (config.authority === RepairAuthority.NONE) {
    return {
      allowed: false,
      authority: config.authority,
      reason: 'FORTRESS TIER 0: No repair authority',
      allowedModels: [],
      remainingAttempts: 0,
      remainingBudget: 0,
    };
  }
  
  if (config.authority === RepairAuthority.REGENERATE) {
    return {
      allowed: true,
      authority: config.authority,
      reason: 'TIER 1: Can only regenerate from template',
      allowedModels: [],
      remainingAttempts: config.maxAttempts - attemptCount,
      remainingBudget: 0,
    };
  }
  
  // Check attempt count
  if (attemptCount >= config.maxAttempts) {
    return {
      allowed: false,
      authority: config.authority,
      reason: `Max attempts (${config.maxAttempts}) reached for ${filePath}`,
      allowedModels: config.models,
      remainingAttempts: 0,
      remainingBudget,
    };
  }
  
  // Check budget
  if (remainingBudget <= 0) {
    return {
      allowed: false,
      authority: config.authority,
      reason: `Budget exhausted for ${filePath} ($${config.budget})`,
      allowedModels: config.models,
      remainingAttempts: config.maxAttempts - attemptCount,
      remainingBudget: 0,
    };
  }
  
  // Check model
  if (!config.models.includes(requestedModel)) {
    return {
      allowed: false,
      authority: config.authority,
      reason: `Model ${requestedModel} not authorized for tier ${config.tier}`,
      allowedModels: config.models,
      remainingAttempts: config.maxAttempts - attemptCount,
      remainingBudget,
    };
  }
  
  return {
    allowed: true,
    authority: config.authority,
    reason: `Authorized (attempt ${attemptCount + 1}/${config.maxAttempts})`,
    allowedModels: config.models,
    remainingAttempts: config.maxAttempts - attemptCount,
    remainingBudget,
  };
}

/**
 * Create new repair session
 */
export function createRepairSession(pipelineId: string, budget: number = 2.0): RepairSession {
  return {
    pipelineId,
    startTime: new Date(),
    attempts: [],
    totalCost: 0,
    budget,
  };
}

/**
 * Record a repair attempt
 */
export function recordAttempt(
  session: RepairSession,
  attempt: Omit<RepairAttempt, 'timestamp'>
): RepairSession {
  const newAttempt: RepairAttempt = {
    ...attempt,
    timestamp: new Date(),
  };
  
  return {
    ...session,
    attempts: [...session.attempts, newAttempt],
    totalCost: session.totalCost + attempt.cost,
  };
}

/**
 * Get fail action for a file
 */
export function getFailAction(filePath: string): 'HALT' | 'ROLLBACK' | 'RESTART_CODER' | 'SKIP' {
  const config = getAuthorityConfig(filePath);
  return config.onFail;
}

/**
 * Get session summary
 */
export function getSessionSummary(session: RepairSession): string {
  const duration = (new Date().getTime() - session.startTime.getTime()) / 1000;
  const successCount = session.attempts.filter(a => a.success).length;
  const failCount = session.attempts.filter(a => !a.success).length;
  
  return `
📊 REPAIR SESSION SUMMARY
═══════════════════════════════════════════════════════════════
Pipeline: ${session.pipelineId}
Duration: ${duration.toFixed(1)}s
Total Attempts: ${session.attempts.length}
  ✅ Success: ${successCount}
  ❌ Failed: ${failCount}
Total Cost: $${session.totalCost.toFixed(4)}
Budget: $${session.budget.toFixed(2)} (${((session.totalCost / session.budget) * 100).toFixed(1)}% used)

By File:
${getAttemptsByFile(session)}
═══════════════════════════════════════════════════════════════
`;
}

/**
 * Get attempts grouped by file
 */
function getAttemptsByFile(session: RepairSession): string {
  const byFile = new Map<string, RepairAttempt[]>();
  
  for (const attempt of session.attempts) {
    if (!byFile.has(attempt.filePath)) {
      byFile.set(attempt.filePath, []);
    }
    byFile.get(attempt.filePath)!.push(attempt);
  }
  
  const lines: string[] = [];
  for (const [file, attempts] of byFile.entries()) {
    const successCount = attempts.filter(a => a.success).length;
    const cost = attempts.reduce((sum, a) => sum + a.cost, 0);
    const tier = getFileTier(file);
    
    lines.push(`  ${file}`);
    lines.push(`    Tier: ${tier} | Attempts: ${attempts.length} | Success: ${successCount} | Cost: $${cost.toFixed(4)}`);
  }
  
  return lines.join('\n');
}

/**
 * Check if session is within budget
 */
export function isWithinBudget(session: RepairSession): boolean {
  return session.totalCost < session.budget;
}

/**
 * Get recommended model for a file tier
 */
export function getRecommendedModel(filePath: string, attemptNumber: number): string {
  const config = getAuthorityConfig(filePath);
  
  if (config.models.length === 0) {
    return 'none';
  }
  
  // Escalate model with attempt number
  const modelIndex = Math.min(attemptNumber, config.models.length - 1);
  const model = config.models[modelIndex];
  if (!model) {
    const fallback = config.models[config.models.length - 1];
    if (!fallback) throw new Error(`No models available in config for ${config.tier}`);
    return fallback;
  }
  return model;
}

