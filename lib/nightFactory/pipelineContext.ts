// =============================================================================
// PIPELINE CONTEXT - The Golden Thread that connects all steps
// =============================================================================
// This object carries ALL context through the entire pipeline
// So every agent knows what was decided before and what the goal is

import * as fs from 'fs';
import * as path from 'path';

export interface FileInfo {
  path: string;
  exports: string[];
  imports: string[];
  isClient: boolean;
  type: 'page' | 'component' | 'lib' | 'type' | 'api' | 'config' | 'other';
}

export interface ErrorInfo {
  code: string;
  message: string;
  file: string;
  line?: number;
  category: 'import' | 'type' | 'syntax' | 'runtime' | 'config' | 'other';
  fixAttempts: number;
  lastFix?: string;
}

export interface PipelineContext {
  // Identity
  ticketId: string;
  pipelineId: string;
  
  // User Intent (The North Star)
  originalPrompt: string;
  optimizedPrompt: string;
  projectName: string;
  projectDescription: string;
  
  // Technical Decisions
  techStack: {
    frontend: string;
    backend: string | null;
    database: string | null;
    styling: string;
    auth: string | null;
  };
  
  // Structure
  projectRoot: 'src' | '.';
  fileStructure: FileInfo[];
  exportMap: Record<string, string[]>; // file -> exports
  importMap: Record<string, string[]>; // file -> imports
  
  // Component Registry
  availableComponents: Record<string, string>; // name -> import path
  
  // RAG Knowledge
  ragContext: string;
  researchFindings: string;
  
  // Blueprint (from Planner)
  blueprint: {
    pages: string[];
    components: string[];
    apis: string[];
    features: string[];
  };
  
  // Error Tracking
  errorHistory: ErrorInfo[];
  fixHistory: { error: string; fix: string; success: boolean }[];
  
