// agent-runner/lib/dependency-detective.ts
// Robust JSON parser with auto-repair and fallback mechanisms
// NEVER throws - always returns a valid result

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const DEFAULT_PACKAGE_JSON = {
  name: "generated-app",
  version: "0.1.0",
  private: true,
  scripts: {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  dependencies: {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.1.0",
    "lucide-react": "^0.300.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  devDependencies: {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.0.1",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.3.0"
  }
};

export interface ParseJsonResult {
  success: boolean;
  data: any;
  wasRepaired: boolean;
  error?: string;
}

/**
 * Aggressive JSON truncation: Remove garbage text appended after valid JSON
 * Finds the LAST closing brace '}' and cuts everything after it
 * This prevents issues when AI outputs multiple files in one block
 */
export function sanitizeJsonString(content: string): string {
  if (!content || typeof content !== 'string') {
    return content || '';
  }

  // 1. Find the LAST closing brace '}' that matches the FIRST opening brace '{'
  // A simple robust way for package.json is to find the last '}' in the file
  const lastBrace = content.lastIndexOf('}');

  if (lastBrace === -1) {
    // No closing brace found - let the parser fail later if no brace
    return content;
  }

  // 2. Cut everything after the last brace
  const cleanContent = content.substring(0, lastBrace + 1);

  // 3. Log if we actually truncated anything
  if (cleanContent.length < content.length) {
    const truncated = content.length - cleanContent.length;
    console.log(`🔧 [JSON Sanitizer] Truncated ${truncated} characters after last closing brace`);
  }

  return cleanContent;
}

/**
 * Aggressive JSON parser that attempts to fix broken JSON strings.
 * Returns { success: boolean, data: any, wasRepaired: boolean }
 * NEVER throws - always returns a valid result
 */
export function parseJsonWithComments(
  jsonString: string,
  options: { fallback?: any; fileName?: string } = {}
): ParseJsonResult {
  const { fallback = {}, fileName = 'unknown.json' } = options;

  // 1. Sanity Check
  if (!jsonString || typeof jsonString !== 'string' || jsonString.trim().length === 0) {
    console.warn(`⚠️ Empty JSON input for ${fileName}. Using fallback.`);
    return { success: false, data: fallback, wasRepaired: true, error: 'Empty input' };
  }

  // 1.5. AGGRESSIVE TRUNCATION: Remove garbage text appended after valid JSON
  // This is especially important for package.json when AI outputs multiple files
  const sanitized = sanitizeJsonString(jsonString);

  // 2. Strip Comments (Regex Fallback - no external package needed)
  let cleaned = sanitized
    .replace(/\/\/.*$/gm, '')  // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove multi-line comments

  // 3. Attempt Repair (The "Trauma Surgeon")
  const attemptParse = (str: string): any | null => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  // Strategy A: Try cleaning whitespace/comments
  let parsed = attemptParse(cleaned);
  if (parsed) {
    return { success: true, data: parsed, wasRepaired: false };
  }

  // Strategy B: Fix Truncation (Add missing braces)
  console.log(`🔧 Attempting to repair truncated JSON in ${fileName}...`);
  const openBraces = (cleaned.match(/{/g) || []).length;
  const closeBraces = (cleaned.match(/}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  let repaired = cleaned;
  
  // Append missing quotes if string was cut
  if (repaired.trim().match(/"[^"]*$/)) {
    repaired += '"';
  }
  
  // Append missing brackets
  repaired += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
  
  // Append missing braces
  repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));

  parsed = attemptParse(repaired);
  if (parsed) {
    console.log(`✅ Repair successful for ${fileName}`);
    return { success: true, data: parsed, wasRepaired: true };
  }

  // Strategy C: Remove trailing commas
  repaired = repaired
    .replace(/,\s*}/g, '}')   // Remove commas before }
    .replace(/,\s*\]/g, ']')  // Remove commas before ]
    .replace(/,\s*,/g, ',');  // Remove duplicate commas

  parsed = attemptParse(repaired);
  if (parsed) {
    console.log(`✅ Repair successful (trailing comma fix) for ${fileName}`);
    return { success: true, data: parsed, wasRepaired: true };
  }

  // Strategy D: Extract first valid JSON object (if garbage after valid JSON)
  const firstBrace = repaired.indexOf('{');
  const lastBrace = repaired.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = repaired.substring(firstBrace, lastBrace + 1);
    parsed = attemptParse(extracted);
    if (parsed) {
      console.log(`✅ Repair successful (extracted valid JSON) for ${fileName}`);
      return { success: true, data: parsed, wasRepaired: true };
    }
  }

  // Strategy E: Absolute Failure -> Fallback
  console.error(`❌ JSON Repair failed for ${fileName}. Using Default Fallback.`);
  return { success: false, data: fallback, wasRepaired: true, error: 'All repair strategies failed' };
}

