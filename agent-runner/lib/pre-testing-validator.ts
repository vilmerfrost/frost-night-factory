// agent-runner/lib/pre-testing-validator.ts

import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export interface ProjectValidationResult {
  success: boolean;
  diagnostics: string[];
  errorCount: number;
}

/**
 * 🛡️ The New Brain: ProjectValidator
 */
export class ProjectValidator {
  private projectRoot: string;
  private tsConfigPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tsConfigPath = path.join(projectRoot, "tsconfig.json");
  }

  public validate(): ProjectValidationResult {
    console.log("🔍 Validator: Initializing TypeScript compiler check...");

    if (!fs.existsSync(this.tsConfigPath)) {
      return {
        success: false,
        diagnostics: [`Error: tsconfig.json not found at ${this.tsConfigPath}`],
        errorCount: 1,
      };
    }

    const configConfigFile = ts.readConfigFile(this.tsConfigPath, ts.sys.readFile);
    if (configConfigFile.error) {
      return {
        success: false,
        diagnostics: [`Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configConfigFile.error.messageText, '\n')}`],
        errorCount: 1,
      };
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configConfigFile.config,
      ts.sys,
      this.projectRoot
    );

    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    const emitResult = program.emit();
    const allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    const formattedErrors: string[] = [];

    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        
        if (!diagnostic.file.fileName.includes("node_modules")) {
          const relativePath = path.relative(this.projectRoot, diagnostic.file.fileName);
          formattedErrors.push(`${relativePath} (${line + 1},${character + 1}): ${message}`);
        }
      } else {
        formattedErrors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      }
    });

    const success = formattedErrors.length === 0;
    if (!success) {
      console.log(`❌ Validator: Found ${formattedErrors.length} errors.`);
    } else {
      console.log("✅ Validator: Project clean.");
    }

    return {
      success,
      diagnostics: formattedErrors,
      errorCount: formattedErrors.length,
    };
  }
}

/**
 * 🔄 PERFECT MIMIC ADAPTER
 * Matches the exact signature and return type of the old validator
 * so pipeline-runner.ts compiles without changes.
 */
export async function validateCoderPhaseOutput(
    coderJSON: any,                 // Accepted but ignored
    projectRoot: string = process.cwd(), 
    pipelineId?: string             // Accepted but ignored
) {
  // console.log("🔄 Adapter: Routing legacy call to ProjectValidator...");
  
  const validator = new ProjectValidator(projectRoot);
  const result = validator.validate();

  // Convert string errors to object format expected by pipeline-runner
  // "validation.errors.map(e => e.message)"
  const errorObjects = result.diagnostics.map(msg => ({ message: msg }));

  return {
    success: result.success,
    // Legacy properties required by pipeline-runner.ts:
    passed: result.success,
    errors: errorObjects,
    fixedCode: null,           // No auto-fix in this phase
    shouldRetryPhase: !result.success
  };
}