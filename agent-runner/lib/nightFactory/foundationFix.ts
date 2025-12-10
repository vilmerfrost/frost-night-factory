// agent-runner/lib/nightFactory/foundationFix.ts
import * as fs from 'fs';
import * as path from 'path';
import { NEXT15_TSCONFIG } from './next15Tsconfig';

export interface FoundationFixOptions {
  workspaceRoot: string;
}

/**
 * Runs all "grand strategy" foundation fixes that should always apply
 * to generated Next.js apps before TypeScript validation.
 */
export async function runFoundationFixes(
  options: FoundationFixOptions
): Promise<void> {
  const { workspaceRoot } = options;

  try {
    await enforceNext15Tsconfig(workspaceRoot);
  } catch (err: any) {
    console.warn(
      '[Foundation Fix] Failed to enforce Next 15 tsconfig. Continuing with existing config.',
      err?.message || err
    );
  }
}

/**
 * Ensures tsconfig.json matches our canonical Next 15 config.
 * This is where "exactConfig" used to explode. Now we use NEXT15_TSCONFIG.
 */
async function enforceNext15Tsconfig(workspaceRoot: string): Promise<void> {
  const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(tsconfigPath)) {
    try {
      const raw = await fs.promises.readFile(tsconfigPath, 'utf8');
      existing = JSON.parse(raw);
    } catch (err: any) {
      console.warn(
        '[Foundation Fix] Existing tsconfig.json is invalid JSON. Overwriting with canonical config.',
        err?.message || err
      );
    }
  }

  // Merge or replace depending on how strict you want to be.
  const nextConfig = {
    ...existing,
    ...NEXT15_TSCONFIG,
    compilerOptions: {
      ...(existing.compilerOptions as Record<string, unknown> | undefined),
      ...(NEXT15_TSCONFIG.compilerOptions as Record<string, unknown>),
    },
  };

  await fs.promises.writeFile(
    tsconfigPath,
    JSON.stringify(nextConfig, null, 2),
    'utf8'
  );

  console.log('[Foundation Fix] Enforced Next 15 tsconfig.json');
}

