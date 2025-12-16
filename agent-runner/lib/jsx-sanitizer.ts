// agent-runner/lib/jsx-sanitizer.ts
/**
 * ✅ JSX Sanitizer for .ts lib files
 * Post-processes code to remove JSX syntax from TypeScript library files
 * This prevents retry loops by sanitizing JSX locally instead of requiring AI regeneration
 */

import { hasRealJsxSyntax, isLibFile } from './jsx-detector';

/**
 * Detect if code contains JSX syntax
 * @deprecated Use hasRealJsxSyntax from jsx-detector instead
 */
export function hasJsxSyntax(code: string): boolean {
  return hasRealJsxSyntax(code);
}

/**
 * Sanitize JSX from TypeScript code
 * Attempts to convert JSX returns to plain objects/strings
 * This is a robust sanitizer that handles multiple JSX patterns
 */
export function sanitizeJsxFromTs(code: string, filePath: string): {
  sanitized: string;
  changed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let sanitized = code;
  let changed = false;
  
  // Pattern 1: Remove React imports if present (do this first)
  const reactImport = /import\s+(?:\*\s+as\s+)?React(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?\s*\n?/gi;
  if (reactImport.test(sanitized)) {
    sanitized = sanitized.replace(reactImport, '');
    changed = true;
    warnings.push('Removed React import');
  }
  
  // Pattern 2: Remove 'use client' directive (not needed in lib files)
  const useClientDirective = /['"]use\s+client['"];?\s*\n?/gi;
  if (useClientDirective.test(sanitized)) {
    sanitized = sanitized.replace(useClientDirective, '');
    changed = true;
    warnings.push('Removed "use client" directive');
  }
  
  // Pattern 3: Simple JSX returns like `return <div>text</div>` or `return (<div>text</div>)`
  const simpleJsxReturn = /return\s*\(\s*<([a-z]+)[^>]*>([^<]*)<\/\1>\s*\)/gi;
  sanitized = sanitized.replace(simpleJsxReturn, (match, tag, content) => {
    changed = true;
    warnings.push(`Replaced JSX return <${tag}> with plain object`);
    return `return { tag: '${tag}', content: '${content.trim()}' }`;
  });
  
  // Pattern 4: JSX returns without parentheses `return <div>text</div>`
  const simpleJsxReturnNoParen = /return\s*<([a-z]+)[^>]*>([^<]*)<\/\1>/gi;
  sanitized = sanitized.replace(simpleJsxReturnNoParen, (match, tag, content) => {
    changed = true;
    warnings.push(`Replaced JSX return <${tag}> with plain object`);
    return `return { tag: '${tag}', content: '${content.trim()}' }`;
  });
  
  // Pattern 5: Self-closing JSX tags `<Component />` or `<img />`
  const selfClosingJsx = /<([A-Z][A-Za-z0-9]*|[a-z]+)[^>]*\s*\/>/g;
  sanitized = sanitized.replace(selfClosingJsx, (match, tag) => {
    changed = true;
    warnings.push(`Replaced self-closing JSX <${tag} /> with null`);
    return 'null';
  });
  
  // Pattern 6: JSX fragments `<>...</>`
  sanitized = sanitized.replace(/<>\s*([^<]+)\s*<\/>/g, (match, content) => {
    changed = true;
    warnings.push('Replaced JSX fragment with content');
    return content.trim();
  });
  
  // Pattern 7: JSX elements with attributes `<Component prop="value">content</Component>`
  // Convert to plain object representation
  const jsxWithAttributes = /<([A-Z][A-Za-z0-9]*)[^>]*>([^<]*)<\/\1>/g;
  sanitized = sanitized.replace(jsxWithAttributes, (match, component, content) => {
    changed = true;
    warnings.push(`Replaced JSX component <${component}> with plain object`);
    return `{ component: '${component}', content: '${content.trim()}' }`;
  });
  
  // Pattern 8: JSX in variable assignments `const element = <div>...</div>`
  const jsxAssignment = /=\s*<([a-z]+)[^>]*>([^<]*)<\/\1>/gi;
  sanitized = sanitized.replace(jsxAssignment, (match, tag, content) => {
    changed = true;
    warnings.push(`Replaced JSX assignment <${tag}> with plain object`);
    return `= { tag: '${tag}', content: '${content.trim()}' }`;
  });
  
  // Pattern 9: Remove any remaining JSX-like patterns that might be false positives
  // But be careful not to remove TypeScript generics
  // Only remove if it looks like actual JSX (has spaces or attributes before >)
  const remainingJsx = /<([A-Z][A-Za-z0-9]*)\s+[^>]*>|<\/[A-Z][A-Za-z0-9]*>/g;
  const matches = sanitized.match(remainingJsx);
  if (matches && matches.length > 0) {
    // Only remove if we're confident it's JSX (not a generic)
    // Check if it's followed by content or closing tag
    sanitized = sanitized.replace(/<([A-Z][A-Za-z0-9]*)\s+[^>]*>[\s\S]{0,200}<\/\1>/g, (match) => {
      changed = true;
      warnings.push('Removed remaining JSX pattern');
      return 'null';
    });
  }
  
  if (changed) {
    warnings.push(`⚠️ JSX detected and sanitized in ${filePath}. Review manually.`);
  }
  
  return { sanitized, changed, warnings };
}

/**
 * Check if file needs JSX sanitization
 */
export function needsJsxSanitization(filePath: string, code: string): boolean {
  return isLibFile(filePath) && filePath.endsWith('.ts') && !filePath.endsWith('.d.ts') && hasRealJsxSyntax(code);
}

