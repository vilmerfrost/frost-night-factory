// =============================================================================
// AI CODE VALIDATOR - Syntax firewall + validation for AI-generated code
// =============================================================================
import * as ts from 'typescript';
import path from 'path';
import { isDangerousContent } from './write-file-safe';
/**
 * Validate generated code using TypeScript compiler
 */
export async function validateGeneratedCode(code, filePath, projectRoot) {
    // First check for dangerous content
    const danger = isDangerousContent(code, filePath);
    if (danger) {
        return { valid: false, errors: [`Security check failed: ${danger}`] };
    }
    // Create a temporary source file
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    // Try to parse and get diagnostics
    try {
        // Use project root if provided, otherwise use file's directory
        const rootDir = projectRoot || path.dirname(filePath);
        const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
        let compilerOptions = {
            target: ts.ScriptTarget.Latest,
            module: ts.ModuleKind.ESNext,
            jsx: filePath.endsWith('.tsx') ? ts.JsxEmit.React : undefined,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
        };
        if (configPath) {
            try {
                const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
                if (!configFile.error) {
                    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);
                    compilerOptions = { ...compilerOptions, ...parsed.options };
                }
            }
            catch {
                // Use defaults if config read fails
            }
        }
        const program = ts.createProgram({
            rootNames: [filePath],
            options: compilerOptions,
        });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length === 0) {
            return { valid: true, errors: [] };
        }
        const errors = diagnostics.map(d => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            const file = d.file ? path.basename(d.file.fileName) : 'unknown';
            const line = d.file && d.start !== undefined
                ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
                : 0;
            return `${file}:${line} - ${message}`;
        });
        return { valid: false, errors };
    }
    catch (error) {
        return { valid: false, errors: [`Validation failed: ${error.message}`] };
    }
}
/**
 * Generate and validate code with retries
 */
export async function generateAndValidateCode(callModel, prompt, filePath, projectRoot, maxRetries = 3) {
    let localPrompt = prompt;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`   🔄 [Validator] Attempt ${attempt}/${maxRetries} for ${path.basename(filePath)}`);
        const code = await callModel(localPrompt);
        // Strip code fences if present
        let cleanedCode = code;
        if (cleanedCode.includes('```')) {
            const match = cleanedCode.match(/```(?:typescript|tsx|ts|jsx|js)?\n([\s\S]*?)```/);
            if (match) {
                cleanedCode = match[1].trim();
            }
            else {
                // Remove all fences
                cleanedCode = cleanedCode.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
            }
        }
        const { valid, errors } = await validateGeneratedCode(cleanedCode, filePath, projectRoot);
        if (valid) {
            console.log(`   ✅ [Validator] Code validated successfully`);
            return cleanedCode;
        }
        console.warn(`   ⚠️ [Validator] Validation failed (attempt ${attempt}/${maxRetries}):`);
        errors.forEach(err => console.warn(`      - ${err}`));
        if (attempt < maxRetries) {
            localPrompt += `\n\nPREVIOUS ATTEMPT HAD SYNTAX ERRORS:\n${errors.join('\n')}\n\nFix them and regenerate. Output ONLY valid ${filePath.endsWith('.tsx') ? 'TSX' : 'TS'} code without markdown fences or explanations.`;
        }
    }
    throw new Error(`Failed to generate valid code for ${filePath} after ${maxRetries} attempts`);
}
