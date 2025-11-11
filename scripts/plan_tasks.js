import fs from "fs/promises";
import fetch from "node-fetch";
import { canSpend } from "./budget.js";

const { GEMINI_API_KEY, PPLX_API_KEY } = process.env;

// Budget check
const budgetCheck = await canSpend("gemini_call", 1, "planning");
if (!budgetCheck.ok) {
  console.log(budgetCheck.message || "Budget cap hit – skipping planning");
  process.exit(0);
}

await fs.mkdir("plans", { recursive: true });
const notes = await fs.readFile("research/notes.md", "utf8").catch(()=> "");

// Gemeni primary planner
async function planWithGemini(prompt, retries = 3, delayMs = 1500) {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  let lastErr = null;

  for (let i=0;i<retries;i++){
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ contents:[{ parts:[{ text: prompt }]}] })
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    const body = await res.text();
    lastErr = new Error(`Gemini error: ${body}`);
    // 429 / 5xx → backoff + retry
    if (res.status === 429 || res.status >= 500) {
      const wait = delayMs * Math.pow(2, i);
      console.log(`Gemini ${res.status}, retry in ${wait}ms...`);
      await new Promise(r=>setTimeout(r, wait));
      continue;
    }
    // andra fel → avbryt direkt
    throw lastErr;
  }
  throw lastErr;
}

// Perplexity fallback planner
async function planWithPerplexity(prompt){
  if (!PPLX_API_KEY) throw new Error("Missing PPLX_API_KEY (for fallback)");
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
  if (!res.ok) throw new Error(`Perplexity fallback error: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

const basePrompt = `Du är senior arkitekt för Frost Solutions (Next.js 16 + Supabase).
Utifrån "notes" nedan, skapa 3–5 PR-specar (små men värdefulla) med:
- Titel, mål, berörda filer/paths
- Exakta steg
- jest/playwright testfall
- inga schema/auth/RLS-ändringar utan manuell flagg
Notes:
${notes}`;

let text = "";
try {
  text = await planWithGemini(basePrompt);
  if (!text.trim()) throw new Error("Empty plan from Gemini");
  console.log("Plan created by Gemini");
} catch (e) {
  console.warn("Gemini failed → using Perplexity fallback:", e.message);
  text = await planWithPerplexity(basePrompt + `\n\nFORMAT:\n# PR: <titel>\n## Mål\n## Steg\n## Testfall\n`);
}

await fs.writeFile("plans/today.md", text);
console.log("✅ plan ready");
