// =============================================================================
// TYPE REGISTRY AUTO-UPDATE - Scans codebase and updates TYPE_REGISTRY
// =============================================================================
// Run: npm run update-type-registry

import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TypeEntry {
  from: string;
  kind: 'interface' | 'type';
}

/**
 * Scan codebase and automatically update TYPE_REGISTRY
 */
async function updateTypeRegistry(srcDir: string): Promise<void> {
  const registry: Record<string, TypeEntry> = {};

  console.log(`🔍 Scanning ${srcDir} for exported types...`);

  // Find all .ts files
  const files = await findTypeScriptFiles(srcDir);
  console.log(`   Found ${files.length} TypeScript files`);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // Extract exported types/interfaces
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
          const name = node.name.text;
          const relativePath = getRelativePath(srcDir, file);
          
          registry[name] = {
            from: relativePath,
            kind: 'interface'
          };
        }

        if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
          const name = node.name.text;
          const relativePath = getRelativePath(srcDir, file);
          
          registry[name] = {
            from: relativePath,
            kind: 'type'
          };
        }
      });
    } catch (error: any) {
      console.warn(`   ⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }

  // Write updated registry
  const registryCode = `// =============================================================================
// TYPE REGISTRY - Central registry of all types available in the codebase
// =============================================================================
// AUTO-GENERATED - Do not edit manually
// Run: npm run update-type-registry
// Generated: ${new Date().toISOString()}

/**
 * Central registry of all types available in the codebase
 * Format: { typeName: { from: modulePath, kind: 'interface' | 'type' } }
 */
export const TYPE_REGISTRY = ${JSON.stringify(registry, null, 2)} as const;

/**
 * Generate import statement for a type
 */
export function getImportForType(typeName: string): string | null {
  const entry = TYPE_REGISTRY[typeName as keyof typeof TYPE_REGISTRY];
  if (!entry) return null;
  return \`import type { \${typeName} } from '\${entry.from}';\`;
}

/**
 * Get all types from a module
 */
export function getTypesFromModule(modulePath: string): string[] {
  return Object.entries(TYPE_REGISTRY)
    .filter(([_, meta]) => meta.from === modulePath)
    .map(([name]) => name);
}

/**
 * Check if a type exists in registry
 */
export function typeExists(typeName: string): boolean {
  return typeName in TYPE_REGISTRY;
}

/**
 * Get all available types as formatted string for AI prompts
 */
export function getTypeRegistryPrompt(): string {
  return Object.entries(TYPE_REGISTRY)
    .map(([name, meta]) => \`- \${name}: import type { \${name} } from '\${meta.from}';\`)
    .join('\\n');
}
`;

  // Determine registry path - always relative to scripts/ directory
  // When run from agent-runner via `tsx ../scripts/update-type-registry.ts`,
  // __dirname will be the scripts/ directory, so we go up one level to root
  const registryPath = path.join(__dirname, '../lib/nightFactory/type-registry.ts');
  
  await fs.writeFile(registryPath, registryCode, 'utf-8');

  console.log(`✅ Type registry updated with ${Object.keys(registry).length} types`);
  console.log(`   Saved to: ${registryPath}`);
  
  if (Object.keys(registry).length === 0) {
    console.warn(`   ⚠️ No types found! Check that srcDir is correct: ${srcDir}`);
  }
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m: ts.Modifier) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function getRelativePath(baseDir: string, filePath: string): string {
  let relative = path.relative(baseDir, filePath)
    .replace(/\\/g, '/')
    .replace(/\.ts$/, '')
    .replace(/\.tsx$/, '');
  
  // Ensure it starts with ./
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }
  
  return relative;
}

async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .next, dist, build
      if (entry.isDirectory()) {
        if (['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
          continue;
        }
        files.push(...await findTypeScriptFiles(fullPath));
      } else if (
        entry.isFile() && 
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && 
        !entry.name.endsWith('.d.ts') &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory might not exist, skip
  }

  return files;
}

// Main execution
async function main() {
  // Determine src directory - check if running from agent-runner or root
  let srcDir = process.argv[2];
  
  if (!srcDir) {
    // Auto-detect: __dirname will be scripts/ directory regardless of where it's called from
    // Go up one level from scripts/ to get to root, then to src
    const rootDir = path.dirname(__dirname);
    srcDir = path.join(rootDir, 'src');
  }
  
  console.log('🏗️  Updating Type Registry...\n');
  console.log(`   Script location: ${__dirname}`);
  console.log(`   Source directory: ${srcDir}\n`);
  
  try {
    await updateTypeRegistry(srcDir);
    console.log('\n✅ Done!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { updateTypeRegistry };

