// lib/pipeline/json-converter.ts
// Pipeline JSON Converter: Transforms raw AI outputs to structured JSON
// Uses Claude 4.5 Haiku for fast, reliable JSON conversion

import { generateClaudeHaikuJSON } from "../../lib/nightFactory/modelClient";
import type {
  ResearchPhaseJSON,
  PlannerPhaseJSON,
  CoderPhaseJSON,
  SqlEditorPhaseJSON,
  TesterPhaseJSON,
  PipelineContext,
} from "./pipeline-json-types";

// ============================================================
// ✅ JSON REPAIR HELPERS (using jsonrepair library)
// ============================================================

/**
 * Extract JSON candidate from text (handles markdown fences, extra text)
 */
function extractJsonCandidate(s: string): string {
  const cleaned = s.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

/**
 * Safe JSON parse with automatic repair using jsonrepair
 * Note: jsonrepair is imported dynamically to avoid breaking if package is missing
 * This function is available for future use but not currently called
 */
async function safeParseJson<T>(s: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const candidate = extractJsonCandidate(s);
    
    // Try direct parse first
    try {
      return { ok: true, data: JSON.parse(candidate) as T };
    } catch {
      // If direct parse fails, try jsonrepair (if available)
      try {
        // Dynamic import with error handling for missing package
        // @ts-ignore - jsonrepair may not be installed, handled gracefully
        const jsonrepairModule = await import("jsonrepair").catch(() => null);
        if (jsonrepairModule?.jsonrepair) {
          const repaired = jsonrepairModule.jsonrepair(candidate);
          return { ok: true, data: JSON.parse(repaired) as T };
        }
        // jsonrepair not available, return error
        return { ok: false, error: "JSON parse failed and jsonrepair unavailable" };
      } catch {
        // jsonrepair failed, return error
        return { ok: false, error: "JSON parse failed and jsonrepair repair failed" };
      }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "unknown parse error" };
  }
}

// ============================================================
// JSON SCHEMAS FOR EACH PHASE (Used as templates for AI)
// ============================================================

const RESEARCH_SCHEMA = `{
  "phase": "research",
  "timestamp": "ISO8601 timestamp",
  "full_raw_output": "COMPLETE raw text from research phase - include EVERYTHING, not just summary",
  "sources": {
    "perplexity": { "query": "string", "results": [], "summary": "string" },
    "kimi_k2": { "query": "string", "results": [], "summary": "string" },
    "gemini": { "query": "string", "results": [], "summary": "string" }
  },
  "extracted_requirements": {
    "must_have": [{ "id": "req-X", "name": "string", "description": "string", "priority": "critical|high|medium|low", "technical_constraints": [], "source": [] }],
    "should_have": [],
    "nice_to_have": []
  },
  "technology_recommendations": {
    "frontend": { "choice": "string", "reason": "string", "alternatives": [], "confidence": 0.0-1.0 },
    "backend": { "choice": "string", "reason": "string", "alternatives": [], "confidence": 0.0-1.0 },
    "database": { "choice": "string", "reason": "string", "alternatives": [], "confidence": 0.0-1.0 },
    "ui_library": { "choice": "string", "reason": "string", "confidence": 0.0-1.0 },
    "auth": { "choice": "string", "reason": "string", "confidence": 0.0-1.0 }
  },
  "potential_challenges": [{ "challenge": "string", "solution": "string", "risk_level": "low|medium|high", "estimated_effort_hours": 0 }],
  "competitive_analysis": { "similar_tools": [{ "name": "string", "strengths": [], "weaknesses": [], "our_advantage": "string" }] },
  "best_practices_found": ["string"],
  "estimated_scope": {
    "total_features": 0,
    "estimated_dev_hours": 0,
    "estimated_timeline_weeks": 0,
    "complexity_score": 0.0-10.0
  }
}`;

