// =============================================================================
// SYNTAX ERROR DIAGNOSTIC TOOL
// =============================================================================
// Identifies exact locations of syntax errors

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface SyntaxIssue {
  file: string;
  line: number;
  column: number;
  type: 'unclosed_string' | 'unclosed_template' | 'unbalanced_brace' | 'unbalanced_paren' | 'unbalanced_bracket';
  message: string;
}

function analyzeFile(filePath: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let templateDepth = 0;
  let braceStack: number[] = [];
  let parenStack: number[] = [];
  let bracketStack: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : '';
      const nextChar = j < line.length - 1 ? line[j + 1] : '';
      
      // Skip comments
      if (char === '/' && nextChar === '/') break;
      if (char === '/' && nextChar === '*') {
        // Skip until */
        let k = j + 2;
        while (k < line.length - 1) {
          if (line[k] === '*' && line[k + 1] === '/') {
            j = k + 1;
            break;
          }
          k++;
        }
        continue;
      }
      
      // Track template literals
      if (char === '`' && prevChar !== '\\') {
        if (!inTemplate) {
          inTemplate = true;
          templateDepth = 1;
        } else {
          templateDepth--;
          if (templateDepth === 0) {
            inTemplate = false;
          }
        }
      }
      
      if (inTemplate && char === '{' && nextChar === '$') {
        templateDepth++;
      }
      if (inTemplate && char === '}' && prevChar !== '$') {
        templateDepth--;
      }
      
      // Track strings (only if not in template)
      if (!inTemplate) {
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
      }
      
      // Track brackets (only if not in string/template)
      if (!inString && !inTemplate) {
        if (char === '{') braceStack.push(lineNum);
        if (char === '}') {
          if (braceStack.length === 0) {
            issues.push({
              file: filePath,
              line: lineNum,
              column: j + 1,
              type: 'unbalanced_brace',
              message: `Extra closing brace }`,
            });
          } else {
            braceStack.pop();
          }
        }
        
        if (char === '(') parenStack.push(lineNum);
        if (char === ')') {
          if (parenStack.length === 0) {
            issues.push({
              file: filePath,
              line: lineNum,
              column: j + 1,
              type: 'unbalanced_paren',
              message: `Extra closing parenthesis )`,
            });
          } else {
            parenStack.pop();
          }
        }
        
        if (char === '[') bracketStack.push(lineNum);
        if (char === ']') {
          if (bracketStack.length === 0) {
            issues.push({
              file: filePath,
              line: lineNum,
              column: j + 1,
              type: 'unbalanced_bracket',
              message: `Extra closing bracket ]`,
            });
          } else {
            bracketStack.pop();
          }
        }
      }
    }
  }
  
  // Check for unclosed strings/templates
  if (inString) {
    issues.push({
      file: filePath,
      line: lines.length,
      column: lines[lines.length - 1].length,
      type: 'unclosed_string',
      message: `Unclosed string (started with ${stringChar})`,
    });
  }
  
  if (inTemplate) {
    issues.push({
      file: filePath,
      line: lines.length,
      column: lines[lines.length - 1].length,
      type: 'unclosed_template',
      message: 'Unclosed template literal',
    });
  }
  
  // Check for unclosed brackets
  braceStack.forEach(lineNum => {
    issues.push({
      file: filePath,
      line: lineNum,
      column: 1,
      type: 'unbalanced_brace',
      message: 'Unclosed opening brace {',
    });
  });
  
  parenStack.forEach(lineNum => {
    issues.push({
      file: filePath,
      line: lineNum,
      column: 1,
      type: 'unbalanced_paren',
      message: 'Unclosed opening parenthesis (',
    });
  });
  
  bracketStack.forEach(lineNum => {
    issues.push({
      file: filePath,
      line: lineNum,
      column: 1,
      type: 'unbalanced_bracket',
      message: 'Unclosed opening bracket [',
    });
  });
  
  return issues;
}

async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const baseDir = path.resolve(targetDir);
  
  console.log('🔍 Syntax Error Diagnostic Tool');
  console.log('================================\n');
  console.log(`Target: ${baseDir}\n`);
  
  // Priority files
  const priorityFiles = [
    'agent-runner/pipeline-runner.ts',
    'agent-runner/semantic-cache.ts',
    'agent-runner/lib/auto-fixer.ts',
  ];
  
  const allFiles = await glob('**/*.{ts,tsx}', {
    cwd: baseDir,
    ignore: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      '**/*.d.ts',
      'workspace/**', // Skip sandbox files
    ],
  });
  
  console.log(`Analyzing ${allFiles.length} files...\n`);
  
  const allIssues: SyntaxIssue[] = [];
  
  // Check priority files first
  for (const file of priorityFiles) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
      const issues = analyzeFile(filePath);
      if (issues.length > 0) {
        console.log(`\n🚨 ${file}:`);
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}:${issue.column} - ${issue.message}`);
        });
        allIssues.push(...issues);
      }
    }
  }
  
  // Check other files
  for (const file of allFiles) {
    if (!priorityFiles.some(pf => file.includes(pf))) {
      const filePath = path.join(baseDir, file);
      try {
        const issues = analyzeFile(filePath);
        if (issues.length > 0) {
          console.log(`\n⚠️ ${file}:`);
          issues.forEach(issue => {
            console.log(`   Line ${issue.line}:${issue.column} - ${issue.message}`);
          });
          allIssues.push(...issues);
        }
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total issues found: ${allIssues.length}`);
  console.log(`   Files with issues: ${new Set(allIssues.map(i => i.file)).size}`);
  
  if (allIssues.length === 0) {
    console.log('\n✅ No syntax errors detected!');
  } else {
    console.log('\n❌ Syntax errors found - fix before deployment');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

