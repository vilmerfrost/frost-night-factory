import { takeSnapshot, detectNoOpLoop, clearSnapshots } from './lib/semantic-distance';
import fs from 'fs/promises';
import path from 'path';
async function test() {
    const testFile = path.join(__dirname, 'test-temp.ts');
    // Create test file
    await fs.writeFile(testFile, 'const x = 5;', 'utf-8');
    // Take 3 snapshots of identical content
    await takeSnapshot(testFile);
    await takeSnapshot(testFile);
    await takeSnapshot(testFile);
    // Should detect no-op loop
    const detected = detectNoOpLoop(testFile);
    console.log(`${detected ? '✅' : '❌'} No-op loop detection`);
    // Modify file
    await fs.writeFile(testFile, 'const x = 10;', 'utf-8');
    await takeSnapshot(testFile);
    // Should NOT detect loop (file changed)
    const notDetected = !detectNoOpLoop(testFile);
    console.log(`${notDetected ? '✅' : '❌'} Loop not detected after change`);
    // Cleanup
    await fs.unlink(testFile);
    clearSnapshots();
    console.log('\n✅ Semantic distance tests passed!');
}
test().catch(console.error);
