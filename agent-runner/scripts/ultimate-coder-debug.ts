/**
 * Ultimate Coder Phase Mass Debugger (Final Edition)
 * --------------------------------------------------
 * What it does (end-to-end):
 *  1) Pulls last N coder steps from Supabase (optionally only failed)
 *  2) Builds a reproducible local corpus per coder-step:
 *       - meta.json
 *       - planner.json (best-effort from coder.input or planner.output)
 *       - coder_raw.txt (from coder.logs)
 *       - coder_output.json (from coder.output)
 *  3) Replays the coder phase OFFLINE (0 AI calls):
 *       parse -> normalize -> rename-policy -> import-rewrite -> validate -> write sandbox
 *  4) Produces deduped heatmap report:
 *       report.json + report.md
 *
 * Requirements:
 *  - Node 18+
 *  - Run with: tsx agent-runner/scripts/ultimate-coder-debug.ts
 *
 * Env:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertDefined } from "@/lib/utils/assert";
import { lineAt } from "@/lib/utils/text";
import { toUtf8 } from "@/lib/utils/bytes";
import { spawnSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ----------------------------- Error Classes ----------------------------- */

class SkipCaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipCaseError";
  }
}

class CorpusHealthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorpusHealthError";
  }
}

/* ----------------------------- Expectation System ----------------------------- */

type CaseExpectation =
  | { kind: "ok" }
  | { kind: "errorKeyIncludes"; value: string };

function inferExpectationFromName(caseName: string): CaseExpectation {
  // Expand this mapping as you add more negative tests
  if (caseName.includes("case_forbidden_env")) {
    return { kind: "errorKeyIncludes", value: 'forbidden path ".env"' };
  }
  if (caseName.includes("case_path_traversal")) {
    return { kind: "errorKeyIncludes", value: "Path traversal blocked" };
  }
  if (caseName.includes("case_jsx_in_ts_lib_should_fail")) {
    return { kind: "errorKeyIncludes", value: "JSX detected in .ts after renamePolicy" };
  }

  // Generic fallback: any "*should_fail*" is expected to fail (but we still want a real errorKey)
  if (caseName.toLowerCase().includes("should_fail")) {
    return { kind: "errorKeyIncludes", value: "validate:" }; // loose match
  }

  return { kind: "ok" };
}

function readFirstExistingTextFile(p: string): string | null {
  if (!fs.existsSync(p)) return null;
  const txt = fs.readFileSync(p, "utf8");
  return txt;
}

function readCaseRaw(caseDir: string): { raw: string; source: string } {
  // 1) Common single-file locations
  const directCandidates = [
    path.join(caseDir, "raw.txt"),
    path.join(caseDir, "raw.md"),
    path.join(caseDir, "raw"), // sometimes a file with no extension
    path.join(caseDir, "output.txt"),
    path.join(caseDir, "coder_raw.txt"), // fallback to standard name
  ];

  for (const p of directCandidates) {
    const txt = readFirstExistingTextFile(p);
    if (txt && txt.trim().length > 0) return { raw: txt, source: p };
  }

  // 2) Chunk folders: raw/0.txt raw/1.txt ... OR output/0.txt output/1.txt ...
  const chunkFolders = [path.join(caseDir, "raw"), path.join(caseDir, "output")];

  for (const folder of chunkFolders) {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) continue;

    const files = fs
      .readdirSync(folder)
      .filter((f) => /\.(txt|md|log)$/i.test(f))
      .sort((a, b) => {
        // numeric sort for "0.txt, 1.txt, 10.txt"
        const an = Number(a.replace(/\D+/g, ""));
        const bn = Number(b.replace(/\D+/g, ""));
        if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
        return a.localeCompare(b);
      });

    if (files.length === 0) continue;

    const joined = files
      .map((f) => fs.readFileSync(path.join(folder, f), "utf8"))
      .join("\n\n");

    if (joined.trim().length > 0) {
      return { raw: joined, source: `${folder}/*` };
    }
  }

  return { raw: "", source: "none" };
}

/* ----------------------------- CLI + Types ----------------------------- */

type Args = {
  outDir: string;
  limit: number;
  onlyFailed: boolean;
  sinceDays?: number;

  // If you pass --corpus, we skip Supabase extraction and just replay that corpus.
  corpusDir?: string;

  // Controls what checks run during replay.
  // "none" still does parse/validate/write + report.
  // "basic" runs basic typecheck if possible.
  // "strict" runs all checks including typecheck.
  checks: "none" | "basic" | "strict";

  // How many cases to replay (after extraction). Undefined = all extracted.
  replayLimit?: number;

  // If true, exit on corpus health issues (empty raw files)
  healthStrict?: boolean;
};

type PipelineRow = {
  id: string;
  name: string | null;
  status: string | null;
  current_phase: string | null;
  created_at: string | null;
  updated_at: string | null;
  initial_prompt: string | null;
};

type StepRow = {
  id: string;
  pipeline_id: string;
  phase: string;
  status: string;
  input: any | null;
  output: any | null;
  logs: string | null;
  raw_output_text?: string | null;
  raw_output_json?: any | null;
  created_at: string | null;
  updated_at: string | null;
};

type CorpusCase = {
  caseId: string; // pipelineId__stepIdprefix__timestamp
  pipelineId: string;
  coderStepId: string;
  createdAt?: string;
  dir: string;

  metaPath: string;
  plannerPath: string;
  coderRawPath: string;
  coderOutputPath: string;
};

type GenFile = {
  filePath: string;
  content: string;
  languageHint?: string;
};

type ReplayResult = {
  caseId: string;
  ok: boolean;
  errorKey?: string;
  errorCategory?: string;
  errorMessage?: string;

  stats?: {
    parsedFiles: number;
    writtenFiles: number;
    renamedCount: number;
    importRewrites: number;
    bytesWritten: number;
  };

  autofixes?: {
    renamed: Array<{ from: string; to: string; reason: string }>;
    importRewrites: Array<{ file: string; count: number }>;
  };

  expected?: {
    kind: "matched";
    expect: string;
    got: string;
  };

  debug?: {
    outputKeys?: string[];
    rawSource?: string;
  };
};

/* ----------------------------- Entry Point ----------------------------- */

