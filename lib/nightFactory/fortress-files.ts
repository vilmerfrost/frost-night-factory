// =============================================================================
// FROST NIGHT FACTORY v9.0 - FORTRESS FILES DEFINITION
// =============================================================================
// Immutable zones the repair loop CANNOT touch

/**
 * Fortress file tiers - defines authority levels for repair loop
 */
export enum FortressTier {
  /** TIER 0: Absolutely untouchable - repair loop cannot even read for "fixing" */
  GOLDEN = 0,
  
  /** TIER 1: Can regenerate from template, but NEVER AI fix */
  REGENERATE_ONLY = 1,
  
  /** TIER 2: AI can fix with strict constraints, max 2 attempts */
  RESTRICTED_FIX = 2,
  
  /** TIER 3: Normal repair rules, max 3 attempts, can restart coder */
  NORMAL = 3,
  
  /** TIER 4: Unlimited repair attempts (disposable files) */
  DISPOSABLE = 4,
}

/**
 * Fortress file definition
 */
export interface FortressFile {
  pattern: string;
  tier: FortressTier;
  description: string;
  maxAttempts: number;
  onFail: 'HALT' | 'ROLLBACK' | 'RESTART_CODER' | 'CONTINUE';
  template?: string; // Path to golden template
}

/**
 * FORTRESS FILES - THE IMMUTABLE CORE
 * 
 * Rule: if (FORTRESS_FILES.includes(error.filePath)) { return FAIL_HARD("FORTRESS_VIOLATION") }
 */
