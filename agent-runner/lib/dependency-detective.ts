// agent-runner/lib/dependency-detective.ts
// Robust JSON parser with auto-repair and fallback mechanisms
// NEVER throws - always returns a valid result

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

  // 2. Strip Comments (Regex Fallback - no external package needed)
  let cleaned = jsonString
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
 */
export function parsePackageJson(content: string): any {
  const result = parseJsonWithComments(content, {
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

