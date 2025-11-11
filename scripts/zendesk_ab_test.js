import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

const { GEMINI_API_KEY } = process.env;
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

const CSV = "data/zendesk_tickets.csv";
const OUT_JSON = "reports/zendesk_ab.json";
const OUT_CSV  = "reports/zendesk_ab_results.csv";

// minimal csv -> array
function parseCSV(text) {
  const [headerLine, ...lines] = text.split("\n").map(s=>s.trim()).filter(Boolean);
  const headers = headerLine.split(",").map(h=>h.replace(/^"|"$/g,""));
  return lines.map(l=>{
    const cols = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (cols[i]||"").replace(/^"|"$/g,""));
    return obj;
  });
}

async function geminiReply(ticket){
  const sys = `Du är svensk supportagent för bygg-SaaS (Frost Solutions). Svara kort, vänligt, med punktlista om behövs. Lägg ev. länkar som platshållare [Hjälpcenter-länk].`;
  const user = `Ärende:
Subject: ${ticket.subject}
Category: ${ticket.category}
Description: ${ticket.description}
Customer: ${ticket.customer}

Skriv ett förslag på svar. Inkludera 1 uppföljningsfråga om oklarheter.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{ role:"user", parts:[{ text: sys+"\n\n"+user }]}] })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

await fs.mkdir("reports", { recursive:true });
const csvText = await fs.readFile(CSV, "utf8");
const tickets = parseCSV(csvText);

const results = [];
for (const t of tickets){
  const gemini = await geminiReply(t);
  results.push({
    subject: t.subject,
    category: t.category,
    customer: t.customer,
    description: t.description,
    zendesk_ai: "(klistra in manuellt från Zendesk UI om du vill jämföra exakt)",
    gemini_suggested: gemini
  });
}

await fs.writeFile(OUT_JSON, JSON.stringify(results, null, 2), "utf8");
await fs.writeFile(
  OUT_CSV,
  "subject,category,customer,description,gemini_suggested\n" +
  results.map(r => [
    JSON.stringify(r.subject),
    JSON.stringify(r.category),
    JSON.stringify(r.customer),
    JSON.stringify(r.description),
    JSON.stringify(r.gemini_suggested.replace(/\n/g," \\n "))
  ].join(",")).join("\n"),
  "utf8"
);

console.log("✅ Zendesk A/B (B=Gemini) klar — se reports/zendesk_ab.json & .csv");
console.log("ℹ️ Logga in i Zendesk och hämta AI-svaret för samma ticket för att jämföra manuellt (A).");
