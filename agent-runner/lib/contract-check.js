// =============================================================================
// CONTRACT CHECKER - Validates core contract files before AI fixes
// =============================================================================
import * as ts from 'typescript';
import path from 'path';
import fs from 'fs';
const CONTRACT_FILES = ['src/lib/types.ts', 'src/lib/schemas.ts'];
/**
 * Validate contract files using TypeScript compiler
 */
export function validateContracts(projectRoot) {
    const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
        return { ok: false, errors: ['No tsconfig.json found'] };
    }
    try {
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        if (configFile.error) {
            return { ok: false, errors: [`Failed to read tsconfig.json: ${ts.formatDiagnostic(configFile.error, ts.createCompilerHost({}))}`] };
        }
        const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot);
        if (parsed.errors.length > 0) {
            const errors = parsed.errors.map(e => ts.formatDiagnostic(e, ts.createCompilerHost({})));
            return { ok: false, errors };
        }
        // Check if contract files exist
        const missingFiles = [];
        const contractPaths = [];
        for (const contractFile of CONTRACT_FILES) {
            const fullPath = path.join(projectRoot, contractFile);
            if (!fs.existsSync(fullPath)) {
                missingFiles.push(contractFile);
            }
            else {
                contractPaths.push(fullPath);
            }
        }
        if (missingFiles.length > 0) {
            return { ok: false, errors: [`Missing contract files: ${missingFiles.join(', ')}`] };
        }
        if (contractPaths.length === 0) {
            return { ok: true, errors: [] }; // No contracts to check
        }
        // Create TypeScript program for contract files only
        const program = ts.createProgram({
            rootNames: contractPaths,
            options: {
                ...parsed.options,
                incremental: false, // FORCE false
                tsBuildInfoFile: undefined, // REMOVE
            },
        });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length === 0) {
            return { ok: true, errors: [] };
        }
        const errors = diagnostics.map(d => {
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            const file = d.file ? path.relative(projectRoot, d.file.fileName) : 'unknown';
            const line = d.file && d.start !== undefined
                ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
                : 0;
            return `${file}:${line} - ${message}`;
        });
        return { ok: false, errors };
    }
    catch (error) {
        return { ok: false, errors: [`Contract validation failed: ${error.message}`] };
    }
}
