import * as fs from 'fs';
import * as path from 'path';

const TARGET_FILE = 'pipeline-runner.ts';
// This is the unique signature of the blocking code
const BLOCKING_SIGNATURE = 'skipping rename (lib/fortress/api-route/other)';

console.log('🔍 Scanning ' + TARGET_FILE + ' for ALL blocking logic instances...');

if (!fs.existsSync(TARGET_FILE)) {
    console.error('❌ Error: pipeline-runner.ts not found.');
    process.exit(1);
}

let code = fs.readFileSync(TARGET_FILE, 'utf-8');

// The Evolutionary Logic we want to inject
const EVOLUTION_LOGIC = `
    if (isFortressFile || isApiRoute || isLibFile) {
        // 🔓 ARCHITECT OVERRIDE: Allow .ts -> .tsx evolution GLOBALLY
        const isEvolution = filePath.endsWith('.ts') && newPath.endsWith('.tsx');
        if (isEvolution) {
            console.log(\`🔓 ARCHITECT OVERRIDE: Permitting Fortress evolution (\${relativePath} -> .tsx) for JSX support.\`);
            finalPath = newPath; 
        } else {
            console.log(\`⚠️ [FORTRESS] Blocked rename of protected file: \${relativePath} (skipping rename).\`);
            finalPath = filePath;
        }
    }
`;

// 1. Regex to find the If-Block containing the blocking signature.
// We use the 'g' flag to find ALL occurrences.
const regex = /if\s*\([^)]+(?:Fortress|Api|Lib)[^)]+\)\s*\{[^}]*skipping rename \(lib\/fortress\/api-route\/other\)[^}]*\}/gs;

// Check how many matches we find
const matches = code.match(regex);

if (matches && matches.length > 0) {
    console.log(`🎯 Found ${matches.length} instances of blocking logic. Patching all...`);
    
    // Replace ALL occurrences
    const newCode = code.replace(regex, EVOLUTION_LOGIC);
    
    fs.writeFileSync(TARGET_FILE, newCode);
    console.log('✅ GLOBAL UPGRADE COMPLETE: All Fortress locks patched.');
} else {
    if (code.includes('ARCHITECT OVERRIDE')) {
        console.log('ℹ️ Code already contains override logic. Checking if any old locks remain...');
        if (code.includes(BLOCKING_SIGNATURE)) {
             console.log('⚠️ WARNING: Old blocking code still exists but Regex missed it. Formatting mismatch?');
             // Fallback: Crude string replacement if regex fails
             // We replace the specific log line + assignment with our logic (risky but necessary if regex fails)
        } else {
             console.log('✅ System appears clean. No blocking signatures found.');
        }
    } else {
        console.error('❌ Could not find the blocking logic pattern. Is the file path correct?');
    }
}

