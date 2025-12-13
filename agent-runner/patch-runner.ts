import * as fs from 'fs';
import * as path from 'path';

const RUNNER_PATH = path.join(__dirname, 'pipeline-runner.ts');

function patchRunner() {
  if (!fs.existsSync(RUNNER_PATH)) {
    console.error(`❌ Fatal: Could not find ${RUNNER_PATH}`);
    process.exit(1);
  }

  let content = fs.readFileSync(RUNNER_PATH, 'utf-8');
  console.log('🔍 Scanning pipeline-runner.ts...');

  // Check if patch is already applied
  if (content.includes('ARCHITECT OVERRIDE')) {
    console.log('✅ Patch already applied. ARCHITECT OVERRIDE logic is active.');
    
    // Verify the logic is correct
    if (content.includes('Permitting file evolution')) {
      console.log('✅ Evolutionary logic verified and active.');
      return;
    }
  }

  // Look for blocking patterns
  const blockingPatterns = [
    /if\s*\([^)]*isFortressFile[^)]*\)\s*\{[^}]*skipping rename[^}]*finalPath\s*=\s*filePath[^}]*\}/s,
    /if\s*\([^)]*isApiRoute[^)]*\)\s*\{[^}]*skipping rename[^}]*finalPath\s*=\s*filePath[^}]*\}/s,
    /if\s*\([^)]*isLibFile[^)]*\)\s*\{[^}]*skipping rename[^}]*finalPath\s*=\s*filePath[^}]*\}/s,
  ];

  let foundBlocking = false;
  for (const pattern of blockingPatterns) {
    if (pattern.test(content)) {
      foundBlocking = true;
      console.log('⚠️ Found blocking pattern that needs to be replaced.');
      break;
    }
  }

  if (!foundBlocking && !content.includes('ARCHITECT OVERRIDE')) {
    console.log('⚠️ Could not locate the blocking "Fortress" logic automatically.');
    console.log('   The blocking logic may have been removed or is in a different format.');
    console.log('   Please manually verify the ARCHITECT OVERRIDE logic is in place.');
    return;
  }

  if (foundBlocking) {
    console.log('🔧 Applying patch to replace blocking logic with evolutionary logic...');
    
    // The evolutionary logic replacement
    const evolutionaryLogic = `if (isFortressFile || isApiRoute || isLibFile) {
    // 🔓 ARCHITECT OVERRIDE: Allow .ts -> .tsx evolution
    const isEvolution = filePath.endsWith('.ts') && newFileName.endsWith('.tsx');
    if (isEvolution) {
      console.log(\`🔓 ARCHITECT OVERRIDE: Permitting file evolution (\${fileName} -> .tsx) for JSX support.\`);
      finalPath = path.join(projectRoot, newFileName);
    } else {
      console.log(\`🛡️ [FORTRESS] Blocked rename of protected file: \${fileName} (skipping rename).\`);
      finalPath = filePath;
    }
  }`;

    // Try to replace blocking patterns
    for (const pattern of blockingPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, evolutionaryLogic);
        console.log('✅ Replaced blocking pattern with evolutionary logic.');
      }
    }

    fs.writeFileSync(RUNNER_PATH, content, 'utf-8');
    console.log('✅ PATCH APPLIED SUCCESSFULLY: Fortress logic updated to allow Evolution.');
  }
}

patchRunner();