const PLANNER_SCHEMA = `{
  "phase": "planner",
  "timestamp": "ISO8601 timestamp",
  "full_raw_output": "COMPLETE raw text from planner phase - include EVERYTHING, not just summary",
  "input_references": {
    "research_timestamp": "ISO8601 timestamp from research phase",
    "research_summary": "Brief summary of research findings"
  },
  "project_overview": {
    "name": "App Name",
    "description": "What we're building",
    "objectives": ["objective 1", "objective 2"]
  },
  "tech_stack": {
    "frontend": { "framework": "string", "language": "TypeScript", "ui_library": "string", "styling": "Tailwind CSS", "state_management": "string" },
    "backend": { "runtime": "string", "language": "TypeScript" },
    "database": { "type": "PostgreSQL", "provider": "Supabase", "auth": "Supabase Auth" },
    "external_services": [{ "service": "string", "options": [], "choice": "string" }]
  },
  "feature_breakdown": {
    "phase_1_mvp": [{ "feature_id": "feat-X", "name": "string", "description": "string", "components": [], "database_tables": [], "api_endpoints": [], "npm_packages": [], "estimated_hours": 0, "dependencies": [], "priority": 1, "technical_notes": "", "status": "planned" }],
    "phase_2_optional": []
  },
  "database_schema_outline": {
    "tables": [{ "name": "string", "columns": [{ "name": "string", "type": "string", "primary_key": false, "foreign_key": "", "required": false, "unique": false, "default": "", "enum_values": [] }] }]
  },
  "component_tree": {
    "app": { "children": ["layout.tsx", "page.tsx"] },
    "components": { "layout": [], "ui": [] },
    "lib": []
  },
  "api_routes_planned": [{ "path": "string", "method": "GET|POST|PATCH|DELETE", "description": "string", "body": {}, "query_params": {}, "response": {} }],
  "timeline": {
    "total_weeks": 0,
    "phases": [{ "week": 1, "features": [], "milestone": "string" }]
  },
  "risks_and_mitigations": [{ "risk": "string", "mitigation": "string", "contingency": "string" }],
  "success_criteria": ["criterion 1", "criterion 2"]
}`;

const CODER_SCHEMA = `{
  "phase": "coder",
  "timestamp": "ISO8601 timestamp",
  "input_references": {
    "research_timestamp": "ISO8601 timestamp",
    "plan_timestamp": "ISO8601 timestamp",
    "plan_summary": "Brief summary of plan"
  },
  "code_generated": {
    "frontend": {
      "files_count": 0,
      "total_lines": 0,
      "language": "TypeScript + React",
      "files": [{ "path": "string", "lines": 0, "purpose": "string", "exports": [], "depends_on": "", "imports_from_plan": [], "uses_types": [], "uses_api": [], "external_libs": [], "status": "complete|partial|needs_review", "notes": "" }]
    },
    "backend": {
      "files_count": 0,
      "total_lines": 0,
      "language": "TypeScript + Node.js",
      "files": []
    }
  },
  "type_definitions": {
    "coverage": 0,
    "strict_mode": true,
    "files_with_any": 0,
    "types_defined": [{ "name": "string", "fields": [], "matches_plan_schema": true }]
  },
  "dependencies_used": [{ "package": "string", "version": "string", "reason": "string" }],
  "code_quality_metrics": {
    "typescript_errors": 0,
    "typescript_warnings": 0,
    "eslint_errors": 0,
    "eslint_warnings": 0,
    "components_without_docstrings": 0,
    "functions_documented": 0,
    "test_coverage": 0,
    "linting_status": "passing|passing_with_warnings|failing"
  },
  "features_implemented": [{ "feature_id": "feat-X", "status": "complete|partial|blocked", "files_created": [], "plan_matches": true, "notes": "" }],
  "critical_notes_for_sql_editor": ["note 1", "note 2"]
}`;

