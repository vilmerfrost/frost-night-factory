// =============================================================================
// PIPELINE CONTEXT TYPES - The Golden Baton 🥇
// =============================================================================
/**
 * Create a new empty pipeline context
 */
export function createPipelineContext(ticketId, userRequest) {
    return {
        ticketId,
        userRequest,
        createdFiles: [],
        rootDir: 'src',
        startedAt: new Date().toISOString(),
        currentPhase: 'planner',
        errors: [],
    };
}
/**
 * Validate context has required data for a stage
 */
export function validateContextForStage(context, stage) {
    const missing = [];
    switch (stage) {
        case 'coder':
            if (!context.techMatrix)
                missing.push('techMatrix');
            if (!context.blueprint && !context.plan)
                missing.push('blueprint or plan');
            // ragKnowledge is optional but recommended
            break;
        case 'tester':
            if (context.createdFiles.length === 0)
                missing.push('createdFiles');
            break;
        case 'publisher':
            if (!context.buildPassed)
                missing.push('buildPassed');
            break;
    }
    return {
        valid: missing.length === 0,
        missing,
    };
}
