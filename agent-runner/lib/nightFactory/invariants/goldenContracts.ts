import * as fs from "fs/promises";
import * as path from "path";
import * as ts from "typescript";
import { atomicWriteFile, exists } from "./atomicWrite";

export type GoldenContract = {
  /** Project file path (posix) e.g. "src/lib/types.ts" */
  file: string;
  /** Template path (posix, relative to agent-runner root) e.g. "templates/fortress/types.ts" */
  template: string;
  /** Required export names. Use "default" for default export requirement */
  requiredExports: string[];
};

export const GOLDEN_CONTRACTS: GoldenContract[] = [
  {
    file: "src/lib/types.ts",
    template: "templates/fortress/types.ts",
    requiredExports: [
      "Invoice",           // App-layer model (camelCase)
      "Invoices",          // DB-layer model (snake_case, auto-generated)
      "InvoiceData", 
      "InvoiceItem", 
      "InvoiceStatus", 
      "CurrencyCode", 
      "ValidationResult",
      "Nullable",
      "Optional",
      "AsyncResult",
      "ApiResponse",
      "PaginatedResponse"
    ],
  },
  {
    file: "src/lib/config.ts",
    template: "templates/fortress/config.ts",
    requiredExports: ["appConfig", "apiConfig"],
  },
  {
    file: "src/lib/extraction.ts",
    template: "templates/fortress/extraction.ts",
    requiredExports: ["extractInvoiceData"],
  },
  {
    file: "src/lib/ai-extractor.ts",
    template: "templates/fortress/ai-extractor.ts",
    requiredExports: ["extractWithAI"],
  },
  {
    file: "src/lib/fallback-extractor.ts",
    template: "templates/fortress/fallback-extractor.ts",
    requiredExports: ["fallbackExtractor"],
  },
  {
    file: "src/lib/pdf-loader.ts",
    template: "templates/fortress/pdf-loader.ts",
    requiredExports: ["PDFLoader"],
  },
  {
    file: "src/lib/db-mappers.ts",
    template: "templates/fortress/db-mappers.ts",
    requiredExports: ["dbToInvoice", "invoiceToDb", "dbToInvoiceArray"],
  },
  {
    file: "src/lib/supabase/client.ts",
    template: "templates/fortress/supabase-client.ts",
    requiredExports: ["createClient", "createBrowserClient", "supabaseClient"],
  },
  {
    file: "src/lib/supabase/server.ts",
    template: "templates/fortress/supabase-server.ts",
    requiredExports: ["createClient", "createServerComponentClient"],
  },
  {
    file: "src/lib/supabase/server-client.ts",
    template: "templates/fortress/supabase-server.ts",
    requiredExports: ["createClient", "createServerComponentClient"],
  },
  {
    file: "src/lib/auth/session.ts",
    template: "templates/fortress/auth-session.ts",
    requiredExports: ["getUserSession"],
  },
  {
    file: "src/lib/extractors/ai-extractor.ts",
    template: "templates/fortress/ai-extractor.ts",
    requiredExports: ["extractWithAI"],
  },
  {
    file: "src/lib/extractors/aiExtractor.ts",
    template: "templates/fortress/ai-extractor.ts",
    requiredExports: ["extractWithAI"],
  },
  // Add more if you want: validators, api index, etc.
];

function toFileNameSafe(x: unknown, fallback = "unknown.ts"): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).path === "string") return (x as any).path;
  return fallback;
}

function collectExportsFromTs(content: string, fileName: string): Set<string> {
  const safe = toFileNameSafe(fileName, "golden-contracts.ts");
  const sf = ts.createSourceFile(safe, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Set<string>();

  const visit = (node: ts.Node) => {
    // export default ...
    if (ts.isExportAssignment(node)) {
      out.add("default");
    }

    // export function foo() {}
    if (ts.isFunctionDeclaration(node) && node.name) {
      const mods = ts.getModifiers(node);
      if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) out.add(node.name.text);
    }

    // export const foo = ...
    if (ts.isVariableStatement(node)) {
      const mods = ts.getModifiers(node);
      if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) out.add(decl.name.text);
        }
      }
    }

    // export interface/type/class/enum
    if (
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      const mods = ts.getModifiers(node);
      if (mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && node.name) {
        out.add(node.name.text);
      }
    }

    // export { A, B as C }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) {
        out.add(el.name.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return out;
}

function stubForExport(name: string): string {
  if (name === "default") return `export default function DefaultExport(){ return null as any; }\n`;
  if (/^[A-Z]/.test(name)) {
    if (name.endsWith("Data") || name.endsWith("Result")) return `export interface ${name} { [key: string]: any }\n`;
    return `export const ${name} = {} as any;\n`;
  }
  return `export const ${name} = {} as any;\n`;
}

function injectContractBlock(original: string, missing: string[]): string {
  const START = "// === AUTO_CONTRACT_START ===";
  const END = "// === AUTO_CONTRACT_END ===";

  const block = [
    START,
    "// This block is maintained by Frost Night Factory (DO NOT hand-edit exports here)",
    ...missing.map((m) => stubForExport(m).trimEnd()),
    END,
    "",
  ].join("\n");

  if (original.includes(START) && original.includes(END)) {
    // Replace existing block entirely (idempotent)
    const before = original.split(START)[0];
    const after = original.split(END)[1] ?? "";
    return before + block + after;
  }

  // Append at end if no block exists
  return original.trimEnd() + "\n\n" + block;
}

/**
 * Ensures template contains required exports. Patches template on disk (agent-runner repo).
 */
export async function ensureGoldenContractTemplate(
  agentRunnerRoot: string,
  contract: GoldenContract
): Promise<{ patched: boolean; missing: string[] }> {
  const templateAbs = path.join(agentRunnerRoot, contract.template.replace(/\//g, path.sep));

  const templateExists = await exists(templateAbs);
  if (!templateExists) {
    // Create a minimal template if missing (still deterministic)
    const seed = `// Fortress template auto-created for ${contract.file}\n\n`;
    await atomicWriteFile(templateAbs, seed);
  }

  const current = await fs.readFile(templateAbs, "utf8");
  const exportsFound = collectExportsFromTs(current, templateAbs);

  const missing = contract.requiredExports.filter((e) => !exportsFound.has(e));
  if (missing.length === 0) return { patched: false, missing: [] };

  const patched = injectContractBlock(current, missing);
  await atomicWriteFile(templateAbs, patched);
  return { patched: true, missing };
}

/**
 * Writes the template content into the sandbox project file (current run),
 * so the pipeline *immediately* benefits (not only future runs).
 */
export async function writeGoldenFileFromTemplate(
  agentRunnerRoot: string,
  projectRoot: string,
  contract: GoldenContract
): Promise<void> {
  const templateAbs = path.join(agentRunnerRoot, contract.template.replace(/\//g, path.sep));
  const projectAbs = path.join(projectRoot, contract.file.replace(/\//g, path.sep));

  const template = await fs.readFile(templateAbs, "utf8");
  await atomicWriteFile(projectAbs, template);
}