const SQL_EDITOR_SCHEMA = `{
  "phase": "sql_editor",
  "timestamp": "ISO8601 timestamp",
  "full_raw_output": "COMPLETE raw text from sql_editor phase - include EVERYTHING, not just summary",
  "input_references": {
    "research_timestamp": "ISO8601 timestamp",
    "plan_timestamp": "ISO8601 timestamp",
    "coder_timestamp": "ISO8601 timestamp",
    "context_summary": "Brief summary of all context"
  },
  "database_schema_created": {
    "tables": [{ "name": "string", "sql": "CREATE TABLE ...", "columns_count": 0, "indexes": 0, "relationships": 0, "validation_rules": [], "foreign_keys": [] }]
  },
  "rls_policies": [{ "table": "string", "policy_name": "string", "definition": "string", "status": "enabled|disabled" }],
  "migrations_created": [{ "version": "001_XXX", "description": "string", "sql_file": "path/to/file.sql", "status": "ready_to_apply|applied|failed", "tested": true }],
  "queries_optimized": [{ "query_name": "string", "optimization": "string", "expected_improvement": "string" }],
  "type_schema_match": {
    "invoice_type_columns": [],
    "database_columns": [],
    "match_status": "perfect_match|partial_match|mismatch"
  },
  "seed_data": { "provided": true, "records_created": 0, "test_records": [] },
  "performance_expectations": {
    "read_operations": {},
    "write_operations": {}
  },
  "critical_notes_for_tester": ["note 1"]
}`;

const TESTER_SCHEMA = `{
  "phase": "tester",
  "timestamp": "ISO8601 timestamp",
  "full_raw_output": "COMPLETE raw text from tester phase - include EVERYTHING, not just summary",
  "input_references": {
    "research_timestamp": "ISO8601 timestamp",
    "plan_timestamp": "ISO8601 timestamp",
    "coder_timestamp": "ISO8601 timestamp",
    "sql_timestamp": "ISO8601 timestamp"
  },
  "context_received": {
    "research": "summary of research",
    "plan": "summary of plan",
    "code": "summary of code",
    "sql": "summary of sql"
  },
  "test_suite": [{ "test_id": "TEST-XXX", "name": "string", "depends_on_feature": "feat-X", "context_used": [], "test_steps": [], "test_data": {}, "expected_result": "string", "actual_result": "string", "performance_target": "string", "actual_time": "string", "status": "passed|failed|skipped|pending", "notes": "" }],
  "integration_tests": [{ "test_name": "string", "steps": [], "status": "passed|failed|skipped", "total_time_ms": 0 }],
  "security_checks": [{ "check": "string", "result": "passed|failed|warning", "evidence": "string" }],
  "quality_gates": [{ "gate": "string", "result": "passed|failed", "evidence": "", "errors": 0, "implemented": 0, "planned": 0, "metrics": "" }],
  "final_recommendation": "READY_FOR_DEPLOYMENT|NEEDS_FIXES|BLOCKED",
  "blockers": [],
  "warnings": [],
  "notes": "string"
}`;

// ============================================================
// CONVERTER FUNCTIONS
// ============================================================

/**
 * Convert raw research output to structured JSON
 */
export async function convertResearchToJSON(
  rawText: string,
  userPrompt: string
): Promise<{ success: boolean; data?: ResearchPhaseJSON; error?: string; raw_text_audit: string }> {
  // Pre-process: Add timestamp and user context
  const enhancedInput = `USER QUERY: ${userPrompt}\n\nRESEARCH OUTPUT (INCLUDE EVERYTHING - FULL RAW TEXT):\n${rawText}`;
  
  const result = await generateClaudeHaikuJSON<ResearchPhaseJSON>(
    enhancedInput,
    RESEARCH_SCHEMA,
    "research"
  );

  if (result.success && result.data) {
    // Ensure timestamp is set
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.phase = "research";
    // ✅ SAVE ENTIRE RAW TEXT
    result.data.full_raw_output = rawText;
    result.data.raw_text_audit = rawText.substring(0, 1000); // First 1000 chars for quick audit
  }

  return result;
}

/**
 * Convert raw planner output to structured JSON
 */