function parseArgs(argv: string[]): Args {
  // Defaults: "ultimate but fast"
  const args: Args = {
    outDir: path.resolve(process.cwd(), ".coder-ultimate-debug"),
    limit: 200,
    onlyFailed: true,
    checks: "basic",
  };

  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];

    if (k === "--out") {
      const nextArg = argv[++i];
      const outDir = assertDefined(nextArg, "--out requires a directory path");
      args.outDir = path.resolve(process.cwd(), outDir);
    } else if (k === "--limit") args.limit = Number(argv[++i] ?? "200");
    else if (k === "--replayLimit") {
      const nextArg = argv[++i];
      if (nextArg) args.replayLimit = Number(nextArg);
    } else if (k === "--all") args.onlyFailed = false;
    else if (k === "--onlyFailed") args.onlyFailed = true;
    else if (k === "--sinceDays") {
      const nextArg = argv[++i];
      if (nextArg) args.sinceDays = Number(nextArg);
    } else if (k === "--corpus") {
      const nextArg = argv[++i];
      const corpusDir = assertDefined(nextArg, "--corpus requires a directory path");
      args.corpusDir = path.resolve(process.cwd(), corpusDir);
    } else if (k === "--checks") {
      const v = String(argv[++i] ?? "basic");
      if (v === "none") args.checks = "none";
      else if (v === "strict") args.checks = "strict";
      else args.checks = "basic";
    }
    else if (k === "--health-strict" || k === "--strict-health" || k === "--corpus-strict") {
      args.healthStrict = true;
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 200;
  if (args.replayLimit !== undefined && (!Number.isFinite(args.replayLimit) || args.replayLimit <= 0)) {
    args.replayLimit = undefined;
  }

  return args;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeUtf8(p: string, s: string) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, "utf8");
}

function writeJson(p: string, obj: unknown) {
  writeUtf8(p, JSON.stringify(obj, null, 2));
}

function readUtf8(p: string) {
  return fs.readFileSync(p, "utf8");
}

function readJson<T = any>(p: string): T {
  return JSON.parse(readUtf8(p));
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function safeRelPath(input: string) {
  // Normalize slashes and remove leading "./" or "/"
  let p = input.replace(/\\/g, "/").trim();
  p = p.replace(/^(\.\/)+/g, "");
  p = p.replace(/^\/+/g, "");
  return p;
}

function safeJoin(root: string, rel: string) {
  const r = path.resolve(root);
  const p = path.resolve(root, rel);
  // ensure p is within root
  if (p !== r && !p.startsWith(r + path.sep)) {
    throw new Error(`Path traversal blocked: ${rel}`);
  }
  return p;
}

/* ----------------------------- Supabase Extract ----------------------------- */

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env SUPABASE_URL");
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
}

