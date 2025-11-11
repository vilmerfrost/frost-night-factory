import fs from "fs/promises";
import { Client as Notion } from "@notionhq/client";

const notion = new Notion({ auth: process.env.NOTION_API_KEY });
const db = process.env.NOTION_DB_MORNING;
if (!db) throw new Error("Missing NOTION_DB_MORNING");

await fs.mkdir("reports", { recursive: true });
const today = new Date().toISOString().slice(0,10);

const summary = `- Nattens plan körd\n- Se artifacts + PR-länkar`;
const prs = `Kolla GitHub → Pull Requests (label: nightly)`;
const podcast = `Ladda NotebookLM med podcast/briefs (om skapade)`;
const cost = 0;

await fs.writeFile("reports/morning.md", `# Morning Brief ${today}

${summary}

## PRs
${prs}

## Podcast
${podcast}

## Kostnad
${cost} SEK
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
