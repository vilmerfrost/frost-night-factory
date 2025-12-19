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
import { convertPlannerToManifestStable } from "../lib/nightFactory/invariants/plannerManifest";
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
      // ✅ A: Use stable planner manifest converter (always returns typed object + raw)
      const plannerManifest = await convertPlannerToManifestStable(rawOutput ?? "");
      
      // 🔍 DEBUG: Verify planner manifest
      console.log('🔍 [DEBUG] Planner Manifest Generated:');
      console.log('   Files in manifest:', plannerManifest.files?.length || 0);
      console.log('   Has architecture:', !!plannerManifest.architecture);
      console.log('   Architecture frontend:', plannerManifest.architecture?.frontend?.length || 0);
      console.log('   Architecture backend:', plannerManifest.architecture?.backend?.length || 0);
      console.log('   Has api routes:', plannerManifest.apiRoutes?.length || 0);
      console.log('   Raw output length:', plannerManifest._raw?.length || 0);
      console.log('   Errors:', plannerManifest._errors?.length || 0);
      
      if (plannerManifest.files && plannerManifest.files.length > 0) {
        console.log('   First 5 files:', plannerManifest.files.slice(0, 5).map(f => f.path || f));
      } else {
        console.warn('   ⚠️ WARNING: No files found in planner manifest!');
        console.warn('   This will cause Coder to be confused!');
      }
      
      // 🔧 CRITICAL FIX: Convert PlannerManifest to FileStructurePlan format
      // Add required fields that Coder expects
      const filesWithTypes = plannerManifest.files.map(file => {
        // Infer type from file extension
        let type = 'unknown';
        const ext = file.path.split('.').pop()?.toLowerCase();
        
        if (ext === 'tsx' || ext === 'jsx') {
          type = 'component';
        } else if (ext === 'ts' || ext === 'js') {
          if (file.path.includes('/api/') || file.path.includes('route.ts')) {
            type = 'api_route';
          } else if (file.path.includes('/lib/') || file.path.includes('utils')) {
            type = 'utility';
          } else if (file.path.includes('layout') || file.path.includes('page')) {
            type = 'page';
          } else {
            type = 'module';
          }
        } else if (ext === 'css') {
          type = 'stylesheet';
        } else if (ext === 'json') {
          type = 'config';
        } else if (ext === 'sql') {
          type = 'migration';
        } else if (ext === 'md') {
          type = 'documentation';
        }
        
        return {
          path: file.path,
          description: file.description || `${type} file`,
          type: type,
          dependencies: file.dependencies || [],
        };
      });
      
      // Build FileStructurePlan-compatible structure
      const fileStructurePlan = {
        phase: "planner",
        timestamp: new Date().toISOString(),
        
        // FileStructurePlan required fields
        files: filesWithTypes,
        root: "src", // Default root directory
        dependencies: [], // Will be populated by dependency detective
        
        // Keep original PlannerPhaseJSON fields for compatibility
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
          frontend: { framework: "", language: "", ui_library: "", styling: "" },
          backend: { runtime: "", language: "" },
          database: { type: "", provider: "" },
        },
        feature_breakdown: { phase_1_mvp: [] },
        database_schema_outline: { tables: [] },
        component_tree: { app: { children: [] }, components: {} },
        api_routes_planned: (plannerManifest.apiRoutes || []).map(route => 
          typeof route === "string" ? { path: route, method: "GET", description: "" } : route
        ),
        timeline: { total_weeks: 0, phases: [] },
        risks_and_mitigations: [],
        success_criteria: [],
        full_raw_output: plannerManifest._raw || rawOutput || "",
        
        // Include original manifest for debugging
        _manifest: plannerManifest,
      };
      
      console.log('📡 [Info Transporter] Planner JSON converted successfully');
      console.log('   FileStructurePlan files:', fileStructurePlan.files.length);
      console.log('   File types:', [...new Set(fileStructurePlan.files.map(f => f.type))].join(', '));
      
      // 🔧 CRITICAL: Save to DB so re-hydration can find it!
      try {
        console.log('💾 [Info Transporter] Saving FileStructurePlan to DB for re-hydration...');
        
        // Get the latest planner step
        const { data: steps, error: fetchError } = await supabase
          .from('pipeline_steps')
          .select('id')
          .eq('pipeline_id', pipelineId)
          .eq('name', 'planner')
          .in('status', ['completed', 'skipped'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!fetchError && steps && steps.length > 0) {
          const { error: updateError } = await supabase
            .from('pipeline_steps')
            .update({
              output: fileStructurePlan,
              updated_at: new Date().toISOString()
            })
            .eq('id', steps[0].id);
          
          if (updateError) {
            console.warn('   ⚠️ Failed to save to DB:', updateError.message);
          } else {
            console.log('   ✅ FileStructurePlan saved to DB');
          }
        } else {
          console.warn('   ⚠️ Could not find planner step to update');
        }
      } catch (saveError: any) {
        console.warn('   ⚠️ Failed to save to DB:', saveError.message);
        // Continue anyway - Info Transporter will still work
      }
      
      return fileStructurePlan as PlannerPhaseJSON & { files: typeof filesWithTypes };
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
      
      // 🔍 DEBUG: Show what was captured
      if (phase === 'planner') {
        console.log('   🔍 Planner context keys:', Object.keys(c));
        console.log('   🔍 Has _manifest:', !!c._manifest);
        if (c._manifest) {
          console.log('   🔍 Manifest files:', c._manifest.files?.length || 0);
        }
      }
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
  // ✅ RAW TEXT FALLBACK: If planner JSON conversion failed, use raw text directly
  if (context.planner && (context.planner as any).raw_text_fallback) {
    const planner = context.planner as PlannerPhaseJSON & { raw_text_fallback?: boolean };
    const rawText = planner.full_raw_output || "";
    
    if (rawText) {
      console.log("📝 [Info Transporter] Using RAW TEXT fallback for planner (JSON conversion failed)");
      
      // Build a prompt-friendly version with raw text
      const fallbackSection = `
═══════════════════════════════════════════════════════════════════
⚠️ PLANNER OUTPUT (RAW TEXT - JSON conversion failed)
═══════════════════════════════════════════════════════════════════
The planner phase generated output, but JSON conversion failed.
Here is the FULL RAW TEXT output from the planner:

${rawText.substring(0, maxLength - 500)}
${rawText.length > maxLength - 500 ? "\n... (truncated for length)" : ""}

═══════════════════════════════════════════════════════════════════
Please extract the following from the raw text above:
- Project structure and file organization
- Technology stack decisions
- Feature breakdown
- API routes planned
- Database schema outline
- Component tree structure
═══════════════════════════════════════════════════════════════════
`;
      
      // Include other context (research, etc.) but prioritize raw text
      const otherContext: Record<string, any> = { ...context };
      delete otherContext.planner; // Remove planner from JSON (we're using raw text)
      
      const otherContextStr = Object.keys(otherContext).length > 0
        ? `\n\nOTHER CONTEXT:\n${JSON.stringify(otherContext, null, 2).substring(0, 2000)}`
        : "";
      
      return fallbackSection + otherContextStr;
    }
  }
  
  // Normal path: stringify context as JSON
  const s = JSON.stringify(context, null, 2);
  return s.length > maxLength ? s.slice(0, maxLength) + "\n... (truncated)" : s;
}