async function fetchCoderSteps(
  supabase: SupabaseClient,
  opts: { limit: number; onlyFailed: boolean; sinceDays?: number }
): Promise<StepRow[]> {
  let q = supabase
    .from("pipeline_steps")
    .select("id,pipeline_id,phase,name,status,input,output,logs,raw_output_text,raw_output_json,created_at,updated_at")
    .in("name", ["coder", "frontend_coder", "backend_coder", "sql_coder", "ui_coder", "api_coder"])
    .order("created_at", { ascending: false })
    .limit(opts.limit);

  if (opts.onlyFailed) {
    // "failed" is the most important, but also catch "pending/running" stuck and other error states.
    q = q.in("status", ["failed", "running", "pending", "rejected", "error"]);
  }

  if (opts.sinceDays && opts.sinceDays > 0) {
    const since = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000).toISOString();
    q = q.gte("created_at", since);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Supabase fetchCoderSteps failed: ${error.message}`);
  return (data ?? []) as StepRow[];
}

async function fetchPipelinesByIds(supabase: SupabaseClient, pipelineIds: string[]): Promise<Map<string, PipelineRow>> {
  const out = new Map<string, PipelineRow>();
  for (const chunk of chunkArray(pipelineIds, 200)) {
    const { data, error } = await supabase
      .from("pipelines")
      .select("id,name,status,current_phase,created_at,updated_at,initial_prompt")
      .in("id", chunk);

    if (error) throw new Error(`Supabase fetchPipelinesByIds failed: ${error.message}`);
    for (const row of (data ?? []) as PipelineRow[]) out.set(row.id, row);
  }
  return out;
}

async function fetchLatestPlannerSteps(supabase: SupabaseClient, pipelineIds: string[]): Promise<Map<string, StepRow>> {
  // Best-effort: grab newest planner step per pipeline.
  const out = new Map<string, StepRow>();

  for (const chunk of chunkArray(pipelineIds, 200)) {
    const { data, error } = await supabase
      .from("pipeline_steps")
      .select("id,pipeline_id,phase,name,status,input,output,logs,created_at,updated_at")
      .eq("name", "planner")
      .in("pipeline_id", chunk)
      .order("created_at", { ascending: false })
      .limit(1000); // chunked anyway

    if (error) throw new Error(`Supabase fetchLatestPlannerSteps failed: ${error.message}`);

    const rows = (data ?? []) as StepRow[];
    for (const r of rows) {
      if (!out.has(r.pipeline_id)) out.set(r.pipeline_id, r);
    }
  }

  return out;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bestPlannerJson(coderStep: StepRow, plannerStep?: StepRow): any {
  // Priority:
  // 1) coderStep.input.plan or planner
  // 2) plannerStep.output
  // 3) coderStep.input (whole)
  const input = coderStep.input ?? null;

  const candidate =
    input?.plan ??
    input?.planner ??
    input?.plannerJSON ??
    input?.context?.planner ??
    plannerStep?.output ??
    null;

  return candidate ?? input ?? plannerStep?.output ?? {};
}

async function buildCorpusFromSupabase(args: Args): Promise<{ corpusDir: string; cases: CorpusCase[] }> {
  const supabase = getSupabaseClient();

  const corpusDir = path.join(args.outDir, "corpus");
  ensureDir(corpusDir);

  const coderSteps = await fetchCoderSteps(supabase, {
    limit: args.limit,
    onlyFailed: args.onlyFailed,
    sinceDays: args.sinceDays,
  });

  const pipelineIdsUnique = [...new Set(coderSteps.map((s) => s.pipeline_id))];
  const pipelines = await fetchPipelinesByIds(supabase, pipelineIdsUnique);
  const plannerSteps = await fetchLatestPlannerSteps(supabase, pipelineIdsUnique);

  const cases: CorpusCase[] = [];

  for (const s of coderSteps) {
    const pipeline = pipelines.get(s.pipeline_id);
    const planner = plannerSteps.get(s.pipeline_id);

    const ts = s.created_at ?? new Date().toISOString();
    const caseId = `${s.pipeline_id}__${s.id.slice(0, 8)}__${ts.replace(/[:.]/g, "-")}`;
    const dir = path.join(corpusDir, caseId);
    ensureDir(dir);

    const meta = {
      caseId,
      pipeline: pipeline ?? { id: s.pipeline_id },
      coder_step: {
        id: s.id,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at,
      },
      planner_step: planner
        ? { id: planner.id, status: planner.status, created_at: planner.created_at, updated_at: planner.updated_at }
        : null,
    };

    const plannerJson = bestPlannerJson(s, planner);
    
    // Smart coderRaw: prioritize raw_output_text, then fallback to logs/output/input text
    const rawFromRawOutput = typeof s.raw_output_text === "string" ? s.raw_output_text : "";
    const rawFromLogs = typeof s.logs === "string" ? s.logs : "";
    const rawFromOutput = extractTextFromAnyOutput(s.output);
    const rawFromInput = extractTextFromAnyOutput(s.input);

    const coderRaw =
      (rawFromRawOutput && rawFromRawOutput.trim()) ||
      (rawFromLogs && rawFromLogs.trim()) ||
      (rawFromOutput && rawFromOutput.trim()) ||
      (rawFromInput && rawFromInput.trim()) ||
      "";
    
    const coderOutput = s.output ?? null;

    const metaPath = path.join(dir, "meta.json");
    const plannerPath = path.join(dir, "planner.json");
    const coderRawPath = path.join(dir, "coder_raw.txt");
    const coderOutputPath = path.join(dir, "coder_output.json");
    const coderInputPath = path.join(dir, "coder_input.json");
    const coderLogsPath = path.join(dir, "coder_logs.txt");
    const coderOutputFullPath = path.join(dir, "coder_output_full.json");

    writeJson(metaPath, meta);
    writeJson(plannerPath, plannerJson);
    writeUtf8(coderRawPath, coderRaw);
    writeJson(coderOutputPath, coderOutput);
    writeJson(coderInputPath, s.input ?? null);
    writeUtf8(coderLogsPath, rawFromLogs);
    writeJson(coderOutputFullPath, s.output ?? null);

    cases.push({
      caseId,
      pipelineId: s.pipeline_id,
      coderStepId: s.id,
      createdAt: s.created_at ?? undefined,
      dir,
      metaPath,
      plannerPath,
      coderRawPath,
      coderOutputPath,
    });
  }

  return { corpusDir, cases };
}

/* ----------------------------- Parsing Coder Output ----------------------------- */

function extractTextFromAnyOutput(output: any): string {
  if (!output) return "";
  if (typeof output === "string") return output;

  // Common: { text: "..." } or { content: "..." }
  if (typeof output.text === "string") return output.text;
  if (typeof output.content === "string") return output.content;

  // Anthropic style: { content: [{ type:"text", text:"..." }, ...] }
  if (Array.isArray(output.content)) {
    const parts = output.content
      .map((x: any) => (typeof x?.text === "string" ? x.text : ""))
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }

  // OpenAI style: { choices: [{ message: { content: "..." } }] }
  const c0 = output?.choices?.[0];
  const msg = c0?.message?.content;
  if (typeof msg === "string") return msg;

  // Some wrappers: { result: { text/content/... } }
  if (output.result) {
    const inner = extractTextFromAnyOutput(output.result);
    if (inner) return inner;
  }

  // Fallback: try a few obvious fields
  for (const k of ["raw", "final", "completion", "response", "output", "message"]) {
    if (typeof output?.[k] === "string") return output[k];
  }

  return "";
}

function extractFilesFromCoderJson(output: any): GenFile[] {
  if (!output) return [];
  if (typeof output === "string") return extractFilesFromRawText(output);

  const collected: GenFile[] = [];
  const seen = new Set<any>();
  const stack: any[] = [output];
  const MAX_NODES = 5000;

  const toFile = (x: any): GenFile | null => {
    const fp = x?.filePath ?? x?.path ?? x?.filename ?? x?.file ?? x?.name;
    const content = x?.content ?? x?.code ?? x?.text ?? x?.body ?? x?.source;
    if (typeof fp !== "string" || typeof content !== "string") return null;
    return { filePath: safeRelPath(fp), content: String(content) };
  };

  let nodes = 0;
  while (stack.length && nodes++ < MAX_NODES) {
    const node = stack.pop();
    if (!node) continue;

    if (typeof node === "object") {
      if (seen.has(node)) continue;
      seen.add(node);
    }

    // Array: might be files OR nested objects
    if (Array.isArray(node)) {
      for (const item of node) {
        const f = toFile(item);
        if (f) collected.push(f);
        stack.push(item);
      }
      continue;
    }

    if (typeof node === "object") {
      // Direct file object
      const f = toFile(node);
      if (f) collected.push(f);

      // Map { "app/page.tsx": "..." }
      for (const [k, v] of Object.entries(node)) {
        if (typeof k === "string" && k.includes("/") && typeof v === "string") {
          collected.push({ filePath: safeRelPath(k), content: v });
        } else {
          stack.push(v);
        }
      }
    }
  }

  return dedupeByPath(collected);
}

function inferFilePathNearIndex(fullText: string, idx: number): string | null {
  // Look back ~400 chars for a line that looks like a path (headings, bullets, "File:" etc)
  const start = Math.max(0, idx - 400);
  const window = fullText.slice(start, idx);

  const patterns = [
    /(?:^|\n)\s*(?:#+\s*)?([A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|sql|md|json|yml|yaml|css))\s*(?:\n|$)/g,
    /(?:^|\n)\s*(?:FILE|File|Path)\s*:\s*([A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|sql|md|json|yml|yaml|css))/g,
    /(?:^|\n)\s*-\s*([A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|sql|md|json|yml|yaml|css))/g,
  ];

  let best: string | null = null;
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(window)) !== null) {
      if (m[1]) best = m[1];
    }
  }
  return best ? safeRelPath(best) : null;
}

function extractFilesFromSectionedText(fullText: string): GenFile[] {
  const text = fullText ?? "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const headerRe =
    /^(?:#{1,6}\s*)?(?:(?:FILE|File|Path)\s*:?\s*)?([A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|sql|css|md|json|yml|yaml))\s*$/;

  const isMarkedHeader = (s: string) =>
    /^(#{1,6}\s)|^((FILE|File|Path)\s*:)/.test(s);

  const isPlausiblePath = (p: string) => {
    // Avoid treating "./globals.css" as header unless explicitly marked
    if (p.startsWith("./") || p.startsWith("../")) return false;
    // Most real files have dirs
    return p.includes("/") || p.startsWith("src/") || p.startsWith("app/") || p.startsWith("components/") || p.startsWith("lib/");
  };

  const files: GenFile[] = [];
  let currentPath: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (!currentPath) return;
    const content = buf.join("\n").replace(/^\s*\n+/, "").trimEnd() + "\n";
    if (content.trim().length > 0) {
      files.push({ filePath: safeRelPath(currentPath), content });
    }
    currentPath = null;
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lineAt(lines, i);
    if (!rawLine) continue;
    
    const line = rawLine.trim();
    const prevLine = lineAt(lines, i - 1);
    const prev = prevLine ? prevLine.trim() : "";

    const m = headerRe.exec(line);
    if (m) {
      const fp = m[1];
      if (!fp) continue;
      
      const marked = isMarkedHeader(line);
      const separated = prev.length === 0;

      // Accept:
      // - Marked headers always (FILE:/###)
      // - OR plausible paths that are separated by a blank line
      if (marked || (separated && isPlausiblePath(fp))) {
        flush();
        currentPath = fp;
        continue;
      }
    }

    if (currentPath) buf.push(rawLine);
  }

  flush();
  return dedupeByPath(files);
}

function extractFilesFromRawText(raw: string): GenFile[] {
  const text = raw ?? "";
  const files: GenFile[] = [];

  // 1) Try to parse raw as JSON (some models output JSON directly)
  const jsonCandidates = findJsonCandidates(text);
  for (const cand of jsonCandidates) {
    try {
      const obj = JSON.parse(cand);
      const parsed = extractFilesFromCoderJson(obj);
      if (parsed.length) return parsed;
    } catch {
      // ignore
    }
  }

  // 2) Parse markdown fences with filename hints
  // Supports:
  //   ```tsx file="app/page.tsx"
  //   ```ts filename=lib/x.ts
  //   ```app/page.tsx
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const info = (m[1] ?? "").trim();
    const body = (m[2] ?? "").trim();
    const parsed = parseFenceInfo(info);
    let filePath = parsed?.filePath;

    if (!filePath) {
      filePath = inferFilePathNearIndex(text, m.index) ?? undefined;
    }

    if (!filePath) continue;

    files.push({
      filePath: safeRelPath(filePath),
      content: stripTrailingNewlines(body),
      languageHint: parsed?.lang ?? undefined,
    });
  }

  // 3) Parse "FILE:" sections (common in "multi-file" outputs)
  // Example:
  //   FILE: app/page.tsx
  //   ```tsx
  //   ...
  //   ```
  const fileHeaderRe = /(?:^|\n)\s*(?:FILE|File|Path)\s*:\s*([^\n]+)\n([\s\S]*?)(?=\n\s*(?:FILE|File|Path)\s*:|\n?$)/g;
  while ((m = fileHeaderRe.exec(text)) !== null) {
    const fp = (m[1] ?? "").trim().replace(/^["']|["']$/g, "");
    const chunk = (m[2] ?? "").trim();

    // If chunk contains a fence, prefer fence content
    const fence = /```([^\n]*)\n([\s\S]*?)```/.exec(chunk);
    const content = fence ? stripTrailingNewlines(fence[2] ?? "") : chunk;

    if (fp && content) {
      files.push({ filePath: safeRelPath(fp), content });
    }
  }

  // 4) Fallback: sectioned format without fences (file path headers + content)
  if (files.length === 0) {
    const sectionFiles = extractFilesFromSectionedText(text);
    if (sectionFiles.length) return sectionFiles;
  }

  // 5) If we still have nothing, return empty (caller will error with actionable message)
  return dedupeByPath(files);
}

function stripTrailingNewlines(s: string) {
  return s.replace(/\s+$/g, "") + "\n";
}

function dedupeByPath(files: GenFile[]): GenFile[] {
  const map = new Map<string, GenFile>();
  for (const f of files) {
    if (!f.filePath) continue;
    if (!map.has(f.filePath)) map.set(f.filePath, f);
    else {
      // keep the larger content (often more complete)
      const prev = map.get(f.filePath)!;
      if ((f.content?.length ?? 0) > (prev.content?.length ?? 0)) map.set(f.filePath, f);
    }
  }
  return [...map.values()];
}

function parseFenceInfo(info: string): { lang?: string; filePath?: string } | null {
  if (!info) return null;

  // Case: ```app/page.tsx  (no lang, just file path)
  if (info.includes("/") && !info.includes("file=") && !info.includes("filename=")) {
    const parts = info.split(/\s+/).filter(Boolean);
    const first = parts[0];
    if (first && first.includes("/")) return { filePath: first };
  }

  // Case: ```tsx file="app/page.tsx"
  const langParts = info.split(/\s+/);
  const lang = langParts[0]?.trim();
  const fileMatch =
    /(?:file|filename|path)\s*=\s*["']([^"']+)["']/.exec(info) ??
    /(?:file|filename|path)\s*=\s*([^\s]+)/.exec(info);

  if (fileMatch && fileMatch[1]) return { lang, filePath: fileMatch[1] };

  // Case: ```tsx app/page.tsx
  const parts = info.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[1] && parts[1].includes("/")) {
    return { lang: parts[0] ?? undefined, filePath: parts[1] };
  }

  return { lang };
}

