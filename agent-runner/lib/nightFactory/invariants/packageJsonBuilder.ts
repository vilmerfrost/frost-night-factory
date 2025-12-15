import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { atomicWriteFile, exists } from "./atomicWrite";

const PackageJsonSchema = z.object({
  name: z.string(),
  private: z.boolean(),
  version: z.string(),
  scripts: z.record(z.string(), z.string()).default({}),
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({}),
});

type PackageJson = z.infer<typeof PackageJsonSchema>;

/**
 * Pinned (exact) versions to avoid “floating” dependency drift.
 * Update these when *you* choose, not when npm feels like it.
 */
const PINNED: Record<string, string> = {
  next: "16.0.7",
  react: "19.0.0",
  "react-dom": "19.0.0",
  "lucide-react": "0.400.0",
  tailwindcss: "3.4.15",
  autoprefixer: "10.4.20",
  postcss: "8.4.47",
  sonner: "1.5.0",
};

const DEFAULT_SCRIPTS: Record<string, string> = {
  dev: "next dev",
  build: "next build",
  start: "next start",
  lint: "next lint",
  typecheck: "tsc -p tsconfig.json --noEmit",
};

const DEFAULT_DEV_DEPS: Record<string, string> = {
  typescript: "5.6.3",
  "@types/node": "20.17.9",
  "@types/react": "19.0.0",
  "@types/react-dom": "19.0.0",
};

function normalizePackageName(pkg: string): string {
  return pkg.trim();
}

export function buildDeterministicPackageJson(opts: {
  name?: string;
  extraDependencies?: string[];
  extraDevDependencies?: string[];
}): PackageJson {
  const name = opts.name ?? "generated-app";
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = { ...DEFAULT_DEV_DEPS };

  // Always include core stack
  for (const core of ["next", "react", "react-dom"]) {
    deps[core] = PINNED[core] ?? "0.0.0";
  }

  // Add extras (dependencies)
  for (const d of opts.extraDependencies ?? []) {
    const pkg = normalizePackageName(d);
    if (!pkg) continue;
    deps[pkg] = PINNED[pkg] ?? "latest";
  }

  // Add extras (devDependencies)
  for (const d of opts.extraDevDependencies ?? []) {
    const pkg = normalizePackageName(d);
    if (!pkg) continue;
    devDeps[pkg] = PINNED[pkg] ?? "latest";
  }

  // If you use Tailwind, keep it deterministic too
  if (deps["tailwindcss"] || deps["postcss"] || deps["autoprefixer"]) {
    deps["tailwindcss"] = PINNED["tailwindcss"];
    deps["postcss"] = PINNED["postcss"];
    deps["autoprefixer"] = PINNED["autoprefixer"];
  }

  const pkg: PackageJson = {
    name,
    private: true,
    version: "0.0.0",
    scripts: { ...DEFAULT_SCRIPTS },
    dependencies: deps,
    devDependencies: devDeps,
  };

  // Validate (and fill defaults if needed)
  return PackageJsonSchema.parse(pkg);
}

export async function writeDeterministicPackageJson(projectRoot: string, opts: {
  name?: string;
  extraDependencies?: string[];
  extraDevDependencies?: string[];
}): Promise<void> {
  const pkgPath = path.join(projectRoot, "package.json");
  const built = buildDeterministicPackageJson(opts);

  const json = JSON.stringify(built, null, 2) + "\n";
  await atomicWriteFile(pkgPath, json);

  // Hard invariant: never accept LLM-writes of package.json
  // If some other step tries to “repair” it later, we overwrite again.
}

export async function ensurePackageJsonExists(projectRoot: string): Promise<void> {
  const pkgPath = path.join(projectRoot, "package.json");
  if (await exists(pkgPath)) return;
  await writeDeterministicPackageJson(projectRoot, {});
}

export async function readPackageJsonIfValid(projectRoot: string): Promise<PackageJson | null> {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw);
    return PackageJsonSchema.safeParse(parsed).success ? PackageJsonSchema.parse(parsed) : null;
  } catch {
    return null;
  }
}
