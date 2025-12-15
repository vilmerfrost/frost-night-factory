/**
 * Selftest for Ultimate Coder Debugger
 * -----------------------------------
 * Creates a synthetic corpus with multiple coder-output formats and known failure modes,
 * then runs the ultimate debugger in offline (--corpus) mode.
 *
 * Run:
 *   tsx agent-runner/scripts/ultimate-coder-debug.selftest.ts
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runUltimateCoderDebug } from "./ultimate-coder-debug";

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

function mkCase(root: string, caseId: string, planner: any, coderRaw: string, coderOutput: any) {
  const dir = path.join(root, caseId);
  ensureDir(dir);

  // ✅ Invariant: good_json_array cases must have non-empty coder_raw.txt
  let finalCoderRaw = coderRaw;
  if (caseId.includes("good_json_array")) {
    if (coderOutput && Array.isArray(coderOutput)) {
      // Write same payload to coder_raw.txt as JSON string
      finalCoderRaw = JSON.stringify({ files: coderOutput }, null, 2);
    } else if (typeof coderOutput === "object" && coderOutput !== null) {
      // If it's already an object, stringify it
      finalCoderRaw = JSON.stringify(coderOutput, null, 2);
    }
    
    if (!finalCoderRaw || finalCoderRaw.trim().length === 0) {
      throw new Error(`Invariant violation: caseId "${caseId}" contains "good_json_array" but coder_raw.txt would be empty`);
    }
  }

  writeJson(path.join(dir, "meta.json"), {
    caseId,
    pipeline: { id: "selftest" },
    coder_step: { id: caseId, status: "failed", created_at: new Date().toISOString() },
  });
  writeJson(path.join(dir, "planner.json"), planner);
  writeUtf8(path.join(dir, "coder_raw.txt"), finalCoderRaw);
  writeJson(path.join(dir, "coder_output.json"), coderOutput);

  // ✅ Post-write invariant check: verify coder_raw.txt is non-empty for good_json_array cases
  if (caseId.includes("good_json_array")) {
    const writtenRaw = fs.readFileSync(path.join(dir, "coder_raw.txt"), "utf8");
    if (!writtenRaw || writtenRaw.trim().length === 0) {
      throw new Error(`Invariant violation: caseId "${caseId}" contains "good_json_array" but coder_raw.txt is empty after write`);
    }
  }
}

async function main() {
  const out = path.join(os.tmpdir(), `ultimate-coder-selftest-${Date.now().toString(16)}`);
  const corpus = path.join(out, "corpus");
  ensureDir(corpus);

  const planner = { project_overview: { name: "Selftest App" } };

  // Case 1: Good JSON output (array of files)
  mkCase(
    corpus,
    "case_good_json_array",
    planner,
    "",
    [
      { filePath: "app/page.tsx", content: "export default function Page(){ return <div>Hello</div>; }\n" },
      { filePath: "app/layout.tsx", content: "export default function Layout({children}:{children:any}){ return <div>{children}</div>; }\n" },
    ]
  );

  // Case 2: Markdown fences with file="..." (JSX in .ts in app -> should auto-rename to .tsx)
  mkCase(
    corpus,
    "case_jsx_in_ts_app_autorename",
    planner,
    [
      "```ts file=\"app/page.ts\"",
      "export default function Page(){ return <div>Hi</div> }",
      "```",
    ].join("\n"),
    null
  );

  // Case 3: JSX in .ts in lib -> should FAIL (policy should NOT rename)
  mkCase(
    corpus,
    "case_jsx_in_ts_lib_should_fail",
    planner,
    [
      "```ts file=\"lib/types.ts\"",
      "export const X = () => <div/>;",
      "```",
    ].join("\n"),
    null
  );

  // Case 4: Forbidden .env write -> FAIL
  mkCase(
    corpus,
    "case_forbidden_env",
    planner,
    [
      "```txt file=\".env\"",
      "SUPABASE_URL=lol",
      "```",
    ].join("\n"),
    null
  );

  // Case 5: Path traversal -> FAIL
  mkCase(
    corpus,
    "case_path_traversal",
    planner,
    [
      "```ts file=\"../evil.ts\"",
      "console.log('nope')",
      "```",
    ].join("\n"),
    null
  );

  console.log("\nRunning selftest corpus at:", corpus);

  await runUltimateCoderDebug([
    "--corpus",
    corpus,
    "--out",
    out,
    "--checks",
    "none",
  ]);

  console.log("\n✅ Selftest completed. Check report in:", path.join(out, "report", "report.md"));
}

main().catch((e) => {
  console.error("❌ selftest failed:", e?.stack ?? e);
  process.exit(1);
});