function findJsonCandidates(text: string): string[] {
  // We try:
  //  - whole text
  //  - fenced ```json blocks
  const out: string[] = [];
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) out.push(trimmed);

  const jsonFence = /```json\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = jsonFence.exec(text)) !== null) {
    const body = (m[1] ?? "").trim();
    if (body.startsWith("{") || body.startsWith("[")) out.push(body);
  }
  return out;
}

/* ----------------------------- Fixers + Policies ----------------------------- */

function looksLikeJsx(code: string): boolean {
  return /return\s*<|<\w+[^>]*>|className\s*=|<\/\w+>/.test(code);
}

function isApiRouteTs(filePath: string): boolean {
  // Next App Router API routes: app/api/**/route.ts
  const p = filePath.replace(/\\/g, "/");
  return p.startsWith("app/api/") && p.endsWith("/route.ts");
}

function isReactComponentArea(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  // Never rename API routes
  if (p.startsWith("app/api/")) return false;
  // Allow rename for all areas that might contain JSX
  if (p.startsWith("app/")) return true;
  if (p.startsWith("components/")) return true;
  if (p.startsWith("src/lib/")) return true;
  if (p.startsWith("src/actions/")) return true;
  if (p.startsWith("src/components/")) return true;
  return false;
}

function isProtectedOrForbiddenPath(filePath: string): { forbidden: boolean; reason?: string } {
  const p = filePath.replace(/\\/g, "/");

  // Hard blocks
  if (p.startsWith("node_modules/")) return { forbidden: true, reason: "node_modules is forbidden" };
  if (p.startsWith(".git/")) return { forbidden: true, reason: ".git is forbidden" };
  if (p.includes("\0")) return { forbidden: true, reason: "NUL byte in path" };

  // Dot-env & secrets
  if (p === ".env" || p === ".env.local" || p.endsWith("/.env") || p.endsWith("/.env.local")) {
    return { forbidden: true, reason: "env files are protected" };
  }

  return { forbidden: false };
}

function applyRenamePolicy(files: GenFile[]): {
  files: GenFile[];
  renamed: Array<{ from: string; to: string; reason: string }>;
} {
  const renamed: Array<{ from: string; to: string; reason: string }> = [];

  const out = files.map((f) => {
    const fp = safeRelPath(f.filePath);

    // Never rename API routes
    if (isApiRouteTs(fp)) return { ...f, filePath: fp };

    // If JSX in .ts inside component areas -> rename to .tsx
    if (fp.endsWith(".ts") && looksLikeJsx(f.content) && isReactComponentArea(fp)) {
      const to = fp.replace(/\.ts$/, ".tsx");
      renamed.push({ from: fp, to, reason: "JSX in .ts inside React area -> .tsx" });
      return { ...f, filePath: to };
    }

    return { ...f, filePath: fp };
  });

  return { files: out, renamed };
}

function buildRenameMap(renamed: Array<{ from: string; to: string }>) {
  const map = new Map<string, string>();
  for (const r of renamed) map.set(r.from, r.to);
  return map;
}

function rewriteImportsForRenames(files: GenFile[], renameMap: Map<string, string>) {
  const rewrites: Array<{ file: string; count: number }> = [];

  if (renameMap.size === 0) return { files, rewrites, total: 0 };

  const importRe = /(from\s+['"])([^'"]+)(['"])/g;
  const requireRe = /(require\(\s*['"])([^'"]+)(['"]\s*\))/g;

  function rewriteSpec(spec: string): string {
    // Only rewrite if explicit extension points to a renamed file.
    // If extensionless: leave as-is (Next/TS resolves).
    if (spec.endsWith(".ts")) {
      const maybe = spec.replace(/\\/g, "/");
      // We rewrite both direct matches and "./x.ts" style
      for (const [from, to] of renameMap.entries()) {
        // If spec ends with the from path, swap the extension.
        // This is best-effort; imports can be relative or aliased.
        if (maybe.endsWith(from)) return maybe.slice(0, -from.length) + to;
        if (maybe.endsWith(from.replace(/\.ts$/, ""))) return maybe; // extensionless should remain
      }
      // Simpler: just flip ".ts" -> ".tsx" if the map contains the same without dirs
      const base = path.posix.basename(maybe);
      const mapped = renameMap.get(base);
      if (mapped) return maybe.slice(0, -base.length) + mapped;
      // Otherwise: keep
      return spec;
    }
    return spec;
  }

  const out = files.map((f) => {
    let count = 0;
    let content = f.content;

    content = content.replace(importRe, (_m, a, spec, b) => {
      const next = rewriteSpec(spec);
      if (next !== spec) count++;
      return `${a}${next}${b}`;
    });

    content = content.replace(requireRe, (_m, a, spec, b) => {
      const next = rewriteSpec(spec);
      if (next !== spec) count++;
      return `${a}${next}${b}`;
    });

    if (count > 0) rewrites.push({ file: f.filePath, count });
    return { ...f, content };
  });

  const total = rewrites.reduce((sum, r) => sum + r.count, 0);
  return { files: out, rewrites, total };
}

/* ----------------------------- Validation ----------------------------- */

function validateFiles(files: GenFile[]) {
  const seen = new Set<string>();

  for (const f of files) {
    const fp = safeRelPath(f.filePath);

    if (!fp) throw new Error("validate: empty filePath");
    if (seen.has(fp)) throw new Error(`validate: duplicate filePath: ${fp}`);
    seen.add(fp);

    const forbidden = isProtectedOrForbiddenPath(fp);
    if (forbidden.forbidden) throw new Error(`validate: forbidden path "${fp}" (${forbidden.reason})`);

    // Hard correctness guards:
    if (fp.endsWith(".ts") && looksLikeJsx(f.content)) {
      // If this is in React area we should have renamed already; if it remains, it's wrong.
      throw new Error(`validate: JSX detected in .ts after renamePolicy: ${fp}`);
    }

    if (isApiRouteTs(fp) && fp.endsWith(".tsx")) {
      throw new Error(`validate: API route must not be .tsx: ${fp}`);
    }
  }

  if (files.length === 0) {
    throw new Error(
      "validate: parsed 0 files from coder output. Parser couldn't detect multi-file structure."
    );
  }
}

/* ----------------------------- Replay Engine ----------------------------- */

function writeSandbox(caseOutDir: string, files: GenFile[]) {
  ensureDir(caseOutDir);

  let bytes = 0;
  for (const f of files) {
    const rel = safeRelPath(f.filePath);
    const abs = safeJoin(caseOutDir, rel);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, f.content, "utf8");
    bytes += Buffer.from(f.content ?? "", "utf8").byteLength;
  }

  return bytes;
}

function runBasicChecksIfPossible(caseSandboxDir: string) {
  // These checks are best-effort:
  // - Only run if we see a package.json and a tsconfig.json in the sandbox root.
  // - We do NOT auto-install deps here (ultimate script focuses on coder-phase infra).
  const pkg = path.join(caseSandboxDir, "package.json");
  const tsconfig = path.join(caseSandboxDir, "tsconfig.json");

  if (!fs.existsSync(pkg) || !fs.existsSync(tsconfig)) return;

  const r = spawnSync("npm", ["run", "typecheck"], { cwd: caseSandboxDir, stdio: "pipe" });
  if (r.status !== 0) {
    const out = (r.stdout?.toString("utf8") ?? "") + "\n" + (r.stderr?.toString("utf8") ?? "");
    throw new Error(`basic-checks: typecheck failed\n${out.slice(0, 4000)}`);
  }
}

function fingerprintError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const firstLine = msg.split("\n")[0];
  if (!firstLine) return String(err).slice(0, 200);
  
  return firstLine
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/([A-Za-z]:)?[\\/][^\s:]+/g, "<path>")
    .slice(0, 200);
}

function hasMaterializedFiles(output: any): boolean {
  return Array.isArray(output?.files) &&
    output.files.some((f: any) => typeof f?.content === "string" && f.content.trim().length >= 20);
}

function detectPlanOnly(raw: string): { paths: string[] } | null {
  try {
    const obj = JSON.parse(raw);
    const plan = obj?.fileStructurePlan;
    if (!plan?.files || !Array.isArray(plan.files)) return null;

    const hasAnyContent = plan.files.some((f: any) => typeof f?.content === "string" && f.content.trim().length > 0);
    if (hasAnyContent) return null;

    const paths = plan.files.map((f: any) => f?.path).filter((p: any) => typeof p === "string");
    return { paths };
  } catch {
    return null;
  }
}

function categorizeError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("empty raw file") || m.includes("skipped")) return "data/empty-raw";
  if (m.includes("plan-only")) return "output/plan-only";
  if (m.includes("path traversal")) return "security/path-traversal";
  if (m.includes("forbidden path") || m.includes("protected")) return "security/protected-files";
  if (m.includes("jsx detected") || m.includes("tsx")) return "syntax/jsx-extension";
  if (m.includes("duplicate filepath")) return "integrity/duplicate-files";
  if (m.includes("parsed 0 files") || m.includes("parser")) return "parser/format-detection";
  if (m.includes("typecheck")) return "typecheck/tsc";
  return "unknown";
}

function checkCorpusHealth(corpusDir: string, strict: boolean = false): { emptyRawCount: number; emptyRawCases: string[] } {
  const dirs = fs
    .readdirSync(corpusDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(corpusDir, d.name));

  const emptyRawCases: string[] = [];
  let emptyRawCount = 0;

  for (const dir of dirs) {
    const caseId = path.basename(dir);
    const coderRawPath = path.join(dir, "coder_raw.txt");
    
    // Check standard path
    if (fs.existsSync(coderRawPath)) {
      const raw = fs.readFileSync(coderRawPath, "utf8");
      if (!raw || raw.trim().length === 0) {
        emptyRawCount++;
        emptyRawCases.push(caseId);
      }
    } else {
      // Check via readCaseRaw
      const { raw } = readCaseRaw(dir);
      if (!raw || raw.trim().length === 0) {
        emptyRawCount++;
        emptyRawCases.push(caseId);
      }
    }
  }

  if (emptyRawCount > 0) {
    console.log(`\n⚠️ CORPUS HEALTH CHECK:`);
    console.log(`   Found ${emptyRawCount} cases with empty coder_raw.txt:`);
    emptyRawCases.slice(0, 10).forEach((id) => console.log(`   - ${id}`));
    if (emptyRawCases.length > 10) {
      console.log(`   ... and ${emptyRawCases.length - 10} more`);
    }
    
    if (strict) {
      throw new CorpusHealthError(
        `Corpus health check failed: ${emptyRawCount} cases have empty coder_raw.txt. ` +
        `This indicates a broken dataset. Fix the generator or remove these cases.`
      );
    }
  } else {
    console.log(`\n✅ CORPUS HEALTH CHECK: All cases have non-empty raw files`);
  }

  return { emptyRawCount, emptyRawCases };
}

function loadCorpusCases(corpusDir: string): CorpusCase[] {
  const dirs = fs
    .readdirSync(corpusDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(corpusDir, d.name));

  const cases: CorpusCase[] = [];

  for (const dir of dirs) {
    const caseId = path.basename(dir);
    const metaPath = path.join(dir, "meta.json");
    const plannerPath = path.join(dir, "planner.json");
    const coderRawPath = path.join(dir, "coder_raw.txt");
    const coderOutputPath = path.join(dir, "coder_output.json");

    // ✅ Check if we have at least meta.json and planner.json
    // Raw file can be found via readCaseRaw() later
    if (!fs.existsSync(metaPath) || !fs.existsSync(plannerPath)) continue;
    
    // ✅ Check if we have any raw content (via readCaseRaw or standard path)
    const { raw } = readCaseRaw(dir);
    const hasStandardRaw = fs.existsSync(coderRawPath);
    if (!raw.trim() && !hasStandardRaw) continue;

    const meta = readJson<any>(metaPath);
    const pipelineId = meta?.pipeline?.id ?? meta?.pipelineId ?? "unknown";
    const coderStepId = meta?.coder_step?.id ?? meta?.coderStepId ?? "unknown";

    cases.push({
      caseId,
      pipelineId,
      coderStepId,
      createdAt: meta?.coder_step?.created_at ?? undefined,
      dir,
      metaPath,
      plannerPath,
      coderRawPath,
      coderOutputPath,
    });
  }

  return cases.sort((a, b) => a.caseId.localeCompare(b.caseId));
}

function replayOneCase(
  c: CorpusCase,
  args: Args,
  replayDir: string
): ReplayResult {
  const caseName = path.basename(c.dir);
  const expect = inferExpectationFromName(caseName);

  // ✅ Robust raw reader with fallback
  const { raw, source } = readCaseRaw(c.dir);
  if (!raw.trim()) {
    // Use standard path as fallback
    const fallbackRaw = fs.existsSync(c.coderRawPath) ? readUtf8(c.coderRawPath) : "";
    if (!fallbackRaw.trim()) {
      // rawSource=none betyder ofta att caset inte har ett rått LLM-svar, så parse-checken kan inte köras.
      throw new SkipCaseError(`validate: empty raw file (skipped) [rawSource=${source ?? "unknown"}]`);
    }
    // Use fallback
    const finalRaw = fallbackRaw;
    const planner = readJson<any>(c.plannerPath);
    const coderOutput = fs.existsSync(c.coderOutputPath) ? readJson<any>(c.coderOutputPath) : null;

    try {
      return replayOneCaseInner(finalRaw, planner, coderOutput, c, args, replayDir, expect, source);
    } catch (err: any) {
      return handleReplayError(err, c, expect, source);
    }
  }

  const planner = readJson<any>(c.plannerPath);
  const coderOutput = fs.existsSync(c.coderOutputPath) ? readJson<any>(c.coderOutputPath) : null;

  try {
    return replayOneCaseInner(raw, planner, coderOutput, c, args, replayDir, expect, source);
  } catch (err: any) {
    return handleReplayError(err, c, expect, source);
  }
}

function replayOneCaseInner(
  raw: string,
  planner: any,
  coderOutput: any,
  c: CorpusCase,
  args: Args,
  replayDir: string,
  expect: CaseExpectation,
  rawSource: string
): ReplayResult {

  // ✅ Detect plan-only output (before parsing)
  // But only if coderOutput doesn't already have materialized files
  const planOnly = detectPlanOnly(raw);
  if (planOnly && !hasMaterializedFiles(coderOutput)) {
    throw new Error(`validate: plan-only output (no file contents). paths=${JSON.stringify(planOnly.paths.slice(0, 25))}`);
  }

  // Parse: prefer structured output, fallback to raw parser
  let files = extractFilesFromCoderJson(coderOutput);

  if (files.length === 0) {
    const outText = extractTextFromAnyOutput(coderOutput);
    if (outText) files = extractFilesFromRawText(outText);
  }

  if (files.length === 0) {
    files = extractFilesFromRawText(raw);
  }

  // ✅ DIAGNOSTIC: When 0 files happen, throw with actionable diagnostics
  if (files.length === 0) {
    const outText = extractTextFromAnyOutput(coderOutput);
    const fenceCount = (raw.match(/```/g) ?? []).length / 2;
    const pathHits = (raw.match(/[A-Za-z0-9_.\/-]+\.(ts|tsx|js|jsx|sql|md|json|yml|yaml|css)/g) ?? []).slice(0, 20);

    throw new Error(
      `validate: parsed 0 files. rawLen=${raw.length}, outTextLen=${outText?.length ?? 0}, fences≈${fenceCount}, pathHits=${JSON.stringify(pathHits)}`
    );
  }

  // Normalize file paths (safeRelPath) already applied but enforce again
  files = files.map((f) => ({ ...f, filePath: safeRelPath(f.filePath) }));

  // Rename policy (JSX-in-.ts for component areas)
  const renameApplied = applyRenamePolicy(files);
  files = renameApplied.files;

  // Import rewrite to match renames
  const renameMap = buildRenameMap(renameApplied.renamed.map((r) => ({ from: r.from, to: r.to })));
  const importRewrite = rewriteImportsForRenames(files, renameMap);
  files = importRewrite.files;

  // Validate (fail-fast)
  validateFiles(files);

  // Write sandbox for this case
  const caseSandboxDir = path.join(replayDir, c.caseId, "sandbox");
  const bytesWritten = writeSandbox(caseSandboxDir, files);

  // Optional: checks (best effort)
  if (args.checks === "basic" || args.checks === "strict") {
    // Uses planner only as future hook (kept so you can log it if needed)
    void planner;
    runBasicChecksIfPossible(caseSandboxDir);
  }

  // ✅ Check if this was expected to fail but passed (regression)
  if (expect.kind !== "ok") {
    return {
      caseId: c.caseId,
      ok: false,
      errorKey: "Expected failure, but passed",
      errorCategory: "regression/unexpected-success",
      errorMessage: `Case was expected to fail with "${expect.value}" but passed validation`,
      stats: {
        parsedFiles: files.length,
        writtenFiles: files.length,
        renamedCount: renameApplied.renamed.length,
        importRewrites: importRewrite.total,
        bytesWritten,
      },
      autofixes: {
        renamed: renameApplied.renamed,
        importRewrites: importRewrite.rewrites,
      },
      debug: { rawSource },
    };
  }

  return {
    caseId: c.caseId,
    ok: true,
    stats: {
      parsedFiles: files.length,
      writtenFiles: files.length,
      renamedCount: renameApplied.renamed.length,
      importRewrites: importRewrite.total,
      bytesWritten,
    },
    autofixes: {
      renamed: renameApplied.renamed,
      importRewrites: importRewrite.rewrites,
    },
    debug: { rawSource },
  };
}

