// =============================================================================
// ADAPTIVE UX THRESHOLDS - Tighten thresholds over time
// =============================================================================

import { supabase } from '../supabase-client';

export interface ThresholdConfig {
  phase: 'initial' | 'stabilizing' | 'mature';
  minUXScore: number;
  minVisualHierarchy: number;
  minCTAClarity: number;
  minClutter: number;
  minConsistency: number;
  description: string;
}

const THRESHOLD_CONFIGS: Record<string, ThresholdConfig> = {
  initial: {
    phase: 'initial',
    minUXScore: 6.0, // Lenient - let pipelines pass
    minVisualHierarchy: 6.0,
    minCTAClarity: 6.0,
    minClutter: 6.0,
    minConsistency: 6.0,
    description: 'Initial phase - lenient thresholds to establish baseline',
  },
  stabilizing: {
    phase: 'stabilizing',
    minUXScore: 7.0, // Moderate - raise bar as golden shells stabilize
    minVisualHierarchy: 7.0,
    minCTAClarity: 7.0,
    minClutter: 7.0,
    minConsistency: 7.0,
    description: 'Stabilizing phase - golden shells are stable, raise standards',
  },
  mature: {
    phase: 'mature',
    minUXScore: 8.0, // Strict - only high-quality layouts pass
    minVisualHierarchy: 8.0,
    minCTAClarity: 8.0,
    minClutter: 8.0,
    minConsistency: 8.0,
    description: 'Mature phase - strict thresholds, borderline cases go to needs_review',
  },
};

/**
 * Determine current threshold phase based on pipeline history
 */
export async function getCurrentThresholdPhase(): Promise<ThresholdConfig> {
  try {
    // Check last 30 days of pipeline success rates
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { data: pipelines, error } = await supabase
      .from('pipelines')
      .select('status, metadata')
      .gte('created_at', cutoffDate.toISOString());

    if (error || !pipelines || pipelines.length === 0) {
      // No history - use initial phase
      return THRESHOLD_CONFIGS.initial;
    }

    const totalPipelines = pipelines.length;
    const successfulPipelines = pipelines.filter(
      p => p.status === 'completed' || p.status === 'published'
    ).length;
    const successRate = successfulPipelines / totalPipelines;

    // Check average UX scores from metadata
    const uxScores = pipelines
      .map(p => {
        const metadata = p.metadata as any;
        return metadata?.visualAudit?.score || metadata?.uxScore || 0;
      })
      .filter(score => score > 0);

    const avgUXScore = uxScores.length > 0
      ? uxScores.reduce((a, b) => a + b, 0) / uxScores.length
      : 0;

    // Determine phase based on success rate and average UX score
    if (successRate >= 0.85 && avgUXScore >= 7.5) {
      // High success rate + high UX scores = mature phase
      return THRESHOLD_CONFIGS.mature;
    } else if (successRate >= 0.70 && avgUXScore >= 6.5) {
      // Moderate success rate + moderate UX scores = stabilizing phase
      return THRESHOLD_CONFIGS.stabilizing;
    } else {
      // Low success rate or low UX scores = initial phase
      return THRESHOLD_CONFIGS.initial;
    }
  } catch (error: any) {
    console.warn(`⚠️ Failed to determine threshold phase: ${error.message}`);
    // Default to initial phase on error
    return THRESHOLD_CONFIGS.initial;
  }
}

/**
 * Get current UX threshold
 */
export async function getUXThreshold(): Promise<number> {
  const config = await getCurrentThresholdPhase();
  return config.minUXScore;
}

/**
 * Check if UX score passes current threshold
 */
export async function passesUXThreshold(score: number): Promise<boolean> {
  const threshold = await getUXThreshold();
  return score >= threshold;
}

/**
 * Get full threshold configuration
 */
export async function getThresholdConfig(): Promise<ThresholdConfig> {
  return await getCurrentThresholdPhase();
}

/**
 * Manually set threshold phase (for testing or forced transitions)
 */
export async function setThresholdPhase(phase: 'initial' | 'stabilizing' | 'mature'): Promise<void> {
  // Store in a feature flag or config table
  try {
    await supabase.from('system_config').upsert({
      key: 'ux_threshold_phase',
      value: phase,
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn(`⚠️ Failed to set threshold phase: ${error.message}`);
  }
}

