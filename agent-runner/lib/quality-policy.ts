// =============================================================================
// QUALITY POLICY - Centralized Quality Gates
// =============================================================================
// Single source of truth for all quality gates
// Prevents AI from making the same mistakes by enforcing hard rules

export interface QualityGateResult {
  passed: boolean;
  reason?: string;
  critical?: boolean; // If true, cannot be overridden
  details?: Record<string, any>;
}

export interface VisionGateResult extends QualityGateResult {
  score?: number;
  cannotEvaluate?: boolean;
}

export interface E2EGateResult extends QualityGateResult {
  passedTests: number;
  failedTests: number;
  totalTests: number;
  failures?: Array<{ test: string; error: string; critical?: boolean }>;
}

export interface LighthouseGateResult extends QualityGateResult {
  scores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  auditRan?: boolean;
}

export interface BuildGateResult extends QualityGateResult {
  buildExists?: boolean;
  buildHash?: string;
}

/**
 * Quality Policy Configuration
 * Adjust these thresholds as needed
 */
export const QUALITY_POLICY = {
  // Vision Audit
  visionMinScore: 8,
  visionRequired: true,
  
  // E2E Tests
  e2eRequired: true,
  e2eCriticalFailures: [
    'Homepage shows 404',
    'Homepage failed to load',
    'Homepage returned',
  ],
  
  // Lighthouse Performance
  lighthouseRequired: true,
  lighthouseMinScores: {
    performance: 70,
    accessibility: 70,
    bestPractices: 70,
    seo: 70,
  },
  
  // Build Artifacts
  buildRequired: true,
} as const;

/**
 * Vision Quality Gate
 * Blocks publish if vision score < threshold or cannot evaluate
 */
export function canPublishFromVision(
  score: number | undefined,
  cannotEvaluate?: boolean,
  reason?: string
): VisionGateResult {
  // ✅ CRITICAL: Cannot evaluate = hard fail
  if (cannotEvaluate || reason?.includes('no code') || reason?.includes('cannot audit')) {
    return {
      passed: false,
      critical: true,
      score: 0,
      cannotEvaluate: true,
      reason: reason || 'Cannot evaluate - no code/context available',
    };
  }
  
  // ✅ CRITICAL: Score must be valid number
  if (!Number.isFinite(score)) {
    return {
      passed: false,
      critical: true,
      reason: 'Vision score is not a valid number',
    };
  }
  
  // ✅ CRITICAL: Score must meet threshold
  if (score! < QUALITY_POLICY.visionMinScore) {
    return {
      passed: false,
      critical: true,
      score: score!,
      reason: `Vision score ${score}/10 is below threshold of ${QUALITY_POLICY.visionMinScore}/10`,
    };
  }
  
  return {
    passed: true,
    score: score!,
  };
}

/**
 * E2E Quality Gate
 * Blocks publish if any E2E test fails, especially critical failures
 */
export function canPublishFromE2E(
  passed: number,
  failed: number,
  failures?: Array<{ test: string; error: string }>
): E2EGateResult {
  if (!QUALITY_POLICY.e2eRequired) {
    return {
      passed: true,
      passedTests: passed,
      failedTests: failed,
      totalTests: passed + failed,
    };
  }
  
  // ✅ CRITICAL: Any failure blocks publish
  if (failed > 0) {
    // Check for critical failures (homepage 404, etc.)
    const criticalFailures = failures?.filter(f => 
      QUALITY_POLICY.e2eCriticalFailures.some(critical => 
        f.error.includes(critical)
      )
    ) || [];
    
    const isCritical = criticalFailures.length > 0;
    
    return {
      passed: false,
      critical: isCritical,
      passedTests: passed,
      failedTests: failed,
      totalTests: passed + failed,
      failures: failures,
      reason: isCritical
        ? `Critical E2E failures detected: ${criticalFailures.map(f => f.test).join(', ')}`
        : `E2E tests failed: ${failed}/${passed + failed} tests failed`,
    };
  }
  
  return {
    passed: true,
    passedTests: passed,
    failedTests: failed,
    totalTests: passed + failed,
  };
}

/**
 * Lighthouse Quality Gate
 * Blocks publish if Lighthouse audit fails to run or scores below threshold
 */
export function canPublishFromLighthouse(
  auditRan: boolean,
  scores?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  },
  error?: string
): LighthouseGateResult {
  if (!QUALITY_POLICY.lighthouseRequired) {
    return {
      passed: true,
      auditRan: false,
    };
  }
  
  // ✅ CRITICAL: Audit must run successfully
  if (!auditRan || error) {
    return {
      passed: false,
      critical: true,
      auditRan: false,
      reason: error || 'Lighthouse audit failed to run',
    };
  }
  
  // ✅ CRITICAL: Scores must meet thresholds
  if (!scores) {
    return {
      passed: false,
      critical: true,
      auditRan: true,
      reason: 'Lighthouse scores are missing',
    };
  }
  
  const failingScores = Object.entries(QUALITY_POLICY.lighthouseMinScores)
    .filter(([key, minScore]) => {
      const actualScore = scores[key as keyof typeof scores];
      return actualScore < minScore;
    });
  
  if (failingScores.length > 0) {
    return {
      passed: false,
      critical: false, // Performance issues are fixable
      auditRan: true,
      scores,
      reason: `Lighthouse scores below threshold: ${failingScores.map(([key, min]) => `${key} ${scores[key as keyof typeof scores]}/${min}`).join(', ')}`,
    };
  }
  
  return {
    passed: true,
    auditRan: true,
    scores,
  };
}

/**
 * Build Quality Gate
 * Blocks publish if build artifacts are missing
 */
export function canPublishFromBuild(
  buildExists: boolean,
  buildHash?: string
): BuildGateResult {
  if (!QUALITY_POLICY.buildRequired) {
    return {
      passed: true,
    };
  }
  
  if (!buildExists) {
    return {
      passed: false,
      critical: true,
      buildExists: false,
      reason: 'Build artifacts (.next) are missing',
    };
  }
  
  return {
    passed: true,
    buildExists: true,
    buildHash,
  };
}

/**
 * Combined Quality Gate Check
 * Returns true only if ALL gates pass
 */
export function canPublish(
  vision: VisionGateResult,
  e2e: E2EGateResult,
  lighthouse: LighthouseGateResult,
  build: BuildGateResult
): {
  canPublish: boolean;
  reasons: string[];
  critical: boolean;
} {
  const gates = [
    { name: 'Vision', result: vision },
    { name: 'E2E', result: e2e },
    { name: 'Lighthouse', result: lighthouse },
    { name: 'Build', result: build },
  ];
  
  const reasons: string[] = [];
  let hasCritical = false;
  
  for (const gate of gates) {
    if (!gate.result.passed) {
      reasons.push(`${gate.name}: ${gate.result.reason || 'Failed'}`);
      if (gate.result.critical) {
        hasCritical = true;
      }
    }
  }
  
  return {
    canPublish: reasons.length === 0,
    reasons,
    critical: hasCritical,
  };
}

