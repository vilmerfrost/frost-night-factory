// =============================================================================
// THE CODEBASE ORACLE 🔮 - Knows the truth about the file system
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './modelClient';

/**
 * Represents a single file in the codebase with its metadata
 */
export interface FileNode {
  path: string;
  exports: string[];      // ['Button', 'CardProps', 'default']
  imports: string[];      // ['react', '@/lib/utils', './Button']
  type: 'component' | 'page' | 'layout' | 'lib' | 'config' | 'style' | 'api' | 'unknown';
  hasDefaultExport: boolean;
  hasNamedExports: boolean;
  isClientComponent: boolean;  // Has 'use client'
  isServerComponent: boolean;  // No 'use client' (default in Next.js 13+)
  lineCount: number;
}

/**
 * Knowledge graph of the entire codebase
 */
export interface KnowledgeGraph {
  files: FileNode[];
  totalFiles: number;
  components: string[];
  pages: string[];
  libs: string[];
  generatedAt: string;
}

/**
 * The Codebase Oracle - Scans and understands the entire project structure
 * 
 * Usage:
 * ```typescript
 * const oracle = new CodebaseOracle('/path/to/project');
 * const knowledge = oracle.generateKnowledgeGraph();
 * const advice = await oracle.askThinkingOracle(errorLog, fileContent);
 * ```
 */
export class CodebaseOracle {
  private projectPath: string;
  private cachedGraph: KnowledgeGraph | null = null;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Scans the ENTIRE project and builds a truth table
   * Uses fast regex analysis (no AI tokens spent)
   */
  generateKnowledgeGraph(): KnowledgeGraph {
    console.log('🔮 Oracle: Scanning codebase...');
    
    const files = this.scanFiles(this.projectPath);
    const fileNodes = files.map(file => this.analyzeFile(file));
    
    const graph: KnowledgeGraph = {
      files: fileNodes,
      totalFiles: fileNodes.length,
      components: fileNodes.filter(f => f.type === 'component').map(f => f.path),
      pages: fileNodes.filter(f => f.type === 'page').map(f => f.path),
      libs: fileNodes.filter(f => f.type === 'lib').map(f => f.path),
      generatedAt: new Date().toISOString(),
    };
    
    this.cachedGraph = graph;
    console.log(`🔮 Oracle: Found ${graph.totalFiles} files (${graph.components.length} components, ${graph.pages.length} pages)`);
    
    return graph;
  }

  /**
   * Get cached graph or generate new one
   */
  getKnowledgeGraph(): KnowledgeGraph {
    if (this.cachedGraph) return this.cachedGraph;
    return this.generateKnowledgeGraph();
  }

  /**
   * Ask the Thinking Oracle (DeepSeek R1) for advice on complex import errors
   */
  async askThinkingOracle(errorLog: string, fileContent: string): Promise<string> {
    console.log('🔮 Oracle: Consulting DeepSeek R1 for deep analysis...');
    
    const graph = this.getKnowledgeGraph();
    
    const prompt = `
I have an error in a file.

ERROR:
${errorLog}

FILE CONTENT:
${fileContent}

FULL PROJECT MAP (ORACLE KNOWLEDGE):
${JSON.stringify(graph.files, null, 2)}

TASK:
1. Analyze the error and the project structure.
2. Find the correct import path or fix based on the MAP.
3. If a file is missing, suggest creating it.
4. Output the exact fix (code or path).

RULES:
- Use ONLY paths that exist in the ORACLE KNOWLEDGE.
- If a component exports 'default', use: import X from '...'
- If a component has named exports, use: import { X } from '...'
- Match the export type to the import type.
`;
    
    return await callAI("ORACLE", prompt);
  }

  /**
   * Find a file by export name
   */
  findFileByExport(exportName: string): FileNode | undefined {
    const graph = this.getKnowledgeGraph();
    return graph.files.find(f => 
      f.exports.includes(exportName) || 
      (exportName === 'default' && f.hasDefaultExport)
    );
  }

  /**
   * Find all files that import a specific module
   */
  findFilesThatImport(modulePath: string): FileNode[] {
    const graph = this.getKnowledgeGraph();
    return graph.files.filter(f => 
      f.imports.some(imp => imp.includes(modulePath))
    );
  }

