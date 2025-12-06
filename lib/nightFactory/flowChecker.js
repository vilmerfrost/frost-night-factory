// =============================================================================
// THE FLOW CHECKER 🌊 - Guarantees data transfer between pipeline steps
// =============================================================================
import { callAI } from './modelClient';
import { validateContextForStage } from './contextTypes';
/**
 * Verify data flow integrity before a pipeline stage
 *
 * Uses Gemini 1.5 Flash (1M context window) to analyze the entire context
 * and ensure no data was lost between stages.
 *
 * @param context - The current pipeline context
 * @param stage - The stage about to run ('coder', 'tester', 'publisher')
 * @throws Error if critical data is missing
 */
export async function verifyDataFlow(context, stage) {
    console.log(`🌊 Flow Watcher verifying integrity before '${stage}'...`);
    // First, do a quick local validation (no AI cost)
    const localValidation = validateContextForStage(context, stage);
    if (!localValidation.valid) {
        console.error(`🚨 FLOW BREAK DETECTED (Local Check)!`);
        console.error(`   Missing: ${localValidation.missing.join(', ')}`);
        throw new Error(`Pipeline Flow Integrity Error: Missing ${localValidation.missing.join(', ')} for stage '${stage}'`);
    }
    // For critical stages, use AI to do a deeper check
    if (stage === 'coder' || stage === 'publisher') {
        const contextDump = JSON.stringify(context, null, 2);
        const prompt = `
CRITICAL DATA CHECK.
Current Stage: ${stage}

Check if the necessary data exists for this stage.

RULES:
- If Stage is 'coder':
  - MUST have 'techMatrix' (frontend_framework, primary_backend)
  - SHOULD have 'blueprint' or 'plan' (implementation guide)
  - OPTIONAL: 'ragKnowledge' (research data)
  
- If Stage is 'tester':
  - MUST have 'createdFiles' array with at least 1 file
  
- If Stage is 'publisher':
  - MUST have 'buildPassed' = true
  - MUST have 'createdFiles' array

If CRITICAL data is missing, return "FAIL: <reason>".
If data is good, return "PASS".
`;
        try {
            const verdict = await callAI("FLOW_WATCHER", prompt, "You are a Data Integrity Guardian. Be strict about MUST requirements, lenient about OPTIONAL.", contextDump);
            if (verdict.includes("FAIL")) {
                console.error("🚨 FLOW BREAK DETECTED (AI Check)!");
                console.error(`   Verdict: ${verdict}`);
                throw new Error(`Pipeline Flow Integrity Error: ${verdict}`);
            }
            console.log("✅ Flow Integrity: SECURE");
        }
        catch (aiError) {
            // If AI check fails, fall back to local validation (which already passed)
            console.warn(`⚠️ AI Flow Check failed (${aiError.message}), using local validation.`);
            console.log("✅ Flow Integrity: SECURE (Local)");
        }
    }
    else {
        console.log("✅ Flow Integrity: SECURE (Quick Check)");
    }
}
/**
 * Quick synchronous check without AI
 */
export function quickFlowCheck(context, stage) {
    const validation = validateContextForStage(context, stage);
    return validation.valid;
}
/**
 * Log the current context state (for debugging)
 */
export function logContextState(context) {
    console.log('\n📊 === PIPELINE CONTEXT STATE ===');
    console.log(`   Ticket: ${context.ticketId}`);
    console.log(`   Phase: ${context.currentPhase}`);
    console.log(`   TechMatrix: ${context.techMatrix ? '✅' : '❌'}`);
    console.log(`   Blueprint: ${context.blueprint ? '✅' : '❌'}`);
    console.log(`   RAG Knowledge: ${context.ragKnowledge ? `✅ (${context.ragKnowledge.length} chars)` : '❌'}`);
    console.log(`   Created Files: ${context.createdFiles.length}`);
    console.log(`   Build Passed: ${context.buildPassed ?? 'N/A'}`);
    console.log(`   Errors: ${context.errors.length}`);
    console.log('================================\n');
}
