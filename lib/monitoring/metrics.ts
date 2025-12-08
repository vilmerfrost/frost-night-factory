// =============================================================================
// PROMETHEUS METRICS - Monitoring & Observability
// =============================================================================

// Note: prom-client is optional - metrics work without it
let promClient: typeof import('prom-client') | null = null;

try {
  promClient = require('prom-client');
} catch {
  console.warn('⚠️ prom-client not installed - metrics disabled. Install with: npm install prom-client');
}

// =============================================================================
// QUARANTINE METRICS
// =============================================================================

export const quarantineReceived = promClient
  ? new promClient.Counter({
      name: 'quarantine_artifacts_received_total',
      help: 'Total artifacts received in quarantine',
    })
  : null;

export const quarantineRejected = promClient
  ? new promClient.Counter({
      name: 'quarantine_artifacts_rejected_total',
      help: 'Total artifacts rejected',
      labelNames: ['reason'],
    })
  : null;

export const quarantineValidated = promClient
  ? new promClient.Counter({
      name: 'quarantine_artifacts_validated_total',
      help: 'Total artifacts validated successfully',
    })
  : null;

export const quarantineValidationDuration = promClient
  ? new promClient.Histogram({
      name: 'quarantine_validation_duration_seconds',
      help: 'Time spent validating artifacts',
      buckets: [0.1, 0.5, 1, 2, 5],
    })
  : null;

// =============================================================================
// PIPELINE METRICS
// =============================================================================

export const pipelinePhaseTransitions = promClient
  ? new promClient.Counter({
      name: 'pipeline_phase_transitions_total',
      help: 'Pipeline phase transitions',
      labelNames: ['from_phase', 'to_phase', 'status'],
    })
  : null;

export const activeWorkers = promClient
  ? new promClient.Gauge({
      name: 'pipeline_active_workers',
      help: 'Number of active pipeline workers',
    })
  : null;

export const errorLoopDetections = promClient
  ? new promClient.Counter({
      name: 'error_loop_detections_total',
      help: 'Number of error loops detected',
      labelNames: ['error_type'],
    })
  : null;

export const pipelineErrors = promClient
  ? new promClient.Counter({
      name: 'pipeline_errors_total',
      help: 'Total pipeline errors',
      labelNames: ['error_type', 'phase'],
    })
  : null;

export const pipelineDuration = promClient
  ? new promClient.Histogram({
      name: 'pipeline_duration_seconds',
      help: 'Pipeline execution duration',
      labelNames: ['phase'],
      buckets: [10, 30, 60, 120, 300, 600],
    })
  : null;

// =============================================================================
// METAMORPHIC VALIDATION METRICS
// =============================================================================

export const metamorphicValidations = promClient
  ? new promClient.Counter({
      name: 'metamorphic_validations_total',
      help: 'Total metamorphic validations',
      labelNames: ['result'],
    })
  : null;

export const metamorphicConsistency = promClient
  ? new promClient.Histogram({
      name: 'metamorphic_consistency_score',
      help: 'Consistency score from metamorphic validation',
      buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0],
    })
  : null;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function incQuarantineReceived(): void {
  quarantineReceived?.inc();
}

export function incQuarantineRejected(reason: string): void {
  quarantineRejected?.inc({ reason: reason.substring(0, 50) });
}

export function incQuarantineValidated(): void {
  quarantineValidated?.inc();
}

export function recordValidationDuration(seconds: number): void {
  quarantineValidationDuration?.observe(seconds);
}

export function incPipelinePhaseTransition(from: string, to: string, status: string): void {
  pipelinePhaseTransitions?.inc({ from_phase: from, to_phase: to, status });
}

export function setActiveWorkers(count: number): void {
  activeWorkers?.set(count);
}

export function incErrorLoopDetection(errorType: string): void {
  errorLoopDetections?.inc({ error_type: errorType });
}

export function incPipelineError(errorType: string, phase: string): void {
  pipelineErrors?.inc({ error_type: errorType, phase });
}

export function recordPipelineDuration(seconds: number, phase: string): void {
  pipelineDuration?.observe({ phase }, seconds);
}

export function incMetamorphicValidation(result: 'passed' | 'failed'): void {
  metamorphicValidations?.inc({ result });
}

export function recordMetamorphicConsistency(score: number): void {
  metamorphicConsistency?.observe(score);
}

// =============================================================================
// METRICS ENDPOINT
// =============================================================================

export async function getMetrics(): Promise<string> {
  if (!promClient) {
    return '# Metrics disabled - prom-client not installed\n';
  }
  
  return await promClient.register.metrics();
}

export function setupMetricsEndpoint(app: any): void {
  if (!promClient) {
    console.warn('⚠️ Metrics endpoint not available - prom-client not installed');
    return;
  }
  
  app.get('/metrics', async (req: any, res: any) => {
    try {
      res.set('Content-Type', promClient!.register.contentType);
      const metrics = await promClient!.register.metrics();
      res.end(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  console.log('✅ Metrics endpoint available at /metrics');
}

// =============================================================================
// METRICS SUMMARY (for logging)
// =============================================================================

export function getMetricsSummary(): Record<string, number> {
  if (!promClient) {
    return { enabled: 0 };
  }
  
  // This is a simplified summary - in production, query Prometheus
  return {
    enabled: 1,
    note: 'Use Prometheus to query full metrics',
  };
}

