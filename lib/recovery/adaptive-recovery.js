// =============================================================================
// ADAPTIVE RECOVERY - Smart error recovery strategies
// =============================================================================
import { snapshots } from '../snapshots/snapshot-manager';
export class AdaptiveRecovery {
    strategies = [
        {
            name: 'rollback_and_retry',
            condition: (e) => e.attemptCount === 1 && e.errorType === 'SYNTAX' && !!e.pipelineId,
            execute: async (e) => {
                if (!e.pipelineId || !e.workspaceRoot) {
                    return {
                        success: false,
                        strategy: 'rollback_and_retry',
                        message: 'Missing pipeline ID or workspace root',
                        shouldRetry: false,
                    };
                }
                const rolledBack = await snapshots.rollback(e.pipelineId, e.workspaceRoot);
                if (rolledBack) {
                    return {
                        success: true,
                        strategy: 'rollback_and_retry',
                        message: 'Rolled back to last snapshot',
                        shouldRetry: true,
                    };
                }
                return {
                    success: false,
                    strategy: 'rollback_and_retry',
                    message: 'Rollback failed - no snapshot found',
                    shouldRetry: false,
                };
            },
        },
        {
            name: 'skip_file',
            condition: (e) => e.errorType === 'IMPORT' && !!e.fileName,
            execute: async (e) => {
                return {
                    success: true,
                    strategy: 'skip_file',
                    message: `Skipped problematic file: ${e.fileName}`,
                    shouldRetry: false, // Don't retry, just skip
                };
            },
        },
        {
            name: 'switch_model',
            condition: (e) => e.attemptCount === 2 && ['SYNTAX', 'BUILD'].includes(e.errorType),
            execute: async (e) => {
                return {
                    success: true,
                    strategy: 'switch_model',
                    message: 'Switched from Claude to DeepSeek',
                    shouldRetry: true,
                };
            },
        },
        {
            name: 'simplify_prompt',
            condition: (e) => e.attemptCount === 2 && e.errorType === 'SYNTAX',
            execute: async (e) => {
                return {
                    success: true,
                    strategy: 'simplify_prompt',
                    message: 'Simplified prompt and regenerating',
                    shouldRetry: true,
                };
            },
        },
        {
            name: 'escalate_to_human',
            condition: (e) => e.attemptCount >= 3,
            execute: async (e) => {
                // In production, this would send notification
                console.warn(`🚨 Escalating to human review: ${e.errorMessage}`);
                return {
                    success: false,
                    strategy: 'escalate_to_human',
                    message: 'Escalated to human review',
                    shouldRetry: false,
                };
            },
        },
        {
            name: 'mark_broken_and_continue',
            condition: (e) => e.attemptCount >= 2 && e.errorType === 'IMPORT' && !!e.pipelineId,
            execute: async (e) => {
                if (e.pipelineId) {
                    await snapshots.markCurrentAsBroken(e.pipelineId);
                }
                return {
                    success: true,
                    strategy: 'mark_broken_and_continue',
                    message: 'Marked snapshot as broken, continuing with next file',
                    shouldRetry: false,
                };
            },
        },
    ];
    /**
     * Find and execute recovery strategy
     */
    async recover(errorContext) {
        // Find applicable strategy (first match wins)
        const strategy = this.strategies.find(s => s.condition(errorContext));
        if (!strategy) {
            return {
                success: false,
                strategy: 'none',
                message: 'No recovery strategy found',
                shouldRetry: false,
            };
        }
        console.log(`🔧 Applying recovery strategy: ${strategy.name}`);
        try {
            const result = await strategy.execute(errorContext);
            console.log(`   Result: ${result.message}`);
            return result;
        }
        catch (error) {
            console.error(`   Recovery strategy failed: ${error.message}`);
            return {
                success: false,
                strategy: strategy.name,
                message: `Recovery failed: ${error.message}`,
                shouldRetry: false,
            };
        }
    }
    /**
     * Get available strategies for an error context
     */
    getAvailableStrategies(errorContext) {
        return this.strategies
            .filter(s => s.condition(errorContext))
            .map(s => s.name);
    }
    /**
     * Add custom recovery strategy
     */
    addStrategy(strategy) {
        this.strategies.push(strategy);
        console.log(`➕ Added recovery strategy: ${strategy.name}`);
    }
}
export const recovery = new AdaptiveRecovery();
/**
 * Helper: Notify human (placeholder for production integration)
 */
async function notifyHuman(error) {
    // In production, integrate with:
    // - Slack webhook
    // - Email service
    // - PagerDuty
    // - Custom notification system
    console.warn(`📧 Human notification (placeholder):`, {
        pipelineId: error.pipelineId,
        errorType: error.errorType,
        message: error.errorMessage,
        attempts: error.attemptCount,
    });
}
