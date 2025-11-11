import fs from "fs/promises";
import fetch from "node-fetch";

const { GEMINI_API_KEY } = process.env;
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

await fs.mkdir("plans", { recursive: true });
const notes = await fs.readFile("research/notes.md", "utf8").catch(()=> "");

const prompt = `Du är senior arkitekt för Frost Solutions (Next.js 16 + Supabase).
Utifrån "notes" nedan, skapa 3–5 PR-specar (små men värdefulla) med:
- Titel, mål, berörda filer/paths
- Exakta steg
- jest/playwright testfall
- inga schema/auth/RLS-ändringar utan manuell flagg
Notes:
${notes}`;

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
  {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{ parts:[{ text: prompt }]}] })
  }
);
if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
const data = await res.json();
const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "# Plan\n\n- (ingen plan, kontrollera GEMINI_API_KEY)";

await fs.writeFile("plans/today.md", text);
console.log("✅ plan ready");
