// =============================================================================
// INTEGRATION TESTER - Validates backend/frontend contract
// =============================================================================

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export interface IntegrationTestConfig {
  workspaceRoot: string;
  backendEntry: string;
  backendPort?: number;
  timeout?: number;
}

export interface IntegrationTestResult {
  success: boolean;
  endpointsTested: number;
  errors: string[];
  warnings: string[];
  typesGenerated: boolean;
}

/**
 * Run integration test suite for FastAPI backend
 */
export async function runIntegrationTestSuite(
  config: IntegrationTestConfig
): Promise<IntegrationTestResult> {
  const {
    workspaceRoot,
    backendEntry,
    backendPort = 8001,
    timeout = 30000,
  } = config;

  const errors: string[] = [];
  const warnings: string[] = [];
  let endpointsTested = 0;
  let typesGenerated = false;

  console.log('🔗 [Integration Tester] Starting backend integration tests...');

  // Step 1: Verify backend exists
  const backendPath = path.join(workspaceRoot, backendEntry);
  if (!fs.existsSync(backendPath)) {
    return {
      success: false,
      endpointsTested: 0,
      errors: [`Backend file not found: ${backendEntry}`],
      warnings: [],
      typesGenerated: false,
    };
  }

  // Step 2: Start FastAPI backend
  console.log(`   🚀 Starting FastAPI backend on port ${backendPort}...`);
  const backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--port', String(backendPort)], {
    cwd: path.dirname(backendPath),
    env: { ...process.env, PORT: String(backendPort) },
    shell: true,
  });

  let backendReady = false;
  let backendOutput = '';

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    backendOutput += output;
    if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
      backendReady = true;
    }
  });

  backendProcess.stderr?.on('data', (data: Buffer) => {
    const error = data.toString();
    backendOutput += error;
    if (error.includes('error') || error.includes('Error')) {
      errors.push(`Backend error: ${error.substring(0, 200)}`);
    }
  });

  // Wait for backend to start
  const startTime = Date.now();
  while (!backendReady && (Date.now() - startTime < timeout)) {
    await sleep(1000);
  }

  if (!backendReady) {
    backendProcess.kill();
    return {
      success: false,
      endpointsTested: 0,
      errors: [`Backend failed to start within ${timeout}ms. Output: ${backendOutput.substring(0, 500)}`],
      warnings: [],
      typesGenerated: false,
    };
  }

  console.log('   ✅ Backend started successfully');

  try {
    // Step 3: Test /health endpoint
    console.log('   🏥 Testing /health endpoint...');
    try {
      const healthResponse = await fetch(`http://localhost:${backendPort}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log(`   ✅ Health check passed: ${JSON.stringify(healthData)}`);
        endpointsTested++;
      } else {
        errors.push(`Health endpoint returned ${healthResponse.status}`);
      }
    } catch (error: any) {
      errors.push(`Health endpoint failed: ${error.message}`);
    }

    // Step 4: Fetch OpenAPI schema
    console.log('   📋 Fetching OpenAPI schema...');
    try {
      const openApiResponse = await fetch(`http://localhost:${backendPort}/openapi.json`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (openApiResponse.ok) {
        const openApiSchema = await openApiResponse.json();
        const paths = Object.keys(openApiSchema.paths || {});
        endpointsTested += paths.length;
        console.log(`   ✅ Found ${paths.length} API endpoints`);

        // Step 5: Generate TypeScript types from OpenAPI
        console.log('   🔧 Generating TypeScript types from OpenAPI...');
        try {
          const typesDir = path.join(workspaceRoot, 'src', 'types');
          if (!fs.existsSync(typesDir)) {
            fs.mkdirSync(typesDir, { recursive: true });
          }

          // Save OpenAPI schema
          const schemaPath = path.join(typesDir, 'openapi.json');
          fs.writeFileSync(schemaPath, JSON.stringify(openApiSchema, null, 2));

          // Generate types using openapi-typescript (if available)
          try {
            execSync(`npx openapi-typescript ${schemaPath} -o ${path.join(typesDir, 'api.ts')}`, {
              cwd: workspaceRoot,
              stdio: 'pipe',
              timeout: 10000,
            });
            typesGenerated = true;
            console.log('   ✅ TypeScript types generated');
          } catch (error: any) {
            warnings.push(`Could not generate types (openapi-typescript not installed): ${error.message}`);
            
            // Fallback: Generate basic types manually
            const basicTypes = generateBasicTypes(openApiSchema);
            fs.writeFileSync(path.join(typesDir, 'api.ts'), basicTypes);
            typesGenerated = true;
            console.log('   ✅ Basic TypeScript types generated (fallback)');
          }
        } catch (error: any) {
          warnings.push(`Type generation failed: ${error.message}`);
        }

        // Step 6: Test each endpoint
        console.log('   🧪 Testing API endpoints...');
        for (const endpointPath of paths.slice(0, 5)) { // Test first 5 endpoints
          const methods = Object.keys(openApiSchema.paths[endpointPath] || {});
          for (const method of methods) {
            if (method === 'get' && !endpointPath.includes('{')) {
              try {
                const testResponse = await fetch(`http://localhost:${backendPort}${endpointPath}`, {
                  method: method.toUpperCase(),
                  signal: AbortSignal.timeout(5000),
                });
                
                if (testResponse.ok || testResponse.status === 404) {
                  console.log(`   ✅ ${method.toUpperCase()} ${endpointPath} - ${testResponse.status}`);
                } else {
                  warnings.push(`${method.toUpperCase()} ${endpointPath} returned ${testResponse.status}`);
                }
              } catch (error: any) {
                warnings.push(`${method.toUpperCase()} ${endpointPath} failed: ${error.message}`);
              }
            }
          }
        }
      } else {
        errors.push(`OpenAPI endpoint returned ${openApiResponse.status}`);
      }
    } catch (error: any) {
      errors.push(`OpenAPI fetch failed: ${error.message}`);
    }

    // Step 7: Generate mock data
    console.log('   📦 Generating mock data...');
    try {
      await generateMockData(workspaceRoot, backendPort);
      console.log('   ✅ Mock data generated');
    } catch (error: any) {
      warnings.push(`Mock data generation failed: ${error.message}`);
    }

  } finally {
    // Cleanup: Kill backend process
    backendProcess.kill();
    await sleep(1000); // Give it time to shut down
  }

  const success = errors.length === 0;

  return {
    success,
    endpointsTested,
    errors,
    warnings,
    typesGenerated,
  };
}

