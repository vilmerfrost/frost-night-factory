import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

function ensureIndex(dirAbs: string): void {
  const indexTs = path.join(dirAbs, 'index.ts');
  const indexTsx = path.join(dirAbs, 'index.tsx');
  if (fs.existsSync(indexTs) || fs.existsSync(indexTsx)) return;

  const files = fs
    .readdirSync(dirAbs)
    .filter(f => /\.(ts|tsx)$/.test(f) && !/^index\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));

  if (files.length === 0) return;

  const lines: string[] = [];
  for (const f of files) {
    const base = f.replace(/\.(ts|tsx)$/, '');
    lines.push(`export * from './${base}';`);
  }

  fs.writeFileSync(indexTs, lines.join('\n') + '\n', 'utf8');
}

function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) return path.join(SRC, spec.slice(2));
  if (spec.startsWith('./') || spec.startsWith('../')) return path.resolve(path.dirname(fromFile), spec);
  return null;
}

const importRe = /\bfrom\s+['"]([^'"]+)['"]/g;

if (!fs.existsSync(SRC)) {
  console.log('⚠️ src directory not found, skipping auto-barrel');
  process.exit(0);
}

for (const file of walk(SRC)) {
  const txt = fs.readFileSync(file, 'utf8');
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(txt))) {
    const spec = m[1];
    const resolved = resolveSpecifier(file, spec);
    if (!resolved) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      ensureIndex(resolved);
    }
  }
}

console.log('✅ auto-barrel done');
