// =============================================================================
// CIRCUIT BREAKER - Fail-fast system to prevent infinite loops
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { hashError, ErrorCategory } from './errorClassifier';
import type { ClassifiedError } from './errorClassifier';

/**
 * Fix attempt tracking
 */
export interface FixAttempt {
  attempt: number;
  timestamp: Date;
  error: string;
  errorHash: string;
  errorCategory: ErrorCategory;
  filesTouched: string[];
  strategy: string;
  success: boolean;
  duration: number; // ms
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  fixHistory: FixAttempt[];
  errorCounts: Map<string, number>;
  totalAttempts: number;
  startTime: Date;
  isOpen: boolean; // true = stopped, false = running
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  maxIdenticalErrors: number;      // Max times same error can occur
  maxTotalAttempts: number;        // Max total fix attempts
  maxDuration: number;             // Max duration in ms
  cooldownPeriod: number;          // Cooldown between attempts in ms
  reportPath: string;              // Where to save error reports
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxIdenticalErrors: 2,
  maxTotalAttempts: 15,
  maxDuration: 10 * 60 * 1000,     // 10 minutes
  cooldownPeriod: 1000,            // 1 second
  reportPath: './error-reports',
};

/**
 * Circuit Breaker Class
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      fixHistory: [],
      errorCounts: new Map(),
      totalAttempts: 0,
      startTime: new Date(),
      isOpen: false,
    };
  }
  
  /**
   * Check if we should continue trying to fix
   */
  shouldRetry(newError: ClassifiedError): { canRetry: boolean; reason?: string } {
    // Check if circuit breaker is already open
    if (this.state.isOpen) {
      return { canRetry: false, reason: 'Circuit breaker is OPEN - manual intervention required' };
    }
    
    // Check total attempts
    if (this.state.totalAttempts >= this.config.maxTotalAttempts) {
      this.openCircuit(`Max total attempts (${this.config.maxTotalAttempts}) exceeded`);
      return { canRetry: false, reason: `Max total attempts exceeded: ${this.state.totalAttempts}` };
    }
    
    // Check total duration
    const elapsed = Date.now() - this.state.startTime.getTime();
    if (elapsed >= this.config.maxDuration) {
      this.openCircuit(`Max duration (${this.config.maxDuration / 1000}s) exceeded`);
      return { canRetry: false, reason: `Max duration exceeded: ${Math.round(elapsed / 1000)}s` };
    }
    
    // Check identical errors
    const errorCount = this.state.errorCounts.get(newError.errorHash) || 0;
    if (errorCount >= this.config.maxIdenticalErrors) {
      this.openCircuit(`Same error occurred ${errorCount}x`);
      return { 
        canRetry: false, 
        reason: `Same error occurred ${errorCount}x: "${newError.originalError.substring(0, 100)}..."` 
      };
    }
    
    return { canRetry: true };
  }
  
  /**
   * Record a fix attempt
   */
  recordAttempt(attempt: Omit<FixAttempt, 'attempt'>): void {
    this.state.totalAttempts++;
    
    const fullAttempt: FixAttempt = {
      ...attempt,
      attempt: this.state.totalAttempts,
    };
    
    this.state.fixHistory.push(fullAttempt);
    
    // Track error count
    const currentCount = this.state.errorCounts.get(attempt.errorHash) || 0;
    this.state.errorCounts.set(attempt.errorHash, currentCount + 1);
    
    console.log(`📊 Fix attempt #${this.state.totalAttempts}: ${attempt.strategy} -> ${attempt.success ? '✅' : '❌'}`);
  }
  
  /**
   * Open the circuit breaker (stop all operations)
   */
  private openCircuit(reason: string): void {
    this.state.isOpen = true;
    console.error(`\n🚨 CIRCUIT BREAKER ACTIVATED 🚨`);
    console.error(`Reason: ${reason}`);
    console.error(`Total attempts: ${this.state.totalAttempts}`);
    console.error(`Unique errors: ${this.state.errorCounts.size}`);
    
    // Generate detailed report
    this.generateReport(reason);
  }
  
  /**
   * Generate a detailed error report
   */
  generateReport(reason: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = this.config.reportPath;
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      reason,
      summary: {
        totalAttempts: this.state.totalAttempts,
        uniqueErrors: this.state.errorCounts.size,
        duration: Date.now() - this.state.startTime.getTime(),
        mostCommonErrors: this.getMostCommonErrors(),
      },
      fixHistory: this.state.fixHistory,
      recommendations: this.generateRecommendations(),
    };
    
    const reportPath = path.join(reportDir, `error-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Detailed error report saved to: ${reportPath}`);
    
    // Also print summary
    console.log('\n--- ERROR SUMMARY ---');
    console.log(`Total fix attempts: ${report.summary.totalAttempts}`);
    console.log(`Unique error types: ${report.summary.uniqueErrors}`);
    console.log(`Duration: ${Math.round(report.summary.duration / 1000)}s`);
    console.log('\nMost common errors:');
    report.summary.mostCommonErrors.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.count}x] ${e.preview}`);
    });
    console.log('\nRecommendations:');
    report.recommendations.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r}`);
    });
    
    return reportPath;
  }
  
  /**
   * Get most common errors
   */
  private getMostCommonErrors(): Array<{ hash: string; count: number; preview: string }> {
    const errors: Array<{ hash: string; count: number; preview: string }> = [];
    
    this.state.errorCounts.forEach((count, hash) => {
      const attempt = this.state.fixHistory.find(a => a.errorHash === hash);
      errors.push({
        hash,
        count,
        preview: attempt?.error.substring(0, 80) + '...' || 'Unknown',
      });
    });
    
    return errors.sort((a, b) => b.count - a.count).slice(0, 5);
  }
  
  /**
   * Generate recommendations based on error patterns
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze error patterns
    const categoryCount = new Map<ErrorCategory, number>();
    this.state.fixHistory.forEach(attempt => {
      const current = categoryCount.get(attempt.errorCategory) || 0;
      categoryCount.set(attempt.errorCategory, current + 1);
    });
    
    // Generate recommendations based on patterns
    if ((categoryCount.get(ErrorCategory.DEPENDENCY_VERSION) || 0) > 2) {
      recommendations.push('DEPENDENCY ISSUES: Consider regenerating package.json from GOLDEN_VERSIONS template');
    }
    
    if ((categoryCount.get(ErrorCategory.IMPORT_ERROR) || 0) > 3) {
      recommendations.push('IMPORT ISSUES: Check that all imported modules exist and exports match imports');
    }
    
    if ((categoryCount.get(ErrorCategory.EXPORT_ERROR) || 0) > 2) {
      recommendations.push('EXPORT ISSUES: Ensure all components use named exports (not default exports)');
    }
    
    if ((categoryCount.get(ErrorCategory.TYPE_ERROR) || 0) > 3) {
      recommendations.push('TYPE ISSUES: Review lib/types.ts and ensure all types are properly defined');
    }
    
    if ((categoryCount.get(ErrorCategory.CONFIG_ERROR) || 0) > 1) {
      recommendations.push('CONFIG ISSUES: Replace config files with golden templates');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Review the error log manually to identify the root cause');
    }
    
    return recommendations;
  }
  
  /**
   * Get current state summary
   */
  getStatus(): {
    isOpen: boolean;
    totalAttempts: number;
    uniqueErrors: number;
    elapsed: number;
    remainingAttempts: number;
  } {
    return {
      isOpen: this.state.isOpen,
      totalAttempts: this.state.totalAttempts,
      uniqueErrors: this.state.errorCounts.size,
      elapsed: Date.now() - this.state.startTime.getTime(),
      remainingAttempts: this.config.maxTotalAttempts - this.state.totalAttempts,
    };
  }
  
  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = {
      fixHistory: [],
      errorCounts: new Map(),
      totalAttempts: 0,
      startTime: new Date(),
      isOpen: false,
    };
    console.log('🔄 Circuit breaker reset');
  }
}

/**
 * Create a fatal error with circuit breaker info
 */
export class CircuitBreakerError extends Error {
  public readonly reportPath: string;
  public readonly fixHistory: FixAttempt[];
  
  constructor(message: string, reportPath: string, fixHistory: FixAttempt[]) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.reportPath = reportPath;
    this.fixHistory = fixHistory;
  }
}

