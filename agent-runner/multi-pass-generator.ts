// agent-runner/multi-pass-generator.ts
import { callAI, selectModel } from './ai-client'
import { validateCode } from './code-validator'
import { validateCodeCompleteness } from './ast-validator'
import { classifyError, generateReflection } from './error-classifier'
import { semanticCache } from './semantic-cache'  // ✅ Phase 2: Semantic caching
import { selectOptimalModel, estimateComplexity, getModelName } from './model-router'  // ✅ Phase 3: Smart routing
import { generateRepositoryMap } from './repo-map-generator'  // ✅ Phase 1: For caching
import * as fs from 'fs'
import * as path from 'path'

export interface GenerationResult {
  success: boolean
  code: string
  attempts: number
  issues: string[]
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
  maxAttempts: number = 10
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
  
  // ✅ Phase 2: Check semantic cache BEFORE generating
  const cacheKey = `${step}:${targetFile}:${prompt.slice(0, 500)}`
  const errorAnalysis = classifyError(prompt) // Extract error type for cache lookup
  const cached = await semanticCache.get(cacheKey, errorAnalysis.errorCode, 0.92)
  
  if (cached.hit && cached.response) {
    console.log(`🎉 [SEMANTIC CACHE] Using cached response (${(cached.similarity! * 100).toFixed(1)}% similarity)`)
    
    // Still validate to be safe
    const validation = validateCode(cached.response, targetFile, projectRoot)
    
    if (validation.valid) {
      return {
        success: true,
        code: cached.response,
        attempts: 0,  // No AI call made!
        issues: []
      }
    } else {
      console.log(`⚠️ [SEMANTIC CACHE] Cached response failed validation, regenerating...`)
    }
  }
  
  let currentPrompt = prompt
  let attempts = 0
  
  console.log(`🔄 Starting multi-pass generation for ${targetFile}`)
  console.log(`   Max attempts: ${maxAttempts}`)
  
  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    console.log(`\n📝 Generation attempt ${attempts}/${maxAttempts}`)
    
    try {
      // ✅ Phase 3: Smart model routing based on complexity
      const complexity = estimateComplexity(currentPrompt, 1) // Single file for now
      const modelConfig = selectOptimalModel(errorAnalysis.errorCode, complexity, attempts)
      const modelName = getModelName(modelConfig)
      
      console.log(`🤖 [ROUTING] Using ${modelName} (${modelConfig.provider}) for ${complexity} task (attempt ${attempts})`)
      console.log(`   💰 Cost: $${modelConfig.inputCost}/M input, $${modelConfig.outputCost}/M output`)
      
      // ✅ Phase 1: Use prompt caching with cacheable blocks
      const cacheableBlocks = [
        { type: 'text' as const, text: MULTI_PASS_SYSTEM_PROMPT },
        { type: 'text' as const, text: `# Repository Map\n\n${repoMap}` },
        { type: 'text' as const, text: `# Codebase Context\n\n${codebaseContext}` }
      ]
      
      // Generate code with caching
      const code = await callAI({
        pipelineId,
        step,
        role: 'CODER',
        model: modelName,
        messages: [
          { role: 'user', content: currentPrompt }
        ],
        cacheableBlocks: modelName.startsWith('claude') ? cacheableBlocks : undefined  // Only Claude supports caching
      })
      
      console.log(`   Generated ${code.length} characters`)
      
      // CRITICAL: Validate BEFORE saving
      const validation = validateCode(code, targetFile, projectRoot)
      
      if (!validation.valid) {
        console.log(`   ❌ Validation failed: ${validation.errors.length} errors`)
        validation.errors.forEach((err, idx) => {
          console.log(`      ${idx + 1}. ${err}`)
        })
        
        // Generate reflection for learning
        if (attempts > 1) {
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
          code,
          validation.errors,
          attempts
        )
        
        continue  // Try again
      }
      
      // AST completeness check
      if (targetFile.endsWith('.ts') || targetFile.endsWith('.tsx')) {
        const astResult = validateCodeCompleteness(code, targetFile)
        
        if (!astResult.complete) {
          console.log(`   ⚠️ AST check failed: score ${astResult.score.toFixed(1)}`)
          astResult.issues.forEach(issue => {
            console.log(`      - ${issue}`)
          })
          
          currentPrompt = buildCompletenessPrompt(
            prompt,
            code,
            astResult.issues,
            attempts
          )
          
          continue  // Try again
        }
      }
      
      // SUCCESS!
      console.log(`   ✅ Code validated successfully!`)
      
      // ✅ Phase 2: Cache successful generation
      await semanticCache.set(cacheKey, code, errorAnalysis.errorCode)
      
      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.log(`   ⚠️ Warnings (non-blocking):`)
        validation.warnings.forEach(warn => console.log(`      - ${warn}`))
      }
      
      return {
        success: true,
        code,
        attempts,
        issues: []
      }
      
    } catch (error: any) {
      console.error(`   ❌ Generation error:`, error.message)
      
      // Classify error to decide if we should retry
      const analysis = classifyError(error.message)
      
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

