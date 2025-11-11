import fs from "fs/promises";
import fetch from "node-fetch";
import { Client as Notion } from "@notionhq/client";
import { canSpend } from "./budget.js";

const { PPLX_API_KEY, NOTION_API_KEY, NOTION_DB_RESEARCH } = process.env;

if (!PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");
if (!NOTION_API_KEY) throw new Error("Missing NOTION_API_KEY");
if (!NOTION_DB_RESEARCH) throw new Error("Missing NOTION_DB_RESEARCH");

const TOPICS = [
  "Zendesk trial A/B for SaaS support (Swedish tone, metrics, edit distance)",
  "LangGraph vs CrewAI vs AutoGen for nightly orchestration",
  "Supabase pgvector best practices EU + audit logging"
];

// Budget check
const budgetCheck = await canSpend("perplexity_call", TOPICS.length);
if (!budgetCheck.ok) {
  console.log("Budget cap hit – skipping research");
  process.exit(0);
}

async function askPerplexity(q) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${PPLX_API_KEY}`
    },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      messages: [{ role:"user", content:`Ge 15–25 länkar (utan paywalls) om: ${q}. Svara endast med länk + 1 rad varför.` }]
    })
  });
  if (!res.ok) throw new Error(`Perplexity error: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function parseLinks(text){
  const rows = [];
  for (const line of text.split("\n").map(s=>s.trim()).filter(Boolean)){
    const m = line.match(/https?:\/\/\S+/);
    if (m) rows.push({ url:m[0], note: line.replace(m[0],"").trim() });
  }
  return rows.slice(0,25);
}

async function upsertNotion(rows, topic){
  const notion = new Notion({ auth: NOTION_API_KEY });
  for (const r of rows){
    try {
      await notion.pages.create({
        parent: { database_id: NOTION_DB_RESEARCH },
        properties: {
          Title: { title: [{ text: { content: r.url } }] },
          URL: { url: r.url },
          Topic: { select: { name: topic } },
          "Must-Read": { checkbox: !!r.note?.includes("★") },
          Notes: r.note ? { rich_text: [{ text: { content: r.note } }] } : undefined
        }
      });
    } catch (e) {
      // fortsätt även om en rad failar
      console.error("Notion create failed for", r.url, e?.message);
    }
  }
}

await fs.mkdir("research", { recursive: true });
const all = [];

for (const t of TOPICS){
  const raw = await askPerplexity(t);
  const rows = parseLinks(raw).map(r=>({ topic:t, ...r }));
  all.push(...rows);
  await upsertNotion(rows, t);
}

await fs.writeFile(
  "research/sources.csv",
  "topic,url,note\n" + all.map(r=>`${JSON.stringify(r.topic)},${r.url},${JSON.stringify(r.note||"")}`).join("\n")
);

await fs.writeFile(
  "research/notes.md",
  all.map(r=>`- **${r.topic}**: ${r.url} — ${r.note||""}`).join("\n")
);

console.log("✅ research done");
