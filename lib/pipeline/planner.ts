// lib/pipeline/planner.ts
import { generateContent } from "@/lib/nightFactory/modelClient";
import type { PlannerOutput, ResearchOutput } from "./phases";

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

