// =============================================================================
// COST TRACKER - Logs costs per pipeline and phase for dashboard
// =============================================================================

import { supabase } from '../supabase-client';

export interface CostLog {
  pipeline_id: string;
  phase: string;
  model: string;
  provider: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number;
  fix_attempts?: number;
  success: boolean;
}

/**
 * Log cost for a phase
 */
export async function logCost(
  pipelineId: string,
  phase: string,
  model: string,
  provider: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
  durationMs: number,
  success: boolean,
  fixAttempts?: number
): Promise<void> {
  try {
    // Store in Supabase (create table if needed)
    const { error } = await supabase.from('ai_cost_logs').insert({
      pipeline_id: pipelineId,
      phase,
      model,
      provider,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      duration_ms: durationMs,
      fix_attempts: fixAttempts || 0,
      success,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Table might not exist, log warning but don't fail
      console.warn(`⚠️ Could not log cost to database: ${error.message}`);
    } else {
      console.log(`💰 Cost logged: $${costUsd.toFixed(4)} (${model}, ${phase})`);
    }
  } catch (err: any) {
    console.warn(`⚠️ Cost logging failed: ${err.message}`);
  }
}

/**
 * Get cost summary for dashboard
 */
export async function getCostSummary(
  days: number = 7
): Promise<{
  total: number;
  byModel: Record<string, number>;
  byPhase: Record<string, number>;
  averagePerPipeline: number;
  pipelines: number;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('ai_cost_logs')
      .select('*')
      .gte('created_at', cutoffDate.toISOString());

    if (error) {
      console.warn(`⚠️ Could not fetch cost summary: ${error.message}`);
      return {
        total: 0,
        byModel: {},
        byPhase: {},
        averagePerPipeline: 0,
        pipelines: 0,
      };
    }

    const logs = (data || []) as CostLog[];

    const byModel: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const pipelines = new Set<string>();

    let total = 0;

    logs.forEach((log) => {
      total += log.cost_usd;
      pipelines.add(log.pipeline_id);

      byModel[log.model] = (byModel[log.model] || 0) + log.cost_usd;
      byPhase[log.phase] = (byPhase[log.phase] || 0) + log.cost_usd;
    });

    const averagePerPipeline = pipelines.size > 0 ? total / pipelines.size : 0;

    return {
      total,
      byModel,
      byPhase,
      averagePerPipeline,
      pipelines: pipelines.size,
    };
  } catch (err: any) {
    console.warn(`⚠️ Cost summary failed: ${err.message}`);
    return {
      total: 0,
      byModel: {},
      byPhase: {},
      averagePerPipeline: 0,
      pipelines: 0,
    };
  }
}
