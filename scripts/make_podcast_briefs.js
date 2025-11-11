/**
 * Make Podcast Briefs (Night Factory v2.1)
 * Generates NotebookLM-friendly podcast briefs using Perplexity
 * Creates 5-7 episode briefs in Markdown format
 */
import fs from "fs/promises";
import fetch from "node-fetch";
import { canSpend } from "./budget.js";

const { PPLX_API_KEY } = process.env;
if (!PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY");

/**
 * Generate podcast brief with retry logic
 * @param {string} prompt - Generation prompt
 * @param {number} retries - Max retries
 * @returns {Promise<string>} Generated content
 */
async function generate(prompt, retries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PPLX_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar-reasoning-pro",
          messages: [{ role: "user", content: prompt }]
        })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`PPLX error ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || "";
      
      if (!content.trim()) {
        throw new Error("Empty response from Perplexity");
      }
      
      return content;
      
    } catch (err) {
      lastError = err;
      console.warn(`⚠️  Attempt ${attempt}/${retries} failed: ${err.message}`);
      
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`   Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

console.log("🎙️  Generating podcast briefs for NotebookLM...");

// Budget check
const budgetCheck = await canSpend("perplexity_call", 1, "podcast_briefs");
if (!budgetCheck.ok) {
  console.log(budgetCheck.message || "Budget cap hit – skipping podcast briefs");
  process.exit(0);
}

await fs.mkdir("podcast/briefs", { recursive: true });

// Läs research-notes (eller en tom fallback)
let notes = "";
try {
  notes = await fs.readFile("research/notes.md", "utf8");
  console.log(`📝 Loaded research notes (${notes.length} chars)`);
} catch {
  notes = "(inga anteckningar ännu)";
  console.log("⚠️  No research notes found, using fallback");
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

console.log("🤖 Generating content with Perplexity...");
const out = await generate(prompt);
console.log(`✅ Received ${out.length} chars from Perplexity`);

// Dela upp i filer med # Titel som avsnitts-separator
console.log("📂 Splitting into individual briefs...");
const parts = out.split(/\n(?=# )/g).map(s => s.trim()).filter(Boolean);

if (parts.length === 0) {
  console.error("❌ No briefs generated - output format unexpected");
  process.exit(1);
}

let i = 1;
for (const p of parts) {
  const titleRaw = (p.match(/^#\s*(.+)$/m)?.[1] || `Avsnitt ${i}`);
  const slug = titleRaw.toLowerCase().replace(/[^a-z0-9\- ]/g, "").replace(/\s+/g, "-").slice(0, 60) || `avsnitt-${i}`;
  const file = `podcast/briefs/${String(i).padStart(2, "0")}-${slug}.md`;
  await fs.writeFile(file, p + "\n", "utf8");
  console.log(`  ✅ ${file}`);
  i++;
}

console.log(`\n✅ Podcast briefs generated successfully!`);
console.log(`   - ${i - 1} episode brief(s) saved to podcast/briefs/`);
console.log(`   - Next: Run 'node scripts/pack_briefs.js' to create TXT bundle`);
console.log(`   - Then: Upload to NotebookLM or sync to Google Drive`);
