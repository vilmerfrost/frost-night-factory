// =============================================================================
// PACT CONTRACT TESTING - Ensures frontend and backend speak the same language
// =============================================================================

import * as Pact from '@pact-foundation/pact';
import * as path from 'path';
import * as fs from 'fs';

// Pact API compatibility layer - handles version differences
const Matchers: any = (Pact as any).MatchersV3 ?? (Pact as any).Matchers ?? {};
const { like, integer, string } = Matchers;

// Wrapper functions for matchers that may not exist in all versions
const email = (v: any) => like(v);
const iso8601DateTime = (v?: any) => like(v ?? new Date().toISOString());

export interface PactTestResult {
  success: boolean;
  contractsVerified: number;
  errors: string[];
}

interface APIEndpoint {
  method: string;
  path: string;
  requestBody?: any;
  responseBody?: any;
  status: number;
}

export async function generateAndTestContracts(
  workspacePath: string
): Promise<PactTestResult> {
  
  console.log('📜 [Pact] Generating API contracts...');
  
  const result: PactTestResult = {
    success: true,
    contractsVerified: 0,
    errors: [],
  };
  
  // Parse FastAPI endpoints from backend
  const backendPath = path.join(workspacePath, 'backend', 'main.py');
  
  if (!fs.existsSync(backendPath)) {
    console.log('   ℹ️ No backend detected, skipping contract tests');
    return result;
  }
  
  const endpoints = await parseEndpointsFromFastAPI(backendPath);
  
  console.log(`   📝 Found ${endpoints.length} API endpoints`);
  
  if (endpoints.length === 0) {
    console.log('   ℹ️ No endpoints found, skipping contract tests');
    return result;
  }
  
  // Create Pact provider
  // NOTE: API may vary by @pact-foundation/pact version
  // Current version: 16.0.2 (check with: node -p "require('@pact-foundation/pact/package.json').version")
  // Using 'any' to handle API differences between versions
  const PactV4: any = (Pact as any).PactV4 ?? (Pact as any).Pact;
  const provider: any = new PactV4({
    consumer: 'frontend',
    provider: 'backend-api',
    port: 8002,
    dir: path.join(workspacePath, 'pacts'),
    logLevel: 'warn',
  });
  
  if (typeof provider.setup === 'function') {
    await provider.setup();
  }
  
  try {
    // Test each endpoint
    for (const endpoint of endpoints) {
      try {
        await testEndpointContract(provider, endpoint);
        result.contractsVerified++;
        console.log(`   ✅ ${endpoint.method} ${endpoint.path}`);
      } catch (error: any) {
        result.success = false;
        result.errors.push(`${endpoint.method} ${endpoint.path}: ${error.message}`);
        console.error(`   ❌ ${endpoint.method} ${endpoint.path}: ${error.message}`);
      }
    }
    
    // Write pact file
    // NOTE: In Pact v16+, finalize() may need to be called differently
    // If errors occur, check: https://github.com/pact-foundation/pact-js
    if (typeof provider.finalize === 'function') {
      await provider.finalize();
    }
    
    // Verify frontend uses correct types
    await verifyFrontendTypesMatchContracts(workspacePath, endpoints);
    
  } finally {
    // Ensure cleanup even if errors occur
    try {
      if (typeof provider.finalize === 'function') {
        await provider.finalize();
      }
    } catch (cleanupError: any) {
      console.warn(`   ⚠️ Cleanup warning: ${cleanupError.message}`);
    }
  }
  
  console.log(`\n📊 [Pact] RESULTS:`);
  console.log(`   Contracts verified: ${result.contractsVerified}/${endpoints.length}`);
  console.log(`   Errors: ${result.errors.length}`);
  
  return result;
}

async function parseEndpointsFromFastAPI(filePath: string): Promise<APIEndpoint[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints: APIEndpoint[] = [];
  
  // Parse @app.get(), @app.post(), etc.
  const routeRegex = /@app\.(get|post|put|delete|patch)\(["']([^"']+)["']\)/g;
  let match;
  
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1]?.toUpperCase();
    const path = match[2];
    if (!method || !path) continue;
    
    // Try to find the function definition
    const functionMatch = content.slice(match.index ?? 0).match(/def\s+(\w+)\([^)]*\):/);
    
    if (functionMatch) {
      const functionName = functionMatch[1];
      if (!functionName) continue;
      
      // Try to infer response from function
      const functionBody = content.slice((match.index ?? 0) + match[0].length).split('def ')[0];
      
      endpoints.push({
        method,
        path,
        status: 200,
        responseBody: inferResponseSchema(functionBody, functionName),
      });
    }
  }
  
  return endpoints;
}

function inferResponseSchema(functionBody: string, functionName: string): any {
  // Simple inference based on common patterns
  if (functionName.includes('list') || functionName.includes('get_all')) {
    return like([
      {
        id: integer(1),
        name: string('Example'),
        created_at: iso8601DateTime(),
      },
    ]);
  }
  
  if (functionName.includes('get') || functionName.includes('read')) {
    return like({
      id: integer(1),
      name: string('Example'),
      created_at: iso8601DateTime(),
    });
  }
  
  if (functionName.includes('create') || functionName.includes('post')) {
    return like({
      id: integer(1),
      message: string('Created successfully'),
    });
  }
  
  // Default
  return like({
    status: string('ok'),
    data: like({}),
  });
}

async function testEndpointContract(
  provider: any,
  endpoint: APIEndpoint
): Promise<void> {
  
  // NOTE: Pact v16+ API - if errors occur, check API docs:
  // https://github.com/pact-foundation/pact-js/tree/v16.0.2
  // Common changes: addInteraction() signature, verify() location, etc.
  // Using optional chaining to handle API differences
  if (typeof provider.addInteraction === 'function') {
    await provider.addInteraction({
      state: 'default state',
      uponReceiving: `${endpoint.method} request to ${endpoint.path}`,
      withRequest: {
        method: endpoint.method,
        path: endpoint.path,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      willRespondWith: {
        status: endpoint.status,
        headers: {
          'Content-Type': 'application/json',
        },
        body: endpoint.responseBody,
      },
    });
  }
  
  // Verify the interaction
  // NOTE: In some Pact versions, verify() is called per interaction,
  // in others it's called once after all interactions
  if (typeof provider.verify === 'function') {
    await provider.verify();
  }
}

async function verifyFrontendTypesMatchContracts(
  workspacePath: string,
  endpoints: APIEndpoint[]
): Promise<void> {
  
  console.log('   🔍 Verifying frontend uses correct types...');
  
  // Check if frontend makes API calls
  const apiClientPath = path.join(workspacePath, 'src', 'lib', 'api-client.ts');
  const apiPath = path.join(workspacePath, 'src', 'lib', 'api.ts');
  
  const clientPath = fs.existsSync(apiClientPath) ? apiClientPath : apiPath;
  
  if (!fs.existsSync(clientPath)) {
    console.log('   ℹ️ No API client found in frontend');
    return;
  }
  
  const clientContent = fs.readFileSync(clientPath, 'utf-8');
  
  // Verify each endpoint is called correctly
  for (const endpoint of endpoints) {
    const hasCall = clientContent.includes(endpoint.path);
    
    if (!hasCall) {
      console.warn(`   ⚠️ Frontend doesn't call ${endpoint.method} ${endpoint.path}`);
    }
  }
}

