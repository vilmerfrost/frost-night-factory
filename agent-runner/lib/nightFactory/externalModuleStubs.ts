// agent-runner/lib/nightFactory/externalModuleStubs.ts
import * as fs from 'fs';
import * as path from 'path';

export interface ExternalStubsOptions {
  workspaceRoot: string;
  missingModules: string[];
}

/**
 * Auto-generate declare module stubs when TypeScript complains about external packages
 * that are installed but TS can't resolve (common with moduleResolution: bundler).
 */
export async function ensureExternalModuleStubs(
  options: ExternalStubsOptions
): Promise<void> {
  const { workspaceRoot, missingModules } = options;

  if (missingModules.length === 0) return;

  const srcRoot = fs.existsSync(path.join(workspaceRoot, 'src'))
    ? path.join(workspaceRoot, 'src')
    : workspaceRoot;

  const typesDir = path.join(srcRoot, 'types');
  await fs.promises.mkdir(typesDir, { recursive: true });

  const stubFile = path.join(typesDir, 'external-modules.d.ts');
  let existing = '';
  if (fs.existsSync(stubFile)) {
    existing = await fs.promises.readFile(stubFile, 'utf8');
  }

  const lines = new Set(existing.split('\n').filter(Boolean));

  for (const mod of missingModules) {
    if (mod.startsWith('@/')) continue; // ignore internal modules
    const decl = `declare module '${mod}';`;
    const linesArray = Array.from(lines);
    if (!linesArray.some((l) => l.includes(`'${mod}'`))) {
      lines.add(decl);
      console.log('[External Stubs] Declared module', mod);
    }
  }

  if (lines.size > 0) {
    const content = Array.from(lines).join('\n') + '\n';
    await fs.promises.writeFile(stubFile, content, 'utf8');
    console.log(`[External Stubs] Updated ${stubFile} with ${lines.size} module declarations`);
  }
}

