// =============================================================================
// ERROR AUTOPSY - Diagnose before fixing loops
// =============================================================================
// When the same error appears multiple times, STOP and diagnose WHY
// instead of blindly trying the same fix again
import { callAI } from './modelClient';
import * as fs from 'fs';
import * as path from 'path';
// Track error history
const errorHistory = [];
const MAX_HISTORY = 50;
/**
 * Record an error occurrence
 */
export function recordErrorOccurrence(errorCode, message, file, fixAttempted) {
    errorHistory.push({
        timestamp: new Date(),
        errorCode,
        message: message.slice(0, 200), // Truncate
        file,
        fixAttempted: fixAttempted.slice(0, 500),
    });
    // Keep history bounded
    if (errorHistory.length > MAX_HISTORY) {
        errorHistory.shift();
    }
}
/**
 * Detect if we're in a loop
 */
export function detectLoop(currentError, currentFile) {
    // Create error signature (code + file + first 50 chars of message)
    const signature = `${currentFile}:${currentError.slice(0, 50)}`;
    // Count recent occurrences (last 10 errors)
    const recent = errorHistory.slice(-10);
    const count = recent.filter(e => e.file === currentFile &&
        e.message.slice(0, 50) === currentError.slice(0, 50)).length;
    return {
        isLooping: count >= 2,
        count,
        signature,
    };
}
/**
 * Get previous fix attempts for an error
 */
export function getPreviousFixes(errorSignature) {
    return errorHistory
        .filter(e => `${e.file}:${e.message.slice(0, 50)}` === errorSignature)
        .map(e => e.fixAttempted);
}
/**
 * Perform deep diagnosis of a looping error
 */
export async function performAutopsy(errorLog, file, fileContent, previousFixes, projectPath) {
    console.log("\n🔬 ERROR AUTOPSY: Deep diagnosis in progress...");
    // Read related files for context
    const relatedFiles = await gatherRelatedFiles(file, fileContent, projectPath);
    const autopsyPrompt = `
=== ERROR AUTOPSY REQUEST ===

You are a senior debugging specialist. An error has occurred MULTIPLE TIMES and previous fixes have FAILED.
Your job is to find the ROOT CAUSE, not just fix the symptom.

ERROR DETAILS:
${errorLog}

PROBLEMATIC FILE (${file}):
\`\`\`tsx
${fileContent}
\`\`\`

RELATED FILES:
${relatedFiles}

PREVIOUS FIX ATTEMPTS THAT FAILED:
${previousFixes.map((f, i) => `Attempt ${i + 1}: ${f}`).join('\n\n')}

=== YOUR ANALYSIS ===

Think step by step:
1. What is the EXACT error?
2. What are ALL the possible causes?
3. Why did previous fixes fail?
4. What is the ROOT CAUSE (not symptom)?
5. What is the CORRECT fix?

Respond in this JSON format:
{
  "rootCause": "The actual underlying problem",
  "whyPreviousFixesFailed": "Why the attempted fixes didn't work",
  "correctFix": "The proper solution",
  "requiresRewrite": true/false,
  "confidence": "high/medium/low",
  "specificInstructions": "Exact code changes needed"
}
`;
    try {
        // Use DEBUGGER role for analysis
        const response = await callAI('DEBUGGER', autopsyPrompt);
        // Parse the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const diagnosis = JSON.parse(jsonMatch[0]);
            console.log(`   📋 Root Cause: ${diagnosis.rootCause}`);
            console.log(`   🎯 Confidence: ${diagnosis.confidence}`);
            console.log(`   📝 Requires Rewrite: ${diagnosis.requiresRewrite}`);
            return {
                isLooping: true,
                errorSignature: `${file}:${errorLog.slice(0, 50)}`,
                occurrences: previousFixes.length + 1,
                rootCause: diagnosis.rootCause,
                recommendedFix: diagnosis.specificInstructions || diagnosis.correctFix,
                confidence: diagnosis.confidence || 'medium',
                requiresRewrite: diagnosis.requiresRewrite || false,
            };
        }
    }
    catch (e) {
        console.error(`   ❌ Autopsy failed: ${e.message}`);
    }
    // Fallback diagnosis
    return {
        isLooping: true,
        errorSignature: `${file}:${errorLog.slice(0, 50)}`,
        occurrences: previousFixes.length + 1,
        rootCause: 'Unable to determine - recommend full file rewrite',
        recommendedFix: 'Rewrite the file from scratch with correct structure',
        confidence: 'low',
        requiresRewrite: true,
    };
}
/**
 * Gather related files for context
 */
