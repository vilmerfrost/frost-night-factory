// agent-runner/model-router.ts
// ✅ Phase 3: Smart Model Routing - Route simple tasks to cheaper models

import path from "node:path";
import { MODELS, type ModelId } from "./lib/models";
import { getRecordOrDefault } from "@/lib/utils/maps";

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'groq'
  model: string
  inputCost: number   // per 1M tokens
  outputCost: number
  maxTokens: number
  speed: 'fast' | 'medium' | 'slow'
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'groq-fast': {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    inputCost: 0.05,
    outputCost: 0.08,
    maxTokens: 8000,
    speed: 'fast'
  },
  'deepseek-cheap': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    inputCost: 0.14,
    outputCost: 0.28,
    maxTokens: 64000,
    speed: 'fast'
  },
  'deepseek-smart': {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    inputCost: 0.55,
    outputCost: 2.19,
    maxTokens: 64000,
    speed: 'slow'
  },
  'claude-premium': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5', // May 2025 - Fast + Smart
    inputCost: 3.00,
    outputCost: 15.00,
    maxTokens: 200000,
    speed: 'medium'
  },
  'claude-haiku': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    inputCost: 0.80,
    outputCost: 4.00,
    maxTokens: 200000,
    speed: 'fast'
  }
}

/**
 * Select optimal model based on error type, complexity, and attempt number
 */
export function selectOptimalModel(
  errorType: string,
  complexity: 'easy' | 'medium' | 'hard',
  attemptNumber: number
): ModelConfig {
  
  // Easy tasks → Cheapest model
  if (complexity === 'easy') {
    // Syntax errors, unused imports
    if (errorType.includes('TS6133') ||
        errorType.includes('TS1005') ||
        errorType.includes('unused') ||
        errorType.includes('syntax') ||
        errorType.includes('TS2304')) {
      const deepseekCheap = MODEL_CONFIGS['deepseek-cheap'];
      if (!deepseekCheap) throw new Error('MODEL_CONFIGS.deepseek-cheap is missing');
      return getRecordOrDefault(MODEL_CONFIGS, 'groq-fast', deepseekCheap);  // 95% cheaper than Claude
    }
    
    // Simple fixes → DeepSeek cheap
    const deepseekCheap = MODEL_CONFIGS['deepseek-cheap'];
    if (!deepseekCheap) throw new Error('MODEL_CONFIGS.deepseek-cheap is missing');
    return getRecordOrDefault(MODEL_CONFIGS, 'deepseek-cheap', deepseekCheap);  // 95% cheaper than Claude
  }
  
  // Medium tasks → DeepSeek V3
  if (complexity === 'medium') {
    const deepseekCheap = MODEL_CONFIGS['deepseek-cheap'];
    if (!deepseekCheap) throw new Error('MODEL_CONFIGS.deepseek-cheap is missing');
    return getRecordOrDefault(MODEL_CONFIGS, 'deepseek-cheap', deepseekCheap);  // 95% cheaper than Claude
  }
  
  // Hard tasks or retries → Escalate
  if (complexity === 'hard' || attemptNumber > 3) {
    // Architecture, refactoring, or failed multiple times
    if (errorType.includes('architecture') ||
        errorType.includes('refactor') ||
        attemptNumber > 5) {
      const deepseekSmart = MODEL_CONFIGS['deepseek-smart'];
      if (!deepseekSmart) throw new Error('MODEL_CONFIGS.deepseek-smart is missing');
      return getRecordOrDefault(MODEL_CONFIGS, 'claude-premium', deepseekSmart);  // Best quality
    }
    
    const deepseekSmart = MODEL_CONFIGS['deepseek-smart'];
    if (!deepseekSmart) throw new Error('MODEL_CONFIGS.deepseek-smart is missing');
    return getRecordOrDefault(MODEL_CONFIGS, 'deepseek-smart', deepseekSmart);  // Good reasoning
  }
  
  // Default: DeepSeek cheap (safe choice)
  const deepseekCheap = MODEL_CONFIGS['deepseek-cheap'];
  if (!deepseekCheap) throw new Error('MODEL_CONFIGS.deepseek-cheap is missing');
  return getRecordOrDefault(MODEL_CONFIGS, 'deepseek-cheap', deepseekCheap);
}

/**
 * Estimate complexity based on error log and file count
 */
export function estimateComplexity(
  errorLog: string,
  fileCount: number
): 'easy' | 'medium' | 'hard' {
  
  const log = errorLog.toLowerCase()
  
  // Easy: Single-file, known patterns
  if (fileCount === 1 &&
      (log.includes('ts6133') ||  // Unused
       log.includes('ts1005') ||  // Syntax
       log.includes('ts2304') ||  // Not found
       log.includes('unused') ||
       log.includes('declared but never'))) {
    return 'easy'
  }
  
  // Hard: Multi-file, architecture
  if (fileCount > 3 ||
      log.includes('refactor') ||
      log.includes('redesign') ||
      log.includes('architecture') ||
      log.includes('type error') ||
      log.includes('cannot find module')) {
    return 'hard'
  }
  
  return 'medium'
}

/**
 * Get model name string for use in callAI
 */
export function getModelName(config: ModelConfig): string {
  return config.model
}

/**
 * Select model based on role (for use with callAI)
 */
