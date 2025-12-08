// =============================================================================
// CODER SELF-DEBUG - Per-file validation before Tester
// =============================================================================
import * as fs from 'fs';
import * as path from 'path';
import { validateGeneratedCode } from './ai-code-validator';
/**
 * Run self-debug on a single file
 */
export async function selfDebugFile(filePath, projectRoot) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {
        return {
            filePath,
            passed: false,
            errors: ['File does not exist'],
            warnings: [],
        };
    }
    const errors = [];
    const warnings = [];
    try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // 1. Syntax validation (TypeScript AST)
        const syntaxResult = await validateGeneratedCode(content, fullPath);
        if (!syntaxResult.valid) {
            errors.push(...syntaxResult.errors.map(e => `Syntax: ${e}`));
        }
        // 2. Check for dangerous content
        if (content.includes('<<<<<<< HEAD') || content.includes('>>>>>>>')) {
            errors.push('Git conflict markers detected');
        }
        if (content.includes('```') && (content.match(/```/g) || []).length > 2) {
            warnings.push('Markdown code fences detected (may be AI artifact)');
        }
        // 3. Check for common issues
        if (content.includes('TODO') || content.includes('FIXME')) {
            warnings.push('TODO/FIXME markers found');
        }
        if (content.includes('return null') && !content.includes('if') && !content.includes('?')) {
            warnings.push('Unconditional return null (may be placeholder)');
        }
        // 4. Check for missing exports (for component files)
        if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            if (filePath.includes('page.tsx') && !content.includes('export default')) {
                errors.push('Page component missing default export');
            }
            if (filePath.includes('layout.tsx') && !content.includes('export default')) {
                errors.push('Layout component missing default export');
            }
        }
        // 5. Check import paths (basic validation)
        const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
            const importPath = match[1];
            if (importPath.startsWith('@/')) {
                // Check if @ alias resolves correctly (would need tsconfig check)
                // For now, just validate format
                if (!importPath.match(/^@\/[a-zA-Z0-9_/-]+$/)) {
                    warnings.push(`Suspicious import path: ${importPath}`);
                }
            }
        }
    }
    catch (error) {
        errors.push(`Self-debug failed: ${error.message}`);
    }
    return {
        filePath,
        passed: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Run self-debug on multiple critical files
 */
export async function selfDebugCriticalFiles(filePaths, projectRoot) {
    const results = [];
    for (const filePath of filePaths) {
        const result = await selfDebugFile(filePath, projectRoot);
        results.push(result);
        if (!result.passed) {
            console.log(`   ⚠️ [Self-Debug] ${filePath}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
            result.errors.forEach(e => console.log(`      Error: ${e}`));
            result.warnings.forEach(w => console.log(`      Warning: ${w}`));
        }
    }
    return results;
}
/**
 * Check if self-debug should run (feature flag)
 */
export async function shouldRunSelfDebug() {
    try {
        const { supabase } = await import('../supabase-client');
        const { data } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'enable_coder_self_debug')
            .maybeSingle();
        return data?.value === 'true' || data?.value === true;
    }
    catch {
        return false; // Default to disabled
    }
}
