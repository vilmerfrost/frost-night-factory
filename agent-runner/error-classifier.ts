// agent-runner/error-classifier.ts
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ErrorClass =
  | 'TS_UNUSED'         // TS6133 - unused imports
  | 'TS_SYNTAX'         // TS1005, TS1161 - JSX in .ts
  | 'TS_TYPE'           // TS2339, TS2741 - type mismatches
  | 'MISSING_MODULE'    // TS2307 - can't find module
  | 'DB_STATE'          // PGRST116, SQL errors
  | 'AI_PLACEHOLDER'    // Detected by validator
  | 'RUNTIME'           // Node/Python execution errors
  | 'INFRA'             // ENOENT, timeouts, network

export interface ErrorAnalysis {
  classification: ErrorClass
  errorCode: string
  errorSignature: string
  fixStrategy: 'SANITIZE' | 'REGEN' | 'GOLDEN_TEMPLATE' | 'AI_FIX' | 'STOP'
  maxRetries: number
  backoffMs: number
  canCache: boolean
}

export function classifyError(errorLog: string): ErrorAnalysis {
  const log = errorLog.toLowerCase()
  
  // ═══════════════════════════════════════════════════════════════
  // TS_UNUSED - Auto-fixable with sanitizer
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('ts6133') || log.includes('declared but never')) {
    return {
      classification: 'TS_UNUSED',
      errorCode: 'TS6133',
      errorSignature: generateSignature('TS6133', errorLog),
      fixStrategy: 'SANITIZE',
      maxRetries: 10,  // ✅ Increased from 5 (industry standard: 10-50x)
      backoffMs: 0,
      canCache: true
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TS_SYNTAX - JSX in .ts files
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('ts1005') || log.includes('ts1161') || log.includes('expected')) {
    return {
      classification: 'TS_SYNTAX',
      errorCode: 'TS1005',
      errorSignature: generateSignature('TS1005', errorLog),
      fixStrategy: 'GOLDEN_TEMPLATE', // Or auto-rename .ts → .tsx
      maxRetries: 2,
      backoffMs: 0,
      canCache: true
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MISSING_MODULE - File doesn't exist
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('ts2307') || log.includes('cannot find module')) {
    return {
      classification: 'MISSING_MODULE',
      errorCode: 'TS2307',
      errorSignature: generateSignature('TS2307', errorLog),
      fixStrategy: 'AI_FIX',
      maxRetries: 8,  // ✅ Increased from 3 (industry standard: 10-50x)
      backoffMs: 500,
      canCache: false // Each missing file is unique
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TS_TYPE - Type mismatches
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('ts2339') || log.includes('ts2741') || log.includes('does not exist on type')) {
    return {
      classification: 'TS_TYPE',
      errorCode: 'TS2339',
      errorSignature: generateSignature('TS2339', errorLog),
      fixStrategy: 'AI_FIX',
      maxRetries: 3,
      backoffMs: 500,
      canCache: true
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // AI_PLACEHOLDER - Validator caught it
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('placeholder detected') || log.includes('mock data') || log.includes('todo')) {
    return {
      classification: 'AI_PLACEHOLDER',
      errorCode: 'PLACEHOLDER',
      errorSignature: generateSignature('PLACEHOLDER', errorLog),
      fixStrategy: 'REGEN',
      maxRetries: 10,  // ✅ Increased from 2 (critical: must eliminate placeholders)
      backoffMs: 0,
      canCache: false
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // DB_STATE - Database/Supabase errors (FATAL)
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('pgrst') || log.includes('database') || log.includes('sql')) {
    return {
      classification: 'DB_STATE',
      errorCode: 'DB_ERROR',
      errorSignature: generateSignature('DB', errorLog),
      fixStrategy: 'STOP',
      maxRetries: 1,
      backoffMs: 0,
      canCache: false
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INFRA - File system, network errors (FATAL)
  // ═══════════════════════════════════════════════════════════════
  if (log.includes('enoent') || log.includes('timeout') || log.includes('econnreset')) {
    return {
      classification: 'INFRA',
      errorCode: 'INFRA',
      errorSignature: generateSignature('INFRA', errorLog),
      fixStrategy: 'STOP',
      maxRetries: 1,
      backoffMs: 0,
      canCache: false
    }
  }
  
  // Default: Runtime error
  return {
    classification: 'RUNTIME',
    errorCode: 'RUNTIME',
    errorSignature: generateSignature('RUNTIME', errorLog),
    fixStrategy: 'AI_FIX',
    maxRetries: 2,
    backoffMs: 1000,
    canCache: false
  }
}

function generateSignature(errorType: string, fullLog: string): string {
  // Normalize: remove numbers, UUIDs, paths
  const normalized = fullLog
    .replace(/\d+/g, 'N')
    .replace(/[a-f0-9-]{36}/gi, 'UUID')
    .replace(/\/[\w\/.-]+/g, '/PATH')
    .slice(0, 500) // Limit length
  
  return crypto.createHash('sha256')
    .update(`${errorType}:${normalized}`)
    .digest('hex')
    .slice(0, 16)
}

export async function recordErrorPattern(
  analysis: ErrorAnalysis,
  success: boolean,
  goldenPatch?: any
): Promise<void> {
  try {
    // Check if pattern exists
    const { data: existing } = await supabase
      .from('error_patterns')
      .select('*')
      .eq('error_signature', analysis.errorSignature)
      .maybeSingle()
    
    if (existing) {
      // Update existing pattern
      const totalOccurrences = existing.occurrences + 1
      const successCount = success ? (existing.success_rate * existing.occurrences + 1) : (existing.success_rate * existing.occurrences)
      const newSuccessRate = successCount / totalOccurrences
      
      await supabase
        .from('error_patterns')
        .update({
          occurrences: totalOccurrences,
          success_rate: newSuccessRate,
          last_seen_at: new Date().toISOString(),
          ...(goldenPatch ? { golden_patch: goldenPatch } : {})
        })
        .eq('error_signature', analysis.errorSignature)
      
      console.log(`📊 Updated error pattern: ${analysis.errorCode} (${totalOccurrences} occurrences, ${(newSuccessRate * 100).toFixed(1)}% success)`)
    } else {
      // Create new pattern
      await supabase
        .from('error_patterns')
        .insert({
          error_code: analysis.errorCode,
          error_signature: analysis.errorSignature,
          classification: analysis.classification,
          fix_strategy: analysis.fixStrategy,
          occurrences: 1,
          success_rate: success ? 1.0 : 0.0,
          golden_patch: goldenPatch || null
        })
      
      console.log(`📝 Created new error pattern: ${analysis.errorCode}`)
    }
  } catch (error) {
    console.error('Failed to record error pattern:', error)
    // Don't throw - this is non-critical
  }
}

/**
 * Generate reflection on why code generation failed
 * Used in multi-pass generation to learn from mistakes
 */
export async function generateReflection(
  errorLog: string,
  attemptNumber: number
): Promise<string> {
  try {
    const { callAI, selectModel } = await import('./ai-client')
    
    // Use cheap model for reflection
    const reflection = await callAI({
      pipelineId: 'reflection',
      step: 'reflection',
      role: 'REVIEWER',
      model: selectModel('REVIEWER'),  // Usually cheaper model
      messages: [
        {
          role: 'system',
          content: `You are a debugging expert analyzing why code generation failed.

Generate a SHORT (2-3 sentences) reflection on:
1. What went wrong
2. What should be done differently next time

Be specific and actionable.`
        },
        {
          role: 'user',
          content: `Attempt ${attemptNumber} failed with this error:

${errorLog}

What lesson should we learn for the next attempt?`
        }
      ]
    })
    
    return reflection
  } catch (error) {
    console.error('Failed to generate reflection:', error)
    return `Previous attempt failed. Review errors carefully and fix all issues.`
  }
}

