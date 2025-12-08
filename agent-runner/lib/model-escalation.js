import { callAI } from '../ai-client';
export const MODEL_ESCALATION_PATH = [
    {
        name: 'Fast Fix',
        model: 'claude-3-5-haiku-20241022',
        maxAttempts: 3,
        costPerCall: 0.003,
        useFor: ['import-errors', 'syntax-errors', 'missing-deps']
    },
    {
        name: 'Deep Reasoning',
        model: 'deepseek-chat',
        maxAttempts: 3,
        costPerCall: 0.010,
        useFor: ['type-errors', 'logic-errors', 'runtime-errors']
    },
    {
        name: 'Genius Mode',
        model: 'gpt-4-turbo',
        maxAttempts: 2,
        costPerCall: 0.030,
        useFor: ['complex-architecture', 'multi-file-refactor']
    }
];
/**
 * Select appropriate model tier based on error type and attempt number
 */
export function selectModelTier(errorType, attemptNumber) {
    for (const tier of MODEL_ESCALATION_PATH) {
        if (attemptNumber <= tier.maxAttempts) {
            if (tier.useFor.some(type => errorType.includes(type))) {
                return tier;
            }
        }
    }
    return null; // Max retries exceeded
}
/**
 * Classify error type for model selection
 */
function classifyError(error) {
    if (error.includes('Cannot find module') || error.includes('Module not found')) {
        return 'import-errors';
    }
    if (error.includes('TS') || error.includes('Type')) {
        return 'type-errors';
    }
    if (error.includes('ReferenceError') || error.includes('Runtime')) {
        return 'runtime-errors';
    }
    if (error.includes('SyntaxError') || error.includes('Unexpected token')) {
        return 'syntax-errors';
    }
    if (error.includes('architecture') || error.includes('multiple files')) {
        return 'complex-architecture';
    }
    return 'unknown';
}
/**
 * Escalated fix: Try models in escalation path until one succeeds
 */
export async function escalatedFix(error, context, pipeline, prompt) {
    const errorType = classifyError(error);
    let totalAttempts = 0;
    for (const tier of MODEL_ESCALATION_PATH) {
        console.log(`🎯 Trying ${tier.name} (${tier.model})...`);
        for (let i = 0; i < tier.maxAttempts; i++) {
            totalAttempts++;
            try {
                const response = await callAI({
                    pipelineId: pipeline?.id || 'unknown',
                    step: 'escalated_fix',
                    role: 'FIXER',
                    model: tier.model,
                    messages: [
                        { role: 'system', content: context },
                        { role: 'user', content: prompt }
                    ]
                });
                // Validate response
                if (response && response.trim().length > 50) {
                    console.log(`✅ ${tier.name} succeeded (attempt ${i + 1}/${tier.maxAttempts})`);
                    return response;
                }
            }
            catch (err) {
                console.log(`⚠️ ${tier.name} attempt ${i + 1} failed: ${err.message}`);
            }
        }
        console.log(`❌ ${tier.name} exhausted, escalating...`);
    }
    console.log(`❌ All models failed after ${totalAttempts} attempts`);
    return null; // Trigger rollback
}
