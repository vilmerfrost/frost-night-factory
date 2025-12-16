// =============================================================================
// METAMORPHIC VALIDATION - Generate same code 3 ways, cross-validate
// =============================================================================
// Perplexity Research + DeepSeek Pattern:
// Generate multiple versions with paraphrased prompts, check for consistency

interface MetamorphicResult {
  valid: boolean;
  confidence: number;
  consistentOutputs: number;
  totalVariations: number;
  errors: string[];
  outputs?: string[];
}

interface ValidationConfig {
  variationCount?: number;
  consistencyThreshold?: number;
  testInputCount?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: Required<ValidationConfig> = {
  variationCount: 3,
  consistencyThreshold: 0.8, // 80% threshold from research
  testInputCount: 5,
  timeout: 30000,
};

/**
 * Metamorphic Validator
 * Generate multiple versions of code and check for semantic consistency
 */
export class MetamorphicValidator {
  private config: Required<ValidationConfig>;
  
  constructor(config: ValidationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Validate code by generating multiple versions
   */
  async validate(
    originalPrompt: string,
    generateFn: (prompt: string) => Promise<string>
  ): Promise<MetamorphicResult> {
    console.log(`🔬 Metamorphic testing with ${this.config.variationCount} variations`);
    
    // Step 1: Create paraphrased prompts
    const variations = this.generatePromptVariations(originalPrompt);
    
    // Step 2: Generate code from each variation
    const outputs: string[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < variations.length; i++) {
      const variation = variations[i];
      if (!variation) {
        errors.push(`Variation ${i + 1} is undefined`);
        outputs.push('');
        continue;
      }
      
      try {
        const code = await Promise.race([
          generateFn(variation),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), this.config.timeout ?? 30000)
          ),
        ]);
        outputs.push(code);
      } catch (err: any) {
        errors.push(`Variation ${i + 1} failed: ${err.message}`);
        outputs.push(''); // Placeholder for failed generation
      }
    }
    
    // Step 3: Check structural equivalence
    const structuralConsistency = this.checkStructuralConsistency(outputs);
    
    // Step 4: Check export/import consistency
    const apiConsistency = this.checkApiConsistency(outputs);
    
    // Step 5: Calculate overall consistency
    const overallConsistency = (structuralConsistency + apiConsistency) / 2;
    const consistentCount = Math.floor(overallConsistency * outputs.filter(o => o).length);
    
    const result: MetamorphicResult = {
      valid: overallConsistency >= this.config.consistencyThreshold,
      confidence: overallConsistency,
      consistentOutputs: consistentCount,
      totalVariations: this.config.variationCount,
      errors,
      outputs: outputs.filter(o => o),
    };
    
    if (!result.valid) {
      console.log(`❌ Metamorphic validation failed (${(overallConsistency * 100).toFixed(1)}% consistency)`);
      result.errors.push(`Inconsistent outputs across variations (${(overallConsistency * 100).toFixed(1)}% < ${(this.config.consistencyThreshold * 100).toFixed(1)}%)`);
    } else {
      console.log(`✅ Metamorphic validation passed (${(overallConsistency * 100).toFixed(1)}% consistency)`);
    }
    
