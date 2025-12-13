/**
 * 📡 INFO TRANSPORTER (HARDENED)
 *
 * Goals:
 * - Never rely on `.single()` when duplicates can exist.
 * - Accept both `completed` and `skipped` as valid upstream "done".
 * - Never pass an invalid ResearchContext into planner conversion.
 * - Always return JS objects (callers JSON.stringify() once when needed).
 */

import { createClient } from "@supabase/supabase-js";
import { convertPlannerToJSON, convertCoderToJSON } from "../../lib/pipeline/json-converter";
import type {
  ResearchPhaseJSON,
  PlannerPhaseJSON,
  CoderPhaseJSON,
} from "../../lib/pipeline/pipeline-json-types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PipelineStepRow = {
  id: string;
  pipeline_id: string;
  name: string;
  status: string;
  output: any | null;
  logs: any | null;
  raw_output_text?: string | null;
  created_at: string;
};

// ✅ FIX C: Memoization cache for context during a single run
// Prevents duplicate conversions when the same phase is requested multiple times
const contextCache = new Map<string, Promise<any>>();

/**
 * Clear context cache (call at start of each pipeline loop)
 */
export function clearContextCache(): void {
  contextCache.clear();
}

/**
 * Get cache key for a phase transport
 */
function getCacheKey(pipelineId: string, fromPhase: string, toPhase: string): string {
  return `${pipelineId}:${fromPhase}->${toPhase}`;
}

function makeEmptyResearchContext(): ResearchPhaseJSON {
  return {
    phase: "research",
    timestamp: new Date().toISOString(),
    full_raw_output: "",
    sources: {
      perplexity: { query: "", results: [], summary: "" },
      kimi_k2: { query: "", results: [], summary: "" },
      gemini: { query: "", results: [], summary: "" },
    },
    extracted_requirements: { must_have: [], should_have: [], nice_to_have: [] },
    technology_recommendations: {
      frontend: { choice: "", reason: "", alternatives: [], confidence: 0 },
      backend: { choice: "", reason: "", alternatives: [], confidence: 0 },
      database: { choice: "", reason: "", alternatives: [], confidence: 0 },
      ui_library: { choice: "", reason: "", confidence: 0 },
      auth: { choice: "", reason: "", confidence: 0 },
    },
    potential_challenges: [],
    competitive_analysis: { similar_tools: [] },
    best_practices_found: [],
    estimated_scope: {
      total_features: 0,
      estimated_dev_hours: 0,
      estimated_timeline_weeks: 0,
      complexity_score: 0,
    },
  };
}

/**
 * Fetch latest "done" step safely (no .single footguns).
 * Includes both completed + skipped, because skipped is still a checkpoint.
 */
