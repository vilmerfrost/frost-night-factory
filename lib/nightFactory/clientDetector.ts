// =============================================================================
// CLIENT DETECTOR - Auto-inject 'use client' for React hooks
// =============================================================================
// Scans all .tsx files and automatically adds 'use client' directive
// if the file uses client-side React features (useState, useEffect, etc.)

import * as fs from 'fs';
import * as path from 'path';

// Patterns that REQUIRE 'use client' directive in Next.js 15
const CLIENT_PATTERNS = [
  // React Hooks
  /\buseState\b/,
  /\buseEffect\b/,
  /\buseContext\b/,
  /\buseReducer\b/,
  /\buseCallback\b/,
  /\buseMemo\b/,
  /\buseRef\b/,
  /\buseLayoutEffect\b/,
  /\buseImperativeHandle\b/,
  /\buseDebugValue\b/,
  /\buseDeferredValue\b/,
  /\buseTransition\b/,
  /\buseId\b/,
  /\buseSyncExternalStore\b/,
  /\buseInsertionEffect\b/,
  
  // Next.js Client Hooks
  /\buseRouter\b/,
  /\busePathname\b/,
  /\buseSearchParams\b/,
  /\buseParams\b/,
  /\buseSelectedLayoutSegment\b/,
  /\buseSelectedLayoutSegments\b/,
  
  // Event Handlers (indicate interactivity)
  /\bonClick\s*=/,
  /\bonChange\s*=/,
  /\bonSubmit\s*=/,
  /\bonKeyDown\s*=/,
  /\bonKeyUp\s*=/,
  /\bonKeyPress\s*=/,
  /\bonMouseEnter\s*=/,
  /\bonMouseLeave\s*=/,
  /\bonFocus\s*=/,
  /\bonBlur\s*=/,
  /\bonDrag\s*=/,
  /\bonDrop\s*=/,
  /\bonScroll\s*=/,
  /\bonTouchStart\s*=/,
  /\bonTouchEnd\s*=/,
  
  // Browser APIs
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bnavigator\b/,
  
  // Framer Motion (client-only)
  /from\s+['"]framer-motion['"]/,
  /\bmotion\./,
  /\bAnimatePresence\b/,
  
  // Other client-only libraries
  /from\s+['"]react-dnd['"]/,
  /from\s+['"]@dnd-kit/,
  /from\s+['"]recharts['"]/,
];

// Files that should NEVER have 'use client' (server components)
const SERVER_ONLY_PATTERNS = [
  /layout\.tsx$/,  // Layouts can be server components
  /loading\.tsx$/,
  /error\.tsx$/,   // Error boundaries need 'use client' though
  /not-found\.tsx$/,
];

// Files that MUST have 'use client'
const FORCE_CLIENT_FILES = [
  /error\.tsx$/,  // Error boundaries require client
];

interface DetectionResult {
  file: string;
  needsClient: boolean;
  hasClient: boolean;
  reasons: string[];
  fixed: boolean;
}

/**
 * Check if a file needs 'use client' directive
 */
export function needsUseClient(content: string, filePath: string): { needs: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check if it's a force-client file
  for (const pattern of FORCE_CLIENT_FILES) {
    if (pattern.test(filePath)) {
      reasons.push('Error boundary requires use client');
      return { needs: true, reasons };
    }
  }
  
  // Check for client patterns
  for (const pattern of CLIENT_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Found client pattern: ${pattern.source}`);
    }
  }
  
  return { needs: reasons.length > 0, reasons };
}

/**
 * Check if file already has 'use client' directive
 */
export function hasUseClientDirective(content: string): boolean {
  // Check first 5 lines for the directive
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  return /'use client'/.test(firstLines) || /"use client"/.test(firstLines);
}

/**
 * Add 'use client' directive to file content
 */
export function addUseClientDirective(content: string): string {
  // If already has it, return as-is
  if (hasUseClientDirective(content)) {
    return content;
  }
  
  // Add at the very top
  return `'use client';\n\n${content}`;
}

/**
 * Scan a directory and fix all files that need 'use client'
 */
export function runClientDetector(projectPath: string): DetectionResult[] {
  console.log("\n🔍 CLIENT DETECTOR: Scanning for missing 'use client' directives...");
  
  const results: DetectionResult[] = [];
  const srcPath = path.join(projectPath, 'src');
  
  if (!fs.existsSync(srcPath)) {
    console.log("   ⚠️ No src/ directory found, scanning root...");
    scanDirectory(projectPath, results);
  } else {
    scanDirectory(srcPath, results);
  }
  
  // Summary
  const fixed = results.filter(r => r.fixed);
  const needsManual = results.filter(r => r.needsClient && !r.hasClient && !r.fixed);
  
  console.log(`\n📊 CLIENT DETECTOR RESULTS:`);
  console.log(`   ✅ Auto-fixed: ${fixed.length} files`);
  console.log(`   ⚠️ Needs review: ${needsManual.length} files`);
  
  if (fixed.length > 0) {
    console.log(`\n   Fixed files:`);
    fixed.forEach(f => console.log(`      - ${path.relative(projectPath, f.file)}`));
  }
  
  return results;
}

function scanDirectory(dir: string, results: DetectionResult[]): void {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, etc.
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath, results);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
      const result = processFile(fullPath);
      if (result) {
        results.push(result);
      }
    }
  }
}

function processFile(filePath: string): DetectionResult | null {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const hasClient = hasUseClientDirective(content);
    const { needs, reasons } = needsUseClient(content, filePath);
    
    const result: DetectionResult = {
      file: filePath,
      needsClient: needs,
      hasClient,
      reasons,
      fixed: false,
    };
    
    // Auto-fix if needed
    if (needs && !hasClient) {
      console.log(`   🔧 Adding 'use client' to: ${path.basename(filePath)}`);
      console.log(`      Reasons: ${reasons.slice(0, 3).join(', ')}${reasons.length > 3 ? '...' : ''}`);
      
      content = addUseClientDirective(content);
      fs.writeFileSync(filePath, content);
      result.fixed = true;
    }
    
    return result;
  } catch (e) {
    console.error(`   ❌ Error processing ${filePath}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Quick check for a single file (used by other modules)
 */
export function ensureUseClient(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const hasClient = hasUseClientDirective(content);
  const { needs } = needsUseClient(content, filePath);
  
  if (needs && !hasClient) {
    content = addUseClientDirective(content);
    fs.writeFileSync(filePath, content);
    return true; // Fixed
  }
  
  return false; // No fix needed
}