function handleReplayError(
  err: any,
  c: CorpusCase,
  expect: CaseExpectation,
  rawSource: string
): ReplayResult {
  const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
  const errorKey = fingerprintError(err);
  const errorCategory = categorizeError(msg);

  let outputKeys: string[] = [];
  try {
    const coderOutput = fs.existsSync(c.coderOutputPath) ? readJson<any>(c.coderOutputPath) : null;
    if (coderOutput && typeof coderOutput === "object") {
      outputKeys = Object.keys(coderOutput).slice(0, 50);
    }
  } catch {
    // ignore
  }

  // ✅ Check if this is an expected failure
  if (expect.kind === "errorKeyIncludes" && errorKey.includes(expect.value)) {
    // ✅ Expected failure -> treat as OK in regression mode
    return {
      caseId: c.caseId,
      ok: true,
      stats: { parsedFiles: 0, writtenFiles: 0, renamedCount: 0, importRewrites: 0, bytesWritten: 0 },
      expected: { kind: "matched", expect: expect.value, got: errorKey },
      debug: { rawSource },
    };
  }

  // ❌ Unexpected failure -> real regression
  return {
    caseId: c.caseId,
    ok: false,
    errorKey,
    errorCategory,
    errorMessage: msg.slice(0, 8000),
    debug: { outputKeys, rawSource },
  };
}

