// agent-runner/repo-map-generator.ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
/**
 * Generate a repository map showing all available exports
 * Prevents AI from importing non-existent files
 */
export function generateRepositoryMap(projectRoot) {
    const srcPath = path.join(projectRoot, 'src');
    const exports = [];
    // Scan all TypeScript files
    scanDirectory(srcPath, exports, projectRoot);
    // Also scan root-level TypeScript files
    scanDirectory(projectRoot, exports, projectRoot);
    // Build the map
    let map = `# REPOSITORY MAP - AVAILABLE EXPORTS\n\n`;
    map += `This is a complete list of all exportable items in your project.\n`;
    map += `ONLY import from files listed here. DO NOT hallucinate imports.\n\n`;
    for (const info of exports) {
        const relativePath = path.relative(projectRoot, info.file);
        if (info.exports.length > 0) {
            map += `## ${relativePath}\n`;
            map += `Available exports:\n`;
            info.exports.forEach(exp => {
                map += `- ${exp}\n`;
            });
            map += `\n`;
        }
    }
    map += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    map += `CRITICAL: If you need to import something NOT listed above,\n`;
    map += `you MUST create that file first!\n`;
    map += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    return map;
}
function scanDirectory(dir, results, projectRoot) {
    if (!fs.existsSync(dir))
        return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip node_modules, .next, and other build directories
            if (entry.name !== 'node_modules' &&
                entry.name !== '.next' &&
                entry.name !== 'dist' &&
                entry.name !== 'build' &&
                !entry.name.startsWith('.')) {
                scanDirectory(fullPath, results, projectRoot);
            }
        }
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            const info = analyzeFile(fullPath, projectRoot);
            if (info && info.exports.length > 0) {
                results.push(info);
            }
        }
    }
}
function analyzeFile(filePath, projectRoot) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        const exports = [];
        const imports = [];
        function visit(node) {
            // Find export declarations
            if (ts.isExportDeclaration(node)) {
                // export { A, B } from './module'
                if (node.exportClause && ts.isNamedExports(node.exportClause)) {
                    node.exportClause.elements.forEach(elem => {
                        exports.push(elem.name.text);
                    });
                }
                // export * from './module'
                else if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
                    exports.push('*');
                }
            }
            else if ((ts.isFunctionDeclaration(node) ||
                ts.isClassDeclaration(node) ||
                ts.isInterfaceDeclaration(node) ||
                ts.isTypeAliasDeclaration(node) ||
                ts.isEnumDeclaration(node) ||
                ts.isVariableStatement(node)) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                // export function X, export class Y, etc.
                if ('name' in node && node.name) {
                    exports.push(node.name.text);
                }
                else if (ts.isVariableStatement(node)) {
                    node.declarationList.declarations.forEach(decl => {
                        if (ts.isIdentifier(decl.name)) {
                            exports.push(decl.name.text);
                        }
                    });
                }
            }
            // Find default exports
            if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
                if ('name' in node && node.name) {
                    exports.push('default');
                }
                else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
                    exports.push('default');
                }
            }
            // Find imports
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    imports.push(moduleSpecifier.text);
                }
            }
            ts.forEachChild(node, visit);
        }
        visit(sourceFile);
        return {
            file: filePath,
            exports,
            imports
        };
    }
    catch (error) {
        // Silently skip files that can't be parsed
        return null;
    }
}
