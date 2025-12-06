// =============================================================================
// VISION AUDIT SYSTEM - Lovable-Level UI Quality Assurance
// =============================================================================
// Uses Claude Vision API to audit UI quality and provide actionable feedback
// Replaces old "Visual Dictator" with intelligent scoring and refinement
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { callAI } from './modelClient';
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
/**
 * Take a screenshot of the application using Puppeteer
 */
async function takeScreenshot(url) {
    let browser = null;
    try {
        console.log(`📸 Taking screenshot of ${url}...`);
        // Launch headless browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        // Set viewport for consistent screenshots
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });
        // Navigate to URL and wait for page to load
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });
        // Wait a bit for any animations/transitions
        await page.waitForTimeout(2000);
        // Take full page screenshot
        const screenshot = await page.screenshot({
            fullPage: true,
            type: 'png',
        });
        await browser.close();
        browser = null;
        console.log(`   ✅ Screenshot captured (${screenshot.length} bytes)`);
        return screenshot;
    }
    catch (error) {
        console.error(`   ❌ Failed to take screenshot: ${error.message}`);
        if (browser) {
            try {
                await browser.close();
            }
            catch (e) {
                // Ignore
            }
        }
        return null;
    }
}
/**
 * Audit UI quality using Claude Vision API
 */
export async function auditUI(screenshotPath, projectDescription) {
    console.log('👁️ VISION AUDIT: Analyzing UI quality...');
    try {
        // Read screenshot if it's a path
        let imageData;
        if (typeof screenshotPath === 'string') {
            imageData = fs.readFileSync(screenshotPath);
        }
        else {
            imageData = screenshotPath;
        }
        // Convert to base64
        const base64Image = imageData.toString('base64');
        // Create prompt for Claude Vision
        const prompt = `
You are a world-class UI/UX expert evaluating a SaaS application.

PROJECT DESCRIPTION:
${projectDescription}

EVALUATION CRITERIA (Rate 0-10 for each):
1. Visual Hierarchy: Is information clearly organized? Are headings, text, and actions easy to scan?
2. Color & Contrast: Are colors used consistently? Is text readable? Do colors convey meaning?
3. Spacing & Layout: Is there breathing room? Is the layout balanced and not cramped?
4. Typography: Are fonts readable? Is text sizing appropriate? Is hierarchy clear?
5. Interactive Elements: Are buttons/links clearly clickable? Do they have proper hover states?
6. Modern Aesthetics: Does it look like a premium SaaS (Linear, Vercel, Raycast)? Or Windows 95?
7. Consistency: Are components styled consistently? Same spacing, colors, shadows?
8. Accessibility: Is contrast sufficient? Are interactive elements large enough?
9. Polish: Are there subtle animations? Smooth transitions? Professional feel?
10. Overall Impression: Would you pay for this? Does it inspire confidence?

OUTPUT FORMAT (JSON):
{
  "score": 8.5,
  "feedback": [
    "✅ Excellent spacing and typography",
    "⚠️ Button colors could be more consistent",
    "❌ Missing hover states on interactive elements"
  ],
  "criticalIssues": [
    "Buttons lack hover states - feels unresponsive",
    "Color contrast too low in dark mode"
  ],
  "suggestions": [
    "Add hover:bg-primary-600 to all buttons",
    "Increase text contrast from neutral-400 to neutral-300"
  ],
  "passed": true
}

Be HONEST. If it looks like Windows 95, say so. If it's premium, acknowledge it.
`;
        // Call Claude Vision API
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: base64Image,
                            },
                        },
                        {
                            type: 'text',
                            text: prompt,
                        },
                    ],
                },
            ],
        });
        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log(`📊 Vision Audit Score: ${result.score}/10`);
            return result;
        }
        // Fallback if JSON parsing fails
        return {
            score: 5,
            feedback: ['Failed to parse audit response'],
            criticalIssues: ['Could not analyze UI'],
            suggestions: ['Retry audit'],
            passed: false,
        };
    }
    catch (error) {
        console.error('Vision audit failed:', error.message);
        // Fallback: Use text-based audit via regular AI
        return await fallbackTextAudit(projectDescription);
    }
}
/**
 * Fallback text-based audit if Vision API fails
 */
