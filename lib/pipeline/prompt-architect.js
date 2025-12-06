// lib/pipeline/prompt-architect.ts
// Prompt Architect phase - creates detailed Cursor prompts for external help
import { generateContent } from "@/lib/nightFactory/modelClient";
import fs from "fs/promises";
import path from "path";
export async function runPromptArchitectPhase(input, repoPath) {
    const prompt = `You are a Senior Prompt Architect specializing in creating detailed, actionable prompts for AI code assistants (like Cursor).

Given this context, create a comprehensive prompt that will help Cursor fix the issue.

CONTEXT:
${JSON.stringify(input.context, null, 2)}

Create a prompt that:
1. Clearly explains the problem
2. Provides relevant code context
3. Specifies the expected outcome
4. Includes style and architectural guidelines
5. Mentions files that need attention

Also provide:
- A branch name (format: auto/bug-<short-description> or auto/feature-<short-description>)
- List of files to focus on
- Style notes for consistency
- Short explanation for humans
- Risk flags (security, RLS, breaking changes, etc.)

Return ONLY valid JSON with this structure:
{
  "cursor_prompt": "Very detailed English prompt for Cursor...",
  "cursor_instructions": {
    "branch_name": "auto/bug-payroll-crash-123",
    "files_to_focus": ["app/payroll/page.tsx", "lib/payroll/calc.ts"],
    "style_notes": ["Follow existing Tailwind/shadcn pattern", "Do not change auth logic"]
  },
  "human_short_explanation": "Brief explanation of why escalation was needed",
  "risk_flags": ["May affect RLS policies", "Breaking change in API"]
}`;
    const response = await generateContent(prompt, "You are a Senior Prompt Architect");
    // Extract JSON
    let jsonStr = response.trim();
    if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    }
    else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    let output;
    try {
        output = JSON.parse(jsonStr);
    }
    catch (e) {
        console.error("Failed to parse prompt architect output:", e);
        throw new Error("Failed to generate valid prompt architect output");
    }
    // Write Cursor task file to repo
    await writeCursorTaskFile(repoPath, input.project, output);
    return output;
}
async function writeCursorTaskFile(repoPath, project, output) {
    const cursorTasksDir = path.join(repoPath, "cursor_tasks");
    try {
        await fs.mkdir(cursorTasksDir, { recursive: true });
    }
    catch (e) {
        // Directory might exist
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${output.cursor_instructions.branch_name.replace(/\//g, "-")}.md`;
    const filePath = path.join(cursorTasksDir, fileName);
    const content = `# Cursor Task: ${output.cursor_instructions.branch_name}

**Project:** ${project}
**Created:** ${new Date().toISOString()}
**Reason:** ${output.human_short_explanation}

## Risk Flags
${output.risk_flags.map((flag) => `- ⚠️ ${flag}`).join("\n")}

## Files to Focus
${output.cursor_instructions.files_to_focus.map((f) => `- \`${f}\``).join("\n")}

## Style Notes
${output.cursor_instructions.style_notes.map((note) => `- ${note}`).join("\n")}

## Prompt for Cursor

${output.cursor_prompt}

---

## Instructions

1. Checkout branch: \`git checkout -b ${output.cursor_instructions.branch_name}\`
2. Copy the prompt above
3. Paste into Cursor Auto mode
4. Review changes
5. Commit and push: \`git commit -am "Auto: ${output.human_short_explanation}" && git push\`
`;
    await fs.writeFile(filePath, content, "utf8");
    console.log(`✅ Wrote Cursor task file: ${filePath}`);
}
