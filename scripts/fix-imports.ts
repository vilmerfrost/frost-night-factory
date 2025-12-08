// =============================================================================
// IMPORT PATH FIXER - Fix broken @/ imports
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Map broken @/ imports to correct relative paths
const importMappings: Record<string, string> = {
  // Common broken patterns
  '@/lib/nightFactory/modelClient': '../lib/nightFactory/modelClient',
  '@/lib/supabase-server': '../lib/supabase-server',
  '@/components/ui/toast': '../components/ui/toast',
  '@/lib/schemas': '../lib/schemas',
  '@/lib/mock-data': '../lib/mock-data',
  '@/lib/types': '../lib/types',
  '@/components/ui/button': '../components/ui/button',
  '@/components/ui/card': '../components/ui/card',
  '@/components/ui/input': '../components/ui/input',
  '@/components/ui/badge': '../components/ui/badge',
  '@/lib/api': '../lib/api',
  '@/hooks/use-auth': '../hooks/use-auth',
  '@/hooks/use-toast': '../hooks/use-toast',
  '@/utils': '../utils',
};

/**
 * Calculate relative path from file to target
 */
function getRelativePath(fromFile: string, toPath: string, baseDir: string): string {
  const fromDir = path.dirname(path.resolve(baseDir, fromFile));
  const toFile = path.resolve(baseDir, toPath);
  
  let relative = path.relative(fromDir, toFile);
  
  // Normalize path separators
  relative = relative.replace(/\\/g, '/');
  
  // Ensure it starts with ./
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }
  
  // Remove .ts/.tsx extensions
  relative = relative.replace(/\.tsx?$/, '');
  
  return relative;
}

/**
 * Fix imports in a file
 */
async function fixImports(filePath: string, baseDir: string): Promise<boolean> {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  const originalContent = content;
  
  // Fix @/ imports
  for (const [broken, fixed] of Object.entries(importMappings)) {
    const regex = new RegExp(`(['"])${broken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['"])`, 'g');
    
    if (content.includes(broken)) {
      // Try to calculate relative path
      const relativePath = getRelativePath(filePath, fixed, baseDir);
      content = content.replace(regex, `$1${relativePath}$2`);
      changed = true;
    }
  }
  
  // Fix common patterns
  const patterns = [
    // @/lib/... -> ../lib/...
    {
      regex: /from\s+['"]@\/lib\/([^'"]+)['"]/g,
      replacer: (match: string, libPath: string) => {
        const relative = getRelativePath(filePath, `lib/${libPath}`, baseDir);
        return `from '${relative}'`;
      },
    },
    // @/components/... -> ../components/...
    {
      regex: /from\s+['"]@\/components\/([^'"]+)['"]/g,
      replacer: (match: string, compPath: string) => {
        const relative = getRelativePath(filePath, `components/${compPath}`, baseDir);
        return `from '${relative}'`;
      },
    },
    // @/hooks/... -> ../hooks/...
    {
      regex: /from\s+['"]@\/hooks\/([^'"]+)['"]/g,
      replacer: (match: string, hookPath: string) => {
        const relative = getRelativePath(filePath, `hooks/${hookPath}`, baseDir);
        return `from '${relative}'`;
      },
    },
  ];
  
  for (const { regex, replacer } of patterns) {
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, replacer);
      changed = true;
    }
  }
  
  if (changed && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed imports in: ${path.relative(baseDir, filePath)}`);
    return true;
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const baseDir = path.resolve(targetDir);
  
  console.log('🔧 Import Path Fixer');
  console.log('===================\n');
  console.log(`Target: ${baseDir}\n`);
  
  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    cwd: baseDir,
    ignore: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      '**/*.d.ts',
    ],
  });
  
  console.log(`Found ${files.length} TypeScript files\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(baseDir, file);
    
    try {
      if (await fixImports(filePath, baseDir)) {
        fixedCount++;
      }
    } catch (error: any) {
      console.warn(`⚠️ Failed to fix ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Fixed imports in ${fixedCount} files`);
  console.log(`   Total files checked: ${files.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

