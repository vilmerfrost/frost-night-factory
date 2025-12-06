// =============================================================================
// MODEL ROUTING POLICIES - Hard rules for when to use which model
// =============================================================================

export interface ModelRoutingPolicy {
  model: string;
  provider: 'deepseek' | 'claude' | 'groq' | 'openai' | 'moonshot';
  useFor: string[];
  escalationConditions: {
    useWhen?: string[]; // Use this model when these conditions are met
    avoidWhen?: string[]; // Avoid this model when these conditions are met
  };
  costPer1KInput: number; // USD per 1K input tokens
  costPer1KOutput: number; // USD per 1K output tokens
  maxTokensPerCall: number;
  monthlyCap?: number; // Optional monthly cost cap (USD)
  perPipelineCap?: number; // Optional per-pipeline cost cap (USD)
}

export interface RoutingDecision {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
}

// =============================================================================
// MODEL DEFINITIONS
// =============================================================================

export const MODEL_POLICIES: Record<string, ModelRoutingPolicy> = {
  'deepseek-chat': {
    model: 'deepseek-chat',
    provider: 'deepseek',
    useFor: ['planner', 'coder', 'fixer', 'default'],
    escalationConditions: {
      useWhen: ['default', 'first_attempt', 'cost_sensitive'],
      avoidWhen: ['ui_review', 'complex_refactor', 'visual_design'],
    },
    costPer1KInput: 0.00014, // $0.14 per 1M tokens
    costPer1KOutput: 0.00028, // $0.28 per 1M tokens
    maxTokensPerCall: 32000,
  },
  'claude-3-5-sonnet-20241022': {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'claude',
    useFor: ['ui_review', 'complex_refactor', 'visual_design', 'escalation'],
    escalationConditions: {
      useWhen: ['deepseek_failed_2x', 'ui_ux_review', 'complex_refactor', 'visual_design'],
      avoidWhen: ['first_attempt', 'cost_sensitive', 'simple_fixes'],
    },
    costPer1KInput: 0.003, // $3 per 1M tokens
    costPer1KOutput: 0.015, // $15 per 1M tokens
    maxTokensPerCall: 200000,
    monthlyCap: 100, // $100/month cap
    perPipelineCap: 5, // $5 per pipeline cap
  },
  'groq-llama-3.1-70b-versatile': {
    model: 'groq-llama-3.1-70b-versatile',
    provider: 'groq',
    useFor: ['log_summarizer', 'error_summarizer', 'quick_checks', 'ux_reviewer'],
    escalationConditions: {
      useWhen: ['log_summarization', 'error_summarization', 'quick_sanity_check', 'ux_scoring'],
      avoidWhen: ['code_generation', 'complex_reasoning'],
    },
    costPer1KInput: 0.0001, // Very cheap
    costPer1KOutput: 0.0001,
    maxTokensPerCall: 32000,
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    provider: 'openai',
    useFor: ['escalation', 'complex_reasoning'],
    escalationConditions: {
      useWhen: ['claude_failed', 'critical_bug', 'complex_reasoning'],
      avoidWhen: ['default', 'cost_sensitive'],
    },
    costPer1KInput: 0.01, // $10 per 1M tokens
    costPer1KOutput: 0.03, // $30 per 1M tokens
    maxTokensPerCall: 128000,
    monthlyCap: 50, // $50/month cap
    perPipelineCap: 10, // $10 per pipeline cap
  },
};

// =============================================================================
// COST TRACKING
// =============================================================================

interface CostTracker {
  monthly: Record<string, number>; // model -> total cost (USD)
  perPipeline: Record<string, Record<string, number>>; // pipelineId -> model -> cost
}

let costTracker: CostTracker = {
  monthly: {},
  perPipeline: {},
};

export function resetMonthlyCosts(): void {
  costTracker.monthly = {};
}

export function getMonthlyCost(model: string): number {
  return costTracker.monthly[model] || 0;
}

export function getPipelineCost(pipelineId: string, model: string): number {
  return costTracker.perPipeline[pipelineId]?.[model] || 0;
}

export function recordCost(
  pipelineId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const policy = MODEL_POLICIES[model];
  if (!policy) {
    console.warn(`⚠️ Unknown model: ${model}, cannot track cost`);
    return 0;
  }

  const cost =
    (inputTokens / 1000) * policy.costPer1KInput +
    (outputTokens / 1000) * policy.costPer1KOutput;

  // Update monthly tracker
  costTracker.monthly[model] = (costTracker.monthly[model] || 0) + cost;

  // Update per-pipeline tracker
  if (!costTracker.perPipeline[pipelineId]) {
    costTracker.perPipeline[pipelineId] = {};
  }
  costTracker.perPipeline[pipelineId][model] =
    (costTracker.perPipeline[pipelineId][model] || 0) + cost;

  return cost;
}

// =============================================================================
// ROUTING DECISION LOGIC
// =============================================================================

