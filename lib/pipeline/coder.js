// lib/pipeline/coder.ts
import { generateContent } from "@/lib/nightFactory/modelClient";
import fs from "fs/promises";
import path from "path";
export async function runCoderPhase(spec, repoPath) {
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
        jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    }
    else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    let coderOutput;
    try {
        coderOutput = JSON.parse(jsonStr);
    }
    catch (e) {
        console.error("Failed to parse coder output:", e);
        throw new Error("Failed to generate valid coder output");
    }
    // Apply files to repo
    await applyGeneratedFiles(repoPath, coderOutput);
    return coderOutput;
}
async function ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    try {
        await fs.mkdir(dir, { recursive: true });
    }
    catch (e) {
        // Directory might already exist, that's OK
    }
}
export async function applyGeneratedFiles(baseDir, output) {
    for (const file of output.files) {
        const fullPath = path.join(baseDir, file.path);
        await ensureDirForFile(fullPath);
        await fs.writeFile(fullPath, file.content, "utf8");
        console.log(`✅ Wrote file: ${file.path}`);
    }
}