async function fallbackTextAudit(projectDescription) {
    console.log('⚠️ Falling back to text-based audit...');
    const prompt = `
You are evaluating a SaaS application UI based on code structure.

PROJECT: ${projectDescription}

Analyze the codebase and rate UI quality (0-10) based on:
- Use of design system colors/spacing
- Component consistency
- Modern patterns (glassmorphism, gradients, animations)

Return JSON:
{
  "score": 7,
  "feedback": ["..."],
  "criticalIssues": ["..."],
  "suggestions": ["..."],
  "passed": false
}
`;
    try {
        const response = await callAI('AUDIT', prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    }
    catch (e) {
        // Ignore
    }
    return {
        score: 5,
        feedback: ['Could not perform audit'],
        criticalIssues: [],
        suggestions: [],
        passed: false,
    };
}
/**
 * Refinement Loop - Iteratively improve UI until score >= 8
 */
export async function refinementLoop(projectPath, devServerUrl, maxIterations = 3, onCodeUpdate) {
    console.log('\n🎨 REFINEMENT LOOP: Starting UI refinement...');
    console.log(`   Target: Score >= 8/10`);
    console.log(`   Max iterations: ${maxIterations}`);
    let currentScore = 0;
    let iterations = 0;
    const allFeedback = [];
    // Get project description
    const packageJsonPath = path.join(projectPath, 'package.json');
    let projectDescription = 'SaaS Application';
    if (fs.existsSync(packageJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            projectDescription = pkg.description || pkg.name || projectDescription;
        }
        catch (e) {
            // Ignore
        }
    }
    while (iterations < maxIterations && currentScore < 8) {
        iterations++;
        console.log(`\n🔄 Iteration ${iterations}/${maxIterations}...`);
        // Take screenshot
        const screenshot = await takeScreenshot(devServerUrl);
        if (!screenshot) {
            console.warn('⚠️ Could not take screenshot, using fallback audit');
            const fallbackResult = await fallbackTextAudit(projectDescription);
            currentScore = fallbackResult.score;
            allFeedback.push(...fallbackResult.feedback);
            if (fallbackResult.passed) {
                break;
            }
            // Generate fix based on suggestions
            if (fallbackResult.suggestions.length > 0 && onCodeUpdate) {
                await applyFixes(projectPath, fallbackResult.suggestions, onCodeUpdate);
            }
            continue;
        }
        // Audit UI
        const auditResult = await auditUI(screenshot, projectDescription);
        currentScore = auditResult.score;
        allFeedback.push(...auditResult.feedback);
        console.log(`   Score: ${currentScore}/10`);
        if (auditResult.passed) {
            console.log('✅ UI Quality passed! (Score >= 8)');
            break;
        }
        // Apply fixes
        if (auditResult.suggestions.length > 0 && onCodeUpdate) {
            console.log(`   🔧 Applying ${auditResult.suggestions.length} fixes...`);
            await applyFixes(projectPath, auditResult.suggestions, async (filePath, code) => {
                // Parse the code output to extract files
                // The code might be in format: ### FILE: path\n```tsx\n...\n```\n### END_FILE
                const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
                let match;
                let filesFound = 0;
                while ((match = fileRegex.exec(code)) !== null) {
                    const relativePath = match[1].trim();
                    let fileContent = match[2].trim();
                    // Remove code block markers
                    fileContent = fileContent.replace(/^```tsx?\n?/i, '').replace(/```$/m, '');
                    // Call the callback with the actual file path
                    const fullPath = path.join(projectPath, relativePath);
                    await onCodeUpdate(fullPath, fileContent);
                    filesFound++;
                }
                // If no files found in format, assume it's raw code for the filePath
                if (filesFound === 0 && filePath) {
                    await onCodeUpdate(filePath, code);
                }
            });
            // Wait for hot reload
            console.log('   ⏳ Waiting for hot reload...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time
        }
        else {
            console.log('   ⚠️ No suggestions provided, stopping refinement');
            break;
        }
    }
    return {
        score: currentScore,
        iterations,
        finalFeedback: allFeedback,
        passed: currentScore >= 8,
    };
}
/**
 * Apply UI fixes based on suggestions
 */
async function applyFixes(projectPath, suggestions, onCodeUpdate) {
    // Find main page file
    const pagePath = path.join(projectPath, 'src', 'app', 'page.tsx');
    const altPagePath = path.join(projectPath, 'app', 'page.tsx');
    const mainPagePath = fs.existsSync(pagePath) ? pagePath : altPagePath;
    if (!fs.existsSync(mainPagePath)) {
        console.warn('⚠️ Could not find page.tsx to apply fixes');
        return;
    }
    const currentCode = fs.readFileSync(mainPagePath, 'utf-8');
    const fixPrompt = `
You are fixing UI issues in a React/Next.js application.

CURRENT CODE:
\`\`\`tsx
${currentCode}
\`\`\`

SUGGESTIONS TO APPLY:
${suggestions.map(s => `- ${s}`).join('\n')}

TASK: Apply ALL suggestions to improve the UI. Return the COMPLETE fixed file.

CRITICAL RULES:
1. Use ONLY colors from DESIGN_SYSTEM.colors
2. Use ONLY spacing from DESIGN_SYSTEM.spacing  
3. Add hover states to all interactive elements
4. Use framer-motion transitions from DESIGN_SYSTEM.transitions
5. Maintain all existing functionality

OUTPUT FORMAT:
### FILE: ${path.relative(projectPath, mainPagePath)}
\`\`\`tsx
// Complete fixed code here
\`\`\`
### END_FILE
`;
    try {
        const fixedCode = await callAI('FRONTEND', fixPrompt);
        await onCodeUpdate(mainPagePath, fixedCode);
        console.log('   ✅ Fixes applied');
    }
    catch (error) {
        console.error('   ❌ Failed to apply fixes:', error.message);
    }
}
/**
 * Start dev server and wait for it to be ready
 */
export async function startDevServerWithVerification(projectPath, port = 3002) {
    const { spawn } = require('child_process');
    console.log(`🚀 Starting dev server on port ${port}...`);
    const serverProcess = spawn('npm', ['run', 'dev', '--', '-p', port.toString()], {
        cwd: projectPath,
        stdio: 'pipe',
        shell: true,
        detached: false,
    });
    // Handle process errors
    serverProcess.on('error', (error) => {
        console.error(`❌ Failed to start dev server: ${error.message}`);
    });
    // Wait for server to be ready
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    while (Date.now() - startTime < maxWait) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`http://localhost:${port}`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.ok || response.status === 404) {
                // 404 is OK - means server is running, just page might not exist
                console.log(`✅ Dev server ready at http://localhost:${port}`);
                return {
                    process: serverProcess,
                    url: `http://localhost:${port}`,
                };
            }
        }
        catch (e) {
            // Server not ready yet or fetch failed
            if (e.name !== 'AbortError') {
                // Only log non-timeout errors
                // console.log(`   Waiting for server... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    // Kill process if timeout
    try {
        serverProcess.kill();
    }
    catch (e) {
        // Ignore
    }
    throw new Error(`Dev server failed to start within ${maxWait / 1000} seconds`);
}
