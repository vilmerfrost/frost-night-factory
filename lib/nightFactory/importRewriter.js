// =============================================================================
// IMPORT REWRITER - Convert relative imports to @/ aliases
// =============================================================================
// Scans all files and converts ../../../ imports to clean @/ aliases
// Also validates that imported files actually exist
import * as fs from 'fs';
import * as path from 'path';
/**
 * Extract all imports from a file
 */
export function extractImports(content) {
    const imports = [];
    const lines = content.split('\n');
    // Match various import patterns
    const importPatterns = [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /from\s+['"]([^'"]+)['"]/g,
    ];
    lines.forEach((line, index) => {
        for (const pattern of importPatterns) {
            pattern.lastIndex = 0; // Reset regex
            let match;
            while ((match = pattern.exec(line)) !== null) {
                imports.push({
                    importPath: match[1],
                    line: index + 1,
                    fullMatch: match[0],
                });
            }
        }
    });
    // Deduplicate
    const seen = new Set();
    return imports.filter(imp => {
        const key = `${imp.importPath}:${imp.line}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * Resolve a relative import to an absolute path
 */
export function resolveImport(importPath, currentFile, projectRoot) {
    // Skip node_modules and already-aliased imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        return null; // Node module or alias
    }
    const currentDir = path.dirname(currentFile);
    let resolved = path.resolve(currentDir, importPath);
    // Try different extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null; // File not found
}
/**
 * Convert an absolute path to @/ alias
 */
export function pathToAlias(absolutePath, projectRoot) {
    const srcPath = path.join(projectRoot, 'src');
    // Normalize paths for comparison
    const normalizedAbsolute = path.normalize(absolutePath);
    const normalizedSrc = path.normalize(srcPath);
    if (normalizedAbsolute.startsWith(normalizedSrc)) {
        // Remove src/ prefix and convert to alias
        let relativePath = path.relative(srcPath, normalizedAbsolute);
        // Remove extension
        relativePath = relativePath.replace(/\.(tsx?|jsx?|js)$/, '');
        // Remove /index suffix
        relativePath = relativePath.replace(/\/index$/, '');
        // Convert backslashes to forward slashes (Windows)
        relativePath = relativePath.replace(/\\/g, '/');
        return `@/${relativePath}`;
    }
    return null;
}
/**
 * Rewrite imports in a single file
 */
export function rewriteFileImports(filePath, projectRoot) {
    const result = {
        file: filePath,
        imports: [],
        rewritten: 0,
        broken: 0,
        fixed: false,
    };
    if (!fs.existsSync(filePath))
        return result;
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    const imports = extractImports(content);
    for (const imp of imports) {
        // Skip non-relative imports
        if (!imp.importPath.startsWith('.')) {
            continue;
        }
        const resolved = resolveImport(imp.importPath, filePath, projectRoot);
        const alias = resolved ? pathToAlias(resolved, projectRoot) : null;
        const info = {
            original: imp.importPath,
            resolved,
            alias,
            exists: resolved !== null,
            line: imp.line,
        };
        result.imports.push(info);
        if (!resolved) {
            result.broken++;
            console.log(`   ⚠️ Broken import in ${path.basename(filePath)}:${imp.line}: '${imp.importPath}'`);
        }
        else if (alias) {
            // Rewrite the import
            const oldImport = `from '${imp.importPath}'`;
            const newImport = `from '${alias}'`;
            const oldImport2 = `from "${imp.importPath}"`;
            const newImport2 = `from "${alias}"`;
            if (content.includes(oldImport)) {
                content = content.replace(oldImport, newImport);
                result.rewritten++;
            }
            else if (content.includes(oldImport2)) {
                content = content.replace(oldImport2, newImport2);
                result.rewritten++;
            }
        }
    }
    // Write back if changed
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        result.fixed = true;
    }
    return result;
}
/**
 * Scan entire project and rewrite all imports
 */
export function runImportRewriter(projectPath) {
    console.log("\n🔄 IMPORT REWRITER: Converting relative imports to @/ aliases...");
    const results = [];
    const srcPath = path.join(projectPath, 'src');
    if (!fs.existsSync(srcPath)) {
        console.log("   ⚠️ No src/ directory found");
        return results;
    }
    scanDirectory(srcPath, projectPath, results);
    // Summary
    const totalRewritten = results.reduce((sum, r) => sum + r.rewritten, 0);
    const totalBroken = results.reduce((sum, r) => sum + r.broken, 0);
    const filesFixed = results.filter(r => r.fixed).length;
    console.log(`\n📊 IMPORT REWRITER RESULTS:`);
    console.log(`   ✅ Imports rewritten: ${totalRewritten}`);
    console.log(`   📁 Files modified: ${filesFixed}`);
    console.log(`   ⚠️ Broken imports found: ${totalBroken}`);
    return results;
}
function scanDirectory(dir, projectRoot, results) {
    if (!fs.existsSync(dir))
        return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
            continue;
        }
        if (entry.isDirectory()) {
            scanDirectory(fullPath, projectRoot, results);
        }
        else if (entry.name.match(/\.(tsx?|jsx?)$/)) {
            const result = rewriteFileImports(fullPath, projectRoot);
            if (result.imports.length > 0) {
                results.push(result);
            }
        }
    }
}
/**
 * Get all broken imports in project (for error reporting)
 */
export function getBrokenImports(projectPath) {
    const broken = [];
    const results = runImportRewriter(projectPath);
    for (const result of results) {
        for (const imp of result.imports) {
            if (!imp.exists) {
                broken.push({
                    file: result.file,
                    importPath: imp.original,
                    line: imp.line,
                });
            }
        }
    }
    return broken;
}
