// =============================================================================
// A/B TESTING - Generate 2 design variants for user selection
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';

export interface ABVariant {
  name: string;
  path: string;
  description: string;
}

export async function generateABVariants(
  workspacePath: string,
  userVision: string
): Promise<ABVariant[]> {
  
  console.log('🔀 [A/B Testing] Generating 2 design variants...');
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });
  
  const variants: ABVariant[] = [];
  
  // Generate Variant A (Bold & Modern)
  console.log('   🎨 Generating Variant A (Bold & Modern)...');
  
  const variantAPrompt = `${userVision}

VARIANT A: Bold & Modern
- Use vibrant gradients (cyan, purple, pink)
- Large, impactful typography
- Animated elements (framer-motion)
- Glass morphism effects
- High contrast

Generate ONLY the page.tsx file with this aesthetic. Use the [FILE: src/app/page.tsx] format.`;

  const variantAResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: variantAPrompt }],
  });

  const variantACode = extractCode(variantAResponse.content[0].type === 'text' ? variantAResponse.content[0].text : '');
  
  // Save Variant A
  const variantAPath = path.join(workspacePath, 'variant-a');
  fs.mkdirSync(variantAPath, { recursive: true });
  
  // Copy entire workspace
  copyDirectory(workspacePath, variantAPath, ['variant-a', 'variant-b', '.next', 'node_modules']);
  
  // Write variant A page
  const variantAPagePath = path.join(variantAPath, 'src', 'app', 'page.tsx');
  fs.mkdirSync(path.dirname(variantAPagePath), { recursive: true });
  fs.writeFileSync(variantAPagePath, variantACode, 'utf-8');
  
  variants.push({
    name: 'Variant A: Bold & Modern',
    path: variantAPath,
    description: 'Vibrant colors, large typography, animated',
  });
  
  // Generate Variant B (Minimal & Clean)
  console.log('   🎨 Generating Variant B (Minimal & Clean)...');
  
  const variantBPrompt = `${userVision}

VARIANT B: Minimal & Clean
- Subtle colors (whites, grays, one accent color)
- Smaller, refined typography
- Minimal animations
- Clean borders and shadows
- High whitespace

Generate ONLY the page.tsx file with this aesthetic. Use the [FILE: src/app/page.tsx] format.`;

  const variantBResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: variantBPrompt }],
  });

  const variantBCode = extractCode(variantBResponse.content[0].type === 'text' ? variantBResponse.content[0].text : '');
  
  // Save Variant B
  const variantBPath = path.join(workspacePath, 'variant-b');
  fs.mkdirSync(variantBPath, { recursive: true });
  
  // Copy entire workspace
  copyDirectory(workspacePath, variantBPath, ['variant-a', 'variant-b', '.next', 'node_modules']);
  
  // Write variant B page
  const variantBPagePath = path.join(variantBPath, 'src', 'app', 'page.tsx');
  fs.mkdirSync(path.dirname(variantBPagePath), { recursive: true });
  fs.writeFileSync(variantBPagePath, variantBCode, 'utf-8');
  
  variants.push({
    name: 'Variant B: Minimal & Clean',
    path: variantBPath,
    description: 'Subtle colors, refined typography, high whitespace',
  });
  
  console.log('   ✅ Generated 2 variants');
  
  return variants;
}

function extractCode(text: string): string {
  // Try to extract code from markdown code blocks
  const codeBlockRegex = /```(?:tsx?|typescript|javascript)?\n([\s\S]*?)```/;
  const match = text.match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }
  
  // Try [FILE: ...] format
  const fileRegex = /\[FILE:\s*[^\]]+\]\s*([\s\S]*?)(?:\[END_FILE\]|$)/;
  const fileMatch = text.match(fileRegex);
  if (fileMatch) {
    return fileMatch[1].trim();
  }
  
  return text;
}

function copyDirectory(src: string, dest: string, exclude: string[] = []): void {
  if (!fs.existsSync(src)) return;
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    if (exclude.includes(item)) continue;
    
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

