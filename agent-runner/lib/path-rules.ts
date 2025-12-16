// agent-runner/lib/path-rules.ts
/**
 * ✅ CENTRAL PATH RULES: Single source of truth for file path handling
 * Ensures consistent behavior across all stub generators and file operations
 */

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function hasSegment(n: string, seg: string): boolean {
  return n.split("/").includes(seg);
}

/**
 * Vår invariant: "lib-regeln" gäller för genererade appens src/lib/**.
 * (Om ni vill att den ska gälla fler lib-mappar senare, kan ni bredda här.)
 */
export function isSrcLibFile(filePath: string): boolean {
  const n = normalizePath(filePath);
  if (n.includes("/node_modules/")) return false;
  return /(^|\/)src\/lib(\/|$)/.test(n);
}

export function preferredExtensionForStub(filePath: string): ".ts" | ".tsx" {
  const n = normalizePath(filePath);

  // Lib-filer ska ALLTID vara .ts
  if (isSrcLibFile(n)) return ".ts";

  // Components är nästan alltid .tsx
  if (/(^|\/)src\/components(\/|$)/.test(n)) return ".tsx";

  // Default: .ts (säkrare än .tsx)
  return ".ts";
}

export function stripTsExtension(filePath: string): string {
  const n = normalizePath(filePath);

  // skydda .d.ts
  if (n.endsWith(".d.ts")) return n.slice(0, -5);

  return n.replace(/\.(tsx|ts)$/, "");
}

export function ensurePreferredExtension(filePath: string): string {
  const n = normalizePath(filePath);
  if (n.endsWith(".ts") || n.endsWith(".tsx")) return n;
  return `${n}${preferredExtensionForStub(n)}`;
}

