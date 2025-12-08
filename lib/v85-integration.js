// =============================================================================
// V8.5 INTEGRATION - Unified entry point for all V8.5 patterns
// =============================================================================
// This file integrates all 5 patterns from the V8.5 architecture:
// 1. Quarantine Pattern (Claude 4.5)
// 2. State-Driven Error Tracking (ChatGPT o1 + Gemini 3.0)
// 3. Facade Pattern (Kimi K2)
// 4. Metamorphic Validation (Perplexity + DeepSeek)
// 5. Zombie Reaper (Gemini 3.0 - via SQL)
// === EXPORTS ===
// 1. Quarantine Pattern
export { QuarantineZone, quarantine, generateCodeWithQuarantine } from './quarantine/quarantine-zone';
// 2. State Machine
export { PipelineStateMachine, pipelineState, } from './state-machine/pipeline-state';
// 3. Public API (Facade)
export * from './nightFactory/public-api';
// 4. Metamorphic Validation
export { MetamorphicValidator, metamorphicValidator, validateWithMetamorphic, } from './validation/metamorphic-validator';
// === UNIFIED WORKFLOW ===
import { quarantine } from './quarantine/quarantine-zone';
import { pipelineState } from './state-machine/pipeline-state';
import { metamorphicValidator } from './validation/metamorphic-validator';
/**
 * V8.5 Unified Code Generation
 * Combines quarantine, state machine, and metamorphic validation
 */
export async function generateCodeV85(config) {
    const { fileName, prompt, generateFn, useMetamorphic = false, maxRetries = 1 } = config;
    const errors = [];
    console.log(`\n🔧 V8.5 Generation: ${fileName}`);
    console.log(`   Metamorphic: ${useMetamorphic}`);
    // Step 1: Generate with optional metamorphic validation
    let rawCode;
    let metamorphicConfidence = 0;
    if (useMetamorphic) {
        const metamorphicResult = await metamorphicValidator.validate(prompt, generateFn);
        if (!metamorphicResult.valid) {
            errors.push(...metamorphicResult.errors);
            console.log(`❌ Metamorphic validation failed`);
        }
        metamorphicConfidence = metamorphicResult.confidence;
        rawCode = metamorphicResult.outputs?.[0] || await generateFn();
    }
    else {
        rawCode = await generateFn();
    }
    // Step 2: Quarantine the output
    const qId = await quarantine.receive(rawCode);
    // Step 3: Validate through quarantine gates
    const validation = await quarantine.validate(qId, fileName);
    if (!validation.passed) {
        errors.push(...validation.errors);
        // Retry once with better context
        if (maxRetries > 0) {
            console.log(`⚠️ Retrying generation...`);
            await quarantine.reject(qId, validation.errors);
            const retryCode = await generateFn();
            const retryQId = await quarantine.receive(retryCode);
            const retryValidation = await quarantine.validate(retryQId, fileName);
            if (retryValidation.passed) {
                const artifact = await quarantine.release(retryQId);
                return {
                    success: true,
                    code: artifact?.source,
                    errors: [],
                    validation: {
                        quarantine: true,
                        metamorphic: useMetamorphic,
                        confidence: metamorphicConfidence,
                    },
                };
            }
            errors.push(...retryValidation.errors);
        }
        return {
            success: false,
            errors,
            validation: {
                quarantine: false,
                metamorphic: useMetamorphic ? metamorphicConfidence >= 0.8 : undefined,
                confidence: metamorphicConfidence,
            },
        };
    }
    // Step 4: Release from quarantine
    const artifact = await quarantine.release(qId);
    if (!artifact) {
        return {
            success: false,
            errors: ['Failed to release artifact from quarantine'],
            validation: {
                quarantine: false,
            },
        };
    }
    console.log(`✅ V8.5 Generation complete: ${fileName}`);
    return {
        success: true,
        code: artifact.source,
        errors: [],
        validation: {
            quarantine: true,
            metamorphic: useMetamorphic,
            confidence: metamorphicConfidence,
        },
    };
}
/**
 * V8.5 Pipeline Step Wrapper
 * Integrates with state machine for error tracking
 */
export async function runPipelineStepV85(pipelineId, phase, stepFn) {
    console.log(`\n📍 V8.5 Pipeline Step: ${phase}`);
    try {
        // Update state to running
        await pipelineState.updateStatus(pipelineId, 'running');
        // Execute the step
        await stepFn();
        // Mark as success
        await pipelineState.updateStatus(pipelineId, 'success');
        return { success: true };
    }
    catch (error) {
        const message = error.message || 'Unknown error';
        // Classify error
        const errorType = classifyError(message);
        // Record in state machine
        const { shouldRetry, isLoop } = await pipelineState.recordError(pipelineId, errorType, message);
        if (isLoop) {
            console.error(`🚨 Error loop detected - pipeline blocked`);
            return { success: false, error: `Loop detected: ${message}` };
        }
        if (shouldRetry) {
            console.log(`⚠️ Will retry: ${errorType}`);
        }
        else {
            console.error(`❌ Non-retryable error: ${errorType}`);
        }
        return { success: false, error: message };
    }
}
/**
 * Classify error into categories
 */
function classifyError(message) {
    const lower = message.toLowerCase();
    if (lower.includes('syntax') || lower.includes('parse'))
        return 'SYNTAX';
    if (lower.includes('import') || lower.includes('module') || lower.includes('cannot find'))
        return 'IMPORT';
    if (lower.includes('build') || lower.includes('compile') || lower.includes('ts'))
        return 'BUILD';
    if (lower.includes('network') || lower.includes('econnreset') || lower.includes('timeout'))
        return 'NETWORK';
    if (lower.includes('429') || lower.includes('rate limit'))
        return 'RATE_LIMIT';
    return 'RUNTIME';
}
// === INITIALIZATION ===
console.log('🚀 V8.5 Integration loaded');
console.log('   Patterns: Quarantine, State Machine, Facade, Metamorphic, Zombie Reaper');
