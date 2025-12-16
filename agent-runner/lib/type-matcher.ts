// agent-runner/lib/type-matcher.ts
// Layer 2: Type Matching Validation (After SQL Phase)
// Validates that frontend types match database schema

import { callAI, selectModel } from '../ai-client';
import type { 
  PlannerPhaseJSON, 
  CoderPhaseJSON, 
  SqlEditorPhaseJSON 
} from '../../lib/pipeline/pipeline-json-types';
import { assertDefined } from '@/lib/utils/assert';

export interface TypeMismatch {
  type: 'missing_interface' | 'missing_field' | 'type_mismatch';
  table: string;
  column?: string;
  expected?: string;
  actual?: string;
  autoFixable: boolean;
  suggestion?: string;
}

export interface TypeMatchResult {
  passed: boolean;
  issues: TypeMismatch[];
  shouldRegenerate: boolean;
  autoFixableCount: number;
}

/**
 * Main validation function - validates types match schema
 */
export async function validateTypesMatchSchema(
  plannerJSON: PlannerPhaseJSON | any,
  coderJSON: CoderPhaseJSON,
  sqlJSON: SqlEditorPhaseJSON,
  pipelineId: string
): Promise<TypeMatchResult> {
  console.log('\n🔍 [Type Matcher] Validating type-schema alignment...');
  const issues: TypeMismatch[] = [];

  // Extract tables from SQL schema
  const tables = sqlJSON.database_schema_created?.tables || [];
  const typeDefs = coderJSON.type_definitions?.types_defined || [];

  // Helper: Convert table name to PascalCase interface name
  const toPascalCase = (str: string): string => {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  };

  // Helper: Convert column name to camelCase
  const toCamelCase = (str: string): string => {
    const parts = str.split('_');
    return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  };

  // For each table in schema
  for (const table of tables) {
    const tableName = table.name;
    const interfaceName = toPascalCase(tableName);

    // Find corresponding TypeScript interface
    const interfaceDef = typeDefs.find(t => 
      t.name === interfaceName || 
      t.name.toLowerCase() === tableName.toLowerCase() ||
      t.name === tableName
    );

    if (!interfaceDef) {
      issues.push({
        type: 'missing_interface',
        table: tableName,
        autoFixable: true,
      });
      continue;
    }

    // Parse SQL columns from table SQL
    const columns = parseColumnsFromSQL(table.sql || '');
    
    // Check column ↔ field mapping
    for (const column of columns) {
      const columnName = column.name;
      const camelCaseName = toCamelCase(columnName);
      
      // Check if field exists in interface
      const fieldExists = interfaceDef.fields.some(field => 
        field === columnName || 
        field === camelCaseName ||
        field.toLowerCase() === columnName.toLowerCase()
      );

      if (!fieldExists) {
        issues.push({
          type: 'missing_field',
          table: tableName,
          column: columnName,
          autoFixable: true,
        });
        continue;
      }

      // Check type compatibility
      const fieldType = interfaceDef.fields.find(f => 
        f === columnName || f === camelCaseName
      );

      if (fieldType) {
        const typeMatch = compareTypes(column.type, fieldType);
        if (!typeMatch.compatible) {
          issues.push({
            type: 'type_mismatch',
            table: tableName,
            column: columnName,
            expected: column.type,
            actual: fieldType,
            autoFixable: true,
            suggestion: typeMatch.suggestion,
          });
        }
      }
    }
  }

  if (issues.length === 0) {
    console.log('✅ [Type Matcher] All types match schema!');
    return { passed: true, issues: [], shouldRegenerate: false, autoFixableCount: 0 };
  }

  const autoFixableCount = issues.filter(i => i.autoFixable).length;
  console.log(`⚠️  [Type Matcher] Found ${issues.length} type mismatches`);
  console.log(`   Auto-fixable: ${autoFixableCount}`);

  return {
    passed: false,
    issues,
    shouldRegenerate: autoFixableCount > 0,
    autoFixableCount,
  };
}

/**
 * Parse columns from SQL CREATE TABLE statement
 */
