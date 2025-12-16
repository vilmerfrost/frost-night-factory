// =============================================================================
// DATABASE-FIRST TYPE GENERATOR
// =============================================================================
// Parses SQL migrations and generates TypeScript types
// Preserves snake_case field names (Postgres standard)
// Auto-syncs types.ts with database schema

import * as fs from 'fs';
import * as path from 'path';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

/**
 * Parse SQL migrations and extract table schemas
 */
function parseSQLMigrations(migrationContent: string): Record<string, Column[]> {
  const tables: Record<string, Column[]> = {};
  
  // Match CREATE TABLE statements (handles IF NOT EXISTS)
  const tableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\);/gi;
  
  let match;
  while ((match = tableRegex.exec(migrationContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    
    // Parse columns
    const columns: Column[] = [];
    const columnLines = columnsBlock.split('\n').filter(line => line.trim());
    
    for (const line of columnLines) {
      const trimmed = line.trim();
      
      // Skip constraints and comments
      if (trimmed.startsWith('CONSTRAINT') || 
          trimmed.startsWith('PRIMARY KEY') || 
          trimmed.startsWith('FOREIGN KEY') ||
          trimmed.startsWith('CHECK') ||
          trimmed.startsWith('--') ||
          trimmed.startsWith('COMMENT')) {
        continue;
      }
      
      // Match column definition: name TYPE [constraints]
      // Handles: invoice_number TEXT, user_id UUID NOT NULL, total DECIMAL(15,2)
      // Also handles: -- Comment lines (skip)
      if (trimmed.startsWith('--')) {
        continue;
      }
      
      const colMatch = trimmed.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/);
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2];
        // Check if nullable (default is nullable unless NOT NULL specified)
        const isNullable = !trimmed.includes('NOT NULL') && !trimmed.includes('PRIMARY KEY');
        
        columns.push({
          name: colName,
          type: sqlToTsType(colType),
          nullable: isNullable
        });
      }
    }
    
    if (columns.length > 0) {
      tables[tableName] = columns;
    }
  }
  
  return tables;
}

/**
 * Convert SQL type to TypeScript type
 */
function sqlToTsType(sqlType: string): string {
  const upperType = sqlType.toUpperCase();
  
  if (upperType.startsWith('VARCHAR') || 
      upperType.startsWith('TEXT') || 
      upperType.startsWith('CHAR')) {
    return 'string';
  }
  
  if (upperType.startsWith('INT') || 
      upperType.startsWith('SMALLINT') || 
      upperType.startsWith('BIGINT') ||
      upperType.startsWith('NUMERIC') ||
      upperType.startsWith('DECIMAL') ||
      upperType.startsWith('REAL') ||
      upperType.startsWith('DOUBLE') ||
      upperType.startsWith('FLOAT')) {
    return 'number';
  }
  
  if (upperType.startsWith('BOOL')) {
    return 'boolean';
  }
  
  if (upperType.startsWith('TIMESTAMP') || 
      upperType.startsWith('DATE') || 
      upperType.startsWith('TIME')) {
    return 'string'; // ISO date strings
  }
  
  if (upperType.startsWith('JSON')) {
    return 'any'; // JSONB/JSON types
  }
  
  if (upperType.startsWith('UUID')) {
    return 'string';
  }
  
  return 'any'; // Fallback
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Generate TypeScript types from database schema
 */
export function generateTypesFromDB(migrationPath: string): string {
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  const tables = parseSQLMigrations(migrationContent);
  
  let output = `// =============================================================================
// AUTO-GENERATED DATABASE TYPES - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// Generated from: ${path.basename(migrationPath)}
// DO NOT EDIT MANUALLY - This file is regenerated from migrations
//
// Flow: Migration SQL → types.ts (this file) → Application code
// All field names preserved from database (snake_case - Postgres standard)

`;
  
  // Generate interface for each table
  for (const [tableName, columns] of Object.entries(tables)) {
    const interfaceName = toPascalCase(tableName);
    
    output += `/**
 * ${interfaceName} table row
 * Table: ${tableName}
 * Generated from database schema - field names match database exactly (snake_case)
 * 
 * ⚠️ CRITICAL: When accessing database rows, use snake_case field names:
 * - ${tableName}.${columns[0]?.name || 'id'} (NOT camelCase)
 * - ${tableName}.${columns.find(c => c.name.includes('_'))?.name || 'created_at'} (NOT camelCase)
 * 
 * Use db-mappers.ts to convert to app-layer types (camelCase) if needed.
 */
export interface ${interfaceName} {\n`;
    
    for (const col of columns) {
      const nullableMarker = col.nullable ? ' | null' : '';
      output += `  ${col.name}: ${col.type}${nullableMarker};\n`;
    }
    
    output += `}\n\n`;
  }
  
  // Add utility types
  output += `// =============================================================================
// UTILITY TYPES
// =============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<{ data: T | null; error: string | null }>;

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// VALIDATION RESULT (for form validation)
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
`;
  
  return output;
}

/**
 * Auto-generate types.ts from migration
 * Finds invoice migration and generates types
 */
export function autoGenerateTypes(projectRoot: string): void {
  const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️ [DB-Type Generator] No migrations directory found, skipping type generation');
    return;
  }
  
  // Find migration files (prioritize invoice migration, then any migration)
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const invoiceMigration = files.find(f => f.includes('create_invoices') || f.includes('invoices'));
  const latestMigration = files.sort().reverse()[0]; // Use latest migration if no invoice-specific one
  
  const migrationFile = invoiceMigration || latestMigration;
  
  if (!migrationFile) {
    console.warn('⚠️ [DB-Type Generator] No migration files found, using default types');
    return;
  }
  
  const migrationPath = path.join(migrationsDir, migrationFile);
  const typesPath = path.join(projectRoot, 'src', 'lib', 'types.ts');
  
  try {
    const generatedTypes = generateTypesFromDB(migrationPath);
    
    // Ensure directory exists
    const typesDir = path.dirname(typesPath);
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }
    
    // Write to types.ts
    fs.writeFileSync(typesPath, generatedTypes, 'utf-8');
    console.log(`✅ [DB-Type Generator] Generated types from ${migrationFile}`);
  } catch (error: any) {
    console.warn(`⚠️ [DB-Type Generator] Failed to generate types: ${error.message}`);
  }
}
