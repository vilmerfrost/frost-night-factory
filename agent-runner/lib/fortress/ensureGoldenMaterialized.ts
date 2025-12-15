import fs from "node:fs";
import path from "node:path";

function writeFile(absPath: string, content: string) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, "utf8");
}

const FALLBACK_TEMPLATES: Record<string, string> = {
  "next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
`,
  "tailwind.config.ts": `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
`,
  "postcss.config.js": `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
  // ✅ Make types deterministic so imports never break
  "src/lib/types.ts": `export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type InvoiceData = {
  fileName: string;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string; // ISO 8601
  due_date: string; // ISO 8601
  currency: string;
  total_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  reference: string;
  line_items: InvoiceLineItem[];
  raw_text: string;
  confidence: number; // 0..1
};

export type InvoiceExtractionResult = InvoiceData;
`,
  // ✅ Kill the lib/api.ts JSX hell permanently
  "src/lib/api.ts": `export type ApiError = { message: string; status?: number };

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "Unknown error"; }
}

export async function postFormData<T>(
  url: string,
  form: FormData,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form, ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(\`HTTP \${res.status}: \${text || res.statusText}\`);
  }
  return (await res.json()) as T;
}
`,
};

export function ensureGoldenMaterialized(projectRoot: string, relPath: string): boolean {
  const normalized = relPath.replace(/\\\\/g, "/");
  const tpl = FALLBACK_TEMPLATES[normalized] ?? FALLBACK_TEMPLATES[path.basename(normalized)];
  if (!tpl) return false;

  const abs = path.join(projectRoot, normalized);
  writeFile(abs, tpl);
  return true;
}