  /**
   * Get relevant files for an error (for token-efficient prompts)
   */
  getRelevantFilesForError(errorLog: string): FileNode[] {
    const graph = this.getKnowledgeGraph();
    
    return graph.files.filter(node => 
      errorLog.includes(node.path) ||                           // File mentioned in error
      node.path.includes('types') ||                            // Type files are always relevant
      node.type === 'lib' ||                                    // Lib files often have exports
      errorLog.includes(path.basename(node.path, '.tsx')) ||   // Filename without extension
      errorLog.includes(path.basename(node.path, '.ts'))
    );
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Recursively scan all TypeScript/JavaScript files
   */
  private scanFiles(dir: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip ignored directories
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git', 'dist', 'build', '__pycache__', '.swc'].includes(entry.name)) {
          continue;
        }
        files.push(...this.scanFiles(fullPath));
      } else if (entry.isFile()) {
        // Only scan code files
        if (entry.name.match(/\.(tsx?|jsx?|css|json)$/)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Analyze a single file and extract metadata
   */
  private analyzeFile(filePath: string): FileNode {
    const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');
    
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      // File might be locked or inaccessible
    }
    
    return {
      path: relativePath,
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      type: this.classifyFile(relativePath, content),
      hasDefaultExport: content.includes('export default'),
      hasNamedExports: /export\s+(const|function|class|interface|type)\s+/.test(content),
      isClientComponent: content.includes("'use client'") || content.includes('"use client"'),
      isServerComponent: !content.includes("'use client'") && !content.includes('"use client"'),
      lineCount: content.split('\n').length,
    };
  }

  /**
   * Extract all exports from file content using regex
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Named exports: export const X, export function X, export class X, export interface X, export type X
    const namedRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = namedRegex.exec(content)) !== null) {
      const name = match[1];
      if (name) exports.push(name);
    }
    
    // Re-exports: export { X, Y } from '...'
    const reExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
    while ((match = reExportRegex.exec(content)) !== null) {
      const namesStr = match[1];
      if (namesStr) {
        const names = namesStr.split(',').map(n => {
          const trimmed = n.trim();
          const parts = trimmed.split(' as ');
          return parts[0]?.trim() ?? '';
        }).filter(n => n && n !== '*');
        exports.push(...names);
      }
    }
    
    // Default export
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    return [...new Set(exports)]; // Remove duplicates
  }

  /**
   * Extract all imports from file content using regex
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // import X from '...' or import { X } from '...'
    const importRegex = /import\s+(?:[\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath) imports.push(importPath);
    }
    
    // require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1];
      if (requirePath) imports.push(requirePath);
    }
    
    return [...new Set(imports)]; // Remove duplicates
  }

  /**
   * Classify file type based on path and content
   */
  private classifyFile(relativePath: string, content: string): FileNode['type'] {
    const normalized = relativePath.toLowerCase();
    
    // Config files
    if (normalized.match(/(config|\.config|tsconfig|package\.json|\.env)/)) {
      return 'config';
    }
    
    // Style files
    if (normalized.match(/\.(css|scss|sass|less)$/)) {
      return 'style';
    }
    
    // API routes
    if (normalized.includes('/api/') || normalized.includes('route.ts')) {
      return 'api';
    }
    
    // Pages (Next.js App Router)
    if (normalized.match(/page\.(tsx?|jsx?)$/)) {
      return 'page';
    }
    
    // Layouts
    if (normalized.match(/layout\.(tsx?|jsx?)$/)) {
      return 'layout';
    }
    
    // Components
    if (normalized.includes('/components/') || 
        (content.includes('export') && (content.includes('React') || content.includes('jsx')))) {
      return 'component';
    }
    
    // Lib/Utils
    if (normalized.includes('/lib/') || normalized.includes('/utils/') || normalized.includes('/hooks/')) {
      return 'lib';
    }
    
    return 'unknown';
  }
}

/**
 * Create a singleton oracle for a project
 */
let oracleInstance: CodebaseOracle | null = null;

export function getOracle(projectPath: string): CodebaseOracle {
  if (!oracleInstance || oracleInstance['projectPath'] !== projectPath) {
    oracleInstance = new CodebaseOracle(projectPath);
  }
  return oracleInstance;
}