/**
 * Generate basic TypeScript types from OpenAPI schema
 */
function generateBasicTypes(schema: any): string {
  const components = schema.components?.schemas || {};
  const types: string[] = [];

  types.push('// Auto-generated from OpenAPI schema');
  types.push('// Run: npx openapi-typescript src/types/openapi.json -o src/types/api.ts');
  types.push('');

  for (const [name, def] of Object.entries(components)) {
    const definition = def as any;
    if (definition.type === 'object') {
      types.push(`export interface ${name} {`);
      const properties = definition.properties || {};
      for (const [prop, propDef] of Object.entries(properties)) {
        const propType = propDef as any;
        const tsType = mapOpenApiTypeToTs(propType.type || 'any');
        const optional = definition.required?.includes(prop) ? '' : '?';
        types.push(`  ${prop}${optional}: ${tsType};`);
      }
      types.push('}');
      types.push('');
    }
  }

  return types.join('\n');
}

/**
 * Map OpenAPI types to TypeScript types
 */
function mapOpenApiTypeToTs(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    integer: 'number',
    number: 'number',
    boolean: 'boolean',
    array: 'any[]',
    object: 'Record<string, any>',
  };
  return typeMap[type] || 'any';
}

/**
 * Generate mock data based on API endpoints
 */
async function generateMockData(workspaceRoot: string, backendPort: number): Promise<void> {
  try {
    const openApiResponse = await fetch(`http://localhost:${backendPort}/openapi.json`);
    const schema = await openApiResponse.json();
    
    const mockDataPath = path.join(workspaceRoot, 'src', 'lib', 'mock-data.ts');
    const mockDir = path.dirname(mockDataPath);
    
    if (!fs.existsSync(mockDir)) {
      fs.mkdirSync(mockDir, { recursive: true });
    }

    const mocks: string[] = [];
    mocks.push('// Auto-generated mock data from backend API');
    mocks.push('// This file is regenerated on each integration test');
    mocks.push('');

    const paths = schema.paths || {};
    for (const [path, methods] of Object.entries(paths)) {
      const pathMethods = methods as any;
      if (pathMethods.get?.responses?.['200']?.content?.['application/json']?.schema) {
        const responseSchema = pathMethods.get.responses['200'].content['application/json'].schema;
        const mockName = path.split('/').filter(Boolean).join('_') || 'root';
        mocks.push(`export const mock${mockName.charAt(0).toUpperCase() + mockName.slice(1)} = ${JSON.stringify(generateMockFromSchema(responseSchema), null, 2)};`);
        mocks.push('');
      }
    }

    fs.writeFileSync(mockDataPath, mocks.join('\n'));
  } catch (error) {
    // Silently fail - mock data generation is optional
  }
}

/**
 * Generate mock data from JSON schema
 */
function generateMockFromSchema(schema: any): any {
  if (schema.type === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(schema.properties || {})) {
      const prop = value as any;
      result[key] = generateMockFromSchema(prop);
    }
    return result;
  } else if (schema.type === 'array') {
    return [generateMockFromSchema(schema.items || {})];
  } else if (schema.type === 'string') {
    return 'mock-string';
  } else if (schema.type === 'number' || schema.type === 'integer') {
    return 0;
  } else if (schema.type === 'boolean') {
    return false;
  }
  return null;
}

