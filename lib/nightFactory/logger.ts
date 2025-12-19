/**
 * 🔍 PROFESSIONAL LOGGING UTILITY
 * Provides structured, consistent logging across the entire pipeline
 */

import chalk from 'chalk';

interface LogContext {
  pipelineId?: string;
  phase?: string;
  file?: string;
  line?: number;
  duration?: number;
  cost?: number;
  [key: string]: any;
}

class Logger {
  private startTimes: Map<string, number> = new Map();

  /**
   * Log phase transitions
   */
  phaseTransition(oldPhase: string, newPhase: string, pipelineId: string, elapsed?: number) {
    console.log(chalk.cyan(`\n${'='.repeat(80)}`));
    console.log(chalk.cyan(`🔄 [PHASE TRANSITION] ${oldPhase} → ${newPhase}`));
    console.log(chalk.gray(`   Pipeline: ${pipelineId}`));
    console.log(chalk.gray(`   Timestamp: ${new Date().toISOString()}`));
    if (elapsed) console.log(chalk.gray(`   Elapsed: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`));
    console.log(chalk.cyan(`${'='.repeat(80)}\n`));
  }

  /**
   * Log MCP/Tool calls
   */
  mcpCall(name: string, method: string, result: { success: boolean; duration?: number; data?: any; error?: string }) {
    const status = result.success ? chalk.green('✅ Success') : chalk.red('❌ Failed');
    console.log(chalk.blue(`\n📡 [MCP CALL] ${name}.${method}()`));
    console.log(`   Status: ${status}`);
    if (result.duration) console.log(chalk.gray(`   Duration: ${result.duration}ms`));
    if (result.error) console.log(chalk.red(`   Error: ${result.error}`));
    if (result.data && !result.success) {
      console.log(chalk.gray(`   Details: ${JSON.stringify(result.data).substring(0, 200)}...`));
    }
  }

  /**
   * Log agent decisions
   */
  agentDecision(agent: string, decision: string, context?: { reasoning?: string; alternatives?: string[] }) {
    console.log(chalk.magenta(`\n🤖 [AGENT] ${agent}`));
    console.log(chalk.white(`   Decision: ${decision}`));
    if (context?.reasoning) {
      console.log(chalk.gray(`   Reasoning: ${context.reasoning.substring(0, 200)}${context.reasoning.length > 200 ? '...' : ''}`));
    }
    if (context?.alternatives && context.alternatives.length > 0) {
      console.log(chalk.gray(`   Alternatives: ${context.alternatives.join(', ')}`));
    }
  }

  /**
   * Log errors with full context
   */
  error(error: Error, context?: LogContext) {
    console.log(chalk.red(`\n❌ [ERROR] ${error.name || 'Error'}`));
    console.log(chalk.red(`   Message: ${error.message}`));
    
    if (context?.phase) console.log(chalk.gray(`   Phase: ${context.phase}`));
    if (context?.file) {
      const location = context.line ? `${context.file}:${context.line}` : context.file;
      console.log(chalk.gray(`   Location: ${location}`));
    }
    if (context?.pipelineId) console.log(chalk.gray(`   Pipeline: ${context.pipelineId}`));
    
    if (error.stack) {
      console.log(chalk.gray(`   Stack: ${error.stack.substring(0, 500)}${error.stack.length > 500 ? '...' : ''}`));
    }
    
    // Log any additional context
    const extraKeys = context ? Object.keys(context).filter(k => !['phase', 'file', 'line', 'pipelineId'].includes(k)) : [];
    if (extraKeys.length > 0) {
      console.log(chalk.gray(`   Context: ${JSON.stringify(Object.fromEntries(extraKeys.map(k => [k, context![k]])))}`));
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: { cost?: number; memory?: number; tokens?: number }) {
    console.log(chalk.yellow(`\n⚡ [PERFORMANCE] ${operation}`));
    console.log(chalk.gray(`   Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`));
    
    if (context?.cost !== undefined) {
      console.log(chalk.gray(`   Cost: $${context.cost.toFixed(4)}`));
    }
    if (context?.memory !== undefined) {
      console.log(chalk.gray(`   Memory: ${context.memory.toFixed(2)}MB`));
    }
    if (context?.tokens !== undefined) {
      console.log(chalk.gray(`   Tokens: ${context.tokens.toLocaleString()}`));
    }
  }

  /**
   * Start a timer for performance tracking
   */
  startTimer(key: string) {
    this.startTimes.set(key, Date.now());
  }

  /**
   * End a timer and log performance
   */
  endTimer(key: string, operation: string, context?: { cost?: number; memory?: number; tokens?: number }) {
    const startTime = this.startTimes.get(key);
    if (!startTime) {
      console.warn(chalk.yellow(`⚠️ No start time found for timer: ${key}`));
      return;
    }
    
    const duration = Date.now() - startTime;
    this.startTimes.delete(key);
    this.performance(operation, duration, context);
  }

  /**
   * Log successful operations
   */
  success(message: string, context?: LogContext) {
    console.log(chalk.green(`\n✅ [SUCCESS] ${message}`));
    if (context && Object.keys(context).length > 0) {
      console.log(chalk.gray(`   ${JSON.stringify(context)}`));
    }
  }

  /**
   * Log warnings
   */
  warning(message: string, context?: LogContext) {
    console.log(chalk.yellow(`\n⚠️ [WARNING] ${message}`));
    if (context && Object.keys(context).length > 0) {
      console.log(chalk.gray(`   ${JSON.stringify(context)}`));
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext) {
    console.log(chalk.blue(`\nℹ️ [INFO] ${message}`));
    if (context && Object.keys(context).length > 0) {
      console.log(chalk.gray(`   ${JSON.stringify(context)}`));
    }
  }

  /**
   * Log debug messages (can be disabled in production)
   */
  debug(message: string, data?: any) {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log(chalk.gray(`\n🐛 [DEBUG] ${message}`));
      if (data) {
        console.log(chalk.gray(`   ${JSON.stringify(data, null, 2).substring(0, 500)}...`));
      }
    }
  }
}

// Export singleton instance
export const log = new Logger();

// Export types for external use
export type { LogContext };