function replayAllCases(cases: CorpusCase[], args: Args): { results: ReplayResult[]; replayDir: string } {
  const replayDir = path.join(args.outDir, "replay");
  ensureDir(replayDir);

  const limited = args.replayLimit ? cases.slice(0, args.replayLimit) : cases;

  const results: ReplayResult[] = [];
  for (const c of limited) {
    try {
      // replayOneCase now handles most errors internally and returns ReplayResult
      results.push(replayOneCase(c, args, replayDir));
    } catch (err) {
      if (err instanceof SkipCaseError) {
        // ✅ Skip cases gracefully - log and continue
        console.warn(`⚠️ SKIP: ${c.caseId} - ${String(err.message)}`);
        // Optionally add a skipped result to track it
        results.push({
          caseId: c.caseId,
          ok: false,
          errorKey: "skipped",
          errorCategory: "data/skipped",
          errorMessage: err.message,
        });
        continue;
      }
      // ❌ Real errors should still fail
      throw err;
    }
  }

  return { results, replayDir };
}

/* ----------------------------- Report ----------------------------- */

function buildHeatmap(results: ReplayResult[]) {
  const map = new Map<string, { count: number; examples: string[]; category: string }>();

  for (const r of results) {
    if (r.ok) continue;
    const key = r.errorKey ?? "unknown";
    const category = r.errorCategory ?? "unknown";

    const item = map.get(key) ?? { count: 0, examples: [], category };
    item.count += 1;
    if (item.examples.length < 5) item.examples.push(r.caseId);
    item.category = category;
    map.set(key, item);
  }

  return [...map.entries()]
    .map(([errorKey, v]) => ({ errorKey, ...v }))
    .sort((a, b) => b.count - a.count);
}

