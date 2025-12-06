// lib/pipeline/coder-escalation.ts
// Enhanced Coder phase with escalation support
import { generateContent } from "@/lib/nightFactory/modelClient";
export async function runCoderPhaseWithEscalation(spec, attemptNumber = 1, previousErrors) {
    const errorContext = previousErrors?.length
        ? `\n\nPrevious attempts failed with:\n${previousErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
        : "";
    const prompt = `You are a senior full-stack engineer specializing in Next.js 16, TypeScript, and Supabase.

Given the following app specification, generate code.

APP SPECIFICATION:
${JSON.stringify(spec, null, 2)}
${errorContext}

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON in this exact format:
{
  "status": "ok" | "need_external_help",
  "reason": "short human-readable reason",
  "patches": [
    {
      "file": "relative/path/to/file.tsx",
      "operation": "replace" | "create" | "delete",
      "old_snippet": "code to replace (if operation is replace)",
      "new_snippet": "new code"
    }
  ],
  "notes": ["note 1", "note 2"],
  "files": [
    {
      "path": "relative/path/to/file.tsx",
      "content": "full file content"
    }
  ]
}

2. Set status = "need_external_help" if:
   - You cannot find the root cause of an error
   - You need to change > 10 files
   - You are uncertain about RLS / advanced SQL
   - You've attempted this 2-3 times already
   - The problem requires domain expertise you don't have

3. If status = "ok":
   - Provide complete files in "files" array
   - Include: package.json, next.config.mjs, tsconfig.json, app/layout.tsx, app/page.tsx
   - For each entity, create CRUD pages under app/[entity]/
   - Create API routes under app/api/[entity]/
   - Use TypeScript strictly, no 'any' types
   - Use Tailwind CSS for styling

4. If status = "need_external_help":
   - Leave "files" empty or minimal
   - Explain clearly in "reason" why you need help
   - List specific files/areas in "notes" that need attention

Return ONLY the JSON object, no markdown code blocks, no explanations.`;
    const response = await generateContent(prompt, "You are a Senior Full-Stack Engineer");
    // Extract JSON
    let jsonStr = response.trim();
    if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    }
    else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    try {
        const output = JSON.parse(jsonStr);
        // Validate structure
        if (!output.status || !["ok", "need_external_help"].includes(output.status)) {
            output.status = "need_external_help";
            output.reason = "Invalid response format from LLM";
        }
        return output;
    }
    catch (e) {
        console.error("Failed to parse coder output:", e);
        return {
            status: "need_external_help",
            reason: "Failed to parse LLM response",
            patches: [],
            notes: [`Parse error: ${e}`],
        };
    }
}
