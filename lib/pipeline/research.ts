// lib/pipeline/research.ts
import { generateContent } from "@/lib/nightFactory/modelClient";
import type { ResearchOutput } from "./phases";

export async function runResearchPhase(
  idea: string,
  ticketType?: "bug" | "feature"
): Promise<ResearchOutput> {
  // Different prompts for bugs vs features
  const isBug = ticketType === "bug";

  const prompt = isBug
    ? `You are a senior debugging engineer and code analyst.

Given this bug report, conduct thorough research:

BUG REPORT: "${idea}"

Focus on:
- Analyzing potential root causes
- Identifying which files are likely affected
- Understanding recent changes that might have introduced the bug
- Stack trace analysis if provided
- Similar bugs in codebase or known issues

Provide a JSON response with this exact structure:
{
  "summary": "High-level summary of the bug and likely cause",
  "key_findings": ["Finding 1", "Finding 2"],
  "file_candidates": ["app/page.tsx", "lib/utils.ts"],
  "api_considerations": ["Endpoint /api/... might be affected"],
  "risks": ["Risk 1", "Risk 2"],
  "recommended_solution_shape": "High-level plan for fix"
}

Return ONLY valid JSON, no markdown.`
    : `You are a senior product researcher and market analyst.

Given this product idea/feature request, conduct comprehensive research:

FEATURE REQUEST: "${idea}"

Focus on:
- Market analysis and competing tools
- Domain-specific requirements
- Technical constraints and recommendations
- MVP scope recommendations
- Edge cases to consider
- User segments who would benefit

Provide a JSON response with this exact structure:
{
  "summary": "High-level summary of what we're building",
  "user_segments": ["Segment 1", "Segment 2"],
  "similar_tools": ["Tool 1", "Tool 2"],
  "key_requirements": ["Requirement 1", "Requirement 2"],
  "tech_recommendations": {
    "frontend": "Recommended frontend framework",
    "backend": "Recommended backend",
    "auth": "Recommended auth solution",
    "db_notes": ["Note 1", "Note 2"]
  },
  "key_insights": ["Insight 1", "Insight 2"],
  "references": [
    { "title": "Reference title", "url": "https://..." }
  ],
  "risks": ["Risk 1", "Risk 2"],
  "recommended_scope_for_mvp": ["Feature 1", "Feature 2"]
}

Return ONLY valid JSON, no markdown.`;

  const response = await generateContent(
    prompt,
    isBug ? "You are a Senior Debugging Engineer" : "You are a Senior Product Researcher"
  );

  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.includes("```json")) {
    jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
  } else if (jsonStr.includes("```")) {
    jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr) as ResearchOutput;

    // Normalize output structure for bugs
    if (isBug && !parsed.key_findings) {
      parsed.key_findings = parsed.key_insights || [];
    }

    return parsed;
  } catch (e) {
    console.error("Failed to parse research output:", e);
    // Return fallback structure
    return {
      summary: response.substring(0, 500),
      user_segments: [],
      similar_tools: [],
      key_requirements: [],
      tech_recommendations: {
        frontend: "Next.js 16",
        backend: "Supabase",
        auth: "Supabase Auth",
        db_notes: [],
      },
      key_findings: [],
      file_candidates: [],
      api_considerations: [],
      risks: [],
      recommended_solution_shape: response.substring(0, 200),
    };
  }
}
