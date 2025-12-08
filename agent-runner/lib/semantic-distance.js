import crypto from 'crypto';
import fs from 'fs/promises';
const snapshotHistory = new Map();
/**
 * ✅ PHASE 3: Semantic Distance Check
 * Implements Gemini's genius "no-op loop" detection
 * Tracks file changes to detect when AI claims to fix but produces identical code
 */
export async function takeSnapshot(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const snapshot = {
            path: filePath,
            hash,
            timestamp: new Date()
        };
        const history = snapshotHistory.get(filePath) || [];
        history.push(snapshot);
        // Keep only last 10 snapshots per file
        if (history.length > 10) {
            history.shift();
        }
        snapshotHistory.set(filePath, history);
        return snapshot;
    }
    catch (error) {
        // File doesn't exist or can't be read - return empty snapshot
        return {
            path: filePath,
            hash: '',
            timestamp: new Date()
        };
    }
}
/**
 * Detect if agent is in a no-op loop (claiming fixes but producing identical code)
 * Returns true if last 3 attempts resulted in identical file hash
 */
export function detectNoOpLoop(filePath) {
    const history = snapshotHistory.get(filePath);
    if (!history || history.length < 3) {
        return false;
    }
    // Check last 3 attempts
    const recent = history.slice(-3);
    const hashes = recent.map(s => s.hash);
    // If all hashes are identical, agent is lying
    if (hashes[0] === hashes[1] && hashes[1] === hashes[2] && hashes[0] !== '') {
        console.log(`🚨 NO-OP LOOP DETECTED in ${filePath}`);
        console.log(`   Last 3 "fixes" resulted in identical file hash: ${hashes[0].substring(0, 12)}...`);
        return true;
    }
    return false;
}
/**
 * Clear snapshot history for a file or all files
 */
export function clearSnapshots(filePath) {
    if (filePath) {
        snapshotHistory.delete(filePath);
    }
    else {
        snapshotHistory.clear();
    }
}
/**
 * Get snapshot history for a file (for debugging)
 */
export function getSnapshotHistory(filePath) {
    return snapshotHistory.get(filePath) || [];
}
