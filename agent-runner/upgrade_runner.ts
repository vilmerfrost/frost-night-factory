import * as fs from 'fs';
import * as path from 'path';

const TARGET_FILE = 'pipeline-runner.ts';
const LOG_MSG = 'skipping rename (lib/fortress/api-route/other)';

console.log('🔍 Scanning ' + TARGET_FILE + ' for blocking logic...');

if (!fs.existsSync(TARGET_FILE)) {
    console.error('❌ Error: pipeline-runner.ts not found in current directory.');
    process.exit(1);
}

let code = fs.readFileSync(TARGET_FILE, 'utf-8');

if (code.includes('ARCHITECT OVERRIDE')) {
    console.log('✅ System already patched! The logic is correct.');
    console.log('✅ ARCHITECT OVERRIDE is active and will allow .ts -> .tsx evolution for fortress files.');
} else if (code.includes(LOG_MSG)) {
    console.log('⚠️ Found blocking logic. Applying patch...');
    
    const PATCH_LOGIC = `
    if (isFortressFile || isApiRoute || isLibFile) {
        // 🔓 ARCHITECT OVERRIDE: Allow .ts -> .tsx evolution
        const isEvolution = filePath.endsWith('.ts') && newPath.endsWith('.tsx');
        if (isEvolution) {
            console.log(\`🔓 ARCHITECT OVERRIDE: Permitting Fortress evolution (\${relativePath} -> .tsx) for JSX support.\`);
            finalPath = newPath; 
        } else {
            console.log(\`⚠️ [AUTO-FIX] JSX detected in \${relativePath}, but skipping rename (lib/fortress/api-route/other).\`);
            finalPath = filePath;
        }
    }
    `;

    const regex = /if\s*\([^)]+(?:Fortress|Api|Lib)[^)]+\)\s*\{[^}]*skipping rename \(lib\/fortress\/api-route\/other\)[^}]*\}/s;
    
    if (regex.test(code)) {
        const newCode = code.replace(regex, PATCH_LOGIC);
        fs.writeFileSync(TARGET_FILE, newCode);
        console.log('✅ UPGRADE COMPLETE: Fortress logic patched to allow TS->TSX evolution.');
    } else {
        console.log('⚠️ Could not match exact code block structure. Manual review may be needed.');
    }
} else {
    console.log('ℹ️ Could not find the specific blocking logic string. The file may already be updated.');
}

