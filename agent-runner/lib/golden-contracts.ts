// =============================================================================
// GOLDEN CONTRACTS - Auto-restore core contract files from golden copies
// =============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const GOLDEN_ROOT = path.join(__dirname, '..', 'data', 'golden', 'invoice');

const GOLDEN_CONTRACTS = [
  { golden: path.join(GOLDEN_ROOT, 'lib', 'types.ts'), target: 'src/lib/types.ts' },
  { golden: path.join(GOLDEN_ROOT, 'lib', 'mock-data.ts'), target: 'src/lib/mock-data.ts' },
  { golden: path.join(GOLDEN_ROOT, 'lib', 'api.ts'), target: 'src/lib/api.ts' },
  { golden: path.join(GOLDEN_ROOT, 'lib', 'schemas.ts'), target: 'src/lib/schemas.ts' },
];

/**
 * Hash a string using SHA-256
 */
function hash(s: string): string {
  return crypto.createHash("sha256").update(Buffer.from(s, "utf8") as unknown as string).digest("hex");
}

/**
 * Ensure golden contracts exist and restore if drifted
 */
export async function ensureGoldenContracts(projectRoot: string): Promise<{ restored: string[]; checked: string[] }> {
  const restored: string[] = [];
  const checked: string[] = [];
  
  for (const { golden, target } of GOLDEN_CONTRACTS) {
    const targetPath = path.join(projectRoot, target);
    
    // Check if golden file exists
    try {
      await fs.access(golden);
    } catch {
      console.warn(`⚠️ [GOLDEN] Golden contract not found: ${golden} (skipping)`);
      continue;
    }
    
    const goldenCode = await fs.readFile(golden, 'utf-8');
    let current = '';
    
    try {
      current = await fs.readFile(targetPath, 'utf-8');
      checked.push(target);
    } catch {
      // Missing → write golden
      const dir = path.dirname(targetPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(targetPath, goldenCode, 'utf-8');
      restored.push(target);
      console.log(`✅ [GOLDEN] Restored missing contract: ${target}`);
      continue;
    }
    
    // Check for drift
    if (hash(current) !== hash(goldenCode)) {
      console.warn(`⚠️ [GOLDEN] Drift detected in ${target}, restoring golden copy.`);
      await fs.writeFile(targetPath, goldenCode, 'utf-8');
      restored.push(target);
    }
  }
  
  return { restored, checked };
}

/**
 * Get list of contract files
 */
export function getContractFiles(): string[] {
  return GOLDEN_CONTRACTS.map(c => c.target);
}