/**
 * Specific helper for package.json that guarantees a valid object
 * Always returns a valid package.json structure, even if parsing fails
 * Ensures aggressive truncation is applied BEFORE parsing
 */
export function parsePackageJson(content: string): any {
  // CRITICAL: Sanitize package.json BEFORE parsing to remove garbage text
  const sanitized = sanitizeJsonString(content);
  
  const result = parseJsonWithComments(sanitized, {
    fallback: DEFAULT_PACKAGE_JSON,
    fileName: 'package.json'
  });

  // Merge with default to ensure critical fields exist even if parse succeeded but data was partial
  const merged = { ...DEFAULT_PACKAGE_JSON, ...result.data };

  // Ensure nested objects exist
  if (!merged.dependencies || typeof merged.dependencies !== 'object') {
    merged.dependencies = { ...DEFAULT_PACKAGE_JSON.dependencies };
  }
  if (!merged.devDependencies || typeof merged.devDependencies !== 'object') {
    merged.devDependencies = { ...DEFAULT_PACKAGE_JSON.devDependencies };
  }
  if (!merged.scripts || typeof merged.scripts !== 'object') {
    merged.scripts = { ...DEFAULT_PACKAGE_JSON.scripts };
  }

  // Warn if fallback was used
  if (result.wasRepaired && !result.success) {
    console.warn('⚠️ package.json was repaired or used fallback structure');
  }

  return merged;
}

/**
 * Safe tsconfig.json parser with fallback
 */
export function parseTsConfig(content: string): any {
  const defaultTsConfig = {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      jsx: 'preserve',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules'],
  };

  const result = parseJsonWithComments(content, {
    fallback: defaultTsConfig,
    fileName: 'tsconfig.json'
  });

  return result.data;
}

/**
 * Validate that parsed JSON has expected structure
 */