function writeReports(
  args: Args,
  corpusDir: string,
  results: ReplayResult[],
  corpusHealth?: { emptyRawCount: number; emptyRawCases: string[] } | null
) {
  const reportDir = path.join(args.outDir, "report");
  ensureDir(reportDir);

  const heatmap = buildHeatmap(results);

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const skippedCount = results.filter((r) => r.errorKey === "skipped").length;

  const reportJson = {
    generatedAt: new Date().toISOString(),
    outDir: args.outDir,
    corpusDir,
    totals: { cases: results.length, ok: okCount, failed: failCount, skipped: skippedCount },
    corpusHealth: corpusHealth
      ? {
          emptyRawFiles: corpusHealth.emptyRawCount,
          emptyRawCases: corpusHealth.emptyRawCases.slice(0, 20), // Limit in JSON
        }
      : null,
    heatmap,
    results,
  };

  writeJson(path.join(reportDir, "report.json"), reportJson);

  const mdLines: string[] = [];
  mdLines.push(`# Ultimate Coder Debug Report`);
  mdLines.push(``);
  mdLines.push(`Generated: ${reportJson.generatedAt}`);
  mdLines.push(`Corpus: \`${corpusDir}\``);
  mdLines.push(`Out: \`${args.outDir}\``);
  mdLines.push(``);
  mdLines.push(`## Summary`);
  mdLines.push(`- Cases: **${results.length}**`);
  mdLines.push(`- OK: **${okCount}**`);
  mdLines.push(`- Failed: **${failCount}**`);
  mdLines.push(`- Skipped: **${skippedCount}**`);
  mdLines.push(``);
  
  // ✅ Corpus Health Section
  if (corpusHealth) {
    mdLines.push(`## Corpus Health`);
    mdLines.push(`- Empty \`coder_raw.txt\`: **${corpusHealth.emptyRawCount}**`);
    if (corpusHealth.emptyRawCount > 0) {
      mdLines.push(`  - Cases: ${corpusHealth.emptyRawCases.slice(0, 10).join(", ")}`);
      if (corpusHealth.emptyRawCases.length > 10) {
        mdLines.push(`  - ... and ${corpusHealth.emptyRawCases.length - 10} more`);
      }
    }
    mdLines.push(`- Skipped cases: **${skippedCount}**`);
    mdLines.push(``);
  }
  mdLines.push(`## Top Failure Heatmap`);
  if (heatmap.length === 0) {
    mdLines.push(`✅ No failures. Your coder-phase infra looks clean for this corpus.`);
  } else {
    for (const h of heatmap.slice(0, 25)) {
      mdLines.push(`- **${h.count}x** [${h.category}] \`${h.errorKey}\``);
      mdLines.push(`  - examples: ${h.examples.join(", ")}`);
    }
  }
  mdLines.push(``);
  mdLines.push(`## How to use this report (fix order)`);
  mdLines.push(`1) Fix the **#1 heatmap key** at the root cause (parser/policy/writer/validator).`);
  mdLines.push(`2) Re-run the script. The heatmap should collapse quickly (Pareto).`);
  mdLines.push(`3) Repeat until failures are near-zero, then enable deeper checks.`);
  mdLines.push(``);

  writeUtf8(path.join(reportDir, "report.md"), mdLines.join("\n"));

  return { reportDir };
}

