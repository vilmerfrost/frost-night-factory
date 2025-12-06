// =============================================================================
// VISION-BASED UI REFINEMENT - Uses Claude Vision to evaluate and improve UI
// =============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
/**
 * Vision-based UI refinement using Claude Vision API
 */
export async function visionRefineUI(workspacePath, maxIterations = 3, targetScore = 9, port = 3002) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    let currentScore = 0;
    let iteration = 0;
    const feedbackHistory = [];
    console.log(`🎨 [Vision Refiner] Starting UI refinement (target: ${targetScore}/10, port: ${port})...`);
    // Start browser
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        // Navigate to dev server
        await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000); // Let React hydrate
        while (iteration < maxIterations && currentScore < targetScore) {
            iteration++;
            console.log(`   📸 Vision Iteration ${iteration}/${maxIterations}...`);
            // Take screenshot
            const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
            const screenshotBase64 = screenshot.toString('base64');
            // Send to Claude Vision
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-5',
                max_tokens: 2000,
                messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/png',
                                    data: screenshotBase64,
                                },
                            },
                            {
                                type: 'text',
                                text: `You are a UI/UX expert evaluating this generated web application.

EVALUATION CRITERIA (Score 1-10):
1. **Spacing & Layout** (2 points)
   - Consistent padding/margins (multiples of 4px)
   - Proper use of whitespace
   - No cramped or overlapping elements

2. **Typography** (2 points)
   - Clear hierarchy (h1 > h2 > body)
   - Readable font sizes (min 14px for body)
   - Proper line-height and letter-spacing

3. **Color & Contrast** (2 points)
   - Accessible contrast ratios (WCAG AA)
   - Cohesive color palette
   - Proper use of accent colors

4. **Component Quality** (2 points)
   - Buttons have hover/active states
   - Cards have proper shadows/borders
   - Interactive elements are obvious

5. **Polish & Details** (2 points)
   - Smooth transitions
   - Loading states
   - Error states
   - Empty states

RESPOND IN THIS EXACT JSON FORMAT:
{
  "score": 8,
  "strengths": ["Good use of card components", "Clear typography hierarchy"],
  "issues": [
    {
      "severity": "high",
      "description": "Buttons lack hover states",
      "fix": "Add hover:bg-primary/90 transition-all to all button elements"
    }
  ],
  "specific_css_fixes": [
    {
      "file": "src/app/page.tsx",
      "selector": "button",
      "add_classes": "hover:scale-105 active:scale-95 transition-all"
    }
  ]
}`,
                            },
                        ],
                    }],
            });
            const content = response.content[0];
            if (content.type !== 'text') {
                console.warn('   ⚠️ Claude did not return text response');
                break;
            }
            // Parse Claude's response
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('   ⚠️ Claude did not return valid JSON');
                break;
            }
            const evaluation = JSON.parse(jsonMatch[0]);
            currentScore = evaluation.score || 0;
            console.log(`   📊 Current score: ${currentScore}/10`);
            if (evaluation.strengths && evaluation.strengths.length > 0) {
                console.log(`   ✅ Strengths: ${evaluation.strengths.join(', ')}`);
            }
            feedbackHistory.push(...(evaluation.issues || []).map((i) => i.description));
            if (currentScore >= targetScore) {
                console.log(`   ✅ Target score ${targetScore} reached!`);
                break;
            }
            // Apply fixes
            if (evaluation.specific_css_fixes && evaluation.specific_css_fixes.length > 0) {
                console.log(`   🔧 Applying ${evaluation.specific_css_fixes.length} CSS fixes...`);
                for (const fix of evaluation.specific_css_fixes) {
                    await applyCssFix(workspacePath, fix);
                }
                // Wait for changes to rebuild
                await page.waitForTimeout(3000);
                await page.reload({ waitUntil: 'networkidle' });
                await page.waitForTimeout(2000);
            }
            else {
                console.log('   ⚠️ No specific fixes provided, stopping refinement');
                break;
            }
        }
    }
    catch (error) {
        console.error(`   ❌ Vision refinement error: ${error.message}`);
    }
    finally {
        await browser.close();
    }
    return {
        score: currentScore,
        feedback: feedbackHistory,
        iterations: iteration,
    };
}
/**
 * Apply CSS fix to a file
 */
async function applyCssFix(workspacePath, fix) {
    const filePath = path.join(workspacePath, fix.file);
    if (!fs.existsSync(filePath)) {
        console.warn(`   ⚠️ File not found: ${fix.file}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf-8');
    // Simple regex to add classes (works for most cases)
    // Match: <button className="existing" or <button className='existing'
    const selectorRegex = new RegExp(`<(${fix.selector})([^>]*className=["']([^"']*)["'])`, 'gi');
    let fixed = false;
    content = content.replace(selectorRegex, (match, tag, attrs, existingClasses) => {
        if (!existingClasses.includes(fix.add_classes)) {
            const newClasses = `${existingClasses} ${fix.add_classes}`.trim();
            fixed = true;
            return match.replace(existingClasses, newClasses);
        }
        return match;
    });
    // Also handle cases without className attribute
    if (!fixed) {
        const noClassRegex = new RegExp(`<(${fix.selector})([^>]*)(>)`, 'gi');
        content = content.replace(noClassRegex, (match, tag, attrs, closing) => {
            if (!attrs.includes('className')) {
                fixed = true;
                return `<${tag}${attrs} className="${fix.add_classes}"${closing}`;
            }
            return match;
        });
    }
    if (fixed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`   ✅ Applied fix to ${fix.file} (${fix.selector})`);
    }
    else {
        console.log(`   ⚠️ Could not apply fix to ${fix.file} (pattern not found)`);
    }
}
