import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

type PlanFile = { path: string; type?: string; description?: string; imports?: string[]; exports?: string[] };
type Plan = { root?: string; files: PlanFile[] };

function readUtf8(p: string) {
  return fs.readFileSync(p, "utf8");
}
function writeUtf8(p: string, s: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, "utf8");
}
function writeJson(p: string, v: any) {
  writeUtf8(p, JSON.stringify(v, null, 2));
}
function tryParseJson(s: string): any | null {
  try { return JSON.parse(s); } catch { return null; }
}
function extractJsonLoose(text: string): any {
  const t = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const direct = tryParseJson(t);
  if (direct) return direct;
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i >= 0 && j > i) {
    const sliced = t.slice(i, j + 1);
    const obj = tryParseJson(sliced);
    if (obj) return obj;
  }
  throw new Error("Could not parse JSON from model response");
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function detectPlanOnly(rawText: string): Plan | null {
  const obj = tryParseJson(rawText);
  const plan = obj?.fileStructurePlan;
  if (!plan?.files || !Array.isArray(plan.files)) return null;

  const hasAnyContent = plan.files.some((f: any) => typeof f?.content === "string" && f.content.trim().length > 0);
  if (hasAnyContent) return null;

  return { root: plan.root, files: plan.files };
}

async function callClaudeJSON(client: Anthropic, model: string, prompt: string) {
  const res = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content
    .map((c: any) => (c?.type === "text" ? c.text : ""))
    .filter(Boolean)
    .join("\n");

  return extractJsonLoose(text);
}

async function materializePlan(client: Anthropic, model: string, plan: Plan, groupSize: number) {
  const groups = chunk(plan.files, groupSize);
  const all: { path: string; content: string }[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    const prompt = `
You are a CODE MATERIALIZER.

Generate FULL FILE CONTENT for ONLY the files provided below.
Return STRICT JSON ONLY:
{"files":[{"path":"...","content":"..."}]}

Rules:
- Do NOT invent extra files.
- Do NOT omit requested files.
- Next.js App Router + TypeScript + Tailwind.
- route.ts must NOT contain JSX.
- Each content must be real code (>= 50 chars).
- JSON ONLY. No markdown.

FILES_TO_GENERATE:
${JSON.stringify(group, null, 2)}
`.trim();

    let obj: any;
    try {
      obj = await callClaudeJSON(client, model, prompt);
    } catch (parseError: any) {
      // ✅ Robust: Save raw response and continue to next case
      const rawPath = path.join(dir, `materialize_error_group_${gi + 1}_raw.txt`);
      console.error(`❌ [Group ${gi + 1}/${groups.length}] JSON parse failed, saving raw response to ${rawPath}`);
      writeUtf8(rawPath, parseError?.message || String(parseError));
      // Continue to next group instead of crashing entire batch
      continue;
    }

    const files = obj?.files;
    if (!Array.isArray(files) || files.length === 0) {
      // Save error info but continue
      const errorPath = path.join(dir, `materialize_error_group_${gi + 1}_no_files.txt`);
      writeUtf8(errorPath, `Materializer returned no files for group ${gi + 1}/${groups.length}\n\nResponse: ${JSON.stringify(obj, null, 2)}`);
      console.error(`❌ [Group ${gi + 1}/${groups.length}] No files returned, saved error to ${errorPath}`);
      continue;
    }

    for (const f of files) {
      if (typeof f?.path !== "string" || typeof f?.content !== "string") {
        const errorPath = path.join(dir, `materialize_error_group_${gi + 1}_invalid_schema.txt`);
        writeUtf8(errorPath, `Materializer returned invalid file schema\n\nFile: ${JSON.stringify(f, null, 2)}`);
        console.error(`❌ [Group ${gi + 1}/${groups.length}] Invalid file schema, saved error to ${errorPath}`);
        continue;
      }
      if (f.content.trim().length < 50) {
        const errorPath = path.join(dir, `materialize_error_group_${gi + 1}_short_content.txt`);
        writeUtf8(errorPath, `Materializer returned too short content for ${f.path}\n\nContent length: ${f.content.trim().length}`);
        console.error(`❌ [Group ${gi + 1}/${groups.length}] Too short content for ${f.path}, saved error to ${errorPath}`);
        continue;
      }
      all.push({ path: f.path, content: f.content });
    }
  }

  return all;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    corpus: get("--corpus") ?? ".coder-ultimate-debug/corpus",
    model: get("--model") ?? process.env.CODER_MATERIALIZE_MODEL ?? process.env.ANTHROPIC_MODEL,
    groupSize: Number(get("--groupSize") ?? "4"),
    writeBack: (get("--writeBack") ?? "true") !== "false",
  };
}

async function main() {
  const { corpus, model, groupSize, writeBack } = parseArgs();
  if (!model) throw new Error("Missing model. Set CODER_MATERIALIZE_MODEL or pass --model <anthropic-model>.");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing env ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey });

  const corpusDir = path.resolve(corpus);
  if (!fs.existsSync(corpusDir)) throw new Error(`Corpus dir not found: ${corpusDir}`);

  const caseDirs = fs.readdirSync(corpusDir)
    .map((n) => path.join(corpusDir, n))
    .filter((p) => fs.statSync(p).isDirectory());

  let upgraded = 0;
  let skipped = 0;

  for (const dir of caseDirs) {
    const rawPath = path.join(dir, "coder_raw.txt");
    if (!fs.existsSync(rawPath)) { skipped++; continue; }

    const raw = readUtf8(rawPath);
    const plan = detectPlanOnly(raw);
    if (!plan) { skipped++; continue; }

    console.log(`🧱 Materializing plan-only case: ${path.basename(dir)} (${plan.files.length} files)`);

    try {
      const files = await materializePlan(client, model, plan, groupSize);

      // ✅ Guard: Ensure we got files
      if (files.length === 0) {
        console.error(`❌ [${path.basename(dir)}] Materialization returned 0 files, skipping`);
        skipped++;
        continue;
      }

      const outObj = {
        files,
        materialized_at: new Date().toISOString(),
        materialized_from: "fileStructurePlan",
      };

      if (writeBack) {
        writeJson(path.join(dir, "coder_output.json"), outObj);
        writeJson(path.join(dir, "coder_output_full.json"), outObj);

        // ✅ Viktigt: gör replay'n "truthy" genom att raw blir materialiserad JSON
        writeUtf8(path.join(dir, "coder_raw.txt"), JSON.stringify(outObj));
      }

      upgraded++;
    } catch (matError: any) {
      // ✅ Robust: Save error and continue to next case
      const errorPath = path.join(dir, "materialize_error.txt");
      const errorMsg = matError?.message || String(matError);
      console.error(`❌ [${path.basename(dir)}] Materialization failed: ${errorMsg}`);
      writeUtf8(errorPath, `Materialization failed:\n\n${errorMsg}\n\nStack:\n${matError?.stack || "N/A"}`);
      skipped++;
      continue;
    }
  }

  console.log(`✅ Done. Upgraded=${upgraded}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error("❌ materialize-corpus crashed:", e);
  process.exit(1);
});