/* ----------------------------- Main Orchestrator ----------------------------- */

export async function runUltimateCoderDebug(rawArgv: string[]) {
  const args = parseArgs(rawArgv);

  ensureDir(args.outDir);

  // ✅ Bulletproof: Always initialize corpusHealth to null
  let corpusHealth: { emptyRawCount: number; emptyRawCases: string[] } | null = null;

  let corpusDir = args.corpusDir;
  let cases: CorpusCase[] = [];

  if (corpusDir) {
    // ✅ Preflight: Corpus health check
    corpusHealth = checkCorpusHealth(corpusDir, args.healthStrict ?? false);
    
    cases = loadCorpusCases(corpusDir);
    if (cases.length === 0) throw new Error(`No cases found in corpus: ${corpusDir}`);
  } else {
    const extracted = await buildCorpusFromSupabase(args);
    corpusDir = extracted.corpusDir;
    cases = extracted.cases;
    
    // ✅ Preflight: Corpus health check (after extraction)
    if (corpusDir) {
      corpusHealth = checkCorpusHealth(corpusDir, args.healthStrict ?? false);
    }
  }

  // Replay
  const { results } = replayAllCases(cases, args);

  // Reports (always pass corpusHealth, even if null)
  const { reportDir } = writeReports(args, corpusDir!, results, corpusHealth);

  // Console summary
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  console.log("\n========== ULTIMATE CODER DEBUG ==========\n");
  console.log(`Out:       ${args.outDir}`);
  console.log(`Corpus:    ${corpusDir}`);
  console.log(`Cases:     ${results.length}`);
  console.log(`OK:        ${okCount}`);
  console.log(`Failed:    ${failCount}`);
  console.log(`Report:    ${path.join(reportDir, "report.md")}`);
  console.log(`JSON:      ${path.join(reportDir, "report.json")}\n`);

  if (failCount > 0) {
    console.log("Next move: öppna report.md och fixa topp-1 felklass först. 🔥\n");
  } else {
    console.log("Zero failures in this corpus ✅ (nu kan du slå på tyngre checks om du vill).\n");
  }
}

// Run as CLI
async function main() {
  await runUltimateCoderDebug(process.argv.slice(2));
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isDirectRun) {
  main().catch((e) => {
    console.error("❌ ultimate-coder-debug crashed:", e?.stack ?? e);
    process.exit(1);
  });
}

