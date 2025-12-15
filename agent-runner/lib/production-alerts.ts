// =============================================================================
// PRODUCTION ALERTS - Monitor cost spikes and success rate drops
// =============================================================================

import { supabase } from '../supabase-client';

export interface Alert {
  id: string;
  type: 'cost_spike' | 'success_rate_drop' | 'model_failure';
  severity: 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Check for cost spikes per model per day
 */
export async function checkCostSpikes(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    // Get cost summary for last 7 days (using CostTracker instance)
    const tracker = new (await import('./cost-tracker')).CostTracker();
    const summary7d = tracker.getSummary(7);
    const summary1d = tracker.getSummary(1);

    // Calculate average daily cost per model
    const avgDailyCost: Record<string, number> = {};
    const byModel7d = (summary7d as any).byModel || {};
    for (const [model, totalCost] of Object.entries(byModel7d)) {
      const cost = Number(totalCost);
      if (Number.isFinite(cost)) {
        avgDailyCost[model] = cost / 7; // Average over 7 days
      }
    }

    // Check if today's cost exceeds 2x average
    const byModel1d = (summary1d as any).byModel || {};
    for (const [model, todayCostRaw] of Object.entries(byModel1d)) {
      const todayCost = Number(todayCostRaw);
      if (!Number.isFinite(todayCost)) continue;
      
      const avgCost = avgDailyCost[model] || 0;
      if (avgCost > 0 && todayCost > avgCost * 2) {
        alerts.push({
          id: `cost-spike-${model}-${Date.now()}`,
          type: 'cost_spike',
          severity: todayCost > avgCost * 3 ? 'critical' : 'warning',
          message: `Cost spike detected for ${model}: $${todayCost.toFixed(2)} today (avg: $${avgCost.toFixed(2)}/day)`,
          details: {
            model,
            todayCost,
            avgDailyCost: avgCost,
            multiplier: (todayCost / avgCost).toFixed(2),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error: any) {
    console.warn(`⚠️ Failed to check cost spikes: ${error.message}`);
  }

  return alerts;
}

/**
 * Check for sudden drop in success rate
 */
export async function checkSuccessRateDrop(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Get pipelines from last 7 days, grouped by day
    const { data: pipelines, error } = await supabase
      .from('pipelines')
      .select('status, created_at, current_phase')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error || !pipelines || pipelines.length === 0) {
      return alerts;
    }

    // Group by day
    const byDay: Record<string, { total: number; success: number }> = {};
    pipelines.forEach((pipeline) => {
      const day = new Date(pipeline.created_at).toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { total: 0, success: 0 };
      }
      byDay[day].total++;
      if (pipeline.status === 'completed' || pipeline.status === 'published') {
        byDay[day].success++;
      }
    });

    // Calculate success rates
    const successRates: Array<{ date: string; rate: number }> = [];
    for (const [date, stats] of Object.entries(byDay)) {
      successRates.push({
        date,
        rate: stats.success / stats.total,
      });
    }

    // Sort by date (most recent first)
    successRates.sort((a, b) => b.date.localeCompare(a.date));

    if (successRates.length >= 2) {
      const todayRate = successRates[0].rate;
      const yesterdayRate = successRates[1].rate;

      // Alert if success rate dropped by more than 20%
      if (yesterdayRate > 0 && todayRate < yesterdayRate * 0.8) {
        alerts.push({
          id: `success-rate-drop-${Date.now()}`,
          type: 'success_rate_drop',
          severity: todayRate < yesterdayRate * 0.6 ? 'critical' : 'warning',
          message: `Success rate dropped: ${(todayRate * 100).toFixed(1)}% today (was ${(yesterdayRate * 100).toFixed(1)}% yesterday)`,
          details: {
            todayRate,
            yesterdayRate,
            drop: ((yesterdayRate - todayRate) / yesterdayRate * 100).toFixed(1) + '%',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error: any) {
    console.warn(`⚠️ Failed to check success rate: ${error.message}`);
  }

  return alerts;
}

/**
 * Check for model failures
 */
export async function checkModelFailures(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24); // Last 24 hours

    const { data: errors, error } = await supabase
      .from('error_events')
      .select('error_type, error_message, created_at')
      .gte('created_at', cutoffDate.toISOString())
      .ilike('error_message', '%timeout%')
      .or('error_message.ilike.%401%,error_message.ilike.%429%');

    if (error || !errors || errors.length === 0) {
      return alerts;
    }

    // Group by error type
    const byType: Record<string, number> = {};
    errors.forEach((e) => {
      byType[e.error_type || 'unknown'] = (byType[e.error_type || 'unknown'] || 0) + 1;
    });

    // Alert if any error type has > 5 occurrences
    for (const [errorType, count] of Object.entries(byType)) {
      if (count > 5) {
        alerts.push({
          id: `model-failure-${errorType}-${Date.now()}`,
          type: 'model_failure',
          severity: count > 10 ? 'critical' : 'warning',
          message: `Model failures detected: ${count} ${errorType} errors in last 24h`,
          details: {
            errorType,
            count,
            timeWindow: '24h',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error: any) {
    console.warn(`⚠️ Failed to check model failures: ${error.message}`);
  }

  return alerts;
}

/**
 * Run all alert checks
 */
export async function runAlertChecks(): Promise<Alert[]> {
  const allAlerts: Alert[] = [];

  const [costAlerts, successRateAlerts, modelFailureAlerts] = await Promise.all([
    checkCostSpikes(),
    checkSuccessRateDrop(),
    checkModelFailures(),
  ]);

  allAlerts.push(...costAlerts);
  allAlerts.push(...successRateAlerts);
  allAlerts.push(...modelFailureAlerts);

  // Save alerts to database
  if (allAlerts.length > 0) {
    try {
      await supabase.from('production_alerts').insert(
        allAlerts.map(alert => ({
          alert_type: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          created_at: alert.timestamp,
        }))
      );
    } catch (error: any) {
      console.warn(`⚠️ Failed to save alerts: ${error.message}`);
    }
  }

  return allAlerts;
}

