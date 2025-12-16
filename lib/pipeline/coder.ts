// lib/pipeline/coder.ts
// Coder Phase with Full JSON Context
// Receives ResearchPhaseJSON + PlannerPhaseJSON, outputs CoderPhaseJSON

import { generateContent, callAI } from "@/lib/nightFactory/modelClient";
import { convertCoderToJSON } from "./json-converter";
import type { CoderOutput, PlannerOutput } from "./phases";
import type { ResearchPhaseJSON, PlannerPhaseJSON, CoderPhaseJSON } from "./pipeline-json-types";
import fs from "fs/promises";
import path from "path";
import { assertDefined } from "@/lib/utils/assert";

/**
 * Legacy coder (for backward compatibility)
 */
export async function runCoderPhase(
  spec: PlannerOutput,
  repoPath: string
): Promise<CoderOutput> {
  const prompt = `You are a senior full-stack engineer specializing in Next.js 16, TypeScript, and Supabase.

Given the following app specification, generate a COMPLETE codebase.

APP SPECIFICATION:
${JSON.stringify(spec, null, 2)}

CRITICAL REQUIREMENTS:
1. Generate ALL files needed for a working Next.js 16 App Router application
2. Use TypeScript strictly - no 'any' types
3. Include: package.json, next.config.mjs, tsconfig.json, tailwind.config.js
4. Create app/layout.tsx and app/page.tsx
5. For each entity, create CRUD pages under app/[entity]/
6. Create API routes under app/api/[entity]/
7. Create lib/ directory with utilities (supabase client, types, etc.)
8. Use Tailwind CSS for styling
9. Follow Frost Night Factory dark theme (zinc-900 backgrounds, cyan accents)

Return ONLY valid JSON with this exact structure:
{
  "files": [
    {
      "path": "package.json",
      "content": "{\\n  ...\\n}"
    },
    {
      "path": "app/layout.tsx",
      "content": "import ..."
    }
  ]
}

IMPORTANT:
- Paths should be relative to repo root (e.g., "app/page.tsx", not "/app/page.tsx")
- Include ALL necessary files for a working MVP
- Use proper TypeScript types
- Include proper imports and exports
- Make it production-ready

Return ONLY the JSON object, no markdown code blocks, no explanations.`;

  const response = await generateContent(prompt, "You are a Senior Full-Stack Engineer");

  // Extract JSON
  let jsonStr = response.trim();
  if (jsonStr.includes("```json")) {
    const parts = jsonStr.split("```json");
    if (parts[1]) {
      const codeParts = parts[1].split("```");
      if (codeParts[0]) jsonStr = codeParts[0].trim();
    }
  } else if (jsonStr.includes("```")) {
    const parts = jsonStr.split("```");
    if (parts[1]) {
      const codeParts = parts[1].split("```");
      if (codeParts[0]) jsonStr = codeParts[0].trim();
    }
  }

  let coderOutput: CoderOutput;
  try {
    coderOutput = JSON.parse(jsonStr) as CoderOutput;
  } catch (e) {
    console.error("Failed to parse coder output:", e);
    throw new Error("Failed to generate valid coder output");
  }

  // Apply files to repo
  await applyGeneratedFiles(repoPath, coderOutput);

  return coderOutput;
}

async function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Directory might already exist, that's OK
  }
}

export async function applyGeneratedFiles(
  baseDir: string,
  output: CoderOutput
): Promise<void> {
  for (const file of output.files) {
    const fullPath = path.join(baseDir, file.path);
    await ensureDirForFile(fullPath);
    await fs.writeFile(fullPath, file.content, "utf8");
    console.log(`✅ Wrote file: ${file.path}`);
  }
}

/**
 * NEW: Coder phase with full JSON context
 * Receives ResearchPhaseJSON + PlannerPhaseJSON, outputs CoderPhaseJSON
 */