export function selectModel(config: {
  role: string;
  step?: string;
  difficulty?: string;
  phase?: string;
}): { provider: string; model: string } {
  
  // PYTHON_FIXER: Use DeepSeek for Python error fixing
  if (config.role === 'PYTHON_FIXER') {
    return { provider: 'deepseek', model: 'deepseek-chat' };
  }
  
  // K2 for research synthesis - use stable preview (avoids timeouts)
  if (config.role === 'RESEARCHER' && config.step === 'synthesis') {
    return { provider: 'kimi', model: 'moonshot-v1-128k' }; // ✅ Stable preview instead of k2-thinking
  }
  
  // Planner
  if (config.role === 'PLANNER') {
    return { provider: 'deepseek', model: 'deepseek-reasoner' };
  }
  
  // Coder
  if (config.role === 'CODER') {
    return { provider: 'anthropic', model: 'claude-sonnet-4-5' }; // May 2025 - Fast + Smart
  }
  
  // Code review
  if (config.role === 'CODE_REVIEWER') {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  }
  
  // Prompt engineer - use correct model names (Dec 2024/Jan 2025)
  if (config.role === 'PROMPT_ENGINEER') {
    return { provider: 'google', model: 'gemini-2.0-flash-exp' }; // ✅ CORRECT: gemini-2.0-flash-exp (fastest)
  }
  
  // Fallback
  return { provider: 'groq', model: 'llama-3.3-70b-versatile' };
}

// ============================================================
// ✅ NEW: Task-based Model Routing (Claude = bulk frontend, Gemini = repair, DeepSeek = backend)
// ============================================================

export type TaskKind = "bulk_frontend" | "backend_heavy" | "repair";

export type RouteInput = {
  task: TaskKind;
  phase: string;          // "coder", "sql", "tester", ...
  filePath?: string;      // "src/app/..", "src/lib/.."
  reason?: string;        // optional debug string
};

function isFrontendFile(p: string): boolean {
  const posix = p.replaceAll("\\", "/");
  return (
    posix.startsWith("src/app/") ||
    posix.startsWith("src/components/") ||
    posix.endsWith(".tsx") ||
    posix.includes("/ui/")
  );
}

function isBackendishFile(p: string): boolean {
  const posix = p.replaceAll("\\", "/");
  return (
    posix.startsWith("src/app/api/") ||
    posix.includes("/server/") ||
    posix.includes("/db/") ||
    posix.includes("/supabase/")
  );
}

/**
 * Route model based on task kind and file path
 * Claude = bulk frontend, Gemini 2.5 Flash = debug/repair, DeepSeek = backend-heavy
 * 
 * CRITICAL: Always returns a valid ModelId, never undefined
 * 
 * ✅ C) Claude-only policy for coder phase (so you don't accidentally use Gemini)
 */
export function routeModel(input: RouteInput): ModelId {
  const file = input.filePath ? input.filePath.replaceAll("\\", "/") : "";
  const isCoderPhase = input.phase === "coder";
  
  // ✅ C) Hard rule: Claude-only during coder phase
  if (isCoderPhase) {
    // ✅ hard rule: no other model during coder
    return MODELS.CLAUDE_SONNET_45;
  }

  let model: ModelId | undefined;

  // 1) Repair/debug lane: cheapest + fast + good at patching
  if (input.task === "repair") {
    model = MODELS.GEMINI_25_FLASH;
  }
  // 2) Coder lane: decide by file type
  else if (input.task === "bulk_frontend") {
    model = MODELS.CLAUDE_SONNET_45;
  }
  else if (input.task === "backend_heavy") {
    model = MODELS.DEEPSEEK_CHAT;
  }
  // Fallback heuristics (if caller passes weird task)
  else if (file) {
    if (isFrontendFile(file)) {
      model = MODELS.CLAUDE_SONNET_45;
    } else if (isBackendishFile(file)) {
      model = MODELS.DEEPSEEK_CHAT;
    }
  }

  // Default: Gemini flash (safe/cheap)
  if (!model) {
    model = MODELS.GEMINI_25_FLASH;
  }

  // Hard guard: never undefined, never empty string
  if (!model || typeof model !== "string") {
    throw new Error(
      `[MODEL_ROUTER] Invalid model for purpose="${input.task}". ` +
      `Got: ${String(model)}. ` +
      `Available models: ${Object.values(MODELS).join(", ")}`
    );
  }

  return model;
}

/**
 * Infer task kind from file path
 */
export function inferTaskKindFromFile(filePath: string): TaskKind {
  const posix = filePath.replaceAll("\\", "/");
  if (isFrontendFile(posix)) return "bulk_frontend";
  if (isBackendishFile(posix)) return "backend_heavy";
  return "backend_heavy";
}

/**
 * Safe model picker - always returns a valid ModelId, never undefined
 * This is a convenience wrapper around routeModel with explicit purpose types
 */
export type RoutePurpose = "bulk_frontend" | "backend" | "repair" | "json_convert";

export function pickModel(purpose: RoutePurpose): ModelId {
  const taskKind: TaskKind =
    purpose === "repair" ? "repair" :
    purpose === "bulk_frontend" ? "bulk_frontend" :
    purpose === "backend" ? "backend_heavy" :
    "repair"; // Default to repair for json_convert (safe/cheap)

  const model = routeModel({
    task: taskKind,
    phase: "coder",
    reason: purpose,
  });

  // Hard guard: never undefined, never empty string
  if (!model || typeof model !== "string") {
    throw new Error(
      `[MODEL_ROUTER] Invalid model for purpose="${purpose}". Got: ${String(model)}`
    );
  }

  return model;
}

