// =============================================================================
// COMPILER AGENT - Use tsc to auto-fix simple errors without AI
// =============================================================================
// Runs TypeScript compiler, parses errors, and fixes simple issues automatically
// Only calls AI for complex errors that require reasoning
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
// Errors that can be auto-fixed without AI
const AUTO_FIXABLE_ERRORS = {
    // TS2307: Cannot find module
    'TS2307': (error, content, projectPath) => {
        const moduleMatch = error.message.match(/Cannot find module '([^']+)'/);
        if (!moduleMatch)
            return null;
        const modulePath = moduleMatch[1];
        // If it's a relative import, try to convert to @/ alias
        if (modulePath.startsWith('.')) {
            // Try to find the file
            const currentDir = path.dirname(path.join(projectPath, error.file));
            const resolvedPath = path.resolve(currentDir, modulePath);
            const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
            for (const ext of extensions) {
                const fullPath = resolvedPath + ext;
                if (fs.existsSync(fullPath)) {
                    // Convert to @/ alias
                    const relativeSrc = path.relative(path.join(projectPath, 'src'), fullPath);
                    if (!relativeSrc.startsWith('..')) {
                        const alias = '@/' + relativeSrc.replace(/\\/g, '/').replace(/\.(tsx?|jsx?)$/, '');
                        return content.replace(new RegExp(`from\\s+['"]${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `from '${alias}'`);
                    }
                }
            }
        }
        return null; // Can't auto-fix
    },
    // TS2305: Module has no exported member
    'TS2305': (error, content, projectPath) => {
        // Check if it's a default vs named export issue
        const memberMatch = error.message.match(/has no exported member '(\w+)'/);
        const moduleMatch = error.message.match(/Module '"([^"]+)"'/);
        if (!memberMatch || !moduleMatch)
            return null;
        const memberName = memberMatch[1];
        const modulePath = moduleMatch[1];
        // Try to read the source module
        let sourcePath = modulePath;
        if (modulePath.startsWith('@/')) {
            sourcePath = path.join(projectPath, 'src', modulePath.slice(2));
        }
        const extensions = ['.tsx', '.ts', '.jsx', '.js'];
        for (const ext of extensions) {
            const fullPath = sourcePath + ext;
            if (fs.existsSync(fullPath)) {
                const sourceContent = fs.readFileSync(fullPath, 'utf-8');
                // Check if it has default export
                if (sourceContent.includes('export default')) {
                    // Change named import to default import
                    const importRegex = new RegExp(`import\\s+\\{[^}]*\\b${memberName}\\b[^}]*\\}\\s+from\\s+['"]${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
                    const match = content.match(importRegex);
                    if (match) {
                        // Simple case: just the one member
                        if (match[0].match(/\{\s*\w+\s*\}/)) {
                            return content.replace(match[0], `import ${memberName} from '${modulePath}'`);
                        }
                    }
                }
                break;
            }
        }
        return null;
    },
    // TS2339: Property does not exist on type
    'TS2339': (error, content) => {
        // Can't auto-fix most type errors, but can handle some simple cases
        return null;
    },
    // TS7006: Parameter implicitly has 'any' type
    'TS7006': (error, content) => {
        // Add : any to the parameter (temporary fix)
        const paramMatch = error.message.match(/Parameter '(\w+)' implicitly has an 'any' type/);
        if (!paramMatch)
            return null;
        // This is a band-aid - we should use proper types
        // But it's better than failing the build
        return null; // Let AI handle this properly
    },
    // TS1192: Module has no default export
    'TS1192': (error, content) => {
        // Change default import to named import
        const moduleMatch = error.message.match(/Module '"([^"]+)"' has no default export/);
        if (!moduleMatch)
            return null;
        const modulePath = moduleMatch[1];
        // Find the import statement
        const importRegex = new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]${modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
        const match = content.match(importRegex);
        if (match) {
            const importName = match[1];
            // Change to named import
            return content.replace(match[0], `import { ${importName} } from '${modulePath}'`);
        }
        return null;
    },
    // TS2686: 'React' refers to a UMD global
    'TS2686': (error, content) => {
        // Add React import if missing
        if (!content.includes("import React") && !content.includes("from 'react'")) {
            return `import React from 'react';\n${content}`;
        }
        return null;
    },
};
// Errors that definitely need AI
const COMPLEX_ERROR_CODES = [
    'TS2322', // Type is not assignable
    'TS2345', // Argument of type X is not assignable to parameter of type Y
    'TS2531', // Object is possibly null
    'TS2532', // Object is possibly undefined
    'TS2571', // Object is of type unknown
    'TS18046', // 'X' is of type 'unknown'
    'TS2769', // No overload matches this call
];
/**
 * Run TypeScript compiler and parse errors
 */
export function runTypeScriptCheck(projectPath) {
    console.log("\n🔍 COMPILER AGENT: Running TypeScript check...");
    const errors = [];
    try {
        // Run tsc with --noEmit to just check types
        execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: 'pipe',
        });
        console.log("   ✅ No TypeScript errors!");
        return [];
    }
    catch (e) {
        const output = e.stdout || e.stderr || e.message;
        // Parse the output
        const lines = output.split('\n');
        // Pattern: src/app/page.tsx(10,5): error TS2307: Cannot find module...
        // Or: ./src/app/page.tsx:10:5 - error TS2307: Cannot find module...
        const errorPattern1 = /([^(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/;
        const errorPattern2 = /\.\/([^:]+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)/;
        for (const line of lines) {
            let match = line.match(errorPattern1) || line.match(errorPattern2);
            if (match) {
                const [, file, lineNum, col, code, message] = match;
                const isAutoFixable = code in AUTO_FIXABLE_ERRORS;
                const isComplex = COMPLEX_ERROR_CODES.includes(code);
                errors.push({
                    file: file.trim(),
                    line: parseInt(lineNum),
                    column: parseInt(col),
                    code,
                    message: message.trim(),
                    category: isComplex ? 'complex' : 'simple',
                    autoFixable: isAutoFixable && !isComplex,
                });
            }
        }
        console.log(`   Found ${errors.length} TypeScript errors`);
        console.log(`   Auto-fixable: ${errors.filter(e => e.autoFixable).length}`);
        console.log(`   Needs AI: ${errors.filter(e => !e.autoFixable).length}`);
        return errors;
    }
}
/**
 * Auto-fix simple errors without AI
 */
export function autoFixSimpleErrors(errors, projectPath) {
    console.log("\n🔧 COMPILER AGENT: Auto-fixing simple errors...");
    let fixed = 0;
    const remaining = [];
    const fixedFiles = new Set();
    for (const error of errors) {
        if (!error.autoFixable) {
            remaining.push(error);
            continue;
        }
        const fixer = AUTO_FIXABLE_ERRORS[error.code];
        if (!fixer) {
            remaining.push(error);
            continue;
        }
        const filePath = path.join(projectPath, error.file);
        if (!fs.existsSync(filePath)) {
            remaining.push(error);
            continue;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fixedContent = fixer(error, content, projectPath);
            if (fixedContent && fixedContent !== content) {
                fs.writeFileSync(filePath, fixedContent);
                fixed++;
                fixedFiles.add(error.file);
                console.log(`   ✅ Fixed ${error.code} in ${error.file}:${error.line}`);
            }
            else {
                remaining.push(error);
            }
        }
        catch (e) {
            console.error(`   ❌ Failed to fix ${error.file}: ${e.message}`);
            remaining.push(error);
        }
    }
    console.log(`\n   Auto-fixed: ${fixed} errors in ${fixedFiles.size} files`);
    console.log(`   Remaining: ${remaining.length} errors need AI`);
    return { fixed, remaining };
}
/**
 * Add 'use client' where needed (special case - very common)
 */
export function fixUseClientErrors(projectPath) {
    console.log("\n🔧 COMPILER AGENT: Checking for missing 'use client'...");
    let fixed = 0;
    const srcPath = path.join(projectPath, 'src');
    function scanDir(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.next')
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            }
            else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                // Check if needs 'use client'
                const needsClient = (content.includes('useState') ||
                    content.includes('useEffect') ||
                    content.includes('useRouter') ||
                    content.includes('onClick=') ||
                    content.includes('onChange=')) &&
                    !content.includes("'use client'") &&
                    !content.includes('"use client"');
                if (needsClient) {
                    fs.writeFileSync(fullPath, `'use client';\n\n${content}`);
                    fixed++;
                    console.log(`   ✅ Added 'use client' to ${path.relative(projectPath, fullPath)}`);
                }
            }
        }
    }
    scanDir(srcPath);
    console.log(`   Fixed ${fixed} files`);
    return fixed;
}
/**
 * Main compiler agent function
 */
