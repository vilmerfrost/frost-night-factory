// agent-runner/lib/apply-fixes.ts
// Applies auto-fixed code to repository files

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseJsonWithComments } from './dependency-detective';  // ✅ Use robust JSON parser

export interface FileFix {
  file: string;
  content: string;
}

/**
 * Apply fixes to repository files
 */
export async function applyFixes(
  fixedCode: string | FileFix[],
  repoPath: string
): Promise<{ applied: number; failed: number }> {
  let fixes: FileFix[] = [];

  // Handle different input formats
  if (typeof fixedCode === 'string') {
    try {
      // Try to parse as JSON (with comment support and auto-repair)
      const result = parseJsonWithComments(fixedCode);
      const parsed = result.data;  // Extract data from result object
      if (parsed.files && Array.isArray(parsed.files)) {
        // Format: { files: [{ file: 'path', content: '...' }] }
        fixes = parsed.files.map((f: any) => ({
          file: f.path || f.file,
          content: f.content,
        }));
      } else if (Array.isArray(parsed.fixedFiles)) {
        // Format: { fixedFiles: ['path1', 'path2'], files: [...] }
        // If files array exists, use it; otherwise read from repo
        if (parsed.files && Array.isArray(parsed.files)) {
          fixes = parsed.files.map((f: any) => ({
            file: f.path || f.file,
            content: f.content,
          }));
        } else {
          // Files were already written, read them back
          for (const filePath of parsed.fixedFiles) {
            const fullPath = path.join(repoPath, filePath);
            if (fs.existsSync(fullPath)) {
              fixes.push({
                file: filePath,
                content: fs.readFileSync(fullPath, 'utf-8'),
              });
            }
          }
        }
      } else if (Array.isArray(parsed)) {
        fixes = parsed;
      }
    } catch {
      // Not JSON, skip
      return { applied: 0, failed: 0 };
    }
  } else if (Array.isArray(fixedCode)) {
    fixes = fixedCode;
  }

  if (fixes.length === 0) {
    console.log('   ℹ️  No fixes to apply');
    return { applied: 0, failed: 0 };
  }

  let applied = 0;
  let failed = 0;

  for (const fix of fixes) {
    try {
      const filePath = path.join(repoPath, fix.file);
      const dir = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write fixed content
      fs.writeFileSync(filePath, fix.content, 'utf-8');
      console.log(`   ✅ Applied fix to ${fix.file}`);
      applied++;
    } catch (error: any) {
      console.error(`   ❌ Failed to apply fix to ${fix.file}: ${error.message}`);
      failed++;
    }
  }

  // Rebuild TypeScript after fixes to verify
  if (applied > 0) {
    try {
      execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
      });
      console.log(`   ✅ TypeScript validation passed after fixes`);
    } catch (error: any) {
      console.warn(`   ⚠️  TypeScript still has errors after auto-fix`);
      // Don't throw - let the validation retry handle it
    }
  }

  return { applied, failed };
}

/**
 * Extract file fixes from validation result
 */
export function extractFixesFromValidation(
  validationResult: any,
  repoPath: string
): FileFix[] {
  const fixes: FileFix[] = [];

  if (!validationResult.fixedCode) {
    return fixes;
  }

  // If fixedCode is a string (JSON), parse it (with comment support and auto-repair)
  if (typeof validationResult.fixedCode === 'string') {
    try {
      const result = parseJsonWithComments(validationResult.fixedCode);
      const parsed = result.data;  // Extract data from result object
      if (parsed.fixedFiles && Array.isArray(parsed.fixedFiles)) {
        // Files were already written, read them back
        for (const filePath of parsed.fixedFiles) {
          const fullPath = path.join(repoPath, filePath);
          if (fs.existsSync(fullPath)) {
            fixes.push({
              file: filePath,
              content: fs.readFileSync(fullPath, 'utf-8'),
            });
          }
        }
      }
    } catch {
      // Not parseable, skip
    }
  }

  return fixes;
}

