// =============================================================================
// FROST NIGHT FACTORY v8.5 - FEATURE FLAGS
// =============================================================================
// Control v8.5 features with environment variables or runtime config

import { DEFAULT_V85_FLAGS } from './v85-types';
import type { V85FeatureFlags } from './v85-types';

/**
 * Load feature flags from environment variables
 */
export function loadFeatureFlagsFromEnv(): V85FeatureFlags {
  return {
    FF_V85_VALIDATION: envBool('FF_V85_VALIDATION', DEFAULT_V85_FLAGS.FF_V85_VALIDATION),
    FF_V85_AST_GUARDRAILS: envBool('FF_V85_AST_GUARDRAILS', DEFAULT_V85_FLAGS.FF_V85_AST_GUARDRAILS),
    FF_V85_COST_TRACKING: envBool('FF_V85_COST_TRACKING', DEFAULT_V85_FLAGS.FF_V85_COST_TRACKING),
    FF_V85_STRATEGY_REPAIR: envBool('FF_V85_STRATEGY_REPAIR', DEFAULT_V85_FLAGS.FF_V85_STRATEGY_REPAIR),
    FF_V85_ESCALATION: envBool('FF_V85_ESCALATION', DEFAULT_V85_FLAGS.FF_V85_ESCALATION),
  };
}

/**
 * Get boolean from environment variable
 */
function envBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Feature flag store (singleton)
 */
class FeatureFlagStore {
  private flags: V85FeatureFlags;
  
  constructor() {
    this.flags = loadFeatureFlagsFromEnv();
  }
  
  get(flag: keyof V85FeatureFlags): boolean {
    return this.flags[flag];
  }
  
  set(flag: keyof V85FeatureFlags, value: boolean): void {
    this.flags[flag] = value;
    console.log(`🚩 Feature flag ${flag} set to ${value}`);
  }
  
  getAll(): V85FeatureFlags {
    return { ...this.flags };
  }
  
  setAll(flags: Partial<V85FeatureFlags>): void {
    this.flags = { ...this.flags, ...flags };
    console.log('🚩 Feature flags updated:', this.flags);
  }
  
  reset(): void {
    this.flags = DEFAULT_V85_FLAGS;
    console.log('🚩 Feature flags reset to defaults');
  }
  
  isEnabled(flag: keyof V85FeatureFlags): boolean {
    return this.get(flag);
  }
}

// Singleton instance
export const featureFlags = new FeatureFlagStore();

/**
 * Decorator for feature-flagged functions
 */
export function featureFlagged(flag: keyof V85FeatureFlags) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      if (!featureFlags.isEnabled(flag)) {
        console.log(`⏭️ Skipping ${propertyKey} (${flag} disabled)`);
        return null;
      }
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Check if all v8.5 features are enabled
 */
export function isV85FullyEnabled(): boolean {
  const flags = featureFlags.getAll();
  return Object.values(flags).every(v => v === true);
}

/**
 * Enable all v8.5 features
 */
export function enableAllV85Features(): void {
  featureFlags.setAll({
    FF_V85_VALIDATION: true,
    FF_V85_AST_GUARDRAILS: true,
    FF_V85_COST_TRACKING: true,
    FF_V85_STRATEGY_REPAIR: true,
    FF_V85_ESCALATION: true,
  });
}

/**
 * Disable all v8.5 features (fallback to legacy)
 */
export function disableAllV85Features(): void {
  featureFlags.setAll({
    FF_V85_VALIDATION: false,
    FF_V85_AST_GUARDRAILS: false,
    FF_V85_COST_TRACKING: false,
    FF_V85_STRATEGY_REPAIR: false,
    FF_V85_ESCALATION: false,
  });
}

/**
 * Print feature flag status
 */
export function printFeatureFlagStatus(): void {
  const flags = featureFlags.getAll();
  
  console.log('\n🚩 v8.5 Feature Flags:');
  console.log('═══════════════════════════════════════');
  
  for (const [key, value] of Object.entries(flags)) {
    const status = value ? '✅ ENABLED' : '❌ DISABLED';
    console.log(`   ${key}: ${status}`);
  }
  
  console.log('═══════════════════════════════════════\n');
}

