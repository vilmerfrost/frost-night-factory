// =============================================================================
// QUARANTINE ZONE - AI output is TOXIC until proven safe
// =============================================================================
// Claude 4.5 Paradigm: Stop treating AI output as code. 
// Treat it as unvalidated text until proven safe.

import { createClient } from '@supabase/supabase-js';

// Lazy initialization to handle missing env vars gracefully
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('⚠️ Supabase credentials not found - DLQ storage disabled');
    return null;
  }
  
  return createClient(url, key);
}

const supabase = getSupabaseClient();

interface UnvalidatedArtifact {
  raw: string;
  status: 'quarantined' | 'validated' | 'rejected';
  receivedAt: number;
  validatedAt?: number;
  errors?: string[];
}

interface ValidatedArtifact {
  source: string;
  syntax: 'valid';
  imports: string[];
  exports: string[];
  metadata: {
    validatedAt: number;
    validator: string;
    confidence: number;
  };
}

type QuarantineID = string;

/**
 * CORE PRINCIPLE: AI output is TOXIC until proven safe
 * This is the single most important class in your V8.5 architecture
 */
export class QuarantineZone {
  private buffer = new Map<QuarantineID, UnvalidatedArtifact>();
  
  /**
   * Step 1: Receive AI output (never trust it)
   */
  async receive(rawOutput: string): Promise<QuarantineID> {
    incQuarantineReceived();
    
    const id = `quar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.buffer.set(id, {
      raw: rawOutput,
      status: 'quarantined',
      receivedAt: Date.now(),
    });
    
    console.log(`🔒 Quarantined artifact: ${id}`);
    return id;
  }
  
  /**
   * Step 2: Validate (multi-gate)
   */
  async validate(
    id: QuarantineID,
    fileName: string
  ): Promise<{ passed: boolean; errors: string[] }> {
    const startTime = Date.now();
    const artifact = this.buffer.get(id);
    if (!artifact) throw new Error(`Quarantine ID not found: ${id}`);
    
    const errors: string[] = [];
    
    // Gate 1: Syntax (TypeScript compiler)
    const syntaxCheck = await this.checkSyntax(artifact.raw, fileName);
    if (!syntaxCheck.valid) errors.push(...syntaxCheck.errors);
    
    // Gate 2: Security (OWASP LLM)
    const securityCheck = await this.checkSecurity(artifact.raw);
    if (!securityCheck.safe) errors.push(...securityCheck.violations);
    
    // Gate 3: Imports (validate all imports exist)
    const importCheck = await this.checkImports(artifact.raw, fileName);
    if (!importCheck.valid) errors.push(...importCheck.errors);
    
    // Gate 4: Bracket balance
    const bracketCheck = this.checkBrackets(artifact.raw);
    if (!bracketCheck.valid) errors.push(...bracketCheck.errors);
    
    const duration = (Date.now() - startTime) / 1000;
    recordValidationDuration(duration);
    
    if (errors.length === 0) {
      // Mark as validated
      artifact.status = 'validated';
      artifact.validatedAt = Date.now();
      incQuarantineValidated();
      console.log(`✅ Validated: ${id}`);
      return { passed: true, errors: [] };
    } else {
      // Mark as rejected
      artifact.status = 'rejected';
      artifact.errors = errors;
      incQuarantineRejected(errors[0] || 'unknown');
      console.log(`❌ Rejected: ${id} (${errors.length} errors)`);
      return { passed: false, errors };
    }
  }
  
  /**
   * Step 3: Release (only if validated)
   */
  async release(id: QuarantineID): Promise<ValidatedArtifact | null> {
    const artifact = this.buffer.get(id);
    
    if (!artifact || artifact.status !== 'validated') {
      console.error(`🚫 Cannot release unvalidated artifact: ${id}`);
      return null;
    }
    
    // Clean from quarantine
    this.buffer.delete(id);
    
    return {
      source: artifact.raw,
      syntax: 'valid',
      imports: this.extractImports(artifact.raw),
      exports: this.extractExports(artifact.raw),
      metadata: {
        validatedAt: artifact.validatedAt!,
        validator: 'QuarantineZone',
        confidence: 1.0,
      },
    };
  }
  
  /**
   * Reject and provide feedback
   */
  async reject(id: QuarantineID, errors: string[]): Promise<void> {
    const artifact = this.buffer.get(id);
    if (artifact) {
      artifact.status = 'rejected';
      artifact.errors = errors;
    }
    
    // Store in DLQ for analysis
    await this.storeInDLQ(id, errors);
  }
  
  /**
   * Get status of quarantined artifact
   */
  getStatus(id: QuarantineID): UnvalidatedArtifact | undefined {
    return this.buffer.get(id);
  }
  
  /**
   * Clear all quarantined items (for cleanup)
   */
  clear(): void {
    this.buffer.clear();
  }
  
  // === VALIDATION HELPERS ===
  
  private async checkSyntax(code: string, fileName: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const ts = await import('typescript');
      const sourceFile = ts.createSourceFile(
        fileName,
        code,
        ts.ScriptTarget.Latest,
        true
      );
      
      // Check for parse errors
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      for (const diag of diagnostics) {
        const line = sourceFile.getLineAndCharacterOfPosition(diag.start || 0).line + 1;
        errors.push(`Syntax error at line ${line}: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
      }
    } catch (err: any) {
      errors.push(`TypeScript parse failed: ${err.message}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private async checkSecurity(code: string): Promise<{ safe: boolean; violations: string[] }> {
    const violations: string[] = [];
    
    // OWASP LLM checks
    if (code.includes('eval(') || code.includes('Function(')) {
      violations.push('CRITICAL: Dynamic code execution detected (eval/Function)');
    }
    
    if (code.match(/process\.env\[.*\+.*\]/)) {
      violations.push('CRITICAL: Dynamic env variable access');
    }
    
    if (code.includes('new Function(')) {
      violations.push('CRITICAL: new Function() detected');
    }
    
    if (code.includes('child_process')) {
      violations.push('WARNING: child_process module used');
    }
    
    // Hardcoded secrets patterns
    const secretPatterns = [
      { pattern: /sk-[A-Za-z0-9]{32,}/, name: 'OpenAI API key' },
      { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'GitHub token' },
      { pattern: /xoxb-[A-Za-z0-9-]+/, name: 'Slack bot token' },
      { pattern: /AIza[A-Za-z0-9_-]{35}/, name: 'Google API key' },
      { pattern: /AKIA[A-Z0-9]{16}/, name: 'AWS access key' },
    ];
    
    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(code)) {
        violations.push(`CRITICAL: Hardcoded ${name} detected`);
      }
    }
    
    return { safe: violations.length === 0, violations };
  }
  
  private async checkImports(code: string, fileName: string): Promise<{ valid: boolean; errors: string[] }> {
    const imports = this.extractImports(code);
    const errors: string[] = [];
    
    for (const imp of imports) {
      // Check for obviously wrong imports
      if (imp.includes('undefined') || imp.includes('null')) {
        errors.push(`Invalid import path: ${imp}`);
      }
      
      // Check for double slashes (common AI mistake)
      if (imp.includes('//') && !imp.startsWith('http')) {
        errors.push(`Malformed import path: ${imp}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private checkBrackets(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Check template literals
    const backticks = (code.match(/`/g) || []).length;
    if (backticks % 2 !== 0) {
      errors.push('Incomplete template literal (missing closing backtick)');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private extractImports(code: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }
  
  private extractExports(code: string): string[] {
    const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    const exports: string[] = [];
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }
  
  private async storeInDLQ(id: QuarantineID, errors: string[]): Promise<void> {
    const artifact = this.buffer.get(id);
    if (!artifact) return;
    
    if (!supabase) {
      // Supabase not available, skip DLQ storage
      return;
    }
    
    try {
      await supabase.from('dead_letter_queue').insert({
        quarantine_id: id,
        raw_code: artifact.raw.substring(0, 50000), // Limit size
        errors: errors,
        created_at: new Date().toISOString(),
      });
      console.log(`📮 Stored in DLQ: ${id}`);
    } catch (err) {
      // DLQ storage is non-critical
      console.warn(`Failed to store in DLQ: ${err}`);
    }
  }
}

// Singleton instance
export const quarantine = new QuarantineZone();

/**
 * High-level helper: Generate code with quarantine protection
 */
export async function generateCodeWithQuarantine(
  generateFn: () => Promise<string>,
  fileName: string,
  maxRetries: number = 1
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Step 1: Generate (AI output is UNTRUSTED)
    const rawOutput = await generateFn();
    
    // Step 2: Quarantine
    const qId = await quarantine.receive(rawOutput);
    
    // Step 3: Validate
    const validation = await quarantine.validate(qId, fileName);
    
    if (validation.passed) {
      // Step 4: Release (only if validated)
      const artifact = await quarantine.release(qId);
      if (artifact) {
        console.log(`✅ Code validated and released on attempt ${attempt + 1}`);
        return artifact.source;
      }
    } else {
      // Reject
      await quarantine.reject(qId, validation.errors);
      console.log(`❌ Attempt ${attempt + 1} rejected:`, validation.errors);
      
      if (attempt === maxRetries) {
        console.error(`🚨 Code generation failed after ${maxRetries + 1} attempts`);
        return null;
      }
    }
  }
  
  return null;
}

