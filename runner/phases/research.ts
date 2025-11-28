// runner/phases/research.ts
// Research phase: Generate structured research output
import { callLLM } from "../llm";

export interface ResearchOutput {
  summary: string;
  key_features: string[];
  target_users: string[];
  risks: string[];
  recommended_scope_for_mvp: string[];
}

export async function runResearchPhase(
  initialPrompt: string
): Promise<ResearchOutput> {
  const prompt = `You are a research agent. Given this idea, produce structured JSON with:

- summary: High-level summary of the idea
- key_features: Array of key features
- target_users: Array of target user segments
- risks: Array of potential risks
- recommended_scope_for_mvp: Array of MVP scope recommendations

Return ONLY valid JSON, no markdown.

Idea: "${initialPrompt}"`;

  const response = await callLLM(prompt);

  // Parse JSON (remove markdown if present)
  let jsonStr = response.trim();
  if (jsonStr.includes("```json")) {
    jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
  } else if (jsonStr.includes("```")) {
    jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
  }

  try {
    return JSON.parse(jsonStr) as ResearchOutput;
  } catch (e) {
    console.error("Failed to parse research output:", e);
    // Return fallback
    return {
      summary: `Research for: ${initialPrompt}`,
      key_features: [],
      target_users: [],
      risks: [],
      recommended_scope_for_mvp: [],
    };
  }
}

