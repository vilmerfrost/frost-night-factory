import { callAI } from "./modelClient";

export interface ProjectIntent {
  isPython: boolean;
  isHybrid: boolean;
  projectType: 'web' | 'mobile' | 'backend' | 'hybrid';
  frameworks: string[];
}

export async function detectProjectIntent(userRequest: string): Promise<ProjectIntent> {
  const prompt = `
    ANALYZE THIS PROJECT REQUEST:

    "${userRequest}"

    Determine the technical stack requirements.
    - Does it strictly require Python (FastAPI, Flask, Django, Streamlit)? -> isPython: true
    - Does it involve BOTH a frontend (React/Next) and a separate backend (Python)? -> isHybrid: true
    - If strictly Node.js/Next.js -> isPython: false

    OUTPUT JSON ONLY:
    {
      "isPython": boolean,
      "isHybrid": boolean,
      "projectType": "web" | "backend" | "hybrid",
      "frameworks": ["Next.js", "FastAPI", etc]
    }
  `;

  // Använd Groq (snabb) för att avgöra detta direkt
  try {
    const raw = await callAI("REVIEWER", prompt); 
    const jsonStr = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("⚠️ Intent detection failed, defaulting to Node.js web.");
    return { isPython: false, isHybrid: false, projectType: 'web', frameworks: [] };
  }
}