async function gatherRelatedFiles(file, fileContent, projectPath) {
    const related = [];
    // Extract imports
    const importMatches = fileContent.matchAll(/from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
        const importPath = match[1];
        // Skip node_modules
        if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
            continue;
        }
        // Resolve path
        let resolvedPath = importPath;
        if (importPath.startsWith('@/')) {
            resolvedPath = path.join(projectPath, 'src', importPath.slice(2));
        }
        else {
            const fileDir = path.dirname(path.join(projectPath, file));
            resolvedPath = path.join(fileDir, importPath);
        }
        // Try with extensions
        const extensions = ['', '.tsx', '.ts', '.jsx', '.js'];
        for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const relativePath = path.relative(projectPath, fullPath);
                related.push(`
=== ${relativePath} ===
\`\`\`tsx
${content.slice(0, 1000)}${content.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`
`);
                break;
            }
        }
    }
    return related.join('\n') || 'No related files found';
}
/**
 * Generate a "nuclear" fix prompt based on autopsy
 */
export function generateNuclearFixPrompt(diagnosis, file, originalContent, projectContext) {
    return `
=== NUCLEAR FIX REQUIRED ===

The file ${file} has failed to build ${diagnosis.occurrences} times.
Previous fixes have not worked. You must now REWRITE it correctly.

DIAGNOSED ROOT CAUSE:
${diagnosis.rootCause}

RECOMMENDED FIX:
${diagnosis.recommendedFix}

PROJECT CONTEXT:
${projectContext}

ORIGINAL (BROKEN) CONTENT:
\`\`\`tsx
${originalContent}
\`\`\`

=== YOUR TASK ===

REWRITE this file COMPLETELY from scratch.

RULES:
1. Address the ROOT CAUSE identified above
2. Use @/ aliases for ALL internal imports
3. Add 'use client' if using React hooks
4. Use proper TypeScript types (no 'any')
5. Export correctly (named for components, default for pages)
6. Include ALL necessary imports
7. Make it PRODUCTION READY

Return the COMPLETE new file content:

### FILE: ${file}
\`\`\`tsx
// Your complete rewritten code here
\`\`\`
### END_FILE
`;
}
/**
 * Main autopsy runner - called when loop is detected
 */
export async function runErrorAutopsy(errorLog, file, fileContent, projectPath) {
    // Get previous fixes
    const errorSignature = `${file}:${errorLog.slice(0, 50)}`;
    const previousFixes = getPreviousFixes(errorSignature);
    // Perform autopsy
    const diagnosis = await performAutopsy(errorLog, file, fileContent, previousFixes, projectPath);
    // Generate fix prompt
    const fixPrompt = generateNuclearFixPrompt(diagnosis, file, fileContent, '' // Project context will be added by caller
    );
    return { diagnosis, fixPrompt };
}
/**
 * Quick check: should we do autopsy?
 */
export function shouldPerformAutopsy(currentError, currentFile) {
    const { isLooping, count } = detectLoop(currentError, currentFile);
    return isLooping && count >= 2;
}
/**
 * Clear error history (call after successful build)
 */
export function clearErrorHistory() {
    errorHistory.length = 0;
    console.log("   🧹 Error history cleared after successful build");
}
/**
 * Get error statistics
 */
export function getErrorStats() {
    const uniqueFiles = new Set(errorHistory.map(e => e.file)).size;
    // Count looping errors
    const errorCounts = new Map();
    for (const e of errorHistory) {
        const sig = `${e.file}:${e.message.slice(0, 50)}`;
        errorCounts.set(sig, (errorCounts.get(sig) || 0) + 1);
    }
    const loopingErrors = Array.from(errorCounts.values()).filter(c => c >= 2).length;
    return {
        totalErrors: errorHistory.length,
        uniqueFiles,
        loopingErrors,
    };
}
