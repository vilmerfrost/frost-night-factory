// scripts/make_podcast_briefs.js
import fs from "fs/promises";
import fetch from "node-fetch";

const { PPLX_API_KEY } = process.env;
if (!PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");

/**
 * Kallar Perplexity (stabilt/billigt) för att skriva NotebookLM-vänliga avsnitts-briefs.
 */
async function generate(prompt){
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${PPLX_API_KEY}`
    },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      messages: [{ role:"user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`PPLX podcast error: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

await fs.mkdir("podcast/briefs", { recursive:true });

// Läs research-notes (eller en tom fallback)
let notes = "";
try {
  notes = await fs.readFile("research/notes.md", "utf8");
} catch {
  notes = "(inga anteckningar ännu)";
}

// Prompt som ger 5–7 avsnitt i Markdown
const prompt = `Skapa 5–7 korta podcast-briefs (5–12 min) på svenska för NotebookLM.
Varje avsnitt i MARKDOWN med rubriker:

# Titel
## Mål
## Nyckelpunkter (5–8 bullets)
## Risker (3 bullets)
## Billiga experiment inatt (3 bullets)
## Vad gör jag 08:00?

Publik: en 16-årig SaaS-grundare som bygger Frost Solutions.
Baserat på dessa anteckningar:
${notes}
`;

const out = await generate(prompt);

// Dela upp i filer med # Titel som avsnitts-separator
const parts = out.split(/\n(?=# )/g).map(s=>s.trim()).filter(Boolean);

let i = 1;
for (const p of parts){
  const titleRaw = (p.match(/^#\s*(.+)$/m)?.[1] || `Avsnitt ${i}`);
  const slug = titleRaw.toLowerCase().replace(/[^a-z0-9\- ]/g,"").replace(/\s+/g,"-").slice(0,60) || `avsnitt-${i}`;
  const file = `podcast/briefs/${String(i).padStart(2,"0")}-${slug}.md`;
  await fs.writeFile(file, p + "\n", "utf8");
  i++;
}

console.log(`✅ podcast briefs generated: ${i-1} file(s) in podcast/briefs/`);
