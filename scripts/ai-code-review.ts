// =============================================================================
// AI CODE REVIEW GATE - Safety net for logical errors
// =============================================================================
// Uses Claude to review code changes before commit

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { blockText, hasText } from '@/lib/utils/contentBlocks';
import { toUtf8 } from '@/lib/utils/bytes';
import { argAt } from '@/lib/utils/argv';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
});

interface ReviewResult {
  safe: boolean;
  issues: string[];
  suggestions?: string[];
  confidence: number;
}

/**
 * Get git diff for staged changes
 */
function getStagedDiff(): string {
  try {
    const result = execSync('git diff --staged', { encoding: 'utf-8' });
    return toUtf8(result);
  } catch (error: any) {
    // Not a git repo or no staged changes
    return '';
  }
}

/**
 * Get git diff for unstaged changes (fallback)
 */
function getUnstagedDiff(): string {
  try {
    const result = execSync('git diff', { encoding: 'utf-8' });
    return toUtf8(result);
  } catch {
    return '';
  }
}

/**
 * Review code changes with AI
 */
export async function reviewChanges(diff?: string): Promise<ReviewResult> {
  const codeDiff = diff || getStagedDiff() || getUnstagedDiff();
  
  if (!codeDiff || codeDiff.trim().length === 0) {
    return {
      safe: true,
      issues: [],
      confidence: 1.0,
    };
  }
  
  // Skip if diff is too large (likely not a real code review scenario)
  if (codeDiff.length > 50000) {
    console.log('⚠️  Diff too large for AI review, skipping...');
    return {
      safe: true,
      issues: [],
      confidence: 0.5,
    };
  }
  
  console.log('🤖 Running AI code review...');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Review this code diff for syntax errors, type errors, dangerous patterns, and logical issues:

\`\`\`diff
${codeDiff.substring(0, 40000)}${codeDiff.length > 40000 ? '\n... (truncated)' : ''}
\`\`\`

Focus on:
1. Syntax errors (missing brackets, unclosed strings, etc.)
2. Type errors (TypeScript type mismatches)
3. Dangerous patterns (eval, unsafe imports, hardcoded secrets)
4. Logic errors (potential bugs, race conditions)
5. Performance issues (inefficient code)

Return JSON only:
{
  "safe": true/false,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "confidence": 0.0-1.0
}`
      }]
    });
    
    const content = response.content[0];
    
    if (content && hasText(content)) {
      // Extract JSON from response
      const text = blockText(content);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result: ReviewResult = JSON.parse(jsonMatch[0]);
        return result;
      }
    }
    
    // Fallback: parse as text
    const text = content ? blockText(content) : '';
    const hasIssues = text.toLowerCase().includes('unsafe') || 
                      text.toLowerCase().includes('error') ||
                      text.toLowerCase().includes('dangerous');
    
    return {
      safe: !hasIssues,
      issues: hasIssues ? ['AI detected potential issues - review manually'] : [],
      confidence: 0.7,
    };
  } catch (error: any) {
    console.warn(`⚠️  AI review failed: ${error.message}`);
    
    // Fallback: basic pattern matching
    return basicPatternCheck(codeDiff);
  }
}

/**
 * Basic pattern check (fallback when AI unavailable)
 */
function basicPatternCheck(diff: string): ReviewResult {
  const issues: string[] = [];
  
  // Check for dangerous patterns
  if (diff.includes('eval(') || diff.includes('Function(')) {
    issues.push('Dangerous: eval() or Function() detected');
  }
  
  if (diff.match(/sk-[A-Za-z0-9]{32,}/)) {
    issues.push('Dangerous: Potential API key detected');
  }
  
  if (diff.includes('process.env[') && diff.includes('+')) {
    issues.push('Warning: Dynamic env variable access');
  }
  
  // Check for common syntax issues
  const openBraces = (diff.match(/\{/g) || []).length;
  const closeBraces = (diff.match(/\}/g) || []).length;
  if (Math.abs(openBraces - closeBraces) > 2) {
    issues.push(`Warning: Significant brace imbalance (${openBraces} open, ${closeBraces} close)`);
  }
  
  return {
    safe: issues.length === 0,
    issues,
    confidence: 0.6,
  };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const isPreCommit = process.argv.includes('--pre-commit');
  const diffFile = process.argv.find(arg => arg.startsWith('--diff='));
  
  let diff: string | undefined;
  
  if (diffFile) {
    const parts = diffFile.split('=');
    const filePath = parts[1];
    if (filePath) {
      diff = fs.readFileSync(filePath, 'utf-8');
    }
  }
  
  const result = await reviewChanges(diff);
  
  if (!result.safe) {
    console.log('\n🚨 AI detected issues:');
    result.issues.forEach(issue => {
      console.log(`   ❌ ${issue}`);
    });
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      result.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion}`);
      });
    }
    
    console.log(`\n   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    
    if (isPreCommit) {
      console.log('\n❌ COMMIT BLOCKED by AI review');
      console.log('   Review issues above and fix before committing');
      process.exit(1);
    }
  } else {
    console.log('✅ AI review passed');
    if (result.confidence < 0.8) {
      console.log(`   ⚠️  Low confidence (${(result.confidence * 100).toFixed(0)}%) - manual review recommended`);
    }
  }
  
  if (isPreCommit) {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

