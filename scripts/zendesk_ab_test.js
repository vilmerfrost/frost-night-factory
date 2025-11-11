// scripts/zendesk_ab_test.js
import fs from "fs/promises";
import fetch from "node-fetch";

const { GEMINI_API_KEY, PPLX_API_KEY } = process.env;
if (!GEMINI_API_KEY && !PPLX_API_KEY) {
  throw new Error("Need at least one of GEMINI_API_KEY or PPLX_API_KEY");
}

const CSV = "data/zendesk_tickets.csv";
const OUT_JSON = "reports/zendesk_ab.json";
const OUT_CSV  = "reports/zendesk_ab_results.csv";

function parseCSV(text) {
  const [head, ...lines] = text.split("\n").map(s=>s.trim()).filter(Boolean);
  const headers = head.split(",").map(h=>h.replace(/^"|"$/g,""));
  return lines.map(l=>{
    const cols = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (cols[i]||"").replace(/^"|"$/g,""));
    return obj;
  });
}

async function geminiReply(ticket, retries=3, delay=1200) {
  if (!GEMINI_API_KEY) throw new Error("NO_GEMINI_KEY");
  const sys = `Du är svensk supportagent för bygg-SaaS (Frost Solutions). Svara kort, vänligt, med punktlista vid behov.`;
  const user = `Ärende:
Subject: ${ticket.subject}
Category: ${ticket.category}
Description: ${ticket.description}
Customer: ${ticket.customer}
Skriv ett förslag på svar och 1 följdfråga.`;

  let last;
  for (let i=0;i<retries;i++){
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ contents:[{ role:"user", parts:[{ text: sys+"\n\n"+user }]}] })
    });
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    last = { status: res.status, body: await res.text() };
    if (res.status === 429 || res.status >= 500) {
      const wait = delay * Math.pow(2,i);
      console.log(`Gemini ${res.status}, backoff ${wait}ms`);
      await new Promise(r=>setTimeout(r, wait));
      continue;
    }
    throw new Error(`Gemini error: ${last.body}`);
  }
  throw new Error(`Gemini exhausted: ${last?.body||"unknown"}`);
}

async function pplxReply(ticket){
  if (!PPLX_API_KEY) throw new Error("NO_PPLX_KEY");
  const prompt = `Du är svensk supportagent för bygg-SaaS (Frost Solutions).
Ärende:
Subject: ${ticket.subject}
Category: ${ticket.category}
Description: ${ticket.description}
Customer: ${ticket.customer}
Skriv ett förslag på svar (kort, tydligt, vänligt) och 1 följdfråga.`;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization":`Bearer ${PPLX_API_KEY}` },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      messages: [{ role:"user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Perplexity error: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

await fs.mkdir("reports", { recursive:true });
const csv = await fs.readFile(CSV, "utf8");
const tickets = parseCSV(csv);

const results = [];
for (const t of tickets){
  let b = ""; // B = vårt externa LLM-svar
  try {
    b = await geminiReply(t);
  } catch (e) {
    console.warn("Gemini fail → fallback PPLX:", e.message);
    b = await pplxReply(t);
  }
  results.push({
    subject: t.subject,
    category: t.category,
    customer: t.customer,
    description: t.description,
    zendesk_ai: "(fyll i manuellt från Zendesk UI om du vill jämföra exakt)",
    gemini_or_pplx: b
  });
}

await fs.writeFile(OUT_JSON, JSON.stringify(results, null, 2), "utf8");
await fs.writeFile(
  OUT_CSV,
  "subject,category,customer,description,gemini_or_pplx\n" +
  results.map(r => [
    JSON.stringify(r.subject),
    JSON.stringify(r.category),
    JSON.stringify(r.customer),
    JSON.stringify(r.description),
    JSON.stringify(r.gemini_or_pplx.replace(/\n/g," \\n "))
  ].join(",")).join("\n"),
  "utf8"
);

console.log("✅ AB (B-svar) klart → reports/zendesk_ab.json & .csv");