  // State
  currentPhase: 'planning' | 'coding' | 'testing' | 'publishing';
  buildAttempts: number;
  lastBuildError: string | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new pipeline context
 */
export function createPipelineContext(
  ticketId: string,
  pipelineId: string,
  originalPrompt: string
): PipelineContext {
  return {
    ticketId,
    pipelineId,
    originalPrompt,
    optimizedPrompt: '',
    projectName: '',
    projectDescription: '',
    techStack: {
      frontend: 'Next.js 15',
      backend: null,
      database: null,
      styling: 'Tailwind CSS',
      auth: null,
    },
    projectRoot: 'src',
    fileStructure: [],
    exportMap: {},
    importMap: {},
    availableComponents: {},
    ragContext: '',
    researchFindings: '',
    blueprint: {
      pages: [],
      components: [],
      apis: [],
      features: [],
    },
    errorHistory: [],
    fixHistory: [],
    currentPhase: 'planning',
    buildAttempts: 0,
    lastBuildError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update context after planning phase
 */
export function updateContextAfterPlanning(
  ctx: PipelineContext,
  optimizedPrompt: string,
  blueprint: PipelineContext['blueprint'],
  techStack: Partial<PipelineContext['techStack']>
): PipelineContext {
  return {
    ...ctx,
    optimizedPrompt,
    blueprint,
    techStack: { ...ctx.techStack, ...techStack },
    currentPhase: 'coding',
    updatedAt: new Date(),
  };
}

/**
 * Update context after coding phase
 */
export function updateContextAfterCoding(
  ctx: PipelineContext,
  fileStructure: FileInfo[],
  exportMap: Record<string, string[]>,
  importMap: Record<string, string[]>,
  availableComponents: Record<string, string>
): PipelineContext {
  return {
    ...ctx,
    fileStructure,
    exportMap,
    importMap,
    availableComponents,
    currentPhase: 'testing',
    updatedAt: new Date(),
  };
}

/**
 * Record an error in the context
 */
export function recordError(
  ctx: PipelineContext,
  error: Omit<ErrorInfo, 'fixAttempts'>
): PipelineContext {
  // Check if we've seen this error before
  const existingIndex = ctx.errorHistory.findIndex(
    e => e.code === error.code && e.file === error.file && e.message === error.message
  );
  
  if (existingIndex >= 0) {
    // Increment fix attempts
    ctx.errorHistory[existingIndex].fixAttempts++;
  } else {
    // Add new error
    ctx.errorHistory.push({ ...error, fixAttempts: 1 });
  }
  
  ctx.lastBuildError = error.message;
  ctx.buildAttempts++;
  ctx.updatedAt = new Date();
  
  return ctx;
}

/**
 * Record a fix attempt
 */
export function recordFix(
  ctx: PipelineContext,
  error: string,
  fix: string,
  success: boolean
): PipelineContext {
  ctx.fixHistory.push({ error, fix, success });
  
  if (success) {
    ctx.lastBuildError = null;
  }
  
  ctx.updatedAt = new Date();
  return ctx;
}

/**
 * Scan project and build file structure map
 */
export function scanProjectStructure(
  ctx: PipelineContext,
  projectPath: string
): PipelineContext {
  const fileStructure: FileInfo[] = [];
  const exportMap: Record<string, string[]> = {};
  const importMap: Record<string, string[]> = {};
  const availableComponents: Record<string, string> = {};
  
  const srcPath = path.join(projectPath, 'src');
  const scanRoot = fs.existsSync(srcPath) ? srcPath : projectPath;
  
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
        const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Extract exports
        const exports: string[] = [];
        const exportMatches = content.matchAll(/export\s+(const|function|class|type|interface|enum)\s+(\w+)/g);
        for (const match of exportMatches) {
          const exportName = match[2];
          if (exportName) exports.push(exportName);
        }
        if (content.includes('export default')) {
          exports.push('default');
        }
        
        // Extract imports
        const imports: string[] = [];
        const importMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
          const importPath = match[1];
          if (importPath) imports.push(importPath);
        }
        
        // Determine file type
        let type: FileInfo['type'] = 'other';
        if (relativePath.includes('/app/') && entry.name.match(/^(page|layout|loading|error)\./)) {
          type = 'page';
        } else if (relativePath.includes('/components/')) {
          type = 'component';
        } else if (relativePath.includes('/lib/')) {
          type = 'lib';
        } else if (relativePath.includes('/types/') || entry.name.includes('.d.ts')) {
          type = 'type';
        } else if (relativePath.includes('/api/')) {
          type = 'api';
        } else if (entry.name.includes('config')) {
          type = 'config';
        }
        
        // Check if client component
        const isClient = content.includes("'use client'") || content.includes('"use client"');
        
        const fileInfo: FileInfo = {
          path: relativePath,
          exports,
          imports,
          isClient,
          type,
        };
        
        fileStructure.push(fileInfo);
        exportMap[relativePath] = exports;
        importMap[relativePath] = imports;
        
        // Add to component registry if it's a component
        if (type === 'component' && exports.length > 0) {
          const componentName = exports.find(e => e !== 'default') || path.basename(entry.name, path.extname(entry.name));
          const aliasPath = '@/' + relativePath.replace(/^src\//, '').replace(/\.(tsx?|jsx?)$/, '');
          availableComponents[componentName] = aliasPath;
        }
      }
    }
  }
  
  scanDir(scanRoot);
  
  return {
    ...ctx,
    fileStructure,
    exportMap,
    importMap,
    availableComponents,
    updatedAt: new Date(),
  };
}

/**
 * Generate a summary for AI agents
 */