function parseColumnsFromSQL(sql: string): Array<{ name: string; type: string }> {
  const columns: Array<{ name: string; type: string }> = [];
  
  // Simple regex-based parser for CREATE TABLE
  const createTableMatch = sql.match(/CREATE TABLE[^\(]*\(([\s\S]*?)\)/i);
  if (!createTableMatch) return columns;

  const columnDefinitions = createTableMatch[1];
  if (!columnDefinitions) return columns;
  const lines = columnDefinitions.split(',');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY') || trimmed.startsWith('CONSTRAINT')) {
      continue;
    }

    // Match: column_name TYPE constraints
    const columnMatch = trimmed.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/);
    if (columnMatch) {
      const name = columnMatch[1];
      const type = columnMatch[2];
      if (name && type) {
        columns.push({ name, type });
      }
    }
  }

  return columns;
}

/**
 * Compare SQL type with TypeScript type
 */
function compareTypes(sqlType: string, tsType: string): { compatible: boolean; suggestion?: string } {
  const sqlLower = sqlType.toLowerCase();
  const tsLower = tsType.toLowerCase();

  // Map SQL types to TypeScript types
  const typeMap: Record<string, string[]> = {
    'uuid': ['string', 'uuid'],
    'text': ['string'],
    'varchar': ['string'],
    'integer': ['number', 'int'],
    'int': ['number', 'int'],
    'bigint': ['number', 'bigint'],
    'numeric': ['number'],
    'decimal': ['number'],
    'real': ['number'],
    'double': ['number'],
    'boolean': ['boolean', 'bool'],
    'bool': ['boolean', 'bool'],
    'timestamp': ['date', 'string'],
    'timestamptz': ['date', 'string'],
    'date': ['date', 'string'],
    'json': ['object', 'any', 'record'],
    'jsonb': ['object', 'any', 'record'],
  };

  // Check if types are compatible
  for (const [sqlKey, tsTypes] of Object.entries(typeMap)) {
    if (sqlLower.includes(sqlKey)) {
      const isCompatible = tsTypes.some(ts => tsLower.includes(ts));
      if (isCompatible) {
        return { compatible: true };
      } else {
        return { 
          compatible: false, 
          suggestion: `Expected TypeScript type: ${tsTypes[0]}, got: ${tsType}` 
        };
      }
    }
  }

  // Default: assume compatible if we can't determine
  return { compatible: true };
}

/**
 * Auto-fix type issues using AI (Groq for fast fixes)
 */
export async function autoFixTypeIssues(
  coderJSON: CoderPhaseJSON,
  sqlJSON: SqlEditorPhaseJSON,
  issues: TypeMismatch[],
  pipelineId: string
): Promise<string> {
  console.log(`🔧 [Type Matcher] Auto-fixing ${issues.length} type issues...`);

  const prompt = `These TypeScript types don't match the database schema:

ISSUES:
${JSON.stringify(issues, null, 2)}

CURRENT TYPE DEFINITIONS:
${JSON.stringify(coderJSON.type_definitions, null, 2)}

DATABASE SCHEMA:
${JSON.stringify(sqlJSON.database_schema_created?.tables, null, 2)}

Generate corrected TypeScript interfaces that match the schema exactly.

RULES:
1. Match all table names to PascalCase interfaces
2. Match all column names to camelCase fields
3. Use correct TypeScript types (string for text/uuid, number for int/bigint, boolean for bool, Date for timestamp)
4. Include all columns from the schema
5. Return ONLY the TypeScript code, no explanations

Return the complete type definitions file:`;

  try {
    const fixed = await callAI({
      pipelineId,
      step: 'type-matcher',
      role: 'FIXER',
      model: selectModel('FIXER', 'simple'), // Use cheap model (Groq/DeepSeek)
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract code from response
    let fixedCode = fixed.trim();
    if (fixedCode.includes('```typescript')) {
      const parts = fixedCode.split('```typescript');
      if (parts[1]) {
        const codeParts = parts[1].split('```');
        if (codeParts[0]) {
          fixedCode = codeParts[0].trim();
        }
      }
    } else if (fixedCode.includes('```')) {
      const parts = fixedCode.split('```');
      if (parts[1]) {
        const codeParts = parts[1].split('```');
        if (codeParts[0]) {
          fixedCode = codeParts[0].trim();
        }
      }
    }

    console.log('✅ [Type Matcher] Generated fixed type definitions');
    return fixedCode;
  } catch (error: any) {
    console.error(`❌ [Type Matcher] Failed to auto-fix: ${error.message}`);
    throw error;
  }
}

