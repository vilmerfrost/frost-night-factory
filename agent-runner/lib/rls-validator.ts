// agent-runner/lib/rls-validator.ts
// Layer 4: RLS Policy Validation (After SQL)
// Ensures Row-Level Security policies exist and are correct

import type { SqlEditorPhaseJSON, PlannerPhaseJSON } from '../../lib/pipeline/pipeline-json-types';

export interface RLSIssue {
  type: 'missing_rls' | 'incorrect_rls' | 'missing_policy';
  table: string;
  autoFixable: boolean;
  message?: string;
}

export interface RLSValidationResult {
  passed: boolean;
  issues: RLSIssue[];
  shouldRegenerateSQL: boolean;
}

/**
 * Main RLS validation function
 */
export async function validateRLSPolicies(
  sqlJSON: SqlEditorPhaseJSON,
  plannerJSON: PlannerPhaseJSON | any
): Promise<RLSValidationResult> {
  console.log('\n🔒 [RLS Validator] Validating Row-Level Security policies...');
  const issues: RLSIssue[] = [];

  const tables = sqlJSON.database_schema_created?.tables || [];
  const rlsPolicies = sqlJSON.rls_policies || [];

  // Keywords that indicate user-specific tables
  const userSpecificKeywords = [
    'user',
    'account',
    'profile',
    'invoice',
    'order',
    'subscription',
    'payment',
    'transaction',
    'session',
    'token',
  ];

  // Check each table
  for (const table of tables) {
    const tableName = table.name.toLowerCase();
    
    // Check if table is user-specific
    const isUserSpecific = 
      userSpecificKeywords.some(keyword => tableName.includes(keyword)) ||
      table.sql?.toLowerCase().includes('user_id') ||
      table.sql?.toLowerCase().includes('created_by') ||
      table.sql?.toLowerCase().includes('owner_id');

    if (!isUserSpecific) {
      // Skip non-user-specific tables (e.g., lookup tables, config tables)
      continue;
    }

    // Check if RLS is enabled (check SQL for ENABLE ROW LEVEL SECURITY)
    const hasRLSEnabled = table.sql?.toUpperCase().includes('ENABLE ROW LEVEL SECURITY') ||
                          table.sql?.toUpperCase().includes('ALTER TABLE') && 
                          table.sql?.toUpperCase().includes('ENABLE ROW LEVEL SECURITY');

    if (!hasRLSEnabled) {
      issues.push({
        type: 'missing_rls',
        table: table.name,
        autoFixable: true,
        message: `Table '${table.name}' is user-specific but RLS is not enabled`,
      });
      continue;
    }

    // Check if policies exist for this table
    const tablePolicies = rlsPolicies.filter(p => 
      p.table.toLowerCase() === tableName
    );

    if (tablePolicies.length === 0) {
      issues.push({
        type: 'missing_policy',
        table: table.name,
        autoFixable: true,
        message: `Table '${table.name}' has RLS enabled but no policies defined`,
      });
    }

    // Check if policies are correct (basic check)
    // A proper RLS setup should have at least SELECT and INSERT policies
    const hasSelectPolicy = tablePolicies.some(p => 
      p.definition?.toUpperCase().includes('SELECT') ||
      p.policy_name?.toLowerCase().includes('select')
    );

    const hasInsertPolicy = tablePolicies.some(p => 
      p.definition?.toUpperCase().includes('INSERT') ||
      p.policy_name?.toLowerCase().includes('insert')
    );

    if (!hasSelectPolicy && !hasInsertPolicy && tablePolicies.length > 0) {
      issues.push({
        type: 'incorrect_rls',
        table: table.name,
        autoFixable: true,
        message: `Table '${table.name}' has RLS policies but missing SELECT or INSERT policies`,
      });
    }
  }

  if (issues.length === 0) {
    console.log('✅ [RLS Validator] All RLS policies are correctly configured!');
    return { passed: true, issues: [], shouldRegenerateSQL: false };
  }

  console.log(`⚠️  [RLS Validator] Found ${issues.length} RLS issues`);
  console.log(`   Auto-fixable: ${issues.filter(i => i.autoFixable).length}`);

  return {
    passed: false,
    issues,
    shouldRegenerateSQL: issues.filter(i => i.autoFixable).length > 0,
  };
}

/**
 * Generate RLS policy SQL for a table
 */
export function generateRLSPolicySQL(
  tableName: string,
  userIdColumn: string = 'user_id'
): string {
  const policyName = `${tableName}_policy`;
  
  return `
-- Enable RLS on ${tableName}
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can only see their own rows
CREATE POLICY "${policyName}_select"
ON ${tableName}
FOR SELECT
USING (auth.uid() = ${userIdColumn});

-- Policy for INSERT: Users can only insert rows with their own user_id
CREATE POLICY "${policyName}_insert"
ON ${tableName}
FOR INSERT
WITH CHECK (auth.uid() = ${userIdColumn});

-- Policy for UPDATE: Users can only update their own rows
CREATE POLICY "${policyName}_update"
ON ${tableName}
FOR UPDATE
USING (auth.uid() = ${userIdColumn})
WITH CHECK (auth.uid() = ${userIdColumn});

-- Policy for DELETE: Users can only delete their own rows
CREATE POLICY "${policyName}_delete"
ON ${tableName}
FOR DELETE
USING (auth.uid() = ${userIdColumn});
`;
}

