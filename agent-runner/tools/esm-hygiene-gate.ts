import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath((import.meta as any).url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const IGNORE_DIRS = new Set(["node_modules", "dist", ".next", "workspace", ".git", "tools", "knowledge", "templates", "data"]);

// Ignore files that are configs/templates (not runtime code)
const IGNORE_PATTERNS = [
  /knowledge[\/\\]/,
  /templates[\/\\]/,
  /\.config\.(ts|js)$/,
  /golden-configs[\/\\]/,
];

function shouldIgnoreFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return IGNORE_PATTERNS.some(pattern => pattern.test(normalized));
}

function walk(dir: string, out: string[]) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), out);
        continue;
      }
      if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (shouldIgnoreFile(fullPath)) continue;
      out.push(fullPath);
    }
  } catch (error) {
    // Ignore permission errors or missing directories
  }
}

function removeComments(src: string): string {
  // Remove single-line comments
  src = src.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments (simple version)
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return src;
}

function main() {
  const files: string[] = [];
  walk(ROOT, files);

  const errors: string[] = [];

  for (const file of files) {
    try {
      const src = fs.readFileSync(file, "utf8");
      const srcWithoutComments = removeComments(src);

      // Ban require.main completely (ESM hazard) - but only in actual code, not comments
      if (srcWithoutComments.includes("require.main")) {
        errors.push(`${file}: contains require.main (ban)`);
      }

      // If file uses require(...), it MUST define createRequire-based require
      // Check in code without comments
      const usesRequireCall = /\brequire\s*\(/.test(srcWithoutComments);
      if (usesRequireCall) {
        const hasCreateRequire = /createRequire\s*\(/.test(src);
        const definesLocalRequire = /\bconst\s+require\s*=/.test(src) || /\blet\s+require\s*=/.test(src);
        if (!(hasCreateRequire && definesLocalRequire)) {
          errors.push(`${file}: uses require(...) but is missing local createRequire shim`);
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }

  if (errors.length) {
    console.error("❌ ESM Hygiene Gate FAILED:\n" + errors.map((e) => " - " + e).join("\n"));
    process.exit(1);
  }

  console.log("✅ ESM Hygiene Gate PASSED");
}

main();