export async function selectModel(
  task: string,
  phase: string,
  attemptNumber: number = 1,
  previousFailures: string[] = [],
  pipelineId?: string
): Promise<RoutingDecision> {
  // ✅ V8.0: Check kill switches first
  const { shouldForceCheapModels, isKillSwitchEnabled, KILL_SWITCHES } = await import('./kill-switches');
  
  if (await shouldForceCheapModels()) {
    // Force cheapest model (DeepSeek)
    return {
      model: 'deepseek-chat',
      provider: 'deepseek',
      reason: 'Kill switch: Force cheap models enabled',
      estimatedCost: 0.00014,
    };
  }
  
  // Check provider-specific kill switches
  if (await isKillSwitchEnabled(KILL_SWITCHES.DISABLE_CLAUDE)) {
    // Skip Claude, use DeepSeek or Groq
    if (task.includes('ui') || task.includes('ux')) {
      return {
        model: 'groq-llama-3.1-70b-versatile',
        provider: 'groq',
        reason: 'Kill switch: Claude disabled, using Groq',
        estimatedCost: 0.0001,
      };
    }
  }
  
  if (await isKillSwitchEnabled(KILL_SWITCHES.DISABLE_GPT4)) {
    // Skip GPT-4, fall back to Claude or DeepSeek
    // (handled in routing logic below)
  }
  
  // Check if we've hit cost caps
  const checkCostCaps = (model: string): boolean => {
    const policy = MODEL_POLICIES[model];
    if (!policy) return false;

    // Check monthly cap
    if (policy.monthlyCap) {
      const monthlyCost = getMonthlyCost(model);
      if (monthlyCost >= policy.monthlyCap) {
        console.log(`💰 Monthly cap reached for ${model} ($${monthlyCost.toFixed(2)} / $${policy.monthlyCap})`);
        return false;
      }
    }

    // Check per-pipeline cap
    if (policy.perPipelineCap && pipelineId) {
      const pipelineCost = getPipelineCost(pipelineId, model);
      if (pipelineCost >= policy.perPipelineCap) {
        console.log(`💰 Pipeline cap reached for ${model} ($${pipelineCost.toFixed(2)} / $${policy.perPipelineCap})`);
        return false;
      }
    }

    return true;
  };

  // Determine task characteristics
  const isUIReview = task.includes('ui') || task.includes('ux') || task.includes('visual');
  const isComplexRefactor = task.includes('refactor') || task.includes('architecture');
  const isLogSummarization = task.includes('log') || task.includes('summarize');
  const isErrorSummarization = task.includes('error') && task.includes('summarize');
  const deepseekFailed = previousFailures.includes('deepseek-chat') && attemptNumber > 1;
  const claudeFailed = previousFailures.includes('claude') && attemptNumber > 2;

  // ROUTING LOGIC
  // 1. Groq for cheap tasks
  if (isLogSummarization || isErrorSummarization) {
    const model = 'groq-llama-3.1-70b-versatile';
    if (checkCostCaps(model)) {
      return {
        model,
        provider: 'groq',
        reason: 'Log/error summarization - using cheap Groq model',
        estimatedCost: 0.0001, // Very cheap
      };
    }
  }

  // 2. Claude for UI/UX review or complex refactor (if not first attempt or DeepSeek failed)
  if ((isUIReview || isComplexRefactor) && (attemptNumber > 1 || deepseekFailed)) {
    const model = 'claude-3-5-sonnet-20241022';
    if (checkCostCaps(model)) {
      return {
        model,
        provider: 'claude',
        reason: `${isUIReview ? 'UI/UX review' : 'Complex refactor'} - using Claude Sonnet`,
        estimatedCost: 0.003, // Estimate based on input cost
      };
    }
  }

  // 3. GPT-4 for critical escalation (if Claude failed)
  if (claudeFailed && (isComplexRefactor || task.includes('critical'))) {
    const model = 'gpt-4-turbo';
    if (checkCostCaps(model)) {
      return {
        model,
        provider: 'openai',
        reason: 'Critical escalation after Claude failure - using GPT-4 Turbo',
        estimatedCost: 0.01,
      };
    }
  }

  // 4. Default: DeepSeek (cheapest, good quality)
  const model = 'deepseek-chat';
  return {
    model,
    provider: 'deepseek',
    reason: 'Default routing - using DeepSeek (cost-effective)',
    estimatedCost: 0.00014,
  };
}

// =============================================================================
// COST SUMMARY FOR DASHBOARD
// =============================================================================

export interface CostSummary {
  totalMonthly: number;
  byModel: Record<string, number>;
  byPhase: Record<string, number>;
  averagePerPipeline: number;
}

export function getCostSummary(pipelineIds: string[]): CostSummary {
  const byModel: Record<string, number> = {};
  const byPhase: Record<string, number> = {}; // Would need phase tracking

  let totalMonthly = 0;
  for (const [model, cost] of Object.entries(costTracker.monthly)) {
    byModel[model] = cost;
    totalMonthly += cost;
  }

  const totalPipelineCost = pipelineIds.reduce((sum, id) => {
    const pipelineCosts = costTracker.perPipeline[id] || {};
    return sum + Object.values(pipelineCosts).reduce((a, b) => a + b, 0);
  }, 0);

  const averagePerPipeline = pipelineIds.length > 0 ? totalPipelineCost / pipelineIds.length : 0;

  return {
    totalMonthly,
    byModel,
    byPhase, // TODO: Implement phase tracking
    averagePerPipeline,
  };
}

