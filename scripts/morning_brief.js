import fs from "fs/promises";
import { Client as Notion } from "@notionhq/client";
import { getBudgetSummary } from "./budget.js";

const notion = new Notion({ auth: process.env.NOTION_API_KEY });
const db = process.env.NOTION_DB_MORNING;
if (!db) throw new Error("Missing NOTION_DB_MORNING");

await fs.mkdir("reports", { recursive: true });
const today = new Date().toISOString().slice(0,10);

// Läs budget med enhanced summary
let cost = 0;
let budgetDetails = "Ingen kostnadsmätning";
try {
  const budgetSummary = await getBudgetSummary();
  cost = Math.round(budgetSummary.total * 100) / 100;
  const breakdown = Object.entries(budgetSummary.by || {})
    .map(([k, v]) => `${k}: ${Math.round(v * 100) / 100} SEK`)
    .join(", ");
  
  budgetDetails = (
    `${budgetSummary.summary}\n\n` +
    `Warnings: ${budgetSummary.warnings.length > 0 ? budgetSummary.warnings.join(', ') : 'none'}`
  );
} catch {}

// Läs Drive upload metadata
let driveDetails = "Inga uploads";
try {
  const uploads = JSON.parse(await fs.readFile("reports/drive_uploads.json","utf8"));
  if (uploads.length > 0) {
    const totalSize = uploads.reduce((sum, u) => sum + u.size, 0);
    const sizeKB = Math.round(totalSize / 1024);
    const created = uploads.filter(u => u.action === "created").length;
    const updated = uploads.filter(u => u.action === "updated").length;
    driveDetails = `${uploads.length} fil(er): ${created} ny, ${updated} uppdaterad (${sizeKB} KB)`;
  }
} catch {}

const summary = `- Nattens plan körd\n- Se artifacts + PR-länkar`;
const prs = `Kolla GitHub → Pull Requests (label: nightly)`;
const podcast = `Ladda NotebookLM med podcast/briefs (om skapade)\n${driveDetails}`;

await fs.writeFile("reports/morning.md", `# Morning Brief ${today}

${summary}

## PRs
${prs}

## Podcast
${podcast}

## Kostnad
${budgetDetails}
`);

await notion.pages.create({
  parent: { database_id: db },
  properties: {
    "Date": { date: { start: today } },
    "Summary": { rich_text:[{ text:{ content: summary }}]},
    "PRs": { rich_text:[{ text:{ content: prs }}]},
    "Podcast": { rich_text:[{ text:{ content: podcast }}]},
    "Cost SEK": { number: cost }
  }
});
console.log("✅ morning brief posted");
