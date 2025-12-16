// agent-runner/lib/nightFactory/missingImportScaffolder.ts
import * as fs from 'fs';
import * as path from 'path';
import { isLibFile } from '../jsx-detector';

export interface ScaffolderOptions {
  workspaceRoot: string;
}

/**
 * Scans project files for imports using '@/...' and auto-creates stub modules
 * for modules that do not exist yet (components + lib only).
 */
export async function scaffoldMissingImports(
  options: ScaffolderOptions
): Promise<void> {
  const { workspaceRoot } = options;

  const tsPaths = await collectSourceFiles(workspaceRoot);
  const imports = await collectAliasImports(tsPaths);

  const missing = await resolveMissingModules(workspaceRoot, imports);

  for (const mod of missing) {
    await createStubModule(workspaceRoot, mod);
  }
}

type ImportRecord = {
  fromPath: string;
  specifier: string; // '@/components/InvoiceList'
  namedImports: string[];
  defaultImport?: string;
};

type MissingModule = ImportRecord & {
  targetFile: string;
  kind: 'component' | 'lib' | 'unknown';
};

/**
 * Helper: collect TS/TSX source files.
 */
async function collectSourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const srcRoot = fs.existsSync(path.join(root, 'src'))
    ? path.join(root, 'src')
    : root;

  const includeDirs = ['app', 'components', 'lib', 'styles'];

  for (const dirName of includeDirs) {
    const dir = path.join(srcRoot, dirName);
    if (!fs.existsSync(dir)) continue;
    await walk(dir, result);
  }

  return result;

  async function walk(dir: string, acc: string[]) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, acc);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      ) {
        acc.push(full);
      }
    }
  }
}

/**
 * Helper: extract @/ imports via simple regex.
 */
async function collectAliasImports(files: string[]): Promise<ImportRecord[]> {
  const records: ImportRecord[] = [];
  const importRegex =
    /import\s+(.+?)\s+from\s+['"](@\/[^'"]+)['"];?/g;

  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf8');
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const clause = match[1].trim();
      const specifier = match[2].trim();

      const namedImports: string[] = [];
      let defaultImport: string | undefined;

      if (clause.startsWith('{')) {
        // import { A, B as C } from '@/...'
        const inner = clause.replace(/[{}]/g, '');
        for (const part of inner.split(',')) {
          const [name] = part.trim().split(/\s+as\s+/i);
          if (name) namedImports.push(name.trim());
        }
      } else if (clause.includes('{')) {
        // import Default, { A } from '@/...'
        const [defPart, namedPart] = clause.split('{');
        defaultImport = defPart.replace(/,/g, '').trim();
        const inner = namedPart.replace(/[{}]/g, '');
        for (const part of inner.split(',')) {
          const [name] = part.trim().split(/\s+as\s+/i);
          if (name) namedImports.push(name.trim());
        }
      } else {
        // import Default from '@/...'
        defaultImport = clause;
      }

      records.push({
        fromPath: file,
        specifier,
        namedImports,
        defaultImport,
      });
    }
  }

  return records;
}

/**
 * Resolve which modules truly don't exist.
 */
async function resolveMissingModules(
  workspaceRoot: string,
  imports: ImportRecord[]
): Promise<MissingModule[]> {
  const missing: MissingModule[] = [];
  const seen = new Set<string>();
  const srcRoot = fs.existsSync(path.join(workspaceRoot, 'src'))
    ? path.join(workspaceRoot, 'src')
    : workspaceRoot; // fallback for non-src projects

  for (const imp of imports) {
    const rel = imp.specifier.replace(/^@\//, ''); // e.g. 'components/InvoiceList'
    const noExtPath = path.join(srcRoot, rel);
    
    const kind: MissingModule['kind'] = rel.startsWith('components')
      ? 'component'
      : rel.startsWith('lib')
      ? 'lib'
      : 'unknown';
    
    // ✅ CRITICAL: Never create .tsx files for lib/ directories (prevents ghost stubs)
    const isLib = kind === 'lib' || isLibFile(noExtPath);
    
    // Prioritize .ts for lib files, .tsx for components
    const candidates = isLib
      ? [
          `${noExtPath}.ts`,
          path.join(noExtPath, 'index.ts'),
          `${noExtPath}.tsx`, // Fallback only
          path.join(noExtPath, 'index.tsx'), // Fallback only
        ]
      : [
          `${noExtPath}.tsx`,
          `${noExtPath}.ts`,
          path.join(noExtPath, 'index.tsx'),
          path.join(noExtPath, 'index.ts'),
        ];

    const exists = candidates.some((c) => fs.existsSync(c));
    if (exists) continue;

    const key = candidates[0];
    if (seen.has(key)) continue;
    seen.add(key);

    missing.push({
      ...imp,
      targetFile: candidates[0], // Will be .ts for lib files, .tsx for components
      kind,
    });
  }

  return missing;
}

/**
 * Create stub modules automatically.
 */
async function createStubModule(
  workspaceRoot: string,
  mod: MissingModule
): Promise<void> {
  const dir = path.dirname(mod.targetFile);
  await fs.promises.mkdir(dir, { recursive: true });

  let content = '';

  if (mod.kind === 'component') {
    content = buildComponentStub(mod);
  } else if (mod.kind === 'lib') {
    content = buildLibStub(mod);
  } else {
    content = buildGenericStub(mod);
  }

  await fs.promises.writeFile(mod.targetFile, content, 'utf8');

  console.log(
    '[Scaffolder] Created stub for missing module:',
    mod.specifier,
    '->',
    path.relative(workspaceRoot, mod.targetFile)
  );
}

function buildComponentStub(mod: MissingModule): string {
  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED STUB by Frost Night Factory`);
  lines.push(`// TODO: Implement ${mod.specifier} properly.`);
  lines.push(`import React from 'react';`);
  lines.push('');

  if (mod.defaultImport) {
    lines.push(
      `const ${mod.defaultImport}: React.FC<React.PropsWithChildren<{}>> = (props) => (<div>${mod.defaultImport} placeholder</div>);`
    );
    lines.push(`export default ${mod.defaultImport};`);
    lines.push('');
  }

  for (const name of mod.namedImports) {
    // Generate proper React component exports
    lines.push(
      `export const ${name}: React.FC<React.PropsWithChildren<{}>> = (props) => (<div>${name} placeholder</div>);`
    );
  }

  if (!mod.defaultImport && mod.namedImports.length === 0) {
    // ensure module has at least one export to avoid empty module errors
    lines.push(
      `export const Placeholder: React.FC<React.PropsWithChildren<{}>> = (props) => (<div>${mod.specifier} placeholder</div>);`
    );
  }

  return lines.join('\n');
}

function buildLibStub(mod: MissingModule): string {
  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED STUB by Frost Night Factory`);
  lines.push(`// TODO: Implement ${mod.specifier} logic.`);
  lines.push('');

  if (mod.defaultImport) {
    lines.push(
      `export default function ${mod.defaultImport}(..._args: unknown[]): void {`
    );
    lines.push(`  // placeholder lib function`);
    lines.push(`}`);
    lines.push('');
  }

  for (const name of mod.namedImports) {
    lines.push(
      `export function ${name}(..._args: unknown[]): void {`
    );
    lines.push(`  // placeholder lib function`);
    lines.push(`}`);
  }

  if (!mod.defaultImport && mod.namedImports.length === 0) {
    lines.push(`export const placeholder = true;`);
  }

  return lines.join('\n');
}

function buildGenericStub(mod: MissingModule): string {
  return buildLibStub(mod);
}

