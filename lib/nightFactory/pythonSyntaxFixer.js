// =============================================================================
// PYTHON SYNTAX FIXER - Auto-fix common Python syntax errors
// =============================================================================
import * as fs from 'fs';
/**
 * Balance brackets in Python code
 * Adds missing closing brackets/parentheses/braces
 */
export function balanceBrackets(code, errorLine) {
    const lines = code.split('\n');
    const stack = [];
    const brackets = {
        '(': ')',
        '[': ']',
        '{': '}',
    };
    const closingBrackets = new Set(Object.values(brackets));
    // Track bracket positions
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        // Skip if error line is specified and we're past it
        if (errorLine && lineNum > errorLine + 5) {
            break;
        }
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            // Skip strings and comments
            if (char === '"' || char === "'") {
                // Find end of string
                const quote = char;
                j++;
                while (j < line.length && (line[j] !== quote || (j > 0 && line[j - 1] === '\\'))) {
                    j++;
                }
                continue;
            }
            if (char === '#') {
                break; // Rest of line is comment
            }
            // Opening bracket
            if (char in brackets) {
                stack.push({ char, line: lineNum, col: j });
            }
            // Closing bracket
            else if (closingBrackets.has(char)) {
                if (stack.length === 0) {
                    // Extra closing bracket - remove it
                    lines[i] = line.slice(0, j) + line.slice(j + 1);
                    j--; // Adjust index
                    continue;
                }
                const last = stack.pop();
                const expected = brackets[last.char];
                if (char !== expected) {
                    // Mismatched bracket - fix it
                    lines[i] = line.slice(0, j) + expected + line.slice(j + 1);
                }
            }
        }
    }
    // Add missing closing brackets at the end
    while (stack.length > 0) {
        const last = stack.pop();
        const closing = brackets[last.char];
        // Add closing bracket at the end of the file or after the error line
        if (errorLine && last.line <= errorLine) {
            // Insert after the error line
            const insertLine = Math.min(errorLine, lines.length - 1);
            lines[insertLine] += closing;
        }
        else {
            // Add at the end
            lines[lines.length - 1] += closing;
        }
    }
    return lines.join('\n');
}
/**
 * Fix indentation errors
 */
export function fixIndentation(code, errorLine) {
    const lines = code.split('\n');
    const targetLine = errorLine - 1; // Convert to 0-based index
    if (targetLine < 0 || targetLine >= lines.length) {
        return code;
    }
    const errorLineContent = lines[targetLine];
    // Check if line ends with colon (needs indented block)
    if (errorLineContent.trim().endsWith(':')) {
        // Find next non-empty line
        for (let i = targetLine + 1; i < lines.length; i++) {
            const nextLine = lines[i];
            if (nextLine.trim().length === 0) {
                continue; // Skip empty lines
            }
            // Check if next line is already indented
            const currentIndent = errorLineContent.match(/^(\s*)/)?.[1]?.length || 0;
            const nextIndent = nextLine.match(/^(\s*)/)?.[1]?.length || 0;
            if (nextIndent <= currentIndent) {
                // Need to indent - add 4 spaces
                lines[i] = ' '.repeat(currentIndent + 4) + nextLine.trim();
            }
            break; // Only fix the first non-empty line
        }
    }
    return lines.join('\n');
}
/**
 * Fix missing colon
 */
export function fixMissingColon(code, errorLine) {
    const lines = code.split('\n');
    const targetLine = errorLine - 1;
    if (targetLine < 0 || targetLine >= lines.length) {
        return code;
    }
    const line = lines[targetLine];
    // Check if line should have a colon (if, for, def, class, etc.)
    const colonKeywords = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'try', 'except', 'finally', 'with'];
    const trimmed = line.trim();
    for (const keyword of colonKeywords) {
        if (trimmed.startsWith(keyword) && !trimmed.includes(':')) {
            // Add colon before any comment
            const commentIndex = trimmed.indexOf('#');
            if (commentIndex > 0) {
                lines[targetLine] = line.slice(0, commentIndex).trim() + ':' + line.slice(commentIndex);
            }
            else {
                lines[targetLine] = line.trim() + ':';
            }
            break;
        }
    }
    return lines.join('\n');
}
/**
 * Auto-fix Python syntax error based on error type
 */
export async function autoFixPythonSyntax(filePath, errorType, errorLine) {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ File not found: ${filePath}`);
            return false;
        }
        let code = fs.readFileSync(filePath, 'utf-8');
        let fixed = false;
        switch (errorType) {
            case 'unclosed_bracket':
            case 'unexpected_eof':
                console.log(`   🔧 Fixing unclosed brackets in ${filePath}...`);
                const balanced = balanceBrackets(code, errorLine);
                if (balanced !== code) {
                    fs.writeFileSync(filePath, balanced);
                    fixed = true;
                    console.log(`   ✅ Fixed brackets`);
                }
                break;
            case 'missing_indentation':
                if (errorLine) {
                    console.log(`   🔧 Fixing indentation in ${filePath} at line ${errorLine}...`);
                    const indented = fixIndentation(code, errorLine);
                    if (indented !== code) {
                        fs.writeFileSync(filePath, indented);
                        fixed = true;
                        console.log(`   ✅ Fixed indentation`);
                    }
                }
                break;
            case 'invalid_syntax':
                // Try multiple fixes
                if (errorLine) {
                    // Try fixing missing colon first
                    const withColon = fixMissingColon(code, errorLine);
                    if (withColon !== code) {
                        fs.writeFileSync(filePath, withColon);
                        fixed = true;
                        console.log(`   ✅ Fixed missing colon`);
                    }
                    else {
                        // Try fixing brackets
                        const balanced = balanceBrackets(code, errorLine);
                        if (balanced !== code) {
                            fs.writeFileSync(filePath, balanced);
                            fixed = true;
                            console.log(`   ✅ Fixed brackets`);
                        }
                    }
                }
                break;
            default:
                console.log(`   ⚠️ Unknown Python syntax error type: ${errorType}`);
        }
        return fixed;
    }
    catch (error) {
        console.error(`   ❌ Failed to auto-fix Python syntax: ${error.message}`);
        return false;
    }
}
/**
 * Check if a Python file has syntax errors (quick check)
 */
export function hasPythonSyntaxErrors(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        // Quick bracket balance check
        const openBrackets = (code.match(/[\(\[\{]/g) || []).length;
        const closeBrackets = (code.match(/[\)\]\}]/g) || []).length;
        if (Math.abs(openBrackets - closeBrackets) > 0) {
            return true;
        }
        // Check for common issues
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Missing colon after keywords
            const colonKeywords = ['if', 'elif', 'else', 'for', 'while', 'def', 'class'];
            for (const keyword of colonKeywords) {
                if (line.startsWith(keyword) && !line.includes(':') && !line.includes('#')) {
                    return true;
                }
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
