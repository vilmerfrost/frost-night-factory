// =============================================================================
// FROST NIGHT FACTORY v9.0 - DOMAIN TYPE ADAPTER
// =============================================================================
// Pillar 2: Unidirectional Type Hierarchy
// 
// Flow: SUPABASE CLI → database.ts → types.ts → mock-data.ts → components
//                      (IMMUTABLE)    (ADAPTERS)  (DERIVED)    (CONSUMES)

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Type definition from Supabase schema
 */
export interface SupabaseTableType {
  tableName: string;
  rowType: string;
  insertType: string;
  updateType: string;
}

/**
 * Domain type adapter definition
 */
export interface DomainTypeAdapter {
  name: string;
  sourceTable: string;
  pickedFields: string[];
  additionalFields: Record<string, string>;
  description: string;
}

/**
 * Pre-defined domain adapters
 * These are the ONLY types that should be in src/lib/types.ts
 */
export const DOMAIN_ADAPTERS: DomainTypeAdapter[] = [
  {
    name: 'InvoiceData',
    sourceTable: 'invoices',
    pickedFields: ['id', 'amount', 'status', 'created_at', 'due_date'],
    additionalFields: {
      customerName: 'string',
      customerEmail: 'string',
    },
    description: 'Invoice with customer info derived from join',
  },
  {
    name: 'UserProfile',
    sourceTable: 'profiles',
    pickedFields: ['id', 'full_name', 'avatar_url', 'created_at'],
    additionalFields: {
      email: 'string',
      isAdmin: 'boolean',
    },
    description: 'User profile with auth info',
  },
  {
    name: 'ProjectData',
    sourceTable: 'projects',
    pickedFields: ['id', 'name', 'description', 'status', 'created_at'],
    additionalFields: {
      ownerName: 'string',
      memberCount: 'number',
    },
    description: 'Project with owner info',
  },
];

/**
 * Common enum types that are LOCKED
 */
export const LOCKED_ENUMS = {
  InvoiceStatus: ['pending', 'paid', 'overdue', 'cancelled'] as const,
  ProjectStatus: ['draft', 'active', 'completed', 'archived'] as const,
  UserRole: ['admin', 'member', 'viewer'] as const,
};

/**
 * Generate types.ts content from adapters
 */
