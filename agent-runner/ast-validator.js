// agent-runner/ast-validator.ts
// AST-Based Completeness Validator (Gemini's brilliant idea)
/**
 * Validates code completeness using AST analysis
 * Checks for empty functions, placeholder patterns, and code density
 */
export function validateCodeCompleteness(code, fileName) {
    const issues = [];
    let totalFunctions = 0;
    let emptyFunctions = 0;
    let statementCount = 0;
    // Simple AST-like parsing (without full TypeScript compiler)
    // This is a lightweight version that works without ts-node
    // Check for empty function bodies
    const emptyFunctionPatterns = [
        // function name() { }
        /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g,
        // const name = () => { }
        /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*\}/g,
        // class method() { }
        /\w+\s*\([^)]*\)\s*:\s*\w+\s*\{\s*\}/g
    ];
    emptyFunctionPatterns.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
            matches.forEach(match => {
                emptyFunctions++;
                const nameMatch = match.match(/(?:function\s+)?(\w+)|(?:const|let|var)\s+(\w+)/);
                const name = nameMatch?.[1] || nameMatch?.[2] || 'anonymous';
                issues.push(`Empty function: ${name}`);
            });
        }
    });
    // Count total functions (approximate)
    const functionPatterns = [
        /function\s+\w+/g,
        /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(/g,
        /\w+\s*\([^)]*\)\s*:\s*\w+\s*\{/g
    ];
    functionPatterns.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
            totalFunctions += matches.length;
        }
    });
    // Count statements (approximate - count semicolons and newlines in blocks)
    const statementPattern = /[;\n]\s*(?![;\n])/g;
    const statements = code.match(statementPattern);
    statementCount = statements ? statements.length : 0;
    // Check for placeholder patterns
    const placeholderPatterns = [
        { pattern: /\/\/\s*TODO:/gi, message: 'TODO comment found' },
        { pattern: /\/\/\s*FIXME:/gi, message: 'FIXME comment found' },
        { pattern: /return\s+\[\s*\]\s*;/g, message: 'Empty array return' },
        { pattern: /return\s+\{\s*\}\s*;/g, message: 'Empty object return' }
        // Note: return null is checked separately with context awareness below
    ];
    placeholderPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(code)) {
            issues.push(message);
        }
    });
    // ✅ CONTEXT-AWARE: Check for "return null" with context awareness
    if (code.includes('return null')) {
        // Allow "return null" in:
        // - Conditional returns: if (!mounted) return null;
        // - Error states: if (error) return null;
        // - Loading states: if (loading) return null;
        const isConditional = /if\s*\([^)]+\)\s*return\s+null/g.test(code);
        const hasOtherReturns = (code.match(/return\s+</g) || []).length > 0 || // JSX returns
            (code.match(/return\s+[^n]/g) || []).length > 0; // Other non-null returns
        if (!isConditional && !hasOtherReturns) {
            issues.push('Null return (likely placeholder)');
        }
    }
    // Score = statements per function (higher is better)
    const score = totalFunctions > 0 ? statementCount / totalFunctions : 0;
    // Code is complete if:
    // 1. No empty functions
    // 2. At least 3 statements per function on average
    // 3. No placeholder patterns
    const complete = emptyFunctions === 0 && score >= 3 && issues.length === 0;
    return {
        complete,
        score,
        issues,
        functionCount: totalFunctions,
        emptyFunctionCount: emptyFunctions,
        statementCount
    };
}
/**
 * Quick validation for a single file
 */
export function quickValidate(code) {
    const result = validateCodeCompleteness(code, 'unknown');
    if (result.emptyFunctionCount > 0) {
        return { valid: false, reason: `Found ${result.emptyFunctionCount} empty functions` };
    }
    if (result.score < 2) {
        return { valid: false, reason: `Low code density: ${result.score.toFixed(1)} statements per function` };
    }
    if (result.issues.length > 0) {
        return { valid: false, reason: `Placeholder patterns detected: ${result.issues.join(', ')}` };
    }
    return { valid: true };
}
