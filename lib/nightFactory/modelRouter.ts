/**
 * SMART MODEL ROUTER v10
 * Routes files to optimal model based on complexity
 * Target: 60-70% cost reduction
 */

export type ModelTier = 'premium' | 'standard' | 'economy';

export interface ModelConfig {
  name: string;
  tier: ModelTier;
  costPer1k: number;
  strengths: string[];
}

export interface RoutingDecision {
  model: string;
  tier: ModelTier;
  reason: string;
  estimatedCost: number;
  fallbackModel?: string;
}

// Model configurations
const MODELS: Record<string, ModelConfig> = {
  'claude-sonnet-4-5': {
    name: 'claude-sonnet-4-5',
    tier: 'premium',
    costPer1k: 3.00,
    strengths: ['UI/UX', 'Complex React', 'Type safety', 'Edge cases']
  },
  'deepseek-coder': {
    name: 'deepseek-coder',
    tier: 'economy',
    costPer1k: 0.14,
    strengths: ['Backend logic', 'APIs', 'Algorithms', 'Data processing']
  },
  'qwen/qwen-2.5-coder-32b-instruct': {
    name: 'qwen/qwen-2.5-coder-32b-instruct',
    tier: 'standard',
    costPer1k: 0.00, // FREE via Groq!
    strengths: ['Types', 'Config', 'Schemas', 'Utils', 'Simple components']
  }
};

/**
 * Select optimal model for a file
 */
export function selectModelForFile(
  filePath: string,
  fileType: string,
  options?: {
    complexity?: number;
    hasJSX?: boolean;
    linesOfCode?: number;
  }
): RoutingDecision {
  
  const complexity = options?.complexity || 50;
  const hasJSX = options?.hasJSX || false;
  const loc = options?.linesOfCode || 100;
  
  // === TIER 1: PREMIUM (Claude Sonnet 4.5) ===
  // Use for complex UI/UX where quality matters
  
  if (needsPremiumModel(filePath, fileType, complexity, hasJSX)) {
    return {
      model: 'claude-sonnet-4-5',
      tier: 'premium',
      reason: determinePremiumReason(filePath, fileType),
      estimatedCost: (loc / 1000) * 3.00,
      fallbackModel: 'deepseek-coder'
    };
  }
  
  // === TIER 2: ECONOMY (DeepSeek Coder) ===
  // Use for backend logic, APIs, data processing
  
  if (isBackendOrLogic(filePath, fileType)) {
    return {
      model: 'deepseek-coder',
      tier: 'economy',
      reason: 'Backend logic/API - DeepSeek excels here',
      estimatedCost: (loc / 1000) * 0.14,
      fallbackModel: 'claude-sonnet-4-5'
    };
  }
  
  // === TIER 3: STANDARD (Qwen via Groq - FREE!) ===
  // Use for simple files, types, configs
  
  return {
    model: 'qwen/qwen-2.5-coder-32b-instruct',
    tier: 'standard',
    reason: 'Simple file - using free Groq tier',
    estimatedCost: 0.00,
    fallbackModel: 'deepseek-coder'
  };
}

/**
 * Determine if file needs premium model
 */
function needsPremiumModel(
  path: string,
  type: string,
  complexity: number,
  hasJSX: boolean
): boolean {
  
  // Complex pages always use Claude
  if (type === 'page' && complexity > 60) {
    return true;
  }
  
  // Dashboard/interactive components
  if (path.includes('dashboard/') && hasJSX) {
    return true;
  }
  
  // Landing page components (marketing critical)
  if (path.includes('landing/') && hasJSX) {
    return true;
  }
  
  // Complex forms or data displays
  if (path.includes('form') || path.includes('table') || path.includes('chart')) {
    return true;
  }
  
  // App layout/structure
  if (path.includes('app/layout') || path.includes('app/page')) {
    return true;
  }
  
  return false;
}

/**
 * Determine premium reason for logging
 */
function determinePremiumReason(path: string, type: string): string {
  if (type === 'page') return 'Complex page - needs Claude quality';
  if (path.includes('dashboard/')) return 'Dashboard component - user-facing';
  if (path.includes('landing/')) return 'Landing page - marketing critical';
  if (path.includes('form')) return 'Form component - complex interactions';
  if (path.includes('layout')) return 'App structure - foundation';
  return 'Complex UI/UX - quality critical';
}

/**
 * Determine if file is backend/logic
 */
function isBackendOrLogic(path: string, type: string): boolean {
  
  // API routes
  if (path.includes('api/') || type === 'api_route') {
    return true;
  }
  
  // Server-side code
  if (path.includes('server') || path.includes('lib/')) {
    return true;
  }
  
  // Utility functions
  if (path.includes('utils/') || type === 'utility') {
    return true;
  }
  
  // Database/data layer
  if (path.includes('db/') || path.includes('database/') || path.includes('supabase/')) {
    return true;
  }
  
  // Business logic
  if (path.includes('services/') || path.includes('controllers/')) {
    return true;
  }
  
  // Pure .ts files (not .tsx)
  if (path.endsWith('.ts') && !path.endsWith('.tsx')) {
    return true;
  }
  
  return false;
}

/**
 * Get routing statistics
 */
export function getRoutingStats(decisions: RoutingDecision[]): {
  byTier: Record<ModelTier, number>;
  totalCost: number;
  averageCost: number;
} {
  const byTier: Record<ModelTier, number> = {
    premium: 0,
    standard: 0,
    economy: 0
  };
  
  let totalCost = 0;
  
  for (const decision of decisions) {
    byTier[decision.tier]++;
    totalCost += decision.estimatedCost;
  }
  
  return {
    byTier,
    totalCost,
    averageCost: decisions.length > 0 ? totalCost / decisions.length : 0
  };
}

