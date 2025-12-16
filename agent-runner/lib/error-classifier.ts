// agent-runner/lib/error-classifier.ts
// Smart Error Classifier: Diagnoses validation failures and recommends actions

export interface ErrorDiagnosis {
  type: 'MISSING_DEPENDENCIES' | 'SYNTAX_CRASH' | 'TYPE_MISMATCH' | 'BUILD_CONFIG' | 'UNKNOWN';
  confidence: number; // 0.0 to 1.0
  action: 'npm_install' | 'retry_coder' | 'fix_config' | 'human_intervention';
  reason: string;
  details: {
    missingModules: string[];
    missingTypes: string[];
    totalErrors: number;
    depErrorCount: number;
  };
}

export class ErrorClassifier {
  /**
   * Diagnose validation errors and recommend action
   */
  static diagnose(errors: string[]): ErrorDiagnosis {
    if (!errors || errors.length === 0) {
      return {
        type: 'UNKNOWN',
        confidence: 0,
        action: 'retry_coder',
        reason: 'No errors provided',
        details: {
          missingModules: [],
          missingTypes: [],
          totalErrors: 0,
          depErrorCount: 0,
        },
      };
    }

    let missingModules = 0;
    let missingTypes = 0;
    let syntaxErrors = 0;
    let configErrors = 0;
    const missingModulesList: string[] = [];
    const missingTypesList: string[] = [];

    // Patterns for missing dependencies
    const DEP_PATTERNS = [
      { pattern: /Cannot find module ['"]([^'"]+)['"]/i, type: 'module' },
      { pattern: /Module not found.*['"]([^'"]+)['"]/i, type: 'module' },
      { pattern: /Cannot find name ['"]?([^'"]+)['"]?/i, type: 'name' },
      { pattern: /Could not find a declaration file for module ['"]([^'"]+)['"]/i, type: 'types' },
      { pattern: /Try `npm i --save-dev @types\/([^`]+)`/i, type: 'types' },
    ];

    const SYNTAX_PATTERNS = [
      /Unexpected token/i,
      /Parsing error/i,
      /SyntaxError/i,
    ];

    const CONFIG_PATTERNS = [
      /Cannot find tsconfig/i,
      /Invalid configuration/i,
      /compilerOptions/i,
    ];

    errors.forEach((err) => {
      // Check dependency patterns
      for (const { pattern, type } of DEP_PATTERNS) {
        const match = err.match(pattern);
        if (match) {
          missingModules++;
          if (type === 'module' && match[1]) {
            missingModulesList.push(match[1]);
          } else if (type === 'types' && match[1]) {
            missingTypesList.push(match[1]);
          } else if (type === 'name') {
            // Common missing names that indicate dependencies
            const name = match[1];
            if (!name) break;
            if (['React', 'useState', 'useEffect', 'Component'].includes(name)) {
              missingModulesList.push('react');
            }
          }
          break;
        }
      }

      // Check syntax patterns
      if (SYNTAX_PATTERNS.some((p) => p.test(err))) {
        syntaxErrors++;
      }

      // Check config patterns
      if (CONFIG_PATTERNS.some((p) => p.test(err))) {
        configErrors++;
      }
    });

    const depRatio = missingModules / errors.length;
    const syntaxRatio = syntaxErrors / errors.length;
    const configRatio = configErrors / errors.length;

    // Decision tree based on error ratios
    
    // 1. Config errors take priority (they block everything)
    if (configRatio > 0.3 || configErrors > 5) {
      return {
        type: 'BUILD_CONFIG',
        confidence: configRatio,
        action: 'fix_config',
        reason: `High volume of configuration errors (${configErrors}/${errors.length}). Config needs fixing.`,
        details: {
          missingModules: missingModulesList,
          missingTypes: missingTypesList,
          totalErrors: errors.length,
          depErrorCount: missingModules,
        },
      };
    }

    // 2. Missing dependencies (most common "progress" indicator)
    // If >40% of errors are dependency-related OR >10 absolute dependency errors, it's likely a missing install
    if (depRatio > 0.4 || missingModules > 10) {
      return {
        type: 'MISSING_DEPENDENCIES',
        confidence: Math.min(depRatio, 1.0),
        action: 'npm_install',
        reason: `High volume of dependency errors (${missingModules}/${errors.length}). Running npm install.`,
        details: {
          missingModules: [...new Set(missingModulesList)], // Unique modules
          missingTypes: [...new Set(missingTypesList)], // Unique types
          totalErrors: errors.length,
          depErrorCount: missingModules,
        },
      };
    }

    // 3. Syntax crashes (need immediate coder retry)
    if (syntaxRatio > 0.5 || syntaxErrors > 20) {
      return {
        type: 'SYNTAX_CRASH',
        confidence: syntaxRatio,
        action: 'retry_coder',
        reason: `High volume of syntax errors (${syntaxErrors}/${errors.length}). Code needs regeneration.`,
        details: {
          missingModules: missingModulesList,
          missingTypes: missingTypesList,
          totalErrors: errors.length,
          depErrorCount: missingModules,
        },
      };
    }

    // 4. Standard type mismatches (retry coder)
    return {
      type: 'TYPE_MISMATCH',
      confidence: 0.5,
      action: 'retry_coder',
      reason: `Standard code errors (${errors.length} total). Needs coder fixes.`,
      details: {
        missingModules: missingModulesList,
        missingTypes: missingTypesList,
        totalErrors: errors.length,
        depErrorCount: missingModules,
      },
    };
  }

  /**
   * Check if error is a "progress" indicator (not a real failure)
   */
  static isProgressError(diagnosis: ErrorDiagnosis): boolean {
    return diagnosis.type === 'MISSING_DEPENDENCIES' && diagnosis.confidence > 0.4;
  }

  /**
   * Check if error requires human intervention
   */
  static requiresHuman(diagnosis: ErrorDiagnosis): boolean {
    return diagnosis.action === 'human_intervention';
  }
}

