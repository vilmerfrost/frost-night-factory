// agent-runner/scripts/type-consistency-enforcer.ts
// Type Consistency Enforcer: Ensures AI fixer uses correct type definitions
// Extracts type definitions from types.ts and provides them as "cheat sheet" to AI

import fs from 'fs';
import path from 'path';
import { lineAt } from '@/lib/utils/text';

export interface TypeDefinition {
  name: string;
  content: string;
  file: string;
  line: number;
}

export interface FixerContext {
  types: TypeDefinition[];
  interfaces: TypeDefinition[];
  exports: string[];
}

export class TypeConsistencyEnforcer {
  private projectPath: string;
  private typeCache: Map<string, FixerContext> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Extract all type definitions from a file
   */
  private extractTypesFromFile(filePath: string): TypeDefinition[] {
    const types: TypeDefinition[] = [];
    
    if (!fs.existsSync(filePath)) {
      return types;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Pattern 1: export interface Name { ... }
      const interfacePattern = /export\s+interface\s+(\w+)/g;
      let match;
      let lineNum = 0;
      
      for (const line of lines) {
        lineNum++;
        let interfaceMatch;
        while ((interfaceMatch = interfacePattern.exec(line)) !== null) {
          const interfaceName = interfaceMatch[1];
          // Extract full interface definition
          const interfaceStart = lineNum;
          let interfaceContent = line;
          let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
          let currentLine = lineNum;
          
          while (braceCount > 0 && currentLine < lines.length) {
            currentLine++;
            const nextLine = lineAt(lines, currentLine - 1);
            if (!nextLine) break;
            interfaceContent += '\n' + nextLine;
            braceCount += (nextLine.match(/\{/g) || []).length - (nextLine.match(/\}/g) || []).length;
          }
          
          types.push({
            name: interfaceName,
            content: interfaceContent.trim(),
            file: filePath,
            line: interfaceStart,
          });
        }
      }

      // Pattern 2: export type Name = ...
      const typePattern = /export\s+type\s+(\w+)\s*=/g;
      lineNum = 0;
      
      for (const line of lines) {
        lineNum++;
        let typeMatch;
        while ((typeMatch = typePattern.exec(line)) !== null) {
          const typeName = typeMatch[1];
          // Extract full type definition (until semicolon or new export)
          let typeContent = line;
          let currentLine = lineNum;
          
          while (currentLine < lines.length) {
            const currentLineContent = lineAt(lines, currentLine - 1);
            if (!currentLineContent || currentLineContent.includes(';') || currentLineContent.match(/^export\s/)) {
              break;
            }
            currentLine++;
            typeContent += '\n' + currentLineContent;
          }
          
          types.push({
            name: typeName,
            content: typeContent.trim(),
            file: filePath,
            line: lineNum,
          });
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ Failed to extract types from ${filePath}: ${error.message}`);
    }

    return types;
  }

  /**
   * Scan project for type definition files
   */
  private findTypeFiles(): string[] {
    const typeFiles: string[] = [];
    const searchPaths = [
      path.join(this.projectPath, 'src', 'lib', 'types.ts'),
      path.join(this.projectPath, 'src', 'types', 'index.ts'),
      path.join(this.projectPath, 'src', 'types.ts'),
      path.join(this.projectPath, 'lib', 'types.ts'),
      path.join(this.projectPath, 'types.ts'),
    ];

    // Also search recursively
    const searchDirs = [
      path.join(this.projectPath, 'src', 'lib'),
      path.join(this.projectPath, 'src', 'types'),
      path.join(this.projectPath, 'lib'),
    ];

    function scanDirectory(dir: string) {
      if (!fs.existsSync(dir)) return;
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('export interface') || content.includes('export type')) {
              typeFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    // Check specific paths first
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        typeFiles.push(searchPath);
      }
    }

    // Then scan directories
    for (const searchDir of searchDirs) {
      scanDirectory(searchDir);
    }

    return [...new Set(typeFiles)]; // Remove duplicates
  }

  /**
   * Build complete type context for the project
   */
  async run(): Promise<FixerContext> {
    const typeFiles = this.findTypeFiles();
    const allTypes: TypeDefinition[] = [];
    const allInterfaces: TypeDefinition[] = [];
    const exports: string[] = [];

    console.log(`🔍 [Type Enforcer] Scanning ${typeFiles.length} type files...`);

    for (const typeFile of typeFiles) {
      const types = this.extractTypesFromFile(typeFile);
      
      for (const type of types) {
        if (type.content.includes('interface')) {
          allInterfaces.push(type);
        } else {
          allTypes.push(type);
        }
        exports.push(type.name);
      }
    }

    const context: FixerContext = {
      types: allTypes,
      interfaces: allInterfaces,
      exports,
    };

    console.log(`✅ [Type Enforcer] Found ${allInterfaces.length} interfaces, ${allTypes.length} types`);
    
    return context;
  }

  /**
   * Generate cheat sheet with all type definitions
   * The Hallucination Killer - ensures AI sees exact data structures
   */
  public generateCheatSheet(): string {
    console.log("👮 [Type Enforcer] Extracting Ground Truth definitions...");
    
    const typesDir = path.join(this.projectPath, 'src', 'types');
    const libTypes = path.join(this.projectPath, 'src', 'lib', 'types.ts');
    
    let cheatSheet = "/// --- SYSTEM: CURRENT TYPE DEFINITIONS (DO NOT HALLUCINATE) ---\n";

    // 1. Scan lib/types.ts (if exists)
    if (fs.existsSync(libTypes)) {
      cheatSheet += `\n// File: src/lib/types.ts\n`;
      cheatSheet += fs.readFileSync(libTypes, 'utf-8');
    }

    // 2. Scan src/types/*.ts
    if (fs.existsSync(typesDir)) {
      const files = fs.readdirSync(typesDir).filter(f => f.endsWith('.ts'));
      files.forEach(f => {
        cheatSheet += `\n// File: src/types/${f}\n`;
        cheatSheet += fs.readFileSync(path.join(typesDir, f), 'utf-8');
      });
    }

    cheatSheet += "\n/// --- END TYPE DEFINITIONS ---\n";
    
    return cheatSheet;
  }

  /**
   * Generate fixer context for a specific file
   * Returns a "cheat sheet" with relevant type definitions
   */
  generateFixerContext(targetFile: string): string {
    // Get or build context
    let context: FixerContext;
    if (this.typeCache.has('global')) {
      context = this.typeCache.get('global')!;
    } else {
      // Build context synchronously (should be called after run())
      const typeFiles = this.findTypeFiles();
      const allTypes: TypeDefinition[] = [];
      const allInterfaces: TypeDefinition[] = [];
      const exports: string[] = [];

      for (const typeFile of typeFiles) {
        const types = this.extractTypesFromFile(typeFile);
        for (const type of types) {
          if (type.content.includes('interface')) {
            allInterfaces.push(type);
          } else {
            allTypes.push(type);
          }
          exports.push(type.name);
        }
      }

      context = { types: allTypes, interfaces: allInterfaces, exports };
      this.typeCache.set('global', context);
    }

    // Read target file to find which types it uses
    let usedTypes: string[] = [];
    try {
      if (fs.existsSync(targetFile)) {
        const content = fs.readFileSync(targetFile, 'utf-8');
        // Find imports and type references
        const importMatches = content.match(/import\s+.*\s+from\s+['"]@\/lib\/types['"]/g) || [];
        const typeMatches = content.match(/\b(Invoice|User|ApiResponse|Item|PaginatedResponse)\b/g) || [];
        usedTypes = [...new Set([...importMatches, ...typeMatches])];
      }
    } catch (error) {
      // Ignore errors
    }

    // Build cheat sheet
    let cheatSheet = `\n// ═══════════════════════════════════════════════════════════════════\n`;
    cheatSheet += `// 📋 TYPE DEFINITIONS CHEAT SHEET (Use these EXACT definitions)\n`;
    cheatSheet += `// ═══════════════════════════════════════════════════════════════════\n\n`;

    // Include all interfaces (most important)
    if (context.interfaces.length > 0) {
      cheatSheet += `// INTERFACES:\n`;
      for (const iface of context.interfaces) {
        cheatSheet += `${iface.content}\n\n`;
      }
    }

    // Include types if any
    if (context.types.length > 0) {
      cheatSheet += `// TYPES:\n`;
      for (const type of context.types) {
        cheatSheet += `${type.content}\n\n`;
      }
    }

    cheatSheet += `// ═══════════════════════════════════════════════════════════════════\n`;
    cheatSheet += `// ✅ CRITICAL: Use the EXACT type definitions above. Do NOT invent new types.\n`;
    cheatSheet += `// ═══════════════════════════════════════════════════════════════════\n`;

    return cheatSheet;
  }
}

