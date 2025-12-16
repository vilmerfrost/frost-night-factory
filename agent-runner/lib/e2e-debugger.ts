// =============================================================================
// E2E DEBUGGER AGENT - Analyzes Playwright failures and proposes fixes
// =============================================================================
// Receives test failures, analyzes code, and produces minimal patches

import { callAI } from '../ai-client';
import { generateRepositoryMap } from '../repo-map-generator';
import fs from 'fs';
import path from 'path';

export interface E2EFailure {
  testName: string;        // "Homepage loads without errors"
  url: string;             // "/"
  message: string;         // "Homepage shows 404 error"
  screenshotPath?: string;
  errorDetails?: string;
  testResult?: any;         // Full Playwright test result for context
}

export interface DebuggerResult {
  explanation: string;     // Natural language explanation of the issue
  targetFile: string;      // File that needs fixing (e.g., "src/app/page.tsx")
  patch: string;           // Patch or full file content
  confidence: number;      // 0.0 to 1.0
  strategy: string;        // "add_export_default", "fix_route", "create_missing_file", etc.
}

/**
 * Run E2E Debugger agent
 * Analyzes test failure and proposes a fix
 */
export async function runE2EDebugger(
  failure: E2EFailure,
  projectRoot: string,
  pipelineId: string
): Promise<DebuggerResult> {
  console.log(`🔍 [E2E Debugger] Analyzing failure: ${failure.testName}`);
  console.log(`   URL: ${failure.url}`);
  console.log(`   Error: ${failure.message}`);
  
  // ✅ Step 1: Generate repository map for context
  const repoMap = await generateRepositoryMap(projectRoot);
  
  // ✅ Step 2: Identify relevant files based on URL and error
  const relevantFiles = identifyRelevantFiles(failure, projectRoot);
  
  // ✅ Step 3: Read code snippets from relevant files
  const codeSnippets: Record<string, string> = {};
  for (const filePath of relevantFiles) {
    const fullPath = path.join(projectRoot, filePath);
    if (fs.existsSync(fullPath)) {
      try {
        codeSnippets[filePath] = fs.readFileSync(fullPath, 'utf-8');
      } catch (error: any) {
        console.warn(`   ⚠️ Could not read ${filePath}: ${error.message}`);
      }
    }
  }
  
  // ✅ Step 4: Build debugger prompt
  const debuggerPrompt = buildDebuggerPrompt(failure, repoMap, codeSnippets);
  
  // ✅ Step 5: Call AI Debugger (use cheaper model for analysis)
  const model = 'deepseek-chat'; // Fast and cheap for analysis
  
  try {
    const debuggerResponse = await callAI({
      pipelineId,
      step: 'e2e_debugger',
      role: 'DEBUGGER',
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert Next.js 16 + React 19 engineer specializing in debugging E2E test failures.

Your task is to analyze Playwright test failures and propose minimal, targeted fixes.

CRITICAL RULES:
1. Preserve existing code - only propose minimal patches
2. Focus on the specific issue (404, routing, exports, etc.)
3. Explain your reasoning clearly
4. Provide either a patch (diff format) or full file content
5. Identify the exact file that needs fixing`,
        },
        {
          role: 'user',
          content: debuggerPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more focused analysis
      maxTokens: 4000,
    });
    
    // ✅ Step 6: Parse debugger response
    const result = parseDebuggerResponse(debuggerResponse, failure, relevantFiles);
    
    console.log(`   ✅ Debugger analysis complete:`);
    console.log(`      Target: ${result.targetFile}`);
    console.log(`      Strategy: ${result.strategy}`);
    console.log(`      Explanation: ${result.explanation.substring(0, 100)}...`);
    
    return result;
  } catch (error: any) {
    console.error(`❌ [E2E Debugger] Failed: ${error.message}`);
    
    // Fallback: Return basic analysis
    return {
      explanation: `Debugger failed: ${error.message}. Falling back to basic fix strategy.`,
      targetFile: identifyLikelyTargetFile(failure, projectRoot),
      patch: '',
      confidence: 0.3,
      strategy: 'fallback',
    };
  }
}

/**
 * Identify relevant files based on E2E failure
 */
function identifyRelevantFiles(failure: E2EFailure, projectRoot: string): string[] {
  const files: string[] = [];
  
  // For homepage 404, check page.tsx and layout.tsx
  if (failure.url === '/' || failure.url === '') {
    files.push('src/app/page.tsx');
    files.push('app/page.tsx');
    files.push('src/app/layout.tsx');
    files.push('app/layout.tsx');
  }
  
  // For nested routes, check route files
  if (failure.url !== '/' && failure.url !== '') {
    const routePath = failure.url.replace(/^\//, '').replace(/\/$/, '');
    files.push(`src/app/${routePath}/page.tsx`);
    files.push(`app/${routePath}/page.tsx`);
  }
  
  // Always check layout
  files.push('src/app/layout.tsx');
  files.push('app/layout.tsx');
  
  // Check middleware if routing issue
  if (failure.message.includes('404') || failure.message.includes('route')) {
    files.push('src/middleware.ts');
    files.push('middleware.ts');
  }
  
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Identify likely target file for fallback
 */
function identifyLikelyTargetFile(failure: E2EFailure, projectRoot: string): string {
  if (failure.url === '/' || failure.url === '') {
    // Check which structure exists
    if (fs.existsSync(path.join(projectRoot, 'src', 'app', 'page.tsx'))) {
      return 'src/app/page.tsx';
    }
    if (fs.existsSync(path.join(projectRoot, 'app', 'page.tsx'))) {
      return 'app/page.tsx';
    }
    return 'src/app/page.tsx'; // Default
  }
  
  return 'src/app/page.tsx';
}

/**
 * Build debugger prompt
 */
function buildDebuggerPrompt(
  failure: E2EFailure,
  repoMap: string,
  codeSnippets: Record<string, string>
): string {
  const codeSnippetsText = Object.entries(codeSnippets)
    .map(([filePath, content]) => `\n=== ${filePath} ===\n${content.substring(0, 2000)}`)
    .join('\n\n');
  
  return `E2E TEST FAILURE ANALYSIS

Test Name: ${failure.testName}
URL: ${failure.url}
Error Message: ${failure.message}
${failure.errorDetails ? `Error Details: ${failure.errorDetails}` : ''}

REPOSITORY STRUCTURE:
${repoMap.substring(0, 2000)}

RELEVANT CODE FILES:
${codeSnippetsText || '(No relevant files found)'}

TASK:
1. Analyze why the test is failing (404, routing issue, missing export, etc.)
2. Identify the exact file that needs fixing
3. Propose a MINIMAL patch that fixes ONLY this issue
4. Explain your reasoning

OUTPUT FORMAT (JSON):
{
  "explanation": "Brief explanation of the issue and fix",
  "targetFile": "src/app/page.tsx",
  "strategy": "add_export_default",
  "patch": "Full file content OR patch description",
  "confidence": 0.9
}

CRITICAL:
- Preserve existing code - only fix the specific issue
- If file doesn't exist, provide full file content
- If file exists, provide minimal patch or full corrected version
- Be specific about what's wrong and how to fix it`;
}

/**
 * Parse debugger response into structured result
 */
function parseDebuggerResponse(
  response: string,
  failure: E2EFailure,
  relevantFiles: string[]
): DebuggerResult {
  // Try to extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*"explanation"[\s\S]*"confidence"[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        explanation: parsed.explanation || 'No explanation provided',
        targetFile: parsed.targetFile || identifyLikelyTargetFile(failure, ''),
        patch: parsed.patch || '',
        confidence: parsed.confidence || 0.7,
        strategy: parsed.strategy || 'unknown',
      };
    } catch (error: any) {
      console.warn(`   ⚠️ Failed to parse JSON from debugger response: ${error.message}`);
    }
  }
  
  // Fallback: Extract information from natural language response
  const explanation = response.split('\n')[0] || 'Debugger analysis completed';
  const targetFile = identifyLikelyTargetFile(failure, '');
  
  // Try to extract code block as patch
  const codeBlockMatch = response.match(/```(?:typescript|tsx|ts|jsx|js)?\n([\s\S]*?)```/);
  const patch = codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim() : '';
  
  return {
    explanation,
    targetFile,
    patch,
    confidence: 0.6,
    strategy: 'extracted_from_response',
  };
}

