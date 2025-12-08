// lib/pipeline/planner.ts
// Planner Phase with Full JSON Context
// Receives ResearchPhaseJSON, outputs PlannerPhaseJSON

import { generateContent, callAI } from "@/lib/nightFactory/modelClient";
import { convertPlannerToJSON } from "./json-converter";
import type { PlannerOutput, ResearchOutput } from "./phases";
import type { ResearchPhaseJSON, PlannerPhaseJSON } from "./pipeline-json-types";

/**
 * Legacy planner (for backward compatibility)
 */
export async function runPlannerPhase(
  idea: string,
  research: ResearchOutput
): Promise<PlannerOutput> {
  const prompt = `You are a senior system architect and technical lead.

Given this product idea and research findings, create a detailed technical specification.

IDEA: "${idea}"

RESEARCH FINDINGS:
${JSON.stringify(research, null, 2)}

Create a comprehensive technical spec with this exact JSON structure:
{
  "app_name": "App Name",
  "stack": {
    "frontend": "nextjs-16-app-router",
    "backend": "supabase",
    "db_style": "sql-migrations"
  },
  "entities": [
    {
      "name": "entity_name",
      "fields": [
        { "name": "id", "type": "uuid", "pk": true },
        { "name": "name", "type": "text", "required": true },
        { "name": "foreign_id", "type": "uuid", "fk": "other_entity.id" }
      ]
    }
  ],
  "pages": [
    {
      "route": "/",
      "type": "dashboard",
      "description": "Page description"
    },
    {
      "route": "/entity",
      "type": "list",
      "entity": "entity_name"
    }
  ],
  "api_endpoints": [
    { "method": "GET", "path": "/api/entity", "entity": "entity_name" },
    { "method": "POST", "path": "/api/entity", "entity": "entity_name" }
  ]
}

Requirements:
- Define all entities with proper fields, types, and relationships
- Include all CRUD pages for each entity
- Define API endpoints for each entity
- Use proper TypeScript types (uuid, text, timestamptz, etc.)
- Consider multi-tenant if needed (company_id, user_id)

Return ONLY valid JSON, no markdown.`;

  const response = await generateContent(prompt, "You are a Senior System Architect");

  // Extract JSON
  let jsonStr = response.trim();
  if (jsonStr.includes("```json")) {
    jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
  } else if (jsonStr.includes("```")) {
    jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
  }

  try {
    return JSON.parse(jsonStr) as PlannerOutput;
  } catch (e) {
    console.error("Failed to parse planner output:", e);
    throw new Error("Failed to generate valid planner spec");
  }
}

/**
 * NEW: Planner phase with full JSON context
 * Receives ResearchPhaseJSON, outputs PlannerPhaseJSON
 */
