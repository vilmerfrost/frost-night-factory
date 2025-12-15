import * as path from "path";
import * as ts from "typescript";

type LibNoJsxResult =
  | { ok: true; content: string }
  | { ok: false; content: string; reason: string; detected: string[] };

function isLibFile(relPathPosix: string): boolean {
  const p = relPathPosix.replace(/\\/g, "/");
  return p.startsWith("src/lib/") && (p.endsWith(".ts") || p.endsWith(".tsx"));
}

function looksLikeRealJsx(text: string): boolean {
  // Avoid false positives from generics/type assertions: require a "real JSX marker"
  // - closing tag </
  // - self-closing />
  // - JSX attribute pattern "className=" etc.
  return text.includes("</") || text.includes("/>") || /className\s*=|style\s*=|onClick\s*=/.test(text);
}

function toFileNameSafe(x: unknown, fallback = "unknown.ts"): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).path === "string") return (x as any).path;
  return fallback;
}

function detectJsxNodes(content: string, fileNameForParser: string): { has: boolean; samples: string[] } {
  if (!looksLikeRealJsx(content)) return { has: false, samples: [] };

  // Parse as TSX ONLY for detection (does not mean we allow TSX)
  const safe = toFileNameSafe(fileNameForParser, "lib-no-jsx.tsx");
  const sf = ts.createSourceFile(
    safe,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const samples: string[] = [];
  let found = false;

  const visit = (node: ts.Node) => {
    if (
      ts.isJsxElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      found = true;
      const text = node.getText(sf).slice(0, 120);
      samples.push(text);
      if (samples.length >= 5) return; // cap
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return { has: found, samples };
}

function stubExport(name: string): string {
  // Heuristics to keep compilation happy
  if (name === "default") {
    return `export default function DefaultExport() { throw new Error("default export stub"); }\n`;
  }
  if (/^[A-Z]/.test(name)) {
    // Type-ish or Component-ish
    if (name.endsWith("Data") || name.endsWith("Result") || name.endsWith("Props")) {
      return `export interface ${name} { [key: string]: any }\n`;
    }
    return `export const ${name} = {} as any;\n`;
  }
  if (name.startsWith("use")) {
    return `export function ${name}(..._args: any[]): any { return null as any; }\n`;
  }
  if (name.startsWith("is") || name.startsWith("has")) {
    return `export function ${name}(..._args: any[]): boolean { return false; }\n`;
  }
  return `export function ${name}(..._args: any[]): any { throw new Error("${name} not implemented"); }\n`;
}

function buildDeterministicLibStub(relPathPosix: string): string {
  const p = relPathPosix.replace(/\\/g, "/");

  // Special-case the ones we KNOW your app imports (from your log)
  if (p.includes("src/lib/api/invoice")) {
    return `// AUTO-STUB (LIB_NO_JSX): ${p}
import type { InvoiceData, ValidationResult } from "@/lib/types";

export async function extractInvoiceFromPDF(_file: File): Promise<InvoiceData> {
  throw new Error("extractInvoiceFromPDF not implemented (auto-stub)");
}

export async function saveInvoiceData(_data: InvoiceData): Promise<void> {
  throw new Error("saveInvoiceData not implemented (auto-stub)");
}

export function validateInvoiceData(_data: unknown): ValidationResult {
  return { valid: false, errors: ["validateInvoiceData auto-stub"] };
}
`;
  }

  if (p.includes("src/lib/claude")) {
    return `// AUTO-STUB (LIB_NO_JSX): ${p}
export async function callClaude(_prompt: string): Promise<string> {
  throw new Error("callClaude not implemented (auto-stub)");
}
`;
  }

  if (p.includes("src/lib/config")) {
    return `// AUTO-STUB (LIB_NO_JSX): ${p}
export const appConfig = {
  env: process.env.NODE_ENV ?? "development",
} as const;

export const apiConfig = {
  timeoutMs: 30000,
  retries: 2,
} as const;
`;
  }

  // Generic lib fallback
  const base = path.basename(p).replace(/\.(ts|tsx)$/, "");
  return `// AUTO-STUB (LIB_NO_JSX): ${p}
export const ${base} = {} as any;
`;
}

/**
 * Enforces: any src/lib/**.ts(x) must not contain JSX.
 * If JSX is detected, we DO NOT retry LLM. We deterministically stub.
 */
export function enforceLibNoJsxInvariant(relPathPosix: string, content: string): LibNoJsxResult {
  if (!isLibFile(relPathPosix)) return { ok: true, content };

  const det = detectJsxNodes(content, relPathPosix);
  if (!det.has) return { ok: true, content };

  const stub = buildDeterministicLibStub(relPathPosix);
  return {
    ok: false,
    content: stub,
    reason: `JSX detected in lib file (${relPathPosix}). Replaced with deterministic stub.`,
    detected: det.samples,
  };
}

/**
 * Optional helper: if ImportHealer finds missing exports in a lib module,
 * we can generate stubs for specific exports deterministically.
 */
export function buildLibStubWithExports(relPathPosix: string, exportsNeeded: string[]): string {
  const header = `// AUTO-STUB (MISSING_EXPORTS): ${relPathPosix}\n`;
  const body = exportsNeeded.map(stubExport).join("");
  return header + body;
}
