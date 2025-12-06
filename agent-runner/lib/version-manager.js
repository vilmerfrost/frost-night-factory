// =============================================================================
// VERSION MANAGER - Feature flags for easy rollback
// =============================================================================
export const PIPELINE_VERSION = '8.0.0';
export const FEATURE_FLAGS = {
    // P0: Production Readiness
    useNextJs16: true,
    useShadcnComponents: true,
    runIntegrationTests: true,
    // P1: Quality Enhancements
    runVisionRefinement: true,
    enableTechStackSelector: true,
    // P2: Advanced Features
    runPlaywrightTests: true,
    runLighthouseAudit: true,
    runPactTesting: true,
    trackCosts: true,
    enableABTesting: false, // Default off for cost reasons (adds ~$0.50 per pipeline)
};
/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature) {
    // Allow override via environment variable
    const envKey = `FEATURE_${feature.toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
        return envValue === 'true' || envValue === '1';
    }
    return FEATURE_FLAGS[feature];
}
/**
 * Get all enabled features
 */
export function getEnabledFeatures() {
    return Object.entries(FEATURE_FLAGS)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature);
}
