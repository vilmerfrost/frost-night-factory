// =============================================================================
// SCAFFOLD AGENT - Lays the foundation before AI builds
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { GOLDEN_COMPONENTS } from '../../agent-runner/lib/golden-components';

/**
 * Fix import paths: Replace relative paths with @/ alias
 */
function fixImportPaths(content: string): string {
  // Replace relative imports like '../../lib/utils' with '@/lib/utils'
  content = content.replace(
    /from\s+['"]\.\.\/.*\/lib\/utils['"]/g,
    "from '@/lib/utils'"
  );
  
  // Replace relative imports like '../../../components/ui/Button' with '@/components/ui/Button'
  content = content.replace(
    /from\s+['"]\.\.\/.*\/components\/ui\/([^'"]+)['"]/g,
    "from '@/components/ui/$1'"
  );
  
  // Replace relative imports like '../../components/layout/AppShell' with '@/components/layout/AppShell'
  content = content.replace(
    /from\s+['"]\.\.\/.*\/components\/layout\/([^'"]+)['"]/g,
    "from '@/components/layout/$1'"
  );
  
  // Replace any other deep relative paths (../../../../...) with @/ alias
  content = content.replace(
    /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/(.+?)['"]/g,
    "from '@/$1'"
  );
  content = content.replace(
    /from\s+['"]\.\.\/\.\.\/\.\.\/(.+?)['"]/g,
    "from '@/$1'"
  );
  content = content.replace(
    /from\s+['"]\.\.\/\.\.\/(.+?)['"]/g,
    "from '@/$1'"
  );
  
  return content;
}

/**
 * Helper function to write file asynchronously with directory creation
 */
async function writeFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

/**
 * Generate scaffold structure - hardened version with defensive validation
 * This ensures the project structure exists BEFORE AI starts coding
 */
export async function generateScaffold(config: any) {
  // 🛡️ DEFENSIVE: Use local variable, never mutate inputs
  let filesToGenerate: Record<string, any> = {};

  if (!config) {
    console.error('❌ CRITICAL: No scaffold config provided');
    return { success: false, error: 'Missing config' };
  }

  // Check validity and assign to local variable
  if (!config.files || typeof config.files !== 'object' || Array.isArray(config.files)) {
    console.warn('⚠️ WARNING: config.files is invalid/missing. Initializing empty scaffold.');
    filesToGenerate = {}; // Safe local assignment
  } else {
    filesToGenerate = config.files;
  }

  // ✅ SAFE: Always read from local variable
  const fileCount = Object.keys(filesToGenerate).length;
  console.log(`🏗️ Scaffold: Processing ${fileCount} files...`);

  const results: { skipped: string[]; generated: string[]; errors: string[] } = {
    skipped: [],
    generated: [],
    errors: [],
  };
  const entries = Object.entries(filesToGenerate);

  for (const [path, content] of entries) {
    try {
      if (!content || (typeof content === 'string' && content.trim() === '')) {
        results.skipped.push(path);
        continue;
      }
      
      await writeFile(path, String(content)); 
      results.generated.push(path);
      
    } catch (err) {
      console.error(`❌ Write Error (${path}):`, err);
      results.errors.push(path);
    }
  }

  return { success: true, ...results };
}

/**
 * Generate Component Registry - scans project and creates a map of available components
 * This helps AI know what components exist and how to import them
 */
export function generateComponentRegistry(repoPath: string): Record<string, string> {
  const registry: Record<string, string> = {};
  
  function scan(dir: string, aliasBase: string) {
    if (!fs.existsSync(dir)) return;
    
    try {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        if (f.endsWith('.tsx') || f.endsWith('.ts')) {
          const name = f.replace(/\.(tsx|ts)$/, '');
          // Extract component name (capitalize first letter)
          const componentName = name.charAt(0).toUpperCase() + name.slice(1);
          registry[componentName] = `${aliasBase}/${name}`;
        }
      });
    } catch (e) {
      // Directory might not exist yet, skip silently
    }
  }
  
  // Scan UI components
  scan(path.join(repoPath, 'src/components/ui'), '@/components/ui');
  
  // Scan general components
  scan(path.join(repoPath, 'src/components'), '@/components');
  
  // Scan lib components
  scan(path.join(repoPath, 'src/lib'), '@/lib');
  
  return registry;
}

/**
 * Format Component Registry as a readable string for AI prompts
 */
export function formatComponentRegistry(registry: Record<string, string>): string {
  if (Object.keys(registry).length === 0) {
    return 'No components found in registry.';
  }
  
  const entries = Object.entries(registry)
    .map(([name, importPath]) => `  - ${name}: import { ${name} } from '${importPath}';`)
    .join('\n');
  
  return `AVAILABLE COMPONENTS (USE THESE IMPORTS):\n${entries}\n\nRULE: If a component exists in this list, IMPORT IT. Do not recreate it.`;
}