export const FORTRESS_FILES: FortressFile[] = [
  // ============================================================================
  // TIER 0: GOLDEN - ABSOLUTELY UNTOUCHABLE
  // ============================================================================
  {
    pattern: 'tsconfig.json',
    tier: FortressTier.GOLDEN,
    description: 'TypeScript configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/tsconfig.json',
  },
  {
    pattern: 'next.config.mjs',
    tier: FortressTier.GOLDEN,
    description: 'Next.js configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/next.config.mjs',
  },
  {
    pattern: 'next.config.js',
    tier: FortressTier.GOLDEN,
    description: 'Next.js configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/next.config.js',
  },
  {
    pattern: 'tailwind.config.ts',
    tier: FortressTier.GOLDEN,
    description: 'Tailwind configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/tailwind.config.ts',
  },
  {
    pattern: 'tailwind.config.js',
    tier: FortressTier.GOLDEN,
    description: 'Tailwind configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/tailwind.config.js',
  },
  {
    pattern: 'package.json',
    tier: FortressTier.GOLDEN,
    description: 'Package manifest - LOCKED',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/package.json',
  },
  {
    pattern: 'postcss.config.js',
    tier: FortressTier.GOLDEN,
    description: 'PostCSS configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/postcss.config.js',
  },
  {
    pattern: 'postcss.config.mjs',
    tier: FortressTier.GOLDEN,
    description: 'PostCSS configuration - NEVER modify',
    maxAttempts: 0,
    onFail: 'HALT',
    template: 'templates/fortress/postcss.config.mjs',
  },

  // ============================================================================
  // TIER 1: REGENERATE ONLY - Can regenerate from template, NEVER AI fix
  // ============================================================================
  {
    pattern: 'src/types/database.ts',
    tier: FortressTier.REGENERATE_ONLY,
    description: 'Supabase types - regenerate from CLI only',
    maxAttempts: 1,
    onFail: 'HALT',
  },
  {
    pattern: 'src/lib/types.ts',
    tier: FortressTier.REGENERATE_ONLY,
    description: 'Domain contracts - regenerate from template',
    maxAttempts: 1,
    onFail: 'HALT',
    template: 'templates/fortress/types.ts',
  },
  {
    pattern: 'src/app/layout.tsx',
    tier: FortressTier.REGENERATE_ONLY,
    description: 'Root layout - regenerate from contract',
    maxAttempts: 1,
    onFail: 'HALT',
    template: 'templates/fortress/layout.tsx',
  },
  {
    pattern: 'src/components/ui/**',
    tier: FortressTier.REGENERATE_ONLY,
    description: 'ShadCN UI components - GOLDEN',
    maxAttempts: 1,
    onFail: 'HALT',
  },

  // ============================================================================
  // TIER 2: RESTRICTED FIX - AI can fix with constraints
  // ============================================================================
  {
    pattern: 'src/lib/api.ts',
    tier: FortressTier.RESTRICTED_FIX,
    description: 'API client - restricted fixes',
    maxAttempts: 2,
    onFail: 'ROLLBACK',
  },
  {
    pattern: 'src/lib/utils.ts',
    tier: FortressTier.RESTRICTED_FIX,
    description: 'Utility functions - restricted fixes',
    maxAttempts: 2,
    onFail: 'ROLLBACK',
  },
  {
    pattern: 'src/lib/supabase*.ts',
    tier: FortressTier.RESTRICTED_FIX,
    description: 'Supabase clients - restricted fixes',
    maxAttempts: 2,
    onFail: 'ROLLBACK',
  },

  // ============================================================================
  // TIER 3: NORMAL - Standard repair rules
  // ============================================================================
  {
    pattern: 'src/app/**/page.tsx',
    tier: FortressTier.NORMAL,
    description: 'Page components - normal repair',
    maxAttempts: 3,
    onFail: 'RESTART_CODER',
  },
  {
    pattern: 'src/components/layout/**',
    tier: FortressTier.NORMAL,
    description: 'Layout components - normal repair',
    maxAttempts: 3,
    onFail: 'RESTART_CODER',
  },
  {
    pattern: 'src/components/**',
    tier: FortressTier.NORMAL,
    description: 'App components - normal repair',
    maxAttempts: 3,
    onFail: 'RESTART_CODER',
  },

  // ============================================================================
  // TIER 4: DISPOSABLE - Unlimited repair attempts
  // ============================================================================
  {
    pattern: 'src/lib/mock-data.ts',
    tier: FortressTier.DISPOSABLE,
    description: 'Mock data - unlimited repairs',
    maxAttempts: Infinity,
    onFail: 'CONTINUE',
  },
  {
    pattern: 'src/**/*.test.ts',
    tier: FortressTier.DISPOSABLE,
    description: 'Test files - unlimited repairs',
    maxAttempts: Infinity,
    onFail: 'CONTINUE',
  },
  {
    pattern: 'src/**/*.test.tsx',
    tier: FortressTier.DISPOSABLE,
    description: 'Test files - unlimited repairs',
    maxAttempts: Infinity,
    onFail: 'CONTINUE',
  },
];

/**
 * Check if a file path matches a fortress pattern
 */
