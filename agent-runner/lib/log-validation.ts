// agent-runner/lib/log-validation.ts
// Logs validation results to database for observability

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export interface ValidationLogResult {
  passed: boolean;
  errorsFound: number;
  autoFixed: number;
  costUsd: number;
  errors?: any[];
  fixedFiles?: string[];
}

/**
 * Log validation result to database
 */
export async function logValidationResult(
  pipelineId: string,
  validationType: string,
  result: ValidationLogResult
): Promise<void> {
  if (!supabase) {
    console.warn('⚠️  Supabase not configured, skipping validation log');
    return;
  }

  try {
    await supabase.from('pipeline_steps').insert({
      pipeline_id: pipelineId,
      name: `${validationType}_check`,
      status: result.passed ? 'completed' : 'failed',
      output: {
        errors_found: result.errorsFound,
        auto_fixed: result.autoFixed,
        cost_usd: result.costUsd,
        errors: result.errors || [],
        fixed_files: result.fixedFiles || [],
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    console.log(`📊 [Validation Log] ${validationType}: ${result.passed ? 'PASSED' : 'FAILED'} (${result.errorsFound} errors, ${result.autoFixed} fixed)`);
  } catch (error: any) {
    console.warn(`⚠️  Failed to log validation result: ${error.message}`);
    // Don't throw - logging failure shouldn't break pipeline
  }
}

/**
 * Get validation history for a pipeline
 */
export async function getValidationHistory(
  pipelineId: string
): Promise<ValidationLogResult[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data } = await supabase
      .from('pipeline_steps')
      .select('output, name, status, created_at')
      .eq('pipeline_id', pipelineId)
      .like('name', '%_validation%')
      .order('created_at', { ascending: true });

    return (data || []).map((step: any) => ({
      passed: step.status === 'completed',
      errorsFound: step.output?.errors_found || 0,
      autoFixed: step.output?.auto_fixed || 0,
      costUsd: step.output?.cost_usd || 0,
      errors: step.output?.errors || [],
      fixedFiles: step.output?.fixed_files || [],
    }));
  } catch (error: any) {
    console.warn(`⚠️  Failed to get validation history: ${error.message}`);
    return [];
  }
}

