import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const traverse =
  (traverseModule as unknown as { default?: any }).default ?? traverseModule;

// ✅ 1. STRICT INTERFACE: warnings is mandatory
export interface ValidationResult {
  valid: boolean;
  score: number;
  reason: string;
  warnings: string[]; // Never undefined
  fileType: 'config' | 'data' | 'logic' | 'component';
}

function isConfigOrDataFile(filePath: string): boolean {
  if (!filePath) return false;
  const patterns = [
    /\.config\.(ts|js|mjs)$/,
    /^(next|tailwind|postcss|tsconfig|jest|vitest)\.config/,
    /src\/lib\/design-system\//,
    /src\/lib\/constants\//,
    /src\/config\//,
    /src\/data\//,
    /\/colors\.(ts|js)$/,
    /\/theme\.(ts|js)$/,
    /\/constants\.(ts|js)$/,
    /\/schema\.(ts|js)$/,
    /\/types\.(ts|js)$/,
  ];
  return patterns.some(pattern => pattern.test(filePath));
}

function hasValidExports(code: string): { hasExports: boolean; exportCount: number } {
  let exportCount = 0;
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });

    traverse(ast, {
      ExportNamedDeclaration() { exportCount++; },
      ExportDefaultDeclaration() { exportCount++; },
      ExportAllDeclaration() { exportCount++; },
    });

    return { hasExports: exportCount > 0, exportCount };
  } catch (error) {
    return { hasExports: false, exportCount: 0 };
  }
}

function calculateComplexityScore(code: string): number {
  let score = 0;
  try {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });

    traverse(ast, {
      FunctionDeclaration() { score += 2; },
      ArrowFunctionExpression() { score += 1; },
      FunctionExpression() { score += 1; },
      JSXElement() { score += 2; },
      CallExpression(path: any) {
        const callee = path.node.callee;
        if (t.isIdentifier(callee) && /^use[A-Z]/.test(callee.name)) { score += 2; }
      },
      IfStatement() { score += 1; },
      SwitchStatement() { score += 1; },
      ForStatement() { score += 1; },
      WhileStatement() { score += 1; },
      TSInterfaceDeclaration() { score += 0.5; },
      TSTypeAliasDeclaration() { score += 0.5; },
    });
  } catch (error) { 
    console.warn('⚠️ Failed to calculate score:', error); 
  }

  return score;
}

export async function validateCode(
  code: string,
  filePath: string,
  context?: { phase?: string; attempt?: number }
): Promise<ValidationResult> {
  // ✅ Initialize defaults
  const warnings: string[] = [];
  const isConfigFile = isConfigOrDataFile(filePath);
  const fileType = isConfigFile ? 'config' : (filePath.endsWith('.tsx') ? 'component' : 'logic');

  if (isConfigFile) console.log(`📋 Detected config/data file: ${filePath}`);

  // 1. Syntax Check
  try {
    parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: false });
  } catch (syntaxError: any) {
    return { 
      valid: false, 
      score: 0, 
      reason: `Syntax error: ${syntaxError.message}`, 
      warnings: [], // ✅ Always array
      fileType 
    };
  }

  // 2. Export Check
  const { hasExports } = hasValidExports(code);
  if (!hasExports) warnings.push('No exports found');

  // 3. Config File Path (Lenient)
  if (isConfigFile) {
    if (hasExports) {
      return { 
        valid: true, 
        score: 0, 
        reason: 'Config/data file with valid exports', 
        warnings, // ✅ Always array
        fileType 
      };
    }
    return { 
      valid: true, 
      score: 0, 
      reason: 'Config/data file (syntactically valid)', 
      warnings: ['No exports found (allowed for config)'], 
      fileType: 'data' 
    };
  }

  // 4. Logic File Path (Strict)
  const complexityScore = calculateComplexityScore(code);
  const MIN_LOGIC_SCORE = 1;

  if (complexityScore < MIN_LOGIC_SCORE) {
    return { 
      valid: false, 
      score: complexityScore, 
      reason: `Incomplete implementation (score: ${complexityScore})`, 
      warnings, // ✅ Always array
      fileType 
    };
  }

  return { 
    valid: true, 
    score: complexityScore, 
    reason: 'Valid implementation', 
    warnings, // ✅ Always array
    fileType 
  };
}

export function logValidationResults(filePath: string, result: ValidationResult): void {
  try {
    const icon = result.valid ? '✅' : '❌';
    const typeLabel = result.fileType === 'config' ? '📋 CONFIG' : '🔧 LOGIC';
    
    console.log(`${icon} ${typeLabel} ${filePath}`);
    console.log(`   Score: ${result.score} | Reason: ${result.reason || 'No reason provided'}`);

    // ✅ Crash-proof loop
    if (Array.isArray(result.warnings)) {
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }
  } catch (err) {
    console.warn('⚠️ Failed to log validation results (non-fatal):', err);
  }
}