async function getLatestDoneStepFromDB(
  pipelineId: string,
  stepName: string
): Promise<PipelineStepRow | null> {
  const { data, error } = await supabase
    .from("pipeline_steps")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("name", stepName)
    .in("status", ["completed", "skipped"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.warn(`⚠️ [Info Transporter] DB fetch failed (${stepName}): ${error.message}`);
    return null;
  }
  return data?.[0] ?? null;
}

/**
 * Extract a usable raw payload from a step.
 * Priority:
 * 1) output (jsonb or string)
 * 2) raw_output_text (if you have this column)
 * 3) logs (string/json)
 */
export async function getPhaseOutputRaw(
  pipelineId: string,
  phaseName: string
): Promise<string | null> {
  try {
    const step = await getLatestDoneStepFromDB(pipelineId, phaseName);
    if (!step) return null;

    // 1) output
    if (step.output != null) {
      if (typeof step.output === "string") return step.output;
      // jsonb/object -> stringify once
      return JSON.stringify(step.output);
    }

    // 2) raw_output_text (optional schema)
    if (typeof step.raw_output_text === "string" && step.raw_output_text.length > 0) {
      return step.raw_output_text;
    }

    // 3) logs
    if (step.logs != null) {
      if (typeof step.logs === "string") return step.logs;
      return JSON.stringify(step.logs);
    }

    return null;
  } catch (e: any) {
    console.warn(`⚠️ [Info Transporter] getPhaseOutputRaw failed (${phaseName}): ${e.message}`);
    return null;
  }
}

/**
 * Convert upstream outputs into structured objects.
 * IMPORTANT: Always return objects (never JSON strings).
 * ✅ FIX C: Memoized to prevent duplicate conversions during a single run
 */
export async function transportPhaseContext(
  pipelineId: string,
  fromPhase: string,
  toPhase: string
): Promise<any | null> {
  // ✅ Check cache first
  const cacheKey = getCacheKey(pipelineId, fromPhase, toPhase);
  const cached = contextCache.get(cacheKey);
  if (cached) {
    console.log(`📡 [Info Transporter] Using cached context from ${fromPhase} for ${toPhase}`);
    return cached;
  }

  // Create promise and cache it immediately (prevents duplicate concurrent calls)
  const transportPromise = (async () => {
    console.log(`📡 [Info Transporter] Capturing context from ${fromPhase} for ${toPhase}...`);

    const rawOutput = await getPhaseOutputRaw(pipelineId, fromPhase);

  // Research must ALWAYS return a valid object shape.
  if (fromPhase === "research") {
    const base = makeEmptyResearchContext();
    base.timestamp = new Date().toISOString();
    base.full_raw_output = rawOutput ?? "";
    return base;
  }

  if (!rawOutput) {
    console.warn(`⚠️ [Info Transporter] No raw output found for ${fromPhase}. Relying on disk state.`);
    return null;
  }

  try {
    if (fromPhase === "k2_synthesis") {
      return {
        phase: "k2_synthesis",
        timestamp: new Date().toISOString(),
        synthesis: rawOutput,
        full_raw_output: rawOutput,
      };
    }

    if (fromPhase === "planner") {
      // Planner conversion needs a stable research context contract.
      const researchContext = (await transportPhaseContext(
        pipelineId,
        "research",
        "planner"
      )) as ResearchPhaseJSON;

      const plannerJson = await convertPlannerToJSON(rawOutput, researchContext);
      if (plannerJson?.success && plannerJson.data) {
        return plannerJson.data as PlannerPhaseJSON;
      }

      // Fallback: convert with empty research context if converter failed
      const fallbackJson = await convertPlannerToJSON(rawOutput, makeEmptyResearchContext());
      if (fallbackJson?.success && fallbackJson.data) {
        return fallbackJson.data as PlannerPhaseJSON;
      }

      return {
        phase: "planner",
        timestamp: new Date().toISOString(),
        full_raw_output: rawOutput,
      };
    }

    if (fromPhase === "coder") {
      // ✅ Coder conversion requires both research and planner context
      // Get research context (always stable)
      const researchContext = (await transportPhaseContext(
        pipelineId,
        "research",
        "coder"
      )) as ResearchPhaseJSON;
      
      // Get planner context (with fallback to empty)
      let planContext: PlannerPhaseJSON;
      try {
        const plannerTransport = await transportPhaseContext(pipelineId, "planner", "coder");
        if (plannerTransport && typeof plannerTransport === 'object' && 'phase' in plannerTransport && plannerTransport.phase === 'planner') {
          planContext = plannerTransport as PlannerPhaseJSON;
        } else {
          // Fallback: create minimal planner context
          const plannerRaw = await getPhaseOutputRaw(pipelineId, "planner");
          planContext = {
            phase: "planner",
            timestamp: new Date().toISOString(),
            full_raw_output: plannerRaw ?? "",
            input_references: {
              research_timestamp: "",
              research_summary: "",
            },
            project_overview: {
              name: "",
              description: "",
              objectives: [],
            },
            tech_stack: {
              frontend: {
                framework: "",
                language: "",
                ui_library: "",
                styling: "",
              },
              backend: {
                runtime: "",
                language: "",
              },
              database: {
                type: "",
                provider: "",
              },
            },
            feature_breakdown: {
              phase_1_mvp: [],
            },
            database_schema_outline: {
              tables: [],
            },
            component_tree: {
              app: {
                children: [],
              },
              components: {},
            },
            api_routes_planned: [],
            timeline: {
              total_weeks: 0,
              phases: [],
            },
            risks_and_mitigations: [],
            success_criteria: [],
          } as PlannerPhaseJSON;
        }
      } catch (error: any) {
        console.warn(`⚠️ Failed to get planner context: ${error.message}`);
        // Fallback: create minimal planner context
        planContext = {
          phase: "planner",
          timestamp: new Date().toISOString(),
          full_raw_output: "",
          input_references: {
            research_timestamp: "",
            research_summary: "",
          },
          project_overview: {
            name: "",
            description: "",
            objectives: [],
          },
          tech_stack: {
            frontend: {
              framework: "",
              language: "",
              ui_library: "",
              styling: "",
            },
            backend: {
              runtime: "",
              language: "",
            },
            database: {
              type: "",
              provider: "",
            },
          },
          feature_breakdown: {
            phase_1_mvp: [],
          },
          database_schema_outline: {
            tables: [],
          },
          component_tree: {
            app: {
              children: [],
            },
            components: {},
          },
          api_routes_planned: [],
          timeline: {
            total_weeks: 0,
            phases: [],
          },
          risks_and_mitigations: [],
          success_criteria: [],
        } as PlannerPhaseJSON;
      }

      // Attempt conversion with both contexts
      const coderJson = await convertCoderToJSON(rawOutput, researchContext, planContext);
      if (coderJson.success && coderJson.data) {
        return coderJson.data;
      } else {
        return {
          phase: "coder",
          raw_text: rawOutput.substring(0, 5000),
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Generic: try parse JSON
    try {
      const parsed = JSON.parse(rawOutput);
      return parsed;
    } catch {
      return {
        phase: fromPhase,
        timestamp: new Date().toISOString(),
        full_raw_output: rawOutput,
      };
    }
  } catch (e: any) {
    console.error(`❌ [Info Transporter] Failed to transport context from ${fromPhase}: ${e.message}`);
    return null;
  }
  })();

  // Cache the promise (not the result) to handle concurrent calls
  contextCache.set(cacheKey, transportPromise);
  
  try {
    const result = await transportPromise;
    // Update cache with resolved value for future synchronous access
    contextCache.set(cacheKey, Promise.resolve(result));
    return result;
  } catch (e: any) {
    // Remove from cache on error so it can be retried
    contextCache.delete(cacheKey);
    throw e;
  }
}

export async function accumulateAllContexts(
  pipelineId: string,
  currentPhase: string
): Promise<Record<string, any>> {
  const ctx: Record<string, any> = {};

  const phaseOrder = ["research", "k2_synthesis", "planner", "coder", "sql", "tester", "publisher"];
  const idx = phaseOrder.indexOf(currentPhase);
  if (idx === -1) return ctx;

  const previous = phaseOrder.slice(0, idx);
  console.log(`📡 [Info Transporter] Accumulating context from ${previous.length} previous phases...`);

  for (const phase of previous) {
    const c = await transportPhaseContext(pipelineId, phase, currentPhase);
    if (c) {
      ctx[phase] = c;
      console.log(`   ✅ ${phase}: Context captured`);
    }
  }

  // Include user prompt if exists
  try {
    const { data, error } = await supabase
      .from("pipelines")
      .select("initial_prompt")
      .eq("id", pipelineId)
      .limit(1);

    if (!error && data?.[0]?.initial_prompt) {
      ctx.user_prompt = data[0].initial_prompt;
    }
  } catch {}

  return ctx;
}

export function contextToPromptString(context: Record<string, any>, maxLength = 5000): string {
  const s = JSON.stringify(context, null, 2);
  return s.length > maxLength ? s.slice(0, maxLength) + "\n... (truncated)" : s;
}
