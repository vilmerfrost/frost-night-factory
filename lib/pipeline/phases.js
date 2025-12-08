// lib/pipeline/phases.ts
// Phase definitions and order for MVP Pipeline system
// 
// NEW: JSON-based pipeline types and orchestrator available:
// - import { runFullPipeline } from "./pipeline-orchestrator"
// - import type { ResearchPhaseJSON, PlannerPhaseJSON, ... } from "./pipeline-json-types"
// Re-export new JSON types and orchestrator
export * from "./pipeline-json-types";
export { runFullPipeline } from "./pipeline-orchestrator";
export { runResearchPhaseJSON } from "./research";
export { runPlannerPhaseJSON } from "./planner";
export { runCoderPhaseJSON } from "./coder";
export { runSqlPhaseJSON } from "./sql";
export { runTesterPhaseJSON, generateTraceabilityReport } from "./tester";
export { convertResearchToJSON, convertPlannerToJSON, convertCoderToJSON, convertSqlEditorToJSON, convertTesterToJSON, buildPipelineContext, getPipelineContextSummary } from "./json-converter";
export const PHASE_ORDER = [
    "research",
    "planner",
    "coder",
    "prompt_architect",
    "external_tool_wait",
    "reviewer",
    "sql",
    "tester",
];
