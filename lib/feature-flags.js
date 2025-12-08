// =============================================================================
// FEATURE FLAGS - Control V8.5 features
// =============================================================================
// Temporarily disable V8.5 features until base system is stable
export const FEATURES = {
    V85_QUARANTINE: false, // Disable until base system works
    V85_METAMORPHIC: false, // Disable
    V85_METRICS: false, // Disable
    V85_STATE_MACHINE: false, // Disable
    V85_SNAPSHOTS: false, // Disable
    V85_RECOVERY: false, // Disable
};
/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature) {
    // Allow override via environment variable
    const envKey = `V85_${feature}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
        return envValue === 'true' || envValue === '1';
    }
    return FEATURES[feature];
}
/**
 * Get all enabled features
 */
export function getEnabledFeatures() {
    return Object.entries(FEATURES)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name);
}