export async function runPlannerPhaseJSON(
  userPrompt: string,
  researchContext: ResearchPhaseJSON,
  options: {
    useDeepSeekR1?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data?: PlannerPhaseJSON;
  error?: string;
  raw_text_audit: string;
}> {
  const { useDeepSeekR1 = true } = options;

  console.log(`\n📋 [PLANNER PHASE] Creating technical specification...`);
  console.log(`   Research context from: ${researchContext.timestamp}`);

  // ============================================================
  // 1. BUILD RICH PROMPT WITH RESEARCH CONTEXT
  // ============================================================

  const researchSummary = `
RESEARCH SUMMARY (from ${researchContext.timestamp}):

REQUIREMENTS:
- Must-have: ${researchContext.extracted_requirements.must_have.map(r => r.name).join(", ")}
- Should-have: ${researchContext.extracted_requirements.should_have.map(r => r.name).join(", ")}
- Nice-to-have: ${researchContext.extracted_requirements.nice_to_have.map(r => r.name).join(", ")}

TECHNOLOGY RECOMMENDATIONS:
- Frontend: ${researchContext.technology_recommendations.frontend.choice} (${Math.round(researchContext.technology_recommendations.frontend.confidence * 100)}% confidence)
- Backend: ${researchContext.technology_recommendations.backend.choice} (${Math.round(researchContext.technology_recommendations.backend.confidence * 100)}% confidence)
- Database: ${researchContext.technology_recommendations.database.choice}
- UI Library: ${researchContext.technology_recommendations.ui_library?.choice || "shadcn/ui"}

CHALLENGES TO ADDRESS:
${researchContext.potential_challenges.map(c => `- ${c.challenge}: ${c.solution}`).join("\n")}

BEST PRACTICES:
${researchContext.best_practices_found.map(bp => `- ${bp}`).join("\n")}

SCOPE ESTIMATE:
- Features: ${researchContext.estimated_scope.total_features}
- Hours: ${researchContext.estimated_scope.estimated_dev_hours}
- Weeks: ${researchContext.estimated_scope.estimated_timeline_weeks}
- Complexity: ${researchContext.estimated_scope.complexity_score}/10
`;

  const plannerPrompt = `You are a Senior System Architect. Create a COMPREHENSIVE technical specification.

USER REQUEST: "${userPrompt}"

${researchSummary}

Create a detailed plan that includes:

1. PROJECT OVERVIEW
   - App name
   - Description
   - Key objectives (3-5)

2. TECH STACK (Use research recommendations)
   - Frontend: framework, language, UI library, styling
   - Backend: runtime, language
   - Database: type, provider, auth method
   - External services needed

3. FEATURE BREAKDOWN
   - Phase 1 MVP features (prioritized, with dependencies)
   - Each feature: ID, name, description, components, database tables, API endpoints, estimated hours
   - Phase 2 optional features

4. DATABASE SCHEMA
   - All tables with columns
   - Column types: uuid, text, timestamptz, boolean, enum, etc.
   - Primary keys, foreign keys, required fields
   - Indexes needed

5. COMPONENT TREE
   - App structure (pages)
   - Component hierarchy
   - Library utilities

6. API ROUTES
   - All endpoints with methods
   - Request/response shapes

7. TIMELINE
   - Week-by-week breakdown
   - Milestones

8. RISKS & MITIGATIONS
   - Address challenges from research
   - Contingency plans

9. SUCCESS CRITERIA
   - How do we know it's done?

Provide DETAILED output. This plan will drive the entire codebase generation.`;

  // ============================================================
  // 2. CALL AI (DeepSeek R1 for complex planning)
  // ============================================================

  let rawPlanText = "";

  try {
    if (useDeepSeekR1) {
      console.log("🧠 DeepSeek R1: Creating detailed architecture plan...");
      rawPlanText = await callAI(
        "PLANNER",
        plannerPrompt,
        "You are an expert software architect. Think step-by-step.",
        undefined,
        "GENIUS"
      );
    } else {
      console.log("⚡ Gemini: Creating architecture plan...");
      rawPlanText = await generateContent(
        plannerPrompt,
        "You are a Senior System Architect"
      );
    }
  } catch (e) {
    console.error("❌ Planner AI call failed:", e);
    return {
      success: false,
      error: `Planner AI failed: ${e}`,
      raw_text_audit: ""
    };
  }

  // ============================================================
  // 3. FAIL FAST: Check if we have plan data
  // ============================================================

  if (!rawPlanText.trim()) {
    return {
      success: false,
      error: "Planner returned empty response",
      raw_text_audit: ""
    };
  }

  console.log(`✅ Raw plan generated (${rawPlanText.length} chars)`);

  // ============================================================
  // 4. CONVERT TO STRUCTURED JSON (Claude 4.5 Haiku)
  // ============================================================

  console.log("🔧 Converting plan to structured JSON (Claude 4.5 Haiku)...");

  const result = await convertPlannerToJSON(rawPlanText, researchContext);

  if (!result.success) {
    console.error(`❌ JSON conversion failed: ${result.error}`);
    return result;
  }

  // ============================================================
  // 5. VALIDATE & RETURN
  // ============================================================

  if (!result.data) {
    return {
      success: false,
      error: "JSON conversion returned no data",
      raw_text_audit: rawPlanText
    };
  }

  // Ensure phase, timestamp, and references are set
  result.data.phase = "planner";
  result.data.timestamp = result.data.timestamp || new Date().toISOString();
  result.data.input_references = {
    research_timestamp: researchContext.timestamp,
    research_summary: `${researchContext.extracted_requirements.must_have.length} requirements, ${researchContext.potential_challenges.length} challenges identified`
  };

  console.log(`✅ [PLANNER PHASE] Complete!`);
  console.log(`   - Project: ${result.data.project_overview.name}`);
  console.log(`   - MVP Features: ${result.data.feature_breakdown.phase_1_mvp.length}`);
  console.log(`   - Tables: ${result.data.database_schema_outline.tables.length}`);
  console.log(`   - API Routes: ${result.data.api_routes_planned.length}`);
  console.log(`   - Timeline: ${result.data.timeline.total_weeks} weeks`);

  return {
    success: true,
    data: result.data,
    raw_text_audit: rawPlanText
  };
}

/**
 * Convert legacy PlannerOutput to PlannerPhaseJSON
 */
export function legacyToPlannerPhaseJSON(
  legacy: PlannerOutput,
  researchTimestamp: string
): PlannerPhaseJSON {
  return {
    phase: "planner",
    timestamp: new Date().toISOString(),
    input_references: {
      research_timestamp: researchTimestamp,
      research_summary: "Legacy conversion"
    },
    project_overview: {
      name: legacy.app_name,
      description: `${legacy.app_name} application`,
      objectives: [
        "Implement core functionality",
        "Deploy to production",
        "Ensure type safety"
      ]
    },
    tech_stack: {
      frontend: {
        framework: legacy.stack.frontend || "Next.js 16",
        language: "TypeScript",
        ui_library: "shadcn/ui",
        styling: "Tailwind CSS",
        state_management: "React Hooks"
      },
      backend: {
        runtime: "Node.js (Next.js API Routes)",
        language: "TypeScript"
      },
      database: {
        type: "PostgreSQL",
        provider: legacy.stack.backend || "Supabase",
        auth: "Supabase Auth"
      },
      external_services: []
    },
    feature_breakdown: {
      phase_1_mvp: legacy.entities.map((entity, i) => ({
        feature_id: `feat-${entity.name}`,
        name: `${entity.name} CRUD`,
        description: `Create, read, update, delete for ${entity.name}`,
        components: [`${entity.name}List.tsx`, `${entity.name}Form.tsx`],
        database_tables: [entity.name],
        api_endpoints: legacy.api_endpoints
          .filter(e => e.entity === entity.name)
          .map(e => `${e.method} ${e.path}`),
        npm_packages: [],
        estimated_hours: 8,
        dependencies: i > 0 ? [`feat-${legacy.entities[i - 1].name}`] : [],
        priority: i + 1,
        status: "planned"
      })),
      phase_2_optional: []
    },
    database_schema_outline: {
      tables: legacy.entities.map(entity => ({
        name: entity.name,
        columns: entity.fields.map(field => ({
          name: field.name,
          type: field.type,
          primary_key: field.pk || false,
          foreign_key: field.fk,
          required: field.required || false,
          enum_values: field.enum
        }))
      }))
    },
    component_tree: {
      app: {
        children: legacy.pages.map(p => `${p.route === "/" ? "" : p.route.slice(1)}/page.tsx`)
      },
      components: {
        layout: ["Header.tsx", "Sidebar.tsx"],
        ui: ["Button.tsx", "Card.tsx", "Input.tsx"]
      },
      lib: ["utils.ts", "types.ts", "supabase.ts"]
    },
    api_routes_planned: legacy.api_endpoints.map(ep => ({
      path: ep.path,
      method: ep.method,
      description: `${ep.method} ${ep.entity || "resource"}`
    })),
    timeline: {
      total_weeks: 2,
      phases: [
        { week: 1, features: legacy.entities.slice(0, 2).map(e => `feat-${e.name}`), milestone: "Core entities" },
        { week: 2, features: legacy.entities.slice(2).map(e => `feat-${e.name}`), milestone: "Complete MVP" }
      ]
    },
    risks_and_mitigations: [
      { risk: "Scope creep", mitigation: "Stick to MVP features", contingency: "Cut nice-to-have features" }
    ],
    success_criteria: [
      "All CRUD operations work",
      "Zero TypeScript errors",
      "Responsive on mobile"
    ]
  };
}