/**
 * Apply debugger patch to file
 * Handles both full file content and patch descriptions
 */
export async function applyDebuggerPatch(
  targetFile: string,
  patch: string,
  projectRoot: string
): Promise<{ success: boolean; message: string }> {
  const fullPath = path.join(projectRoot, targetFile);
  
  // ✅ Backup original if file exists
  if (fs.existsSync(fullPath)) {
    const backupPath = fullPath.replace(/\.(tsx|ts|jsx|js)$/, '.backup.$1');
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(fullPath, backupPath);
      console.log(`   📦 Backed up ${targetFile} to ${path.basename(backupPath)}`);
    }
  }
  
  // ✅ Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // ✅ Check if patch is full file content or needs to be applied
  const originalContent = fs.existsSync(fullPath) 
    ? fs.readFileSync(fullPath, 'utf-8')
    : '';
  
  // If patch looks like full file content (has imports, exports, etc.), use it directly
  const isFullFile = patch.includes('import ') || patch.includes('export ') || patch.length > 500;
  
  if (isFullFile || !originalContent) {
    // Write patch as full file
    fs.writeFileSync(fullPath, patch, 'utf-8');
    console.log(`   ✅ Applied debugger patch to ${targetFile} (full file)`);
    return {
      success: true,
      message: `Applied full file patch to ${targetFile}`,
    };
  } else {
    // Try to apply as patch (simplified - in production would use proper diff library)
    // For now, append patch if it's a small addition
    if (patch.length < 500 && !patch.includes('import ') && !patch.includes('export ')) {
      const newContent = originalContent + '\n\n' + patch;
      fs.writeFileSync(fullPath, newContent, 'utf-8');
      console.log(`   ✅ Applied debugger patch to ${targetFile} (appended)`);
      return {
        success: true,
        message: `Applied patch addition to ${targetFile}`,
      };
    } else {
      // Replace entire file if patch is substantial
      fs.writeFileSync(fullPath, patch, 'utf-8');
      console.log(`   ✅ Applied debugger patch to ${targetFile} (replaced)`);
      return {
        success: true,
        message: `Applied patch replacement to ${targetFile}`,
      };
    }
  }
}