export function generateContextSummary(ctx: PipelineContext): string {
  const errorSummary = ctx.errorHistory.length > 0
    ? `\n\nRECENT ERRORS (${ctx.errorHistory.length} total):\n` + 
      ctx.errorHistory.slice(-5).map(e => 
        `- [${e.category.toUpperCase()}] ${e.file}: ${e.message} (${e.fixAttempts} fix attempts)`
      ).join('\n')
    : '';
  
  const componentList = Object.entries(ctx.availableComponents).length > 0
    ? `\n\nAVAILABLE COMPONENTS:\n` +
      Object.entries(ctx.availableComponents)
        .map(([name, path]) => `- ${name}: import { ${name} } from '${path}'`)
        .join('\n')
    : '';
  
  const fileList = ctx.fileStructure.length > 0
    ? `\n\nPROJECT FILES (${ctx.fileStructure.length} total):\n` +
      ctx.fileStructure.slice(0, 20).map(f => 
        `- ${f.path} [${f.type}] exports: ${f.exports.join(', ') || 'none'}`
      ).join('\n')
    : '';
  
  return `
=== PIPELINE CONTEXT ===
Project: ${ctx.projectName || 'Unnamed'}
Phase: ${ctx.currentPhase.toUpperCase()}
Build Attempts: ${ctx.buildAttempts}

ORIGINAL REQUEST:
${ctx.originalPrompt}

OPTIMIZED SPECIFICATION:
${ctx.optimizedPrompt || 'Not yet optimized'}

TECH STACK:
- Frontend: ${ctx.techStack.frontend}
- Backend: ${ctx.techStack.backend || 'None'}
- Database: ${ctx.techStack.database || 'None'}
- Styling: ${ctx.techStack.styling}

BLUEPRINT:
- Pages: ${ctx.blueprint.pages.join(', ') || 'None defined'}
- Components: ${ctx.blueprint.components.join(', ') || 'None defined'}
- Features: ${ctx.blueprint.features.join(', ') || 'None defined'}
${componentList}
${fileList}
${errorSummary}
=== END CONTEXT ===
`.trim();
}

/**
 * Get context for Tester agent specifically
 */
export function getTesterContext(ctx: PipelineContext): string {
  const recentErrors = ctx.errorHistory.slice(-10);
  const failedFixes = ctx.fixHistory.filter(f => !f.success).slice(-5);
  
  let loopWarning = '';
  
  // Detect loops
  const errorCounts = new Map<string, number>();
  for (const err of recentErrors) {
    const key = `${err.code}:${err.file}`;
    errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
  }
  
  for (const [key, count] of errorCounts) {
    if (count >= 3) {
      loopWarning += `\n⚠️ LOOP DETECTED: Error "${key}" has appeared ${count} times. Try a DIFFERENT approach!`;
    }
  }
  
  return `
=== TESTER CONTEXT ===
You are fixing: ${ctx.projectName || ctx.originalPrompt.slice(0, 100)}

WHAT THIS PROJECT SHOULD DO:
${ctx.optimizedPrompt || ctx.originalPrompt}

BUILD ATTEMPTS: ${ctx.buildAttempts}
${loopWarning}

${recentErrors.length > 0 ? `
RECENT ERRORS TO FIX:
${recentErrors.map(e => `
[${e.category.toUpperCase()}] ${e.file}${e.line ? `:${e.line}` : ''}
Code: ${e.code}
Message: ${e.message}
Fix attempts: ${e.fixAttempts}
${e.lastFix ? `Last fix tried: ${e.lastFix}` : ''}
`).join('\n---\n')}
` : 'No errors recorded yet.'}

${failedFixes.length > 0 ? `
FIXES THAT DIDN'T WORK (DO NOT REPEAT):
${failedFixes.map(f => `- Tried: ${f.fix.slice(0, 100)}...`).join('\n')}
` : ''}

AVAILABLE COMPONENTS (USE THESE):
${Object.entries(ctx.availableComponents)
  .map(([name, path]) => `- import { ${name} } from '${path}'`)
  .join('\n') || 'No components registered'}

FILE STRUCTURE:
${ctx.fileStructure.slice(0, 15).map(f => 
  `${f.path} → exports: [${f.exports.join(', ')}]`
).join('\n') || 'No files scanned'}

=== END TESTER CONTEXT ===
`.trim();
}

/**
 * Serialize context to JSON for storage
 */
export function serializeContext(ctx: PipelineContext): string {
  return JSON.stringify(ctx, null, 2);
}

/**
 * Deserialize context from JSON
 */
export function deserializeContext(json: string): PipelineContext {
  const ctx = JSON.parse(json);
  ctx.createdAt = new Date(ctx.createdAt);
  ctx.updatedAt = new Date(ctx.updatedAt);
  return ctx;
}