export function validatePackageJson(packageJson: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!packageJson.name || typeof packageJson.name !== 'string') {
    errors.push('Missing or invalid "name" field');
  }
  if (!packageJson.version || typeof packageJson.version !== 'string') {
    errors.push('Missing or invalid "version" field');
  }
  if (!packageJson.dependencies || typeof packageJson.dependencies !== 'object') {
    errors.push('Missing or invalid "dependencies" field');
  }
  if (!packageJson.devDependencies || typeof packageJson.devDependencies !== 'object') {
    errors.push('Missing or invalid "devDependencies" field');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export default package.json for use as fallback
 */
export { DEFAULT_PACKAGE_JSON };

/**
 * Enforce Next.js 15 compatible tsconfig.json
 * Sets critical compiler options to prevent "ghost errors" (Cannot find module)
 */
export async function enforceNextJs15Config(projectPath: string): Promise<boolean> {
  console.log(`🔧 [Foundation Fix] Enforcing Next.js 15 tsconfig.json in ${projectPath}...`);
  
  try {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      console.error(`❌ tsconfig.json not found at ${tsConfigPath}`);
      return false;
    }

    // Read current config
    const currentContent = fs.readFileSync(tsConfigPath, 'utf-8');
    let config: any;
    
    try {
      // Try to parse as JSON (might have comments)
      config = parseJsonWithComments(currentContent, { fallback: {} }).data;
    } catch {
      // Fallback: try direct JSON parse
      config = JSON.parse(currentContent);
    }

    // Ensure compilerOptions exists
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }

    // CRITICAL FIXES for Next.js 15
    const changes: string[] = [];
    
    // 1. SET moduleResolution to "bundler" (Next.js 15 requirement)
    if (config.compilerOptions.moduleResolution !== 'bundler') {
      changes.push(`moduleResolution: ${config.compilerOptions.moduleResolution || 'undefined'} → bundler`);
      config.compilerOptions.moduleResolution = 'bundler';
    }

    // 2. SET resolveJsonModule to false (Critical conflict fix)
    if (config.compilerOptions.resolveJsonModule !== false) {
      changes.push(`resolveJsonModule: ${config.compilerOptions.resolveJsonModule ?? 'undefined'} → false`);
      config.compilerOptions.resolveJsonModule = false;
    }

    // 3. SET paths to ensure src alias
    if (!config.compilerOptions.paths || !config.compilerOptions.paths['@/*']) {
      if (!config.compilerOptions.paths) {
        config.compilerOptions.paths = {};
      }
      changes.push(`paths: Added @/* alias`);
      config.compilerOptions.paths['@/*'] = ['./src/*'];
    }

    // 4. SET include to Next.js 15 standard
    const requiredIncludes = [
      'next-env.d.ts',
      '**/*.ts',
      '**/*.tsx',
      '.next/types/**/*.ts'
    ];
    
    if (!config.include || !Array.isArray(config.include)) {
      config.include = requiredIncludes;
      changes.push(`include: Set to Next.js 15 standard`);
    } else {
      // Merge required includes
      const missingIncludes = requiredIncludes.filter(inc => !config.include.includes(inc));
      if (missingIncludes.length > 0) {
        config.include = [...new Set([...config.include, ...missingIncludes])];
        changes.push(`include: Added missing entries`);
      }
    }

    // Write updated config
    fs.writeFileSync(tsConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    
    if (changes.length > 0) {
      console.log(`✅ [Foundation Fix] tsconfig.json updated:`);
      changes.forEach(change => console.log(`   ${change}`));
    } else {
      console.log(`✅ [Foundation Fix] tsconfig.json already correct`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ [Foundation Fix] Failed to enforce Next.js 15 config: ${error.message}`);
    return false;
  }
}

/**
 * Relax tsconfig.json to be less strict
 * Sets strict: false, noImplicitAny: false, skipLibCheck: true
 */
export async function relaxTsConfig(projectPath: string): Promise<boolean> {
  console.log(`🔧 [Config Relaxer] Relaxing tsconfig.json in ${projectPath}...`);
  
  try {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json');
    
    if (!fs.existsSync(tsConfigPath)) {
      console.error(`❌ tsconfig.json not found at ${tsConfigPath}`);
      return false;
    }

    // Read current config
    const currentContent = fs.readFileSync(tsConfigPath, 'utf-8');
    let config: any;
    
    try {
      // Try to parse as JSON (might have comments)
      config = parseJsonWithComments(currentContent, { fallback: {} }).data;
    } catch {
      // Fallback: try direct JSON parse
      config = JSON.parse(currentContent);
    }

    // Relax compiler options
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }

    const originalStrict = config.compilerOptions.strict;
    const originalNoImplicitAny = config.compilerOptions.noImplicitAny;
    const originalSkipLibCheck = config.compilerOptions.skipLibCheck;

    config.compilerOptions.strict = false;
    config.compilerOptions.noImplicitAny = false;
    config.compilerOptions.skipLibCheck = true;

    // Write relaxed config
    fs.writeFileSync(tsConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.log(`✅ [Config Relaxer] tsconfig.json relaxed:`);
    console.log(`   strict: ${originalStrict} → false`);
    console.log(`   noImplicitAny: ${originalNoImplicitAny ?? 'undefined'} → false`);
    console.log(`   skipLibCheck: ${originalSkipLibCheck ?? 'undefined'} → true`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ [Config Relaxer] Failed to relax tsconfig.json: ${error.message}`);
    return false;
  }
}

/**
 * Install dependencies in the given directory
 * Returns true if successful, false otherwise
 */
export async function installDependencies(projectPath: string): Promise<boolean> {
  console.log(`📦 [Dependency Detective] Installing dependencies in ${projectPath}...`);
  
  try {
    // Check if package.json exists
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error(`❌ package.json not found at ${packageJsonPath}`);
      return false;
    }

    // CRITICAL: Sanitize package.json BEFORE npm install to remove garbage text
    // This prevents 'npm install' from failing due to appended text like "[FILE: next.config.mjs]"
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const sanitizedContent = sanitizeJsonString(packageJsonContent);
    
    // Only write back if content was actually changed
    if (sanitizedContent !== packageJsonContent) {
      console.log(`🔧 [JSON Sanitizer] Cleaning package.json before npm install...`);
      fs.writeFileSync(packageJsonPath, sanitizedContent, 'utf-8');
    }

    // Check if node_modules exists (maybe already installed)
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const alreadyInstalled = fs.existsSync(nodeModulesPath);
    
    if (alreadyInstalled) {
      console.log(`   ℹ️ node_modules already exists, running install anyway to ensure up-to-date...`);
    }

    // Run npm install with legacy-peer-deps flag (handles peer dependency conflicts)
    console.log(`   Running: npm install --legacy-peer-deps`);
    const startTime = Date.now();
    
    execSync('npm install --legacy-peer-deps', {
      cwd: projectPath,
      stdio: 'inherit', // Show npm output to user
      timeout: 180000, // 3 minute timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [Dependency Detective] Dependencies installed successfully in ${duration}s`);
    
    // Verify node_modules was created
    if (!fs.existsSync(nodeModulesPath)) {
      console.error(`❌ node_modules was not created after npm install`);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ [Dependency Detective] npm install failed: ${error.message}`);
    
    // Try fallback: npm install without legacy-peer-deps
    try {
      console.log(`   Trying fallback: npm install (without --legacy-peer-deps)`);
      execSync('npm install', {
        cwd: projectPath,
        stdio: 'pipe', // Suppress output on retry
        timeout: 180000,
      });
      console.log(`✅ [Dependency Detective] Fallback install succeeded`);
      return true;
    } catch (fallbackError: any) {
      console.error(`❌ [Dependency Detective] Fallback install also failed: ${fallbackError.message}`);
      return false;
    }
  }
}