export async function convertPlannerToJSON(
  rawText: string,
  researchContext: ResearchPhaseJSON
): Promise<{ success: boolean; data?: PlannerPhaseJSON; error?: string; raw_text_audit: string }> {
  // ✅ SAFETY: Ensure sources object exists (defensive guard)
  const sources = researchContext.sources || {
    perplexity: { query: "", results: [], summary: "" },
    kimi_k2: { query: "", results: [], summary: "" },
    gemini: { query: "", results: [], summary: "" },
  };
  
  // Pre-process: Include research reference + FULL RAW TEXT
  const enhancedInput = `RESEARCH CONTEXT (from ${researchContext.timestamp}):
Summary: ${sources.perplexity?.summary || sources.gemini?.summary || "N/A"}
Tech Recommendations: ${JSON.stringify(researchContext.technology_recommendations || {})}
FULL RESEARCH RAW TEXT: ${researchContext.full_raw_output || researchContext.raw_text_audit || "N/A"}

PLANNER OUTPUT (INCLUDE EVERYTHING - FULL RAW TEXT):
${rawText}`;
  
  const result = await generateClaudeHaikuJSON<PlannerPhaseJSON>(
    enhancedInput,
    PLANNER_SCHEMA,
    "planner"
  );

  if (result.success && result.data) {
    // Ensure timestamps and references are set
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.phase = "planner";
    // ✅ SAVE ENTIRE RAW TEXT
    result.data.full_raw_output = rawText;
    result.data.raw_text_audit = rawText.substring(0, 1000); // First 1000 chars for quick audit
    result.data.input_references = {
      research_timestamp: researchContext.timestamp,
      research_summary: sources.perplexity?.summary || 
                        sources.gemini?.summary || 
                        "Research findings available"
    };
  }

  // ✅ FIX B: Planner wrapper fallback (so coder never blocks)
  // If both Haiku + Gemini failed, return stable planner-shape with FULL RAW TEXT
  if (!result.success) {
    console.warn("⚠️ [Planner Converter] Both Haiku + Gemini failed. Returning stable planner wrapper fallback with FULL RAW TEXT.");
    
    const fallbackPlanner: PlannerPhaseJSON = {
      phase: "planner",
      timestamp: new Date().toISOString(),
      full_raw_output: rawText, // ✅ FULL RAW TEXT - no truncation!
      input_references: {
        research_timestamp: researchContext.timestamp,
        research_summary: sources.perplexity?.summary || 
                          sources.gemini?.summary || 
                          "Research findings available"
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
      warnings: ["planner_json_failed", "using_raw_text_fallback"], // ✅ Mark as fallback + raw text mode
    };
    
    return {
      success: true,
      data: fallbackPlanner,
      raw_text_audit: rawText.substring(0, 1000),
    };
  }

  return result;
}

/**
 * Convert raw coder output to structured JSON
 */
export async function convertCoderToJSON(
  rawText: string,
  researchContext: ResearchPhaseJSON,
  planContext: PlannerPhaseJSON
): Promise<{ success: boolean; data?: CoderPhaseJSON; error?: string; raw_text_audit: string }> {
  // Pre-process: Include both contexts + FULL RAW TEXT
  const enhancedInput = `RESEARCH CONTEXT (from ${researchContext.timestamp}):
Tech Stack: ${JSON.stringify(researchContext.technology_recommendations)}
Best Practices: ${researchContext.best_practices_found.join(", ")}
FULL RESEARCH RAW TEXT: ${researchContext.full_raw_output || researchContext.raw_text_audit || "N/A"}

PLAN CONTEXT (from ${planContext.timestamp}):
Features: ${planContext.feature_breakdown.phase_1_mvp.map(f => f.name).join(", ")}
Components: ${JSON.stringify(planContext.component_tree)}
FULL PLAN RAW TEXT: ${planContext.full_raw_output || planContext.raw_text_audit || "N/A"}

CODER OUTPUT (INCLUDE EVERYTHING - FULL RAW TEXT):
${rawText}`;
  
  const result = await generateClaudeHaikuJSON<CoderPhaseJSON>(
    enhancedInput,
    CODER_SCHEMA,
    "coder"
  );

  if (result.success && result.data) {
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.phase = "coder";
    // ✅ SAVE ENTIRE RAW TEXT
    result.data.full_raw_output = rawText;
    result.data.raw_text_audit = rawText.substring(0, 1000); // First 1000 chars for quick audit
    result.data.input_references = {
      research_timestamp: researchContext.timestamp,
      plan_timestamp: planContext.timestamp,
      plan_summary: `${planContext.feature_breakdown.phase_1_mvp.length} features planned for ${planContext.project_overview.name}`
    };
  }

  return result;
}

/**
 * Convert raw SQL editor output to structured JSON
 */
export async function convertSqlEditorToJSON(
  rawText: string,
  researchContext: ResearchPhaseJSON,
  planContext: PlannerPhaseJSON,
  coderContext: CoderPhaseJSON
): Promise<{ success: boolean; data?: SqlEditorPhaseJSON; error?: string; raw_text_audit: string }> {
  // Pre-process: Full context + FULL RAW TEXT
  const enhancedInput = `RESEARCH CONTEXT (from ${researchContext.timestamp}):
Challenges: ${researchContext.potential_challenges.map(c => c.challenge).join(", ")}
FULL RESEARCH RAW TEXT: ${researchContext.full_raw_output || researchContext.raw_text_audit || "N/A"}

PLAN CONTEXT (from ${planContext.timestamp}):
Schema Outline: ${JSON.stringify(planContext.database_schema_outline)}
FULL PLAN RAW TEXT: ${planContext.full_raw_output || planContext.raw_text_audit || "N/A"}

CODER CONTEXT (from ${coderContext.timestamp}):
Types Defined: ${coderContext.type_definitions.types_defined.map(t => t.name).join(", ")}
Critical Notes: ${coderContext.critical_notes_for_sql_editor.join(", ")}
FULL CODER RAW TEXT: ${coderContext.full_raw_output || coderContext.raw_text_audit || "N/A"}

SQL EDITOR OUTPUT (INCLUDE EVERYTHING - FULL RAW TEXT):
${rawText}`;
  
  const result = await generateClaudeHaikuJSON<SqlEditorPhaseJSON>(
    enhancedInput,
    SQL_EDITOR_SCHEMA,
    "sql_editor"
  );

  if (result.success && result.data) {
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.phase = "sql_editor";
    // ✅ SAVE ENTIRE RAW TEXT
    result.data.full_raw_output = rawText;
    result.data.raw_text_audit = rawText.substring(0, 1000); // First 1000 chars for quick audit
    result.data.input_references = {
      research_timestamp: researchContext.timestamp,
      plan_timestamp: planContext.timestamp,
      coder_timestamp: coderContext.timestamp,
      context_summary: `Schema for ${planContext.project_overview.name} with ${coderContext.type_definitions.types_defined.length} types`
    };
  }

  return result;
}

/**
 * Convert raw tester output to structured JSON
 */
export async function convertTesterToJSON(
  rawText: string,
  context: PipelineContext
): Promise<{ success: boolean; data?: TesterPhaseJSON; error?: string; raw_text_audit: string }> {
  const { research, planner, coder, sql_editor } = context;
  
  if (!research || !planner || !coder || !sql_editor) {
    return {
      success: false,
      error: "Tester requires all previous phase contexts",
      raw_text_audit: rawText
    };
  }

  // Pre-process: Complete context + FULL RAW TEXT
  const enhancedInput = `FULL PIPELINE CONTEXT:

RESEARCH (${research.timestamp}):
- Requirements: ${research.extracted_requirements.must_have.length} must-have, ${research.extracted_requirements.should_have.length} should-have
- Challenges: ${research.potential_challenges.length} identified
- Scope: ${research.estimated_scope.total_features} features, ${research.estimated_scope.estimated_dev_hours}h estimated
FULL RESEARCH RAW TEXT: ${research.full_raw_output || research.raw_text_audit || "N/A"}

PLAN (${planner.timestamp}):
- Project: ${planner.project_overview.name}
- Features: ${planner.feature_breakdown.phase_1_mvp.map(f => f.name).join(", ")}
- Success Criteria: ${planner.success_criteria.join(", ")}
- Risks: ${planner.risks_and_mitigations.map(r => r.risk).join(", ")}
FULL PLAN RAW TEXT: ${planner.full_raw_output || planner.raw_text_audit || "N/A"}

CODE (${coder.timestamp}):
- Frontend: ${coder.code_generated.frontend.files_count} files (${coder.code_generated.frontend.total_lines} lines)
- Backend: ${coder.code_generated.backend.files_count} files (${coder.code_generated.backend.total_lines} lines)
- TypeScript Errors: ${coder.code_quality_metrics.typescript_errors}
- Features Implemented: ${coder.features_implemented.filter(f => f.status === "complete").length}/${coder.features_implemented.length}
FULL CODER RAW TEXT: ${coder.full_raw_output || coder.raw_text_audit || "N/A"}

SQL (${sql_editor.timestamp}):
- Tables: ${sql_editor.database_schema_created.tables.map(t => t.name).join(", ")}
- RLS Policies: ${sql_editor.rls_policies.length}
- Type Match: ${sql_editor.type_schema_match.match_status}
- Notes for Tester: ${sql_editor.critical_notes_for_tester.join(", ")}
FULL SQL RAW TEXT: ${sql_editor.full_raw_output || sql_editor.raw_text_audit || "N/A"}

TESTER OUTPUT (INCLUDE EVERYTHING - FULL RAW TEXT):
${rawText}`;
  
  const result = await generateClaudeHaikuJSON<TesterPhaseJSON>(
    enhancedInput,
    TESTER_SCHEMA,
    "tester"
  );

  if (result.success && result.data) {
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.phase = "tester";
    // ✅ SAVE ENTIRE RAW TEXT
    result.data.full_raw_output = rawText;
    result.data.raw_text_audit = rawText.substring(0, 1000); // First 1000 chars for quick audit
    result.data.input_references = {
      research_timestamp: research.timestamp,
      plan_timestamp: planner.timestamp,
      coder_timestamp: coder.timestamp,
      sql_timestamp: sql_editor.timestamp
    };
    result.data.context_received = {
      research: `${research.extracted_requirements.must_have.length} requirements, ${research.potential_challenges.length} challenges`,
      plan: `${planner.feature_breakdown.phase_1_mvp.length} features, ${planner.timeline.total_weeks} weeks`,
      code: `${coder.code_generated.frontend.files_count + coder.code_generated.backend.files_count} files, ${coder.code_quality_metrics.typescript_errors} TS errors`,
      sql: `${sql_editor.database_schema_created.tables.length} tables, ${sql_editor.rls_policies.length} RLS policies`
    };
  }

  return result;
}

// ============================================================
// VALIDATION & FAIL-FAST
// ============================================================

/**
 * Validate pipeline phase JSON (fail-fast)
 */
export function validatePipelineJSON<T extends { phase: string; timestamp: string }>(
  json: T,
  expectedPhase: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!json.phase) {
    errors.push("Missing 'phase' field");
  } else if (json.phase !== expectedPhase) {
    errors.push(`Phase mismatch: expected '${expectedPhase}', got '${json.phase}'`);
  }

  if (!json.timestamp) {
    errors.push("Missing 'timestamp' field");
  } else {
    // Validate ISO8601 format
    const date = new Date(json.timestamp);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid timestamp format: ${json.timestamp}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Build pipeline context from phase outputs
 */
export function buildPipelineContext(phases: {
  research?: ResearchPhaseJSON;
  planner?: PlannerPhaseJSON;
  coder?: CoderPhaseJSON;
  sql_editor?: SqlEditorPhaseJSON;
  tester?: TesterPhaseJSON;
}): PipelineContext {
  return {
    research: phases.research,
    planner: phases.planner,
    coder: phases.coder,
    sql_editor: phases.sql_editor,
    tester: phases.tester
  };
}

/**
 * Get summary of pipeline context for logging
 */
export function getPipelineContextSummary(context: PipelineContext): string {
  const parts: string[] = [];

  if (context.research) {
    parts.push(`Research: ${context.research.timestamp}`);
  }
  if (context.planner) {
    parts.push(`Plan: ${context.planner.project_overview.name}`);
  }
  if (context.coder) {
    parts.push(`Code: ${context.coder.code_generated.frontend.files_count + context.coder.code_generated.backend.files_count} files`);
  }
  if (context.sql_editor) {
    parts.push(`SQL: ${context.sql_editor.database_schema_created.tables.length} tables`);
  }
  if (context.tester) {
    parts.push(`Tester: ${context.tester.final_recommendation}`);
  }

  return parts.join(" → ");
}

