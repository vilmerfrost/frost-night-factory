// agent-runner/lib/jsx-sanitizer.ts
/**
 * ✅ JSX Sanitizer for .ts lib files
 * Post-processes code to remove JSX syntax from TypeScript library files
 * This prevents retry loops by sanitizing JSX locally instead of requiring AI regeneration
 */

/**
 * Detect if code contains JSX syntax
 */
export function hasJsxSyntax(code: string): boolean {
  const jsxPatterns = [
    /<[a-z]+[^>]*>/i,           // HTML tags <div>
    /<\/[A-Za-z]+>/,             // Closing tags </div>
    /<[A-Za-z]+[^>]*\/>/,        // Self-closing tags <img />
    /return\s*\(?\s*</,          // return (<div>)
    /return\s*</,                 // return <div>
    /<[A-Z][A-Za-z0-9]*/,        // React components <Component>
  ];
  
  return jsxPatterns.some(pattern => pattern.test(code));
}

/**
 * Sanitize JSX from TypeScript code
 * Attempts to convert JSX returns to plain objects/strings
 */
export function sanitizeJsxFromTs(code: string, filePath: string): {
  sanitized: string;
  changed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let sanitized = code;
  let changed = false;
  
  // Pattern 1: Simple JSX returns like `return <div>text</div>`
  const simpleJsxReturn = /return\s*\(\s*<([a-z]+)[^>]*>([^<]*)<\/\1>\s*\)/gi;
  if (simpleJsxReturn.test(code)) {
    sanitized = sanitized.replace(simpleJsxReturn, (match, tag, content) => {
      changed = true;
      warnings.push(`Replaced JSX return <${tag}> with plain object`);
      return `return { tag: '${tag}', content: '${content.trim()}' }`;
    });
  }
  
  // Pattern 2: JSX returns without parentheses `return <div>text</div>`
  const simpleJsxReturnNoParen = /return\s*<([a-z]+)[^>]*>([^<]*)<\/\1>/gi;
  if (simpleJsxReturnNoParen.test(code)) {
    sanitized = sanitized.replace(simpleJsxReturnNoParen, (match, tag, content) => {
      changed = true;
      warnings.push(`Replaced JSX return <${tag}> with plain object`);
      return `return { tag: '${tag}', content: '${content.trim()}' }`;
    });
  }
  
  // Pattern 3: Remove React imports if present
  const reactImport = /import\s+.*\s+from\s+['"]react['"];?\s*\n/gi;
  if (reactImport.test(sanitized)) {
    sanitized = sanitized.replace(reactImport, '');
    changed = true;
    warnings.push('Removed React import');
  }
  
  // Pattern 4: Remove JSX fragments <>
  sanitized = sanitized.replace(/<>\s*([^<]+)\s*<\/>/g, (match, content) => {
    changed = true;
    warnings.push('Replaced JSX fragment with content');
    return content.trim();
  });
  
  if (changed) {
    warnings.push(`⚠️ JSX detected and sanitized in ${filePath}. Review manually.`);
  }
  
  return { sanitized, changed, warnings };
}

/**
 * Check if file needs JSX sanitization
 */
export function needsJsxSanitization(filePath: string, code: string): boolean {
  // Only sanitize .ts files in lib/ directory
  const isLibFile = filePath.includes('/lib/') || filePath.includes('\\lib\\');
  const isTsFile = filePath.endsWith('.ts') && !filePath.endsWith('.d.ts');
  
  return isLibFile && isTsFile && hasJsxSyntax(code);
}