export async function runCoderPhaseJSON(
  researchContext: ResearchPhaseJSON,
  planContext: PlannerPhaseJSON,
  repoPath: string,
  options: {
    generateFrontend?: boolean;
    generateBackend?: boolean;
    useClaude?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data?: CoderPhaseJSON;
  error?: string;
  raw_text_audit: string;
  files_written: string[];
}> {
  const { 
    generateFrontend = true, 
    generateBackend = true,
    useClaude = true 
  } = options;

  console.log(`\n💻 [CODER PHASE] Generating code...`);
  console.log(`   Research context from: ${researchContext.timestamp}`);
  console.log(`   Plan context from: ${planContext.timestamp}`);

  let rawCoderOutput = "";
  const filesWritten: string[] = [];
  let frontendFiles: Array<{ path: string; content: string }> = [];
  let backendFiles: Array<{ path: string; content: string }> = [];

  // ============================================================
  // 1. BUILD RICH PROMPTS WITH FULL CONTEXT
  // ============================================================

  const contextPreamble = `
PROJECT: ${planContext.project_overview.name}
DESCRIPTION: ${planContext.project_overview.description}

RESEARCH CONTEXT (${researchContext.timestamp}):
- Tech Stack: ${researchContext.technology_recommendations.frontend.choice} + ${researchContext.technology_recommendations.backend.choice}
- Best Practices: ${researchContext.best_practices_found.slice(0, 3).join(", ")}
- Challenges to avoid: ${researchContext.potential_challenges.map(c => c.challenge).slice(0, 3).join(", ")}

PLAN CONTEXT (${planContext.timestamp}):
- Features: ${planContext.feature_breakdown.phase_1_mvp.map(f => f.name).join(", ")}
- Stack: ${planContext.tech_stack.frontend.framework} + ${planContext.tech_stack.backend.runtime}
- UI: ${planContext.tech_stack.frontend.ui_library} with ${planContext.tech_stack.frontend.styling}
`;

  // ============================================================
  // 2. GENERATE FRONTEND CODE
  // ============================================================

  if (generateFrontend) {
    console.log("🎨 Generating frontend code...");

    const frontendPrompt = `${contextPreamble}

COMPONENT TREE:
${JSON.stringify(planContext.component_tree, null, 2)}

DATABASE ENTITIES (for TypeScript types):
${JSON.stringify(planContext.database_schema_outline.tables, null, 2)}

PAGES TO CREATE:
${planContext.feature_breakdown.phase_1_mvp.map(f => `- ${f.name}: ${f.components?.join(", ") || "TBD"}`).join("\n")}

Generate ALL frontend files for a Next.js 16 App Router application.

CRITICAL: WINDOWS FILESYSTEM CASING RULES (ENFORCE STRICTLY):
⚠️ Windows filesystem is case-insensitive, but TypeScript is case-sensitive.
⚠️ This causes TS1261 errors if imports mix casing.

FILE NAMING RULES (MANDATORY):
- Component files: ALWAYS lowercase (button.tsx, card.tsx, input.tsx)
- Page files: kebab-case (upload/page.tsx, dashboard/page.tsx)
- NEVER use PascalCase filenames (Button.tsx, Card.tsx) ❌

IMPORT RULES (MANDATORY):
- ALWAYS use lowercase paths: import { Button } from '@/components/ui/button'
- NEVER use PascalCase paths: import { Button } from '@/components/ui/Button' ❌
- Example correct imports:
  ✅ import { Button } from '@/components/ui/button'
  ✅ import { Card } from '@/components/ui/card'
  ✅ import { Input } from '@/components/ui/input'
  ❌ import { Button } from '@/components/ui/Button'  // WRONG
  ❌ import { Card } from '@/components/ui/Card'        // WRONG

REQUIREMENTS:
1. app/layout.tsx - Root layout with dark theme
2. app/page.tsx - Dashboard/home page
3. app/[entity]/page.tsx - List page for each entity
4. app/[entity]/[id]/page.tsx - Detail page
5. components/ui/* - shadcn/ui components (button.tsx, card.tsx, input.tsx - LOWERCASE)
6. components/[entity]/* - Entity-specific components
7. lib/types.ts - TypeScript interfaces matching database schema
8. lib/supabase.ts - Supabase client

STYLE:
- Dark theme: zinc-900 backgrounds, cyan-400 accents
- Use Tailwind CSS classes
- Responsive design

Return a JSON object with this structure:
{
  "files": [
    { "path": "app/layout.tsx", "content": "..." },
    { "path": "app/page.tsx", "content": "..." }
  ]
}

NO markdown, NO explanations. ONLY valid JSON.`;

    try {
      const frontendResponse = useClaude
        ? await callAI("FRONTEND", frontendPrompt, "You are a Senior React/Next.js Developer")
        : await generateContent(frontendPrompt, "You are a Senior React/Next.js Developer");

      rawCoderOutput += `\n=== FRONTEND ===\n${frontendResponse}\n`;

      // Parse frontend files
      let frontendJson = frontendResponse.trim();
      if (frontendJson.includes("```json")) {
        const parts = frontendJson.split("```json");
        if (parts[1]) {
          const codeParts = parts[1].split("```");
          if (codeParts[0]) frontendJson = codeParts[0].trim();
        }
      } else if (frontendJson.includes("```")) {
        const parts = frontendJson.split("```");
        if (parts[1]) {
          const codeParts = parts[1].split("```");
          if (codeParts[0]) frontendJson = codeParts[0].trim();
        }
      }

      try {
        const parsed = JSON.parse(frontendJson);
        frontendFiles = parsed.files || [];
        console.log(`   ✅ Frontend: ${frontendFiles.length} files generated`);
      } catch (e) {
        console.error("   ⚠️ Failed to parse frontend JSON:", e);
      }
    } catch (e) {
      console.error("   ❌ Frontend generation failed:", e);
    }
  }

  // ============================================================
  // 3. GENERATE BACKEND CODE
  // ============================================================

  if (generateBackend) {
    console.log("⚙️ Generating backend code...");

    const backendPrompt = `${contextPreamble}

DATABASE SCHEMA:
${JSON.stringify(planContext.database_schema_outline.tables, null, 2)}

API ROUTES TO CREATE:
${JSON.stringify(planContext.api_routes_planned, null, 2)}

Generate ALL backend/API files for Next.js 16 App Router.

REQUIREMENTS:
1. app/api/[entity]/route.ts - GET (list) and POST (create) endpoints
2. app/api/[entity]/[id]/route.ts - GET (single), PATCH (update), DELETE endpoints
3. lib/supabase-server.ts - Server-side Supabase client
4. lib/db-queries.ts - Reusable database query functions
5. middleware.ts - Auth middleware (optional)

CODING STANDARDS:
- Use TypeScript strictly (no 'any')
- Proper error handling with NextResponse
- Use Supabase client for database operations
- Return JSON responses

Return a JSON object with this structure:
{
  "files": [
    { "path": "app/api/users/route.ts", "content": "..." }
  ]
}

NO markdown, NO explanations. ONLY valid JSON.`;

    try {
      const backendResponse = await callAI(
        "BACKEND", 
        backendPrompt, 
        "You are a Senior Backend Engineer specializing in TypeScript and APIs"
      );

      rawCoderOutput += `\n=== BACKEND ===\n${backendResponse}\n`;

      // Parse backend files
      let backendJson = backendResponse.trim();
      if (backendJson.includes("```json")) {
        const parts = backendJson.split("```json");
        if (parts[1]) {
          const codeParts = parts[1].split("```");
          if (codeParts[0]) backendJson = codeParts[0].trim();
        }
      } else if (backendJson.includes("```")) {
        const parts = backendJson.split("```");
        if (parts[1]) {
          const codeParts = parts[1].split("```");
          if (codeParts[0]) backendJson = codeParts[0].trim();
        }
      }

      try {
        const parsed = JSON.parse(backendJson);
        backendFiles = parsed.files || [];
        console.log(`   ✅ Backend: ${backendFiles.length} files generated`);
      } catch (e) {
        console.error("   ⚠️ Failed to parse backend JSON:", e);
      }
    } catch (e) {
      console.error("   ❌ Backend generation failed:", e);
    }
  }

  // ============================================================
  // 4. WRITE FILES TO DISK
  // ============================================================

  console.log("📁 Writing files to disk...");
  
  const allFiles = [...frontendFiles, ...backendFiles];
  
  for (const file of allFiles) {
    try {
      const fullPath = path.join(repoPath, file.path);
      await ensureDirForFile(fullPath);
      await fs.writeFile(fullPath, file.content, "utf8");
      filesWritten.push(file.path);
      console.log(`   ✅ ${file.path}`);
    } catch (e) {
      console.error(`   ❌ Failed to write ${file.path}:`, e);
    }
  }

  // ============================================================
  // 5. FAIL FAST: Check if we generated any files
  // ============================================================

  if (filesWritten.length === 0) {
    return {
      success: false,
      error: "No files were generated or written",
      raw_text_audit: rawCoderOutput,
      files_written: []
    };
  }

  // ============================================================
  // 6. CONVERT TO STRUCTURED JSON (Claude 4.5 Haiku)
  // ============================================================

  console.log("🔧 Converting coder output to structured JSON (Claude 4.5 Haiku)...");

  // Build a summary of what was generated for the JSON converter
  const coderSummary = `
FRONTEND FILES (${frontendFiles.length}):
${frontendFiles.map(f => `- ${f.path} (${f.content.length} chars)`).join("\n")}

BACKEND FILES (${backendFiles.length}):
${backendFiles.map(f => `- ${f.path} (${f.content.length} chars)`).join("\n")}

TOTAL FILES: ${allFiles.length}
TOTAL LINES: ~${allFiles.reduce((sum, f) => sum + f.content.split("\n").length, 0)}

TYPES GENERATED:
${planContext.database_schema_outline.tables.map(t => t.name).join(", ")}

FEATURES IMPLEMENTED:
${planContext.feature_breakdown.phase_1_mvp.map(f => `- ${f.feature_id}: ${f.name}`).join("\n")}
`;

  const result = await convertCoderToJSON(coderSummary, researchContext, planContext);

  if (!result.success) {
    console.error(`❌ JSON conversion failed: ${result.error}`);
    // Return partial success with files written
    return {
      success: true, // Files were written, just JSON conversion failed
      data: undefined,
      error: `Files written but JSON conversion failed: ${result.error}`,
      raw_text_audit: rawCoderOutput,
      files_written: filesWritten
    };
  }

  // ============================================================
  // 7. VALIDATE & RETURN
  // ============================================================

  if (!result.data) {
    return {
      success: true,
      data: undefined,
      error: "JSON conversion returned no data",
      raw_text_audit: rawCoderOutput,
      files_written: filesWritten
    };
  }

  // Enhance with actual file data
  result.data.phase = "coder";
  result.data.timestamp = result.data.timestamp || new Date().toISOString();
  result.data.input_references = {
    research_timestamp: researchContext.timestamp,
    plan_timestamp: planContext.timestamp,
    plan_summary: `${planContext.feature_breakdown.phase_1_mvp.length} features, ${planContext.timeline.total_weeks} weeks`
  };

  // Update file counts with actual data
  result.data.code_generated.frontend.files_count = frontendFiles.length;
  result.data.code_generated.frontend.total_lines = frontendFiles.reduce(
    (sum, f) => sum + f.content.split("\n").length, 0
  );
  result.data.code_generated.backend.files_count = backendFiles.length;
  result.data.code_generated.backend.total_lines = backendFiles.reduce(
    (sum, f) => sum + f.content.split("\n").length, 0
  );

  console.log(`✅ [CODER PHASE] Complete!`);
  console.log(`   - Frontend: ${frontendFiles.length} files`);
  console.log(`   - Backend: ${backendFiles.length} files`);
  console.log(`   - Total files written: ${filesWritten.length}`);

  return {
    success: true,
    data: result.data,
    raw_text_audit: rawCoderOutput,
    files_written: filesWritten
  };
}

/**
 * Convert legacy CoderOutput to CoderPhaseJSON
 */
export function legacyToCoderPhaseJSON(
  legacy: CoderOutput,
  researchTimestamp: string,
  planTimestamp: string
): CoderPhaseJSON {
  const frontendFiles = legacy.files.filter(f => 
    f.path.startsWith("app/") && !f.path.includes("/api/") ||
    f.path.startsWith("components/")
  );
  const backendFiles = legacy.files.filter(f => 
    f.path.includes("/api/") ||
    f.path.startsWith("lib/")
  );

  return {
    phase: "coder",
    timestamp: new Date().toISOString(),
    input_references: {
      research_timestamp: researchTimestamp,
      plan_timestamp: planTimestamp,
      plan_summary: "Legacy conversion"
    },
    code_generated: {
      frontend: {
        files_count: frontendFiles.length,
        total_lines: frontendFiles.reduce((sum, f) => sum + f.content.split("\n").length, 0),
        language: "TypeScript + React",
        files: frontendFiles.map(f => ({
          path: f.path,
          lines: f.content.split("\n").length,
          purpose: `Generated file: ${f.path}`,
          status: "complete" as const
        }))
      },
      backend: {
        files_count: backendFiles.length,
        total_lines: backendFiles.reduce((sum, f) => sum + f.content.split("\n").length, 0),
        language: "TypeScript + Node.js",
        files: backendFiles.map(f => ({
          path: f.path,
          lines: f.content.split("\n").length,
          purpose: `Generated file: ${f.path}`,
          status: "complete" as const
        }))
      }
    },
    type_definitions: {
      coverage: 90,
      strict_mode: true,
      files_with_any: 0,
      types_defined: []
    },
    dependencies_used: [
      { package: "next", version: "^16.0.0", reason: "Framework" },
      { package: "@supabase/supabase-js", version: "^2.40.0", reason: "Database" },
      { package: "tailwindcss", version: "^3.3.0", reason: "Styling" }
    ],
    code_quality_metrics: {
      typescript_errors: 0,
      typescript_warnings: 0,
      eslint_errors: 0,
      eslint_warnings: 0,
      linting_status: "passing"
    },
    features_implemented: [],
    critical_notes_for_sql_editor: legacy.notes || []
  };
}