export function matchesFortressPattern(filePath: string, pattern: string): boolean {
  // Normalize path
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  
  // Exact match
  if (normalizedPath.endsWith(normalizedPattern)) {
    return true;
  }
  
  // Glob pattern matching
  if (normalizedPattern.includes('**')) {
    const [prefix, suffix] = normalizedPattern.split('**');
    const hasPrefix = !prefix || normalizedPath.includes(prefix.replace(/\/$/, ''));
    const hasSuffix = !suffix || normalizedPath.endsWith(suffix.replace(/^\//, ''));
    return hasPrefix && hasSuffix;
  }
  
  if (normalizedPattern.includes('*')) {
    const regex = new RegExp(
      '^' + normalizedPattern.replace(/\*/g, '[^/]*').replace(/\//g, '\\/') + '$'
    );
    return regex.test(normalizedPath);
  }
  
  return normalizedPath.includes(normalizedPattern);
}

/**
 * Get fortress file definition for a path
 */
export function getFortressFile(filePath: string): FortressFile | null {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Sort by specificity (more specific patterns first)
  const sorted = [...FORTRESS_FILES].sort((a, b) => {
    const aSpecificity = a.pattern.split('/').length + (a.pattern.includes('**') ? 0 : 10);
    const bSpecificity = b.pattern.split('/').length + (b.pattern.includes('**') ? 0 : 10);
    return bSpecificity - aSpecificity;
  });
  
  for (const fortress of sorted) {
    if (matchesFortressPattern(normalizedPath, fortress.pattern)) {
      return fortress;
    }
  }
  
  return null;
}

/**
 * Get tier for a file path
 */
export function getFileTier(filePath: string): FortressTier {
  const fortress = getFortressFile(filePath);
  return fortress?.tier ?? FortressTier.NORMAL;
}

/**
 * Check if a file is in the fortress (tiers 0-1)
 */
export function isInFortress(filePath: string): boolean {
  const tier = getFileTier(filePath);
  return tier <= FortressTier.REGENERATE_ONLY;
}

/**
 * Check if repair is allowed for a file
 */
export function canRepair(filePath: string, attemptCount: number): boolean {
  const fortress = getFortressFile(filePath);
  
  if (!fortress) {
    return attemptCount < 3; // Default max attempts
  }
  
  if (fortress.tier === FortressTier.GOLDEN) {
    return false; // NEVER repair golden files
  }
  
  if (fortress.tier === FortressTier.REGENERATE_ONLY) {
    return false; // Can only regenerate, not repair
  }
  
  return attemptCount < fortress.maxAttempts;
}

/**
 * Get action to take when repair fails
 */
export function getFailAction(filePath: string): 'HALT' | 'ROLLBACK' | 'RESTART_CODER' | 'CONTINUE' {
  const fortress = getFortressFile(filePath);
  return fortress?.onFail ?? 'ROLLBACK';
}

/**
 * Get all fortress files of a specific tier
 */
export function getFilesByTier(tier: FortressTier): FortressFile[] {
  return FORTRESS_FILES.filter(f => f.tier === tier);
}

/**
 * Get fortress summary for logging
 */
export function getFortressSummary(): string {
  const byTier = {
    [FortressTier.GOLDEN]: getFilesByTier(FortressTier.GOLDEN),
    [FortressTier.REGENERATE_ONLY]: getFilesByTier(FortressTier.REGENERATE_ONLY),
    [FortressTier.RESTRICTED_FIX]: getFilesByTier(FortressTier.RESTRICTED_FIX),
    [FortressTier.NORMAL]: getFilesByTier(FortressTier.NORMAL),
    [FortressTier.DISPOSABLE]: getFilesByTier(FortressTier.DISPOSABLE),
  };
  
  return `
🏰 FORTRESS FILES SUMMARY
═══════════════════════════════════════════════════════════════

TIER 0 - GOLDEN (${byTier[FortressTier.GOLDEN].length} files):
${byTier[FortressTier.GOLDEN].map(f => `  🔒 ${f.pattern}`).join('\n')}

TIER 1 - REGENERATE ONLY (${byTier[FortressTier.REGENERATE_ONLY].length} files):
${byTier[FortressTier.REGENERATE_ONLY].map(f => `  🔄 ${f.pattern}`).join('\n')}

TIER 2 - RESTRICTED FIX (${byTier[FortressTier.RESTRICTED_FIX].length} files):
${byTier[FortressTier.RESTRICTED_FIX].map(f => `  ⚠️ ${f.pattern}`).join('\n')}

TIER 3 - NORMAL (${byTier[FortressTier.NORMAL].length} files):
${byTier[FortressTier.NORMAL].map(f => `  📝 ${f.pattern}`).join('\n')}

TIER 4 - DISPOSABLE (${byTier[FortressTier.DISPOSABLE].length} files):
${byTier[FortressTier.DISPOSABLE].map(f => `  ♻️ ${f.pattern}`).join('\n')}

═══════════════════════════════════════════════════════════════
`;
}

