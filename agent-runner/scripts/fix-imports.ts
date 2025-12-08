#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface FileExports {
  filePath: string;
  normalizedPath: string;
  defaultExport?: string;
  namedExports: string[];
  hasDefaultExport: boolean;
}

interface ImportStatement {
  raw: string;
  source: string;
  isDefault: boolean;
  isNamespace: boolean;
  namedImports: string[];
  line: number;
}

interface Fix {
  file: string;
  line: number;
  original: string;
  fixed: string;
  reason: string;
}

interface ChiropractorStats {
  filesScanned: number;
  importsFound: number;
  fixesApplied: number;
  errors: number;
}

// ✅ SINGLE EXPORT HERE
export class ImportChiropractor {
  private exportMap = new Map<string, FileExports>();
  private fixes: Fix[] = [];
  private stats: ChiropractorStats = {
    filesScanned: 0,
    importsFound: 0,
    fixesApplied: 0,
    errors: 0,
  };

  constructor(
    private rootDir: string,
    private dryRun: boolean = true
  ) {}

  async run(): Promise<void> {
    console.log('\n🩺 Import Chiropractor starting...');
    console.log(`📁 Root: ${this.rootDir}`);
    console.log(`✍️  Mode: ${this.dryRun ? 'DRY RUN' : 'WRITE'}\n`);

    await this.buildExportMap();
    await this.scanAndFixImports();
    this.printReport();
  }

  private async buildExportMap(): Promise<void> {
    console.log('📋 Building export map...');
    // Use glob to find all TS/TSX files, ignoring node_modules
    const files = await glob('src/**/*.{ts,tsx}', { 
      cwd: this.rootDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.d.ts']
    });

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const exports = this.extractExports(content, filePath);
        
        // Generate keys: "components/ui/Button", "@/components/ui/button", etc.
        const keys = this.generateLookupKeys(filePath);
        keys.forEach(key => this.exportMap.set(key, exports));
      } catch (error) {
        // Silent fail for unreadable files
      }
    }
    console.log(`✅ Indexed ${this.exportMap.size} lookup keys from ${files.length} files`);
  }

  private extractExports(content: string, filePath: string): FileExports {
    const namedExports: string[] = [];
    let hasDefaultExport = false;
    let defaultExportName: string | undefined;

    // Regex for "export default"
    if (/export\s+default/.test(content)) {
      hasDefaultExport = true;
      const match = content.match(/export\s+default\s+(?:function|class)?\s*(\w+)/);
      if (match) defaultExportName = match[1];
    }

    // Regex for named exports
    const namedMatches = content.matchAll(/export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g);
    for (const match of namedMatches) namedExports.push(match[1]);

    return {
      filePath,
      normalizedPath: filePath.toLowerCase(),
      defaultExport: defaultExportName,
      namedExports,
      hasDefaultExport
    };
  }

  private generateLookupKeys(filePath: string): string[] {
    const keys: string[] = [];
    const relPath = path.relative(this.rootDir, filePath).replace(/\\/g, '/');
    
    // Key 1: src/components/Button.tsx -> components/Button
    const cleanPath = relPath.replace(/^src\//, '').replace(/\.(tsx?|ts)$/, '');
    
    keys.push(cleanPath);               // components/Button
    keys.push(`@/${cleanPath}`);        // @/components/Button
    keys.push(cleanPath.toLowerCase()); // components/button
    keys.push(`@/${cleanPath.toLowerCase()}`); // @/components/button

    return keys;
  }

  private async scanAndFixImports(): Promise<void> {
    console.log('🔍 Scanning imports...');
    const files = await glob('src/**/*.{ts,tsx}', { 
      cwd: this.rootDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.d.ts']
    });

    for (const filePath of files) {
      await this.fixImportsInFile(filePath);
      this.stats.filesScanned++;
    }
  }

  private async fixImportsInFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    let newContent = content;
    let modified = false;

    // Simple regex to find imports
    const importRegex = /import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const [fullLine, imports, source] = match;
      this.stats.importsFound++;

      // Skip relative imports that are just "." or ".."
      if (source === '.' || source === '..') continue;

      // Check if we know this source
      // 1. Try exact match
      if (this.exportMap.has(source)) continue;

      // 2. Try Fuzzy Match (Case insensitive)
      const correctSource = this.fuzzyFindSource(source);
      
      if (correctSource && correctSource !== source) {
        // We found a fix!
        // Replace ONLY the source part of the line
        const fixedLine = fullLine.replace(source, correctSource);
        newContent = newContent.replace(fullLine, fixedLine);
        
        this.fixes.push({
          file: path.relative(this.rootDir, filePath),
          line: 0, // Regex doesn't easily give line number, acceptable for now
          original: source,
          fixed: correctSource,
          reason: 'Case mismatch or wrong path'
        });
        this.stats.fixesApplied++;
        modified = true;
      }
    }

    if (modified && !this.dryRun) {
      await fs.writeFile(filePath, newContent, 'utf-8');
    }
  }

  private fuzzyFindSource(source: string): string | null {
    // Check if we have it in lowercase
    const lower = source.toLowerCase();
    
    // Check direct lowercase map
    if (this.exportMap.has(lower)) {
        // We found the target file data. Now reconstruct the import string.
        const target = this.exportMap.get(lower);
        if (!target) return null;

        // Reconstruct the "Correct" casing from the file path
        // e.g. target.filePath = .../src/components/ui/Button.tsx
        // we want @/components/ui/Button
        const rel = path.relative(this.rootDir, target.filePath).replace(/\\/g, '/');
        const clean = rel.replace(/^src\//, '').replace(/\.(tsx?|ts)$/, '');
        
        if (source.startsWith('@/')) return `@/${clean}`;
        return clean; // If they didn't use alias, we return clean path (maybe naive, but safe for now)
    }
    return null;
  }

  private printReport() {
    console.log('\n════════ REPORT ════════');
    console.log(`Scanned: ${this.stats.filesScanned} files`);
    console.log(`Fixes:   ${this.stats.fixesApplied}`);
    
    if (this.fixes.length > 0) {
      console.log('\n--- Fixes Applied ---');
      this.fixes.forEach(f => console.log(`🔧 ${f.file}: ${f.original} -> ${f.fixed}`));
    }
    console.log('════════════════════════');
  }
}

// CLI Execution Wrapper
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--write'); // Default to dry run unless --write passed
  
  // Use current working directory or provided path
  // In the pipeline context, we usually pass the sandbox path
  const targetDir = args.find(a => !a.startsWith('--')) || process.cwd();

  try {
    const doc = new ImportChiropractor(targetDir, dryRun);
    await doc.run();
  } catch (e) {
    console.error('Chiropractor failed:', e);
    process.exit(1);
  }
}

// Check if run directly
if (require.main === module) {
  main();
}