export function generateTypesFile(adapters: DomainTypeAdapter[] = DOMAIN_ADAPTERS): string {
  const lines: string[] = [
    '// =============================================================================',
    '// DOMAIN TYPES - AUTO-GENERATED FROM TYPE ADAPTERS',
    '// =============================================================================',
    '// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-types',
    '// ',
    '// Flow: database.ts → types.ts (this file) → mock-data.ts → components',
    '// This file contains PURE ADAPTERS - no re-exports, no mutations',
    '',
    "import type { Database } from '@/types/database';",
    '',
    '// =============================================================================',
    '// LOCKED ENUMS - NEVER CHANGE THESE',
    '// =============================================================================',
    '',
  ];
  
  // Add locked enums
  for (const [name, values] of Object.entries(LOCKED_ENUMS)) {
    lines.push(`export type ${name} = ${values.map(v => `'${v}'`).join(' | ')};`);
  }
  
  lines.push('');
  lines.push('// =============================================================================');
  lines.push('// DOMAIN TYPE ADAPTERS');
  lines.push('// =============================================================================');
  lines.push('');
  
  // Add domain adapters
  for (const adapter of adapters) {
    lines.push(`/**`);
    lines.push(` * ${adapter.description}`);
    lines.push(` * Source: ${adapter.sourceTable}`);
    lines.push(` */`);
    
    // Generate the Pick type
    const pickFields = adapter.pickedFields.map(f => `'${f}'`).join(' | ');
    const baseType = `Pick<Database['public']['Tables']['${adapter.sourceTable}']['Row'], ${pickFields}>`;
    
    // Add additional fields
    const additionalFieldsStr = Object.entries(adapter.additionalFields)
      .map(([field, type]) => `  ${field}: ${type};`)
      .join('\n');
    
    if (Object.keys(adapter.additionalFields).length > 0) {
      lines.push(`export type ${adapter.name} = ${baseType} & {`);
      lines.push(additionalFieldsStr);
      lines.push('};');
    } else {
      lines.push(`export type ${adapter.name} = ${baseType};`);
    }
    
    lines.push('');
  }
  
  // Add common utility types
  lines.push('// =============================================================================');
  lines.push('// UTILITY TYPES');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('export type Nullable<T> = T | null;');
  lines.push('export type Optional<T> = T | undefined;');
  lines.push('export type AsyncResult<T> = Promise<{ data: T | null; error: string | null }>;');
  lines.push('');
  lines.push('// =============================================================================');
  lines.push('// API RESPONSE TYPES');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('export interface ApiResponse<T> {');
  lines.push('  data: T | null;');
  lines.push('  error: string | null;');
  lines.push('  status: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface PaginatedResponse<T> {');
  lines.push('  data: T[];');
  lines.push('  total: number;');
  lines.push('  page: number;');
  lines.push('  pageSize: number;');
  lines.push('  hasMore: boolean;');
  lines.push('}');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate mock data file from types
 */
export function generateMockDataFile(adapters: DomainTypeAdapter[] = DOMAIN_ADAPTERS): string {
  const lines: string[] = [
    '// =============================================================================',
    '// MOCK DATA - AUTO-GENERATED FROM DOMAIN TYPES',
    '// =============================================================================',
    '// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-mocks',
    '// ',
    '// These mocks EXACTLY match the domain types in types.ts',
    '',
    "import type {",
    ...adapters.map(a => `  ${a.name},`),
    "} from './types';",
    '',
  ];
  
  // Generate mock data for each adapter
  for (const adapter of adapters) {
    const mockName = `MOCK_${adapter.name.toUpperCase()}S`;
    
    lines.push(`/**`);
    lines.push(` * Mock ${adapter.name} data`);
    lines.push(` * Count: 5`);
    lines.push(` */`);
    lines.push(`export const ${mockName}: ${adapter.name}[] = [`);
    
    // Generate 5 mock items
    for (let i = 1; i <= 5; i++) {
      lines.push(`  {`);
      
      // Add picked fields with mock values
      for (const field of adapter.pickedFields) {
        const mockValue = getMockValue(field, adapter.sourceTable, i);
        lines.push(`    ${field}: ${mockValue},`);
      }
      
      // Add additional fields
      for (const [field, type] of Object.entries(adapter.additionalFields)) {
        const mockValue = getMockValueForType(field, type, i);
        lines.push(`    ${field}: ${mockValue},`);
      }
      
      lines.push(`  },`);
    }
    
    lines.push(`];`);
    lines.push('');
  }
  
  // Add helper functions
  lines.push('// =============================================================================');
  lines.push('// MOCK DATA HELPERS');
  lines.push('// =============================================================================');
  lines.push('');
  lines.push('export function getMockById<T extends { id: string }>(');
  lines.push('  collection: T[],');
  lines.push('  id: string');
  lines.push('): T | undefined {');
  lines.push('  return collection.find(item => item.id === id);');
  lines.push('}');
  lines.push('');
  lines.push('export function filterMocks<T>(');
  lines.push('  collection: T[],');
  lines.push('  predicate: (item: T) => boolean');
  lines.push('): T[] {');
  lines.push('  return collection.filter(predicate);');
  lines.push('}');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get mock value for a field based on field name and table
 */
function getMockValue(field: string, table: string, index: number): string {
  // Common field patterns
  if (field === 'id') {
    return `'${table.slice(0, 3)}_${index.toString().padStart(3, '0')}'`;
  }
  if (field === 'created_at' || field === 'updated_at') {
    const date = new Date(2024, 0, index);
    return `'${date.toISOString()}'`;
  }
  if (field === 'due_date') {
    const date = new Date(2024, index, 15);
    return `'${date.toISOString()}'`;
  }
  if (field === 'amount' || field === 'total') {
    return `${(100 + index * 50)}.00`;
  }
  if (field === 'status') {
    const statuses = ['pending', 'active', 'completed'];
    return `'${statuses[index % statuses.length]}'`;
  }
  if (field === 'name' || field === 'full_name') {
    return `'${table.charAt(0).toUpperCase() + table.slice(1)} Item ${index}'`;
  }
  if (field === 'description') {
    return `'Description for item ${index}'`;
  }
  if (field === 'avatar_url') {
    return `'https://api.dicebear.com/7.x/avataaars/svg?seed=${index}'`;
  }
  
  // Default string
  return `'mock_${field}_${index}'`;
}

/**
 * Get mock value for a TypeScript type
 */
function getMockValueForType(field: string, type: string, index: number): string {
  if (type === 'string') {
    if (field.includes('email')) {
      return `'user${index}@example.com'`;
    }
    if (field.includes('name') || field.includes('Name')) {
      return `'Test User ${index}'`;
    }
    return `'${field}_${index}'`;
  }
  if (type === 'number') {
    return `${index * 10}`;
  }
  if (type === 'boolean') {
    return index % 2 === 0 ? 'true' : 'false';
  }
  
  return `'mock_${field}_${index}'`;
}

/**
 * Write generated files to disk
 */
export async function generateDomainFiles(
  projectRoot: string,
  adapters: DomainTypeAdapter[] = DOMAIN_ADAPTERS
): Promise<{ types: string; mocks: string }> {
  const typesContent = generateTypesFile(adapters);
  const mocksContent = generateMockDataFile(adapters);
  
  const typesPath = path.join(projectRoot, 'src', 'lib', 'types.ts');
  const mocksPath = path.join(projectRoot, 'src', 'lib', 'mock-data.ts');
  
  await fs.mkdir(path.dirname(typesPath), { recursive: true });
  await fs.writeFile(typesPath, typesContent, 'utf-8');
  await fs.writeFile(mocksPath, mocksContent, 'utf-8');
  
  console.log(`✅ Generated: src/lib/types.ts`);
  console.log(`✅ Generated: src/lib/mock-data.ts`);
  
  return { types: typesContent, mocks: mocksContent };
}

/**
 * Validate that mock data matches types
 */
export function validateMockDataTypes(
  mockData: Record<string, unknown[]>,
  adapters: DomainTypeAdapter[] = DOMAIN_ADAPTERS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const adapter of adapters) {
    const mockName = `MOCK_${adapter.name.toUpperCase()}S`;
    const mocks = mockData[mockName];
    
    if (!mocks) {
      errors.push(`Missing mock data: ${mockName}`);
      continue;
    }
    
    for (let i = 0; i < mocks.length; i++) {
      const mock = mocks[i] as Record<string, unknown>;
      
      // Check picked fields
      for (const field of adapter.pickedFields) {
        if (!(field in mock)) {
          errors.push(`${mockName}[${i}] missing field: ${field}`);
        }
      }
      
      // Check additional fields
      for (const field of Object.keys(adapter.additionalFields)) {
        if (!(field in mock)) {
          errors.push(`${mockName}[${i}] missing field: ${field}`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

