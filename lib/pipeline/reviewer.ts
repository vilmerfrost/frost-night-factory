// lib/pipeline/reviewer.ts
// Reviewer phase - analyzes changes made by external tools (Cursor)
import { generateContent } from "@/lib/nightFactory/modelClient";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { toUtf8 } from "@/lib/utils/bytes";

export interface ReviewerOutput {
  summary: string[];
  file_changes: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;
  risks: string[];
  human_todos: string[];
}

export async function runReviewerPhase(
  repoPath: string,
  branchName: string,
  originalSpec: any
): Promise<ReviewerOutput> {
  // Get git diff
  const diff = await getGitDiff(repoPath, branchName);
  
  // Get list of changed files
  const changedFiles = await getChangedFiles(repoPath, branchName);

  const prompt = `You are a "Reviewer Agent" analyzing code changes made by an external tool (Cursor).

ORIGINAL SPECIFICATION:
${JSON.stringify(originalSpec, null, 2)}

GIT DIFF:
\`\`\`
${diff}
\`\`\`

CHANGED FILES:
${changedFiles.join("\n")}

Analyze the changes and provide:

1. Summary: 3-5 bullet points of what was fixed/changed
2. File changes: For each significant file, describe what changed with code snippets
3. Risks: Potential issues or breaking changes
4. Human todos: Things a human reviewer should check

Return ONLY valid JSON with this structure:
{
  "summary": [
    "Fixed payload shape bug in /api/payroll/export",
    "Updated calculation logic for overtime hours"
  ],
  "file_changes": [
    {
      "file": "app/payroll/page.tsx",
      "description": "Updated form submit handler",
      "snippet": "\\\`\\\`\\\`tsx\\n...code...\\n\\\`\\\`\\\`"
    }
  ],
  "risks": [
    "May affect legacy payroll export script"
  ],
  "human_todos": [
    "Test payroll export for projects without hours",
    "Confirm calculations with real example"
  ]
}`;

  const response = await generateContent(
    prompt,
    "You are a Senior Code Reviewer"
  );

  // Extract JSON
  let jsonStr = response.trim();
  if (jsonStr.includes("```json")) {
    const parts = jsonStr.split("```json");
    if (parts[1]) {
      const codeParts = parts[1].split("```");
      if (codeParts[0]) {
        jsonStr = codeParts[0].trim();
      }
    }
  } else if (jsonStr.includes("```")) {
    const parts = jsonStr.split("```");
    if (parts[1]) {
      const codeParts = parts[1].split("```");
      if (codeParts[0]) {
        jsonStr = codeParts[0].trim();
      }
    }
  }

  try {
    const output = JSON.parse(jsonStr) as ReviewerOutput;
    
    // Write review report to repo
    await writeReviewReport(repoPath, branchName, output);

    return output;
  } catch (e) {
    console.error("Failed to parse reviewer output:", e);
    return {
      summary: ["Failed to parse review output"],
      file_changes: [],
      risks: [],
      human_todos: ["Review changes manually"],
    };
  }
}

async function getGitDiff(repoPath: string, branchName: string): Promise<string> {
  try {
    // Get diff between main and the branch
    const diff = execSync(
      `git diff main...${branchName}`,
      { cwd: repoPath, encoding: "utf-8" }
    );
    return toUtf8(diff) || "No changes detected";
  } catch (e: any) {
    console.error("Error getting git diff:", e.message);
    return `Error: ${e.message}`;
  }
}

async function getChangedFiles(repoPath: string, branchName: string): Promise<string[]> {
  try {
    const output = execSync(
      `git diff --name-only main...${branchName}`,
      { cwd: repoPath, encoding: "utf-8" }
    );
    return toUtf8(output).trim().split("\n").filter(Boolean);
  } catch (e: any) {
    console.error("Error getting changed files:", e.message);
    return [];
  }
}

async function writeReviewReport(
  repoPath: string,
  branchName: string,
  review: ReviewerOutput
) {
  const reportsDir = path.join(repoPath, "reports");
  
  try {
    await fs.mkdir(reportsDir, { recursive: true });
  } catch (e) {
    // Directory might exist
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `pipeline-${timestamp}-${branchName.replace(/\//g, "-")}.md`;
  const filePath = path.join(reportsDir, fileName);

  const content = `# Pipeline Review Report

**Branch:** ${branchName}
**Reviewed:** ${new Date().toISOString()}

## Summary

${review.summary.map((item) => `- ${item}`).join("\n")}

## File Changes

${review.file_changes.map((change) => `
### ${change.file}

${change.description}

${change.snippet}
`).join("\n")}

## Risks

${review.risks.map((risk) => `- ⚠️ ${risk}`).join("\n")}

## Human Review Checklist

${review.human_todos.map((todo) => `- [ ] ${todo}`).join("\n")}
`;

  await fs.writeFile(filePath, content, "utf8");
  console.log(`✅ Wrote review report: ${filePath}`);
}

