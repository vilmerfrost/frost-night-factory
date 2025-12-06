// lib/nightFactory/scopeAnalyzer.ts
import { generateDeepSeekCoder } from './modelClient';
/**
 * SCOPE ANALYZER: Bestämmer vad som faktiskt behöver ändras
 * Förhindrar onödig SQL/Backend-körning vid enkla UI-fixar
 */
export async function analyzeUpdateScope(userRequest, existingFileStructure) {
    const prompt = `
    You are the Gatekeeper of a Software Factory.

    User Request: "${userRequest}"

    Existing File Structure:
    ${existingFileStructure.substring(0, 2000)} // Begränsa längd

    Analyze what needs to change. Output ONLY a JSON object:
    {
      "requires_sql": boolean, // Does it need database schema changes?
      "requires_backend": boolean, // Does it need API/Server Action changes?
      "requires_frontend": boolean, // Does it need UI changes?
      "complexity": "low" | "medium" | "high",
      "risk_level": "safe" | "dangerous"
    }

    RULES:
    - CSS fixes, text changes, or refresh logic NEVER require SQL.
    - Adding a new page usually requires Frontend + Backend (for routing).
    - Only migrations trigger requires_sql.
    - Simple UI tweaks (colors, spacing) are "low" complexity and "safe".
    - Database schema changes are "high" complexity and "dangerous".
  `;
    try {
        // Använd DeepSeek V3 (snabb och billig) för scope analysis
        const result = await generateDeepSeekCoder(prompt);
        // Försök extrahera JSON från svaret
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`[Scope Analyzer] 📊 Determined: SQL=${parsed.requires_sql}, Backend=${parsed.requires_backend}, Frontend=${parsed.requires_frontend}`);
            return parsed;
        }
        // Fallback om JSON parsing misslyckas
        console.warn("[Scope Analyzer] ⚠️ Failed to parse JSON. Using safe defaults.");
        return {
            requires_sql: false,
            requires_backend: true,
            requires_frontend: true,
            complexity: "medium",
            risk_level: "safe"
        };
    }
    catch (e) {
        console.error("[Scope Analyzer] ❌ Error:", e.message);
        // Default till safe mode om AI:n hallucinerar formatet
        return {
            requires_sql: false,
            requires_backend: true,
            requires_frontend: true,
            complexity: "medium",
            risk_level: "safe"
        };
    }
}