export async function runCompilerAgent(projectPath) {
    console.log("\n🤖 COMPILER AGENT: Starting automated error fixing...");
    // Phase 1: Fix 'use client' issues first (very common)
    const useClientFixes = fixUseClientErrors(projectPath);
    // Phase 2: Run TypeScript check
    let errors = runTypeScriptCheck(projectPath);
    if (errors.length === 0) {
        return {
            success: true,
            errors: [],
            autoFixed: useClientFixes,
            needsAI: [],
        };
    }
    // Phase 3: Auto-fix simple errors
    const { fixed, remaining } = autoFixSimpleErrors(errors, projectPath);
    // Phase 4: Re-check to see if fixes worked
    if (fixed > 0) {
        console.log("\n🔄 Re-checking after auto-fixes...");
        errors = runTypeScriptCheck(projectPath);
    }
    const needsAI = errors.filter(e => !e.autoFixable || e.category === 'complex');
    return {
        success: errors.length === 0,
        errors,
        autoFixed: useClientFixes + fixed,
        needsAI,
    };
}
/**
 * Generate a focused prompt for AI based on compiler errors
 */
export function generateAIFixPrompt(errors, projectPath) {
    // Group errors by file
    const errorsByFile = new Map();
    for (const error of errors) {
        if (!errorsByFile.has(error.file)) {
            errorsByFile.set(error.file, []);
        }
        errorsByFile.get(error.file).push(error);
    }
    // Build prompt
    let prompt = `
=== TYPESCRIPT ERRORS TO FIX ===

The Compiler Agent has already fixed simple errors automatically.
These ${errors.length} errors require your intelligence to fix.

`;
    for (const [file, fileErrors] of errorsByFile) {
        const filePath = path.join(projectPath, file);
        let content = '';
        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf-8');
        }
        prompt += `
### FILE: ${file}

ERRORS:
${fileErrors.map(e => `  Line ${e.line}: [${e.code}] ${e.message}`).join('\n')}

CURRENT CONTENT:
\`\`\`tsx
${content}
\`\`\`

`;
    }
    prompt += `
=== YOUR TASK ===

Fix ALL the TypeScript errors above.
Return the complete fixed files using this format:

### FILE: path/to/file.tsx
\`\`\`tsx
// Complete fixed content
\`\`\`
### END_FILE

RULES:
1. Fix the ROOT CAUSE, not just the symptom
2. Use proper TypeScript types (no 'any')
3. Use @/ aliases for imports
4. Add 'use client' if using React hooks
5. Ensure all exports match imports
`;
    return prompt;
}
