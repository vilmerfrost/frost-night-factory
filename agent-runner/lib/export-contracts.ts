// agent-runner/lib/export-contracts.ts
/**
 * ✅ EXPORT CONTRACT MAP: Central source of truth for required exports
 * 
 * Defines what exports MUST exist in core lib files to prevent import/export mismatches.
 * Used by stub generators, fallback creators, and import healers.
 */

export interface ExportContract {
  filePath: string;
  requiredExports: string[];
  description?: string;
}

/**
 * Central export contract map - single source of truth
 */
export const EXPORT_CONTRACTS: ExportContract[] = [
  {
    filePath: 'src/lib/supabase/client.ts',
    requiredExports: ['createBrowserClient'],
    description: 'Browser-side Supabase client creator'
  },
  {
    filePath: 'src/lib/supabase/server.ts',
    requiredExports: ['createServerClient'],
    description: 'Server-side Supabase client creator'
  },
  {
    filePath: 'src/lib/types.ts',
    requiredExports: ['InvoiceData', 'Invoice', 'InvoiceStatus', 'InvoiceItem'],
    description: 'Core invoice type definitions'
  },
  {
    filePath: 'src/lib/utils.ts',
    requiredExports: ['formatCurrency', 'formatDate', 'cn'],
    description: 'Utility functions'
  },
];

/**
 * Get export contract for a file path
 */
export function getExportContract(filePath: string): ExportContract | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  return EXPORT_CONTRACTS.find(contract => {
    const contractPath = contract.filePath.replace(/\\/g, '/');
    return normalized === contractPath || normalized.endsWith(contractPath);
  });
}

/**
 * Get all required exports for a file
 */
export function getRequiredExports(filePath: string): string[] {
  const contract = getExportContract(filePath);
  return contract?.requiredExports || [];
}

/**
 * Check if a file has all required exports
 */
export function hasRequiredExports(filePath: string, code: string): {
  missing: string[];
  hasAll: boolean;
} {
  const required = getRequiredExports(filePath);
  if (required.length === 0) {
    return { missing: [], hasAll: true };
  }
  
  const missing = required.filter(exp => {
    // Check for named export: export { exp } or export const exp or export function exp
    const namedExportPattern = new RegExp(`export\\s+(?:const|function|class|type|interface|enum|\\{.*?\\b${exp}\\b.*?\\})`, 'm');
    return !namedExportPattern.test(code);
  });
  
  return {
    missing,
    hasAll: missing.length === 0
  };
}

