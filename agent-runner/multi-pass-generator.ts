// agent-runner/multi-pass-generator.ts
import { callAI, selectModel } from './ai-client'
import { validateCode as validateCodeRobust } from './lib/validator'  // ✅ Use robust validator
import { validateCode as validateCodeStrict } from './code-validator'  // Keep for compatibility
import { validateCodeCompleteness } from './ast-validator'
import { classifyError, generateReflection } from './error-classifier'
import { semanticCache } from './semantic-cache'  // ✅ Phase 2: Semantic caching
import { selectOptimalModel, estimateComplexity, getModelName, routeModel, inferTaskKindFromFile } from './model-router'  // ✅ Phase 3: Smart routing
import { MODELS } from './lib/models'  // ✅ Model constants
import { generateRepositoryMap } from './repo-map-generator'  // ✅ Phase 1: For caching
import { needsJsxSanitization } from './lib/jsx-sanitizer'  // ✅ JSX sanitizer
import { ClaudeOverloadExhaustedError } from './lib/claude/claude-gateway'  // ✅ Claude gateway (central resilience)
import * as fs from 'fs'
import * as path from 'path'
import { ensurePreferredExtension, isSrcLibFile } from './lib/path-rules'
import { sanitizeModelOutput } from './pipeline-runner'

export interface GenerationResult {
  success: boolean
  code: string
  attempts: number
  issues: string[]
}

/**
 * 🔧 STUB GENERATOR: Pre-scaffold imports to prevent ghost imports
 * Scans prompt for import statements and creates empty stub files
 */
