// agent-runner/lib/auto-stub-generator.ts
/**
 * ✅ AUTO-STUB GENERATOR: Creates stub files for missing imports
 * Prevents "Import not found" errors from blocking generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { isSrcLibFile, stripTsExtension, preferredExtensionForStub, normalizePath } from './path-rules';

/**
 * Extract import path from error message
 * Handles: "Import not found: '@/types/invoice'"
 */
export function extractImportFromError(error: string): string | null {
  const patterns = [
    /Import not found:\s*['"]([^'"]+)['"]/i,
    /Cannot find module\s+['"]([^'"]+)['"]/i,
    /Module not found:\s+['"]([^'"]+)['"]/i,
  ];
  
  for (const pattern of patterns) {
    const match = error.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Create a minimal stub file for a missing import
 */
export function createStubFile(importPath: string, projectRoot: string): {
  created: boolean;
  filePath: string;
  content: string;
} {
  // Normalize import path
  let normalizedPath = importPath.replace(/\\/g, '/');
  
  // Handle @/ alias
  if (normalizedPath.startsWith('@/')) {
    normalizedPath = normalizedPath.replace('@/', 'src/');
  }
  
  // Handle relative imports
  if (normalizedPath.startsWith('./') || normalizedPath.startsWith('../')) {
    // Keep relative path as-is, but ensure it's within project
    normalizedPath = normalizedPath.replace(/^\.\//, '');
  }
  
  // Determine file extension and path
  let filePath: string;
  let content: string;
  
  if (normalizedPath.includes('/types/') || normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.tsx')) {
    // Type definition file
    const baseName = path.basename(normalizedPath, '.ts');
    const dirPath = path.dirname(normalizedPath);
    filePath = path.join(projectRoot, dirPath, `${baseName}.ts`);
    
    // Create minimal type stub
    const typeName = baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/[^a-zA-Z0-9]/g, '');
    content = `// Auto-generated stub for ${importPath}
// TODO: Replace with actual type definitions

export type ${typeName} = Record<string, unknown>;

// Add more types as needed
`;
  } else {
    // Component or module file
    const hasExtension = normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx');
    
    // ✅ FIX: Use centralized stripTsExtension (handles .ts, .tsx, .d.ts correctly)
    const basePath = hasExtension 
      ? stripTsExtension(normalizedPath)
      : normalizedPath;
    
    // ✅ Use centralized path-rules to determine extension
    const isLib = isSrcLibFile(basePath);
    const ext = preferredExtensionForStub(basePath);
    
    filePath = path.join(projectRoot, `${basePath}${ext}`);
    
    // Create minimal component/module stub
    const componentName = path.basename(basePath).replace(/[^a-zA-Z0-9]/g, '');
    if (ext === '.tsx') {
      content = `'use client';

// Auto-generated stub for ${importPath}
// TODO: Replace with actual component

export default function ${componentName}Stub() {
  return null;
}
`;
    } else {
      content = `// Auto-generated stub for ${importPath}
// TODO: Replace with actual implementation

export function ${componentName}Stub(): void {
  // Stub implementation
}
`;
    }
  }
  
  // Create directory if needed
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write stub file
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { created: true, filePath, content };
  }
  
  return { created: false, filePath, content };
}

/**
 * Auto-create stubs for missing imports from validation errors
 */
export async function autoCreateStubsForMissingImports(
  errors: string[],
  projectRoot: string
): Promise<{ created: number; files: string[] }> {
  const createdFiles: string[] = [];
  let createdCount = 0;
  
  for (const error of errors) {
    const importPath = extractImportFromError(error);
    if (!importPath) continue;
    
    // Skip node_modules imports
    if (!importPath.startsWith('@/') && !importPath.startsWith('./') && !importPath.startsWith('../')) {
      continue;
    }
    
    try {
      const result = createStubFile(importPath, projectRoot);
      if (result.created) {
        createdFiles.push(result.filePath);
        createdCount++;
        console.log(`   📄 Created stub: ${path.relative(projectRoot, result.filePath)}`);
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Failed to create stub for ${importPath}: ${e.message}`);
    }
  }
  
  if (createdCount > 0) {
    console.log(`✅ [AUTO-STUB] Created ${createdCount} stub files for missing imports`);
  }
  
  return { created: createdCount, files: createdFiles };
}