    return result;
  }
  
  /**
   * Quick validation (without generation, just structural check)
   */
  validateStructure(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for common issues
    const checks = [
      { test: () => this.hasBalancedBrackets(code), error: 'Unbalanced brackets' },
      { test: () => this.hasExports(code), error: 'No exports found' },
      { test: () => !code.includes('any'), error: 'Contains "any" type (might be lazy)' },
      { test: () => code.trim().length > 50, error: 'Code too short (suspicious)' },
    ];
    
    for (const { test, error } of checks) {
      try {
        if (!test()) {
          errors.push(error);
        }
      } catch {
        // Test failed, skip
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  // === PROMPT VARIATIONS ===
  
  private generatePromptVariations(original: string): string[] {
    return [
      original,
      this.paraphrase1(original),
      this.paraphrase2(original),
    ].slice(0, this.config.variationCount);
  }
  
  private paraphrase1(prompt: string): string {
    // Rephrase with synonyms
    return prompt
      .replace(/\bcreate\b/gi, 'build')
      .replace(/\bfunction\b/gi, 'method')
      .replace(/\bcomponent\b/gi, 'UI element')
      .replace(/\bimplement\b/gi, 'develop')
      .replace(/\bgenerate\b/gi, 'produce');
  }
  
  private paraphrase2(prompt: string): string {
    // Rephrase with structure change
    return `Implement the following: ${prompt}. Ensure TypeScript compliance and proper error handling.`;
  }
  
  // === CONSISTENCY CHECKS ===
  
  private checkStructuralConsistency(outputs: string[]): number {
    const validOutputs = outputs.filter(o => o && o.length > 0);
    if (validOutputs.length < 2) return 0;
    
    // Compare line counts (should be similar)
    const lineCounts = validOutputs.map(o => o.split('\n').length);
    const avgLines = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
    const lineVariance = lineCounts.reduce((sum, c) => sum + Math.abs(c - avgLines), 0) / lineCounts.length;
    const lineConsistency = Math.max(0, 1 - (lineVariance / avgLines));
    
    // Compare function counts
    const fnCounts = validOutputs.map(o => (o.match(/function\s+\w+/g) || []).length);
    const avgFns = fnCounts.reduce((a, b) => a + b, 0) / fnCounts.length;
    const fnVariance = fnCounts.reduce((sum, c) => sum + Math.abs(c - avgFns), 0) / fnCounts.length;
    const fnConsistency = avgFns === 0 ? 1 : Math.max(0, 1 - (fnVariance / avgFns));
    
    return (lineConsistency + fnConsistency) / 2;
  }
  
  private checkApiConsistency(outputs: string[]): number {
    const validOutputs = outputs.filter(o => o && o.length > 0);
    if (validOutputs.length < 2) return 0;
    
    // Extract exports from each output
    const exportSets = validOutputs.map(o => new Set(this.extractExports(o)));
    
    if (exportSets.length === 0) return 0.5; // Unknown
    
    const baselineSet = exportSets[0];
    if (!baselineSet || baselineSet.size === 0) return 0.5; // Unknown
    
    // Compare exports across variations
    const baseline = baselineSet;
    let matchCount = 0;
    
    for (let i = 1; i < exportSets.length; i++) {
      const current = exportSets[i];
      if (!current) continue;
      
      const baselineArray = Array.from(baseline);
      const currentArray = Array.from(current);
      const intersection = new Set(baselineArray.filter(x => current.has(x)));
      const union = new Set([...baselineArray, ...currentArray]);
      const jaccard = intersection.size / union.size;
      matchCount += jaccard;
    }
    
    return matchCount / (exportSets.length - 1);
  }
  
  private extractExports(code: string): string[] {
    const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    const exports: string[] = [];
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
    }
    
    return exports;
  }
  
  private hasBalancedBrackets(code: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
    
    for (const char of code) {
      if (char in pairs) {
        stack.push(pairs[char]);
      } else if (Object.values(pairs).includes(char)) {
        if (stack.pop() !== char) return false;
      }
    }
    
    return stack.length === 0;
  }
  
  private hasExports(code: string): boolean {
    return /export\s+(default\s+)?/.test(code);
  }
}

// Singleton instance
export const metamorphicValidator = new MetamorphicValidator();

/**
 * Quick helper: Validate code with metamorphic testing
 */
export async function validateWithMetamorphic(
  prompt: string,
  generateFn: (prompt: string) => Promise<string>,
  config?: ValidationConfig
): Promise<MetamorphicResult> {
  const validator = new MetamorphicValidator(config);
  return validator.validate(prompt, generateFn);
}

