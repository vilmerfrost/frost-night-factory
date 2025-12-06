import { callAI } from "./modelClient";
export async function detectProjectIntent(userRequest) {
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
    }
    catch (e) {
        console.warn("⚠️ Intent detection failed, defaulting to Node.js web.");
        return { isPython: false, isHybrid: false, projectType: 'web', frameworks: [] };
    }
}
export async function detectTechMatrix(userRequest) {
    const prompt = `
    ANALYZE PROJECT REQUEST: "${userRequest}"

    Determine the optimal tech stack.
    - Backend: If performance/systems -> Rust. If AI/ML -> Python. If Realtime/Web -> Go or Node.
    - Frontend: Default to Next.js 15 unless mobile specified.
    - Architecture: If frontend + separate backend -> Hybrid. If single codebase -> Monolith.
    - Complexity: Always choose "Production" unless explicitly stated as MVP/prototype.
    
    DECIDE PROJECT ROOT:
    - If Next.js/React: Use "src" (Standard enterprise pattern).
    - If Python/FastAPI only: Use "." (Root).
    - If Hybrid: Use "src" for frontend.
    
    OUTPUT JSON ONLY:
    {
      "languages": ["string"],
      "primary_backend": "Node" | "Python" | "Go" | "Rust",
      "frontend_framework": "Next.js" | "React Native" | "Electron" | "None",
      "architecture": "Monolith" | "Hybrid" | "Microservices",
      "complexity": "Production",
      "project_root": "src" | "."
    }
  `;
    try {
        const raw = await callAI("REVIEWER", prompt); // Using REVIEWER (Groq) for fast analysis
        const jsonStr = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        // Validate and ensure required fields
        return {
            languages: parsed.languages || ["TypeScript"],
            primary_backend: parsed.primary_backend || "Node",
            frontend_framework: parsed.frontend_framework || "Next.js",
            architecture: parsed.architecture || "Monolith",
            complexity: parsed.complexity || "Production",
            project_root: parsed.project_root || "src" // Default to "src" for Next.js projects
        };
    }
    catch (e) {
        console.warn("⚠️ Tech Matrix detection failed, using defaults.");
        // Fallback
        return {
            languages: ["TypeScript"],
            primary_backend: "Node",
            frontend_framework: "Next.js",
            architecture: "Monolith",
            complexity: "Production",
            project_root: "src" // Default to "src" for Next.js projects
        };
    }
}
