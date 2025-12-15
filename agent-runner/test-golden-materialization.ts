import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureGoldenMaterialized } from "./lib/fortress/ensureGoldenMaterialized";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fnf-golden-"));

assert.strictEqual(ensureGoldenMaterialized(tmp, "next.config.js"), true);
assert.ok(fs.existsSync(path.join(tmp, "next.config.js")));

assert.strictEqual(ensureGoldenMaterialized(tmp, "src/lib/types.ts"), true);
const types = fs.readFileSync(path.join(tmp, "src/lib/types.ts"), "utf8");
assert.ok(types.includes("export type InvoiceData"));

console.log("✅ test-golden-materialization passed");

