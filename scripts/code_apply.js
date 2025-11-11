import { execSync } from "node:child_process";
import fs from "fs/promises";

// Sätt alltid lokal git-identitet i detta repo (failsafe på runnern)
try {
  const actor = process.env.GITHUB_ACTOR || "night-factory-bot";
  execSync(`git config --local user.name "${actor}"`, { stdio: "inherit" });
  execSync(`git config --local user.email "${actor}@users.noreply.github.com"`, { stdio: "inherit" });
} catch (e) {
  console.warn("Could not set local git identity:", e?.message);
}

await fs.mkdir("tasks", { recursive: true });
const plan = await fs.readFile("plans/today.md","utf8");

const tasks = [...plan.matchAll(/^#+\s*(PR|Task)\s*[:\-]\s*(.+)$/gmi)]
  .map(m=>m[2])
  .filter(Boolean)
  .map(t => t.toLowerCase().replace(/[^a-z0-9\- ]/g,"").replace(/\s+/g,"-"))
  .slice(0,4);

if (tasks.length===0) {
  console.log("no tasks parsed, creating 1 generic task");
  tasks.push("refactor-docs");
}

for (const t of tasks){
  execSync(`git checkout -b nightly/${t}`, { stdio:"inherit" });
  await fs.mkdir(`tasks/${t}`, { recursive:true });
  await fs.writeFile(`tasks/${t}/TODO.md`, `# ${t}\n\nImplementera enligt plans/today.md\n`);
  execSync(`git add -A && git commit -m "chore(nightly): scaffold ${t}"`, { stdio:"inherit" });
  execSync(`git push -u origin HEAD`, { stdio:"inherit" });

  // försök skapa PR med GitHub CLI om runnern har gh (annars hoppar vi över)
  try {
    execSync(`gh pr create -t "Nightly: ${t}" -b "Auto-scaffold enligt plan" -B main`, { stdio:"inherit" });
  } catch (_) {}

  execSync(`git checkout -`, { stdio:"inherit" });
}

console.log("✅ branches & (ev.) PRs created");