async function preScaffoldImports(
  prompt: string, 
  projectRoot: string,
  plan?: { files?: Array<{ path: string }> }
): Promise<void> {
  console.log(`🔧 [STUB GENERATOR] Scanning for imports to pre-scaffold...`);
  
  // Extract import statements from prompt
  const importPattern = /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]@\/([^'"]+)['"]/g;
  const imports: Set<string> = new Set();
  let match;
  
  while ((match = importPattern.exec(prompt)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;
    
    // Convert @/lib/extractors -> src/lib/extractors
    const basePath = importPath.startsWith('src/') 
      ? importPath 
      : `src/${importPath}`;
    
    // ✅ FIX: Check if plan has index.ts for this import path
    // If plan has src/lib/extractors/index.ts, use that instead of src/lib/extractors.ts
    const indexPath = `${basePath}/index.ts`;
    const directPath = `${basePath}.ts`;
    const directPathTsx = `${basePath}.tsx`;
    
    let targetPath: string;
    
    if (plan?.files) {
      // Check if plan has index.ts structure
      const hasIndexFile = plan.files.some(f => f.path === indexPath);
      const hasDirectFile = plan.files.some(f => f.path === directPath || f.path === directPathTsx);
      
      if (hasIndexFile) {
        // Plan expects directory/index.ts structure
        targetPath = indexPath;
      } else if (hasDirectFile) {
        // Plan expects direct file
        const planFile = plan.files.find(f => f.path === directPath || f.path === directPathTsx);
        targetPath = planFile?.path || ensurePreferredExtension(basePath);
      } else {
        // No plan info, use default logic
        targetPath = ensurePreferredExtension(basePath);
      }
    } else {
      // No plan available, use default logic
      targetPath = ensurePreferredExtension(basePath);
    }
    
    imports.add(targetPath);
  }
  
  // Also check for common component imports
  const commonComponents = ['Sidebar', 'RecentInvoices', 'InvoiceStats', 'DashboardShell', 'AppShell'];
  for (const comp of commonComponents) {
    const possiblePaths = [
      `src/components/${comp}.tsx`,
      `src/components/layout/${comp}.tsx`,
      `src/components/ui/${comp}.tsx`
    ];
    
    for (const possiblePath of possiblePaths) {
      if (prompt.includes(comp) && !fs.existsSync(path.join(projectRoot, possiblePath))) {
        imports.add(possiblePath);
      }
    }
  }
  
  // Create stub files
  let stubsCreated = 0;
  for (const importPath of imports) {
    const fullPath = path.join(projectRoot, importPath);
    const dir = path.dirname(fullPath);
    
    // ✅ FIX: Check if path is a directory (EISDIR prevention)
    // If directory exists but file doesn't, and this is NOT an index.ts, skip
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory() && !importPath.endsWith('/index.ts') && !importPath.endsWith('/index.tsx')) {
      // Directory exists but we're trying to create a file with same name
      // This means plan expects index.ts structure but we're creating flat file
      // Skip this stub - let the actual file generation handle it
      console.log(`   ⚠️ Skipping stub for ${importPath} (directory exists, likely needs index.ts)`);
      continue;
    }
    
    if (!fs.existsSync(fullPath)) {
      // Create directory if needed
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // ✅ Use correct extension based on path-rules
      const isLib = isSrcLibFile(importPath);
      const componentName = path.basename(importPath, importPath.endsWith('.tsx') ? '.tsx' : '.ts')
        .replace(/[^a-zA-Z0-9]/g, '') || 'Component';
      
      let stubContent: string;
      if (importPath.endsWith('.tsx') && !isLib) {
        stubContent = `'use client';

export default function ${componentName}() {
  return null;
}
`;
      } else {
        // .ts file (lib or default)
        stubContent = `export {}; // Stub
`;
      }
      
      try {
        fs.writeFileSync(fullPath, stubContent, 'utf-8');
        console.log(`   📄 Created stub: ${importPath}`);
        stubsCreated++;
      } catch (error: any) {
        if (error.code === 'EISDIR') {
          console.warn(`   ⚠️ Skipping stub for ${importPath} (path is a directory, likely needs index.ts)`);
        } else {
          console.warn(`   ⚠️ Failed to create stub for ${importPath}: ${error.message}`);
        }
      }
    }
  }
  
  if (stubsCreated > 0) {
    console.log(`✅ [STUB GENERATOR] Created ${stubsCreated} stub files to prevent ghost imports`);
  } else {
    console.log(`   ℹ️ No new stubs needed`);
  }
}

/**
 * Multi-pass code generation with iterative refinement
 * Industry standard: 10-50 attempts before giving up
 */
export async function generateWithValidation(
  pipelineId: string,
  step: string,
  prompt: string,
  targetFile: string,
  projectRoot: string,
  maxAttempts: number = 10,
  plan?: { files?: Array<{ path: string }> }
): Promise<GenerationResult> {
  
  // ✅ Phase 1: Generate context ONCE (will be cached)
  console.log(`📋 [CACHE] Generating repository map and codebase context...`)
  let repoMap = ''
  let codebaseContext = ''
  
  try {
    repoMap = generateRepositoryMap(projectRoot)
    codebaseContext = await buildCodebaseContext(projectRoot)
    console.log(`✅ [CACHE] Context ready (repo map: ${repoMap.length} chars, codebase: ${codebaseContext.length} chars)`)
  } catch (e) {
    console.warn(`⚠️ [CACHE] Could not generate context: ${e}`)
    repoMap = '\n(Repository map unavailable)\n'
    codebaseContext = '\n(Codebase context unavailable)\n'
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔧 STUB GENERATOR: Create empty stubs for imports BEFORE generation
  // ═══════════════════════════════════════════════════════════════════
  await preScaffoldImports(prompt, projectRoot, plan);
  
  // ✅ Phase 2: Check semantic cache BEFORE generating (STRICT MATCHING)
  // ✅ Pass filePath for better classification (even if prompt doesn't contain it)
  const errorAnalysis = classifyError({
    filePath: targetFile,
    message: prompt
  }) // Extract error type for cache lookup
  const cached = await semanticCache.get(prompt, targetFile, errorAnalysis.errorCode)
  
  if (cached.hit && cached.response) {
    console.log(`🎉 [SEMANTIC CACHE] Using cached response (${(cached.similarity! * 100).toFixed(1)}% similarity)`)
    
    // Still validate to be safe (defensive access)
    const cachedCode = cached.response || '';
    if (!cachedCode || cachedCode.length === 0) {
      console.log(`⚠️ [SEMANTIC CACHE] Cached response is empty, regenerating...`);
    } else {
      const validation = await validateCodeStrict(cachedCode, targetFile, projectRoot)
      
      if (validation.valid) {
        return {
          success: true,
          code: cachedCode,
          attempts: 0,  // No AI call made!
          issues: []
        }
      } else {
        console.log(`⚠️ [SEMANTIC CACHE] Cached response failed validation, regenerating...`)
      }
    }
  }
  
  let currentPrompt = prompt
  let attempts = 0
  let previousErrorCount = Infinity  // 📉 DYNAMIC MOMENTUM: Track error count
  let forcedNextModel: string | null = null;  // ✅ 2C: For provider termination handling
  
  // ✅ 2B: Fail-fast för lib-filer (långsiktigt billig + stabil)
  const normalizedTargetFile = targetFile.replace(/\\/g, '/');
  const isLibFile = normalizedTargetFile.includes('/src/lib/') || normalizedTargetFile.includes('/lib/');
  const MAX_TOTAL_LOOPS = isLibFile ? 2 : 10;  // ✅ Fail-fast för lib (2 attempts max)
  
  // ✅ LAYER 1: NO-JSX GUARD - Prevent JSX in lib files from the start
  
  const NO_JSX_GUARD = `
🚫 ABSOLUTE RULES (MUST FOLLOW):
- This file is a pure TypeScript library module. NO JSX/TSX.
- Do NOT write React components. Do NOT use <div>, <Component>, fragments, or any tag-like syntax.
- Do NOT import React.
- Output valid TypeScript only.
- If you need UI, it belongs in /src/components or /src/app, not /src/lib.
- Return plain objects, strings, numbers, or functions - NOT JSX elements.
- ✅ NO TEMPLATE LITERALS (backticks): Use string concatenation or regular strings instead.
- ✅ Avoid backticks entirely to prevent unterminated template literal errors.
- ✅ Use single quotes (') or double quotes (") for strings, NOT backticks (\`).
`;

  // Prepend NO-JSX guard if this is a lib file
  if (isLibFile) {
    currentPrompt = `${NO_JSX_GUARD}\n\n${currentPrompt}`;
    console.log(`🚫 [NO-JSX GUARD] Applied strict no-JSX rules for lib file: ${targetFile}`);
  }
  
  console.log(`🔄 Starting multi-pass generation for ${targetFile}`)
  console.log(`   Max attempts: ${maxAttempts}`)
  console.log(`   📉 Dynamic Momentum enabled: Will extend retries if errors decrease`)
  
  for (attempts = 1; attempts <= MAX_TOTAL_LOOPS; attempts++) {
    console.log(`\n📝 Generation attempt ${attempts}/${MAX_TOTAL_LOOPS}`)
    
    try {
      // ✅ Re-apply NO-JSX guard if REMOVE_JSX strategy is active
      let promptToUse = currentPrompt;
      
      if (attempts > 1) {
        // Check if we're in REMOVE_JSX mode (from previous validation)
        const lastValidation = await validateCodeStrict('', targetFile, projectRoot).catch(() => null);
        if (lastValidation?.fixStrategy === 'REMOVE_JSX' || isLibFile) {
          promptToUse = `${NO_JSX_GUARD}\n\n${currentPrompt}`;
        }
      }
      
      // ✅ 2B: Determine task kind and route model accordingly
      const strategy = errorAnalysis.fixStrategy || '';
      const taskKind =
        strategy === "REMOVE_JSX" ||
        strategy === "JSON_REPAIR" ||
        strategy === "IMPORT_FIX" ||
        strategy === "PATCH" ||
        strategy === "VALIDATION_REPAIR" ||
        strategy === "SANITIZE"
          ? "repair"
          : inferTaskKindFromFile(targetFile);
      
      // Use forced model if set (from provider termination), otherwise route normally
      const pickedModel = forcedNextModel || routeModel({
        task: taskKind,
        phase: "coder",
        filePath: targetFile,
        reason: strategy || undefined,
      });
      
      // ✅ Ensure model is always a string (handle case where routeModel might return object)
      const modelName =
        typeof pickedModel === "string"
          ? pickedModel
          : typeof pickedModel === "object" && pickedModel && typeof (pickedModel as any).model === "string"
            ? (pickedModel as any).model
            : typeof MODELS.GEMINI_25_FLASH === "string"
              ? MODELS.GEMINI_25_FLASH
              : "gemini-2.5-flash"; // Final fallback
      
      console.log(`🤖 [ROUTING] Using ${modelName} for ${taskKind} task (attempt ${attempts}/${MAX_TOTAL_LOOPS})`)
      if (forcedNextModel) {
        console.log(`   ⚠️ Forced to ${modelName} due to provider termination`);
      }
      
      // ✅ Phase 1: Use prompt caching with cacheable blocks (only for Claude)
      const cacheableBlocks = [
        { type: 'text' as const, text: MULTI_PASS_SYSTEM_PROMPT },
        { type: 'text' as const, text: `# Repository Map\n\n${repoMap}` },
        { type: 'text' as const, text: `# Codebase Context\n\n${codebaseContext}` }
      ]
      
      // ✅ OUTPUT FORMAT (STRICT) - Inject target file path
      const relPath = targetFile.replace(/\\/g, '/'); // Normalize path
      const OUTPUT_FORMAT_STRICT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return EXACTLY one file using this wrapper:

\`\`\`typescript
// FILE: ${relPath}
<full file content>
\`\`\`

Rules:
- No other text before/after.
- No markdown headings.
- No explanations.
- Start with \`\`\`typescript and end with \`\`\`.
- The file path comment is optional but helpful.

Alternative formats (also accepted):
- [FILE: ${relPath}]
<full file content>

- ### FILE: ${relPath}
<full file content>
`;

      // Prepend OUTPUT FORMAT to user prompt
      const finalPrompt = `${OUTPUT_FORMAT_STRICT}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${promptToUse}`;
      
      // ✅ Ensure modelName is string before using .includes()
      const modelStr = String(modelName);
      
      // Generate code with caching (callAI determines provider from model name)
      let rawCode = await callAI({
        pipelineId,
        step,
        role: 'CODER',
        model: modelName,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        cacheableBlocks: modelStr.includes('claude') ? cacheableBlocks : undefined  // Only Claude supports caching
      })
      
      console.log(`   Generated ${rawCode?.length || 0} characters`)
      
      // ✅ CRITICAL FIX: Sanitize model output BEFORE any validation/caching
      // This ensures sanitized code flows through entire pipeline (cache, repair loop, etc.)
      let sanitizedCode = sanitizeModelOutput(rawCode || '', targetFile);
      
      // Track what was sanitized for debugging
      const sanitizationLog: string[] = [];
      if (sanitizedCode !== rawCode) {
        if (rawCode?.includes('declare module')) sanitizationLog.push('removedDeclareModule');
        if (rawCode?.includes('```')) sanitizationLog.push('removedFences');
        if (sanitizationLog.length > 0) {
          console.log(`   🔧 [SANITIZER] Cleaned model output: ${sanitizationLog.join(', ')}`);
        }
      }
      
      // ✅ LAYER 2: JSX Post-processor for .ts lib files (auto-sanitize, not retry loop)
      let finalCode = sanitizedCode;
      if (needsJsxSanitization(targetFile, finalCode)) {
        console.log(`🔧 [JSX SANITIZER] Detected JSX in .ts lib file. Sanitizing...`);
        const { sanitizeJsxFromTs } = await import('./lib/jsx-sanitizer');
        const sanitized = sanitizeJsxFromTs(finalCode, targetFile);
        if (sanitized.changed) {
          finalCode = sanitized.sanitized;
          console.log(`   ✅ JSX sanitized: ${sanitized.warnings.join(', ')}`);
        }
      }
      
      // ✅ Use sanitized code for all subsequent operations
      const code = finalCode;
      
      // CRITICAL: Validate BEFORE saving (defensive: ensure code exists)
      const validation = await validateCodeStrict(finalCode || '', targetFile, projectRoot)
      
      // ═══════════════════════════════════════════════════════════════════
      // 🔧 CRITICAL FIX: Don't retry config files if they're syntactically valid
      // ═══════════════════════════════════════════════════════════════════
      // Check if this is a config/data file using lenient validator
      const { validateCode: validateCodeLenient } = await import('./lib/validator');
      let lenientResult: any = null;
      try {
        lenientResult = await validateCodeLenient(code, targetFile, { attempt: attempts });
      } catch (e) {
        // Lenient validator failed, use strict validation
      }
      
      if (lenientResult && (lenientResult.fileType === 'config' || lenientResult.fileType === 'data')) {
        const reason = lenientResult.reason || '';
        if (lenientResult.valid || !reason.includes('Syntax error')) {
          console.log(`📋 ${targetFile} is a config/data file - accepting despite low complexity score`);
          // Proceed to save file - break out of retry loop
          return {
            success: true,
            code: code || '',
            attempts: attempts || 0,
            issues: Array.isArray(lenientResult.warnings) ? lenientResult.warnings : []
          };
        }
      }
      
      if (!validation.valid) {
        const currentErrorCount = validation.errors?.length || 0;
        console.log(`   ❌ Validation failed: ${currentErrorCount} errors`)
        if (validation.errors && Array.isArray(validation.errors)) {
          validation.errors.forEach((err, idx) => {
            console.log(`      ${idx + 1}. ${err}`)
          })
          
          // ✅ LAYER 3: Auto-create stubs for missing imports (prevents blocking)
          const importErrors = validation.errors.filter((e: string) => 
            e.includes('Import not found') || e.includes('Cannot find module')
          );
          if (importErrors.length > 0) {
            console.log(`   🔧 [AUTO-STUB] Detected ${importErrors.length} missing import(s). Creating stubs...`);
            const { autoCreateStubsForMissingImports } = await import('./lib/auto-stub-generator');
            await autoCreateStubsForMissingImports(importErrors, projectRoot);
            
            // Re-validate after stub creation
            const revalidation = await validateCodeStrict(finalCode || '', targetFile, projectRoot);
            if (revalidation.valid) {
              console.log(`   ✅ Validation passed after stub creation`);
              // Continue with success path below
              return {
                success: true,
                code: finalCode,
                attempts: attempts,
                issues: []
              };
            }
          }
        }
        
        // ✅ LONG-TERM FIX: Check for REMOVE_JSX strategy
        const hasJsxError = validation.errors?.some((e: string) => 
          e.includes('JSX syntax detected') && e.includes('lib/')
        );
        const fixStrategy = validation.fixStrategy || (hasJsxError ? 'REMOVE_JSX' : undefined);
        
        if (fixStrategy === 'REMOVE_JSX' || isLibFile) {
          console.log(`   🔧 REMOVE_JSX strategy: Rewriting as pure TypeScript (no JSX)`);
          // ✅ Apply NO-JSX guard + specific REMOVE_JSX instructions
          currentPrompt = `${NO_JSX_GUARD}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL FIX REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The file ${targetFile} is in src/lib/ and MUST be pure TypeScript (.ts).
JSX syntax was detected, but rename to .tsx is FORBIDDEN for lib files.

REQUIRED ACTION:
- Remove ALL JSX syntax (<tags>, React components, JSX returns)
- Rewrite as pure TypeScript functions/utilities
- Keep the same functionality but use plain TypeScript
- NO React components, NO JSX, NO <tags>

Example:
❌ BAD: return <div>Hello</div>;
✅ GOOD: return { message: "Hello" };

Current errors:
${validation.errors?.map((e: string) => `- ${e}`).join('\n') || 'JSX detected in .ts file'}

Rewrite the code as pure TypeScript with NO JSX.`;
          continue; // Try again with REMOVE_JSX prompt + NO-JSX guard
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // 📉 DYNAMIC MOMENTUM: Check if errors are decreasing
        // ═══════════════════════════════════════════════════════════════════
        if (currentErrorCount < previousErrorCount) {
          console.log(`📉 [Momentum] Progress detected (${previousErrorCount} -> ${currentErrorCount} errors). Extending retries...`);
          // Don't increment attempt counter - give it more time
          // Reset previousErrorCount to current for next comparison
          previousErrorCount = currentErrorCount;
          
          // Generate reflection for learning
          if (attempts > 1 && validation.errors && validation.errors.length > 0) {
            try {
              const reflection = await generateReflection(
                validation.errors.join('\n'),
                attempts
              )
              console.log(`   💭 Reflection: ${reflection}`)
            } catch (e) {
              // Reflection is non-critical, continue
            }
          }
          
          // Build feedback prompt for next iteration
          currentPrompt = buildFeedbackPrompt(
            prompt,
            code || '',
            validation.errors || [],
            attempts
          )
          
          // Don't increment attempts - momentum extends retries
          attempts--;  // Decrement so the for loop doesn't advance
          continue  // Try again (without consuming attempt)
        } else {
          console.warn(`⚠️ [Momentum] No progress made (${currentErrorCount} errors, was ${previousErrorCount}). Consuming retry attempt.`);
          previousErrorCount = currentErrorCount;
          
          // Check if we've exceeded the base maxAttempts limit
          if (attempts > maxAttempts) {
            console.warn(`   ⚠️ Exceeded base max attempts (${maxAttempts}), but continuing due to momentum tracking...`);
          }
          
          // Generate reflection for learning
          if (attempts > 1 && validation.errors && validation.errors.length > 0) {
            try {
              const reflection = await generateReflection(
                validation.errors.join('\n'),
                attempts
              )
              console.log(`   💭 Reflection: ${reflection}`)
            } catch (e) {
              // Reflection is non-critical, continue
            }
          }
          
          // Build feedback prompt for next iteration
          currentPrompt = buildFeedbackPrompt(
            prompt,
            code || '',
            validation.errors || [],
            attempts
          )
          
          continue  // Try again
        }
      }
      
      // If we get here, validation passed!
      previousErrorCount = 0;  // Reset for next file
      
      // ═══════════════════════════════════════════════════════════════════
      // 🔒 SYNTAX GATE: Check for TypeScript syntax errors BEFORE marking as valid
      // ═══════════════════════════════════════════════════════════════════
      if (targetFile.endsWith('.ts') || targetFile.endsWith('.tsx')) {
        const { getSyntaxErrors, getSyntaxErrorString } = await import('./lib/validation/tsSyntaxGuard');
        const syntaxErrors = getSyntaxErrors(finalCode || '', targetFile);
        
        if (syntaxErrors.length > 0) {
          const errorString = getSyntaxErrorString(finalCode || '', targetFile);
          console.log(`   ❌ [SYNTAX GATE] TypeScript syntax errors detected (${syntaxErrors.length}):`);
          console.log(`      ${errorString?.split('\n').join('\n      ') || 'Unknown syntax error'}`);
          
          // Build targeted repair prompt for syntax errors
          const syntaxErrorMessages = syntaxErrors
            .map(e => `${e.file}:${e.line}:${e.column} ${e.message}${e.code ? ` (TS${e.code})` : ''}`)
            .join('\n');
          
          currentPrompt = `${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 SYNTAX ERROR DETECTED - TARGETED REPAIR REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The generated code has TypeScript syntax errors that must be fixed:

${syntaxErrorMessages}

COMMON FIXES:
- Unterminated template literal: Check for missing closing backtick (\`)
- Unbalanced brackets: Check for missing }, ], or )
- Missing semicolon: Add semicolon if required
- Invalid type syntax: Fix type annotations

${isLibFile ? NO_JSX_GUARD : ''}

Fix ONLY the syntax errors. Do not change the logic or structure.
Return the complete, syntactically valid file.`;
          
          console.log(`   🔧 [SYNTAX GATE] Triggering targeted repair for syntax errors...`);
          continue; // Try again with syntax repair prompt
        }
      }
      
      // AST completeness check (skip for config files)
      const isConfigFile = /\.config\.(ts|js|mjs)$/.test(targetFile) || 
                           /^(next|tailwind|postcss|tsconfig|jest|vitest)\.config/.test(targetFile) ||
                           /src\/lib\/(design-system|constants|config|data)\//.test(targetFile) ||
                           /\/(colors|theme|constants|schema|types)\.(ts|js)$/.test(targetFile);
      
      if (!isConfigFile && (targetFile.endsWith('.ts') || targetFile.endsWith('.tsx'))) {
        const astResult = validateCodeCompleteness(code || '', targetFile)
        
        if (!astResult.complete) {
          const score = astResult.score || 0;
          console.log(`   ⚠️ AST check failed: score ${score.toFixed(1)}`)
          if (astResult.issues && Array.isArray(astResult.issues)) {
            astResult.issues.forEach(issue => {
              console.log(`      - ${issue}`)
            })
          }
          
          currentPrompt = buildCompletenessPrompt(
            prompt,
            code || '',
            astResult.issues || [],
            attempts || 0
          )
          
          continue  // Try again
        }
      }
      
      // SUCCESS! (Only reached if syntax is valid AND completeness check passes)
      console.log(`   ✅ Code validated successfully! (syntax + completeness)`)
      
      // ✅ LONG-TERM FIX: Only cache AFTER validation passes
      // ✅ CRITICAL: Cache SANITIZED code (not raw), so repair loops get clean code
      // This prevents caching bad code (like JSX in .ts files) and ensures sanitized code flows through
      if (validation.valid && code) {
        await semanticCache.set(prompt, targetFile, code, errorAnalysis.errorCode, true) // ✅ isValidated = true, code is sanitized
      } else {
        console.warn(`   ⚠️ Skipping cache (validation failed or no code)`);
      }
      
      // Log warnings if any
      if (Array.isArray(validation.warnings) && validation.warnings.length > 0) {
        console.log(`   ⚠️ Warnings (non-blocking):`)
        validation.warnings.forEach(warn => console.log(`      - ${warn}`))
      }
      
      return {
        success: true,
        code: code || '',
        attempts: attempts || 0,
        issues: []
      }
      
    } catch (error: any) {
      console.error(`   ❌ Generation error:`, error.message)
      
      // ✅ Claude overload exhausted - don't retry 10 times, fail fast
      // Overload = BLOCKA pipen och respektera att Claude är nere
      if (error instanceof ClaudeOverloadExhaustedError) {
        console.error(`🧯 Claude overloaded too long — marking pipeline as BLOCKED_OVERLOAD and stopping cleanly.`)
        console.error(`   Attempts: ${error.attempts}, Retry after: ${error.retryAfterMs}ms, Last message: ${error.lastMessage}`)
        // 1) Pipeline status uppdateras i DB (blocked / waiting) - hanteras av dispatcher/pipeline-runner
        // 2) File som var aktivt sparas i error message - kan resume senare
        // 3) Throw kontrollerat så dispatcher inte spinnar
        throw error; // Re-throw så outer loop kan hantera det
      }
      
      // Classify error to decide if we should retry
      // ✅ Pass filePath when available for better classification
      const analysis = classifyError({
        filePath: targetFile,
        message: error.message
      })
      
      if (analysis.fixStrategy === 'STOP') {
        console.log(`   🛑 Fatal error detected, stopping`)
        return {
          success: false,
          code: '',
          attempts,
          issues: [error.message]
        }
      }
      
      // Add error to prompt for next attempt
      currentPrompt = `${currentPrompt}



PREVIOUS ATTEMPT FAILED WITH ERROR:
${error.message}



Fix this error and regenerate COMPLETE code.`
    }
  }
  
  // Max attempts reached
  console.log(`\n❌ Failed to generate valid code after ${maxAttempts} attempts`)
  
  return {
    success: false,
    code: '',
    attempts: maxAttempts,
    issues: ['Max attempts exceeded']
  }
}

function buildFeedbackPrompt(
  originalPrompt: string,
  previousCode: string,
  errors: string[],
  attemptNumber: number
): string {
  return `${originalPrompt}



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ATTEMPT ${attemptNumber} FAILED - VALIDATION ERRORS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



${errors.map((err, idx) => `${idx + 1}. ${err}`).join('\n')}



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTIONS FOR NEXT ATTEMPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1. Read the errors above CAREFULLY

2. Fix EVERY error listed

3. Generate COMPLETE code (no placeholders)

4. Ensure all imports reference REAL files

5. Follow TypeScript strict mode rules



DO NOT make the same mistakes again.
Generate the CORRECTED, COMPLETE code now.`
}

function buildCompletenessPrompt(
  originalPrompt: string,
  previousCode: string,
  issues: string[],
  attemptNumber: number
): string {
  return `${originalPrompt}



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ATTEMPT ${attemptNumber} - CODE INCOMPLETE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



AST Analysis found incomplete implementations:



${issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')}



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: You wrote empty or stub functions.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Every function MUST have a COMPLETE implementation:

- No empty function bodies

- No "return null" without logic

- No "// TODO: implement"

- At least 3 statements per function



Regenerate with FULL implementations for all functions.`
}

const MULTI_PASS_SYSTEM_PROMPT = `You are a production code generator that iterates until perfection.



CRITICAL RULES:

1. NEVER write placeholder code (TODO, FIXME, mock data)

2. EVERY function must be fully implemented

3. ALL imports must reference EXISTING files

4. Follow file extension rules (.ts vs .tsx)

5. Use TypeScript strict mode



YOU ARE IN A FEEDBACK LOOP:

- If your previous attempt failed, you will see validation errors

- You MUST fix those exact errors

- You will be given multiple attempts

- Do NOT repeat the same mistakes



Your goal: Generate code that passes ALL validation checks on first try.

Quality over speed. Completeness over brevity.`

/**
 * Build codebase context for caching (Phase 1)
 */
async function buildCodebaseContext(projectRoot: string): Promise<string> {
  try {
    const srcPath = path.join(projectRoot, 'src')
    const appPath = path.join(projectRoot, 'app')
    
    let context = '# Codebase Context\n\n'
    
    // List key files
    const keyFiles = [
      'package.json',
      'tsconfig.json',
      'next.config.mjs',
      'tailwind.config.ts'
    ]
    
    for (const file of keyFiles) {
      const filePath = path.join(projectRoot, file)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        context += `## ${file}\n\`\`\`\n${content.slice(0, 500)}\n\`\`\`\n\n`
      }
    }
    
    return context
  } catch (e) {
    return '\n(Codebase context unavailable)\n'
  }
}

