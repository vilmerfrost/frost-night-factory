import puppeteer from 'puppeteer';
import waitPort from 'wait-port';
import { callAI } from './modelClient';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Denna prompt gör Claude till en elak Art Director
const DESIGN_DICTATOR_V2_PROMPT = `
ROLE: You are the Chief Design Officer at a top-tier VC firm (like Sequoia's design partner).

TASK: Audit this screenshot of a new portfolio company's product.

REFERENCE AESTHETIC: Dark mode, clean sidebar navigation, high data density but not cluttered, professional typography (like Linear/Replit).

CRITERIA FOR IMMEDIATE REJECTION (FAIL):

1. "Student Project Look": Default Bootstrap/Tailwind styling without customization.

2. Broken Layout: Sidebar overlaps content, poor alignment, horizontal scrolling on desktop.

3. "Dead End" UI: Buttons that look clickable but are clearly just static text/divs (no hover feedback implications).

4. Empty States: A dashboard with zero data visualization or call-to-action. (Must inject mock data before screenshot).

5. Lack of "Premium Feel": Poor contrast, generic fonts, no subtle visual polish (shadows, gradients, borders).

CRITERIA FOR APPROVAL (PASS):

1. Commercial Grade: Looks ready to charge $99/month for.

2. Clear Navigation: Sidebar or top nav is obvious and well-structured.

3. Intelligent Layout: Information is presented logically (e.g., cards for projects, tables for data).

4. "WOW" Potential: Is there a unique visual element or interaction hint that stands out?

RESPONSE FORMAT:

"VERDICT: [PASS/FAIL]"

"CRITIQUE: [Brutal, bullet-point list of exactly what fails to meet the premium standard]"
`;

const DESIGN_DICTATOR_PROMPT = DESIGN_DICTATOR_V2_PROMPT;

export interface VisualAuditResult {
  success: boolean;
  score?: number; // 0-10 visual quality score
  critique?: string;
  screenshotBase64?: string; // Screenshot för Vision Loop
  cannotEvaluate?: boolean; // True if no code/context available
  reason?: string; // Why audit failed or cannot evaluate
}

/**
 * ✅ Verify project has real files before visual audit
 */
function verifyProjectFiles(projectPath: string): { valid: boolean; reason?: string } {
  const criticalFiles = [
    'src/app/page.tsx',
    'app/page.tsx',
    'src/app/layout.tsx',
    'app/layout.tsx',
  ];
  
  const minFileSize = 200; // Minimum bytes for non-trivial file
  
  let foundValidFile = false;
  
  for (const file of criticalFiles) {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > minFileSize) {
        foundValidFile = true;
        break;
      }
    }
  }
  
  // Also check for components directory
  const componentsDirs = [
    'src/components',
    'components',
    'src/components/ui',
    'components/ui',
  ];
  
  let hasComponents = false;
  for (const dir of componentsDirs) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      if (files.length > 0) {
        hasComponents = true;
        break;
      }
    }
  }
  
  if (!foundValidFile) {
    return { 
      valid: false, 
      reason: 'No valid page.tsx found (missing or too small)' 
    };
  }
  
  if (!hasComponents) {
    return { 
      valid: false, 
      reason: 'No components directory found' 
    };
  }
  
  return { valid: true };
}

export async function runVisualAudit(projectPath: string): Promise<VisualAuditResult> {
  console.log("👮 DESIGN DICTATOR: Starting aesthetic audit...");
  
  // ✅ Pre-flight check: Verify project has real files
  const fileCheck = verifyProjectFiles(projectPath);
  if (!fileCheck.valid) {
    console.error(`❌ Visual Audit: Cannot evaluate - ${fileCheck.reason}`);
    return {
      success: false,
      score: 0,
      cannotEvaluate: true,
      reason: fileCheck.reason,
    };
  }
  
  const port = 3002; 

  // 1. Starta Next.js med Offline Mode flagga
  const server = spawn('npm', ['run', 'dev', '--', '-p', port.toString()], {
    cwd: projectPath,
    stdio: 'ignore',
    detached: true,
    shell: true,
    env: { 
      ...process.env, 
      NEXT_PUBLIC_IS_AUDIT_MODE: 'true' // Offline Mode: Tvinga mock-data
    }
  });

  let browser;
  try {
    console.log("⏳ Waiting for app to render...");
    const open = await waitPort({ host: 'localhost', port, timeout: 60000 });
    if (!open) throw new Error("Server failed to start.");

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 }); // Desktop standard

    // 2. Navigera och vänta på hydration
    // FIX #1: Wait Longer Before Screenshot
    await page.goto(`http://localhost:${port}`, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // FIX #1: Wait extra time for React to hydrate
    console.log('⏳ Waiting extra 5s for React to hydrate...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // ✅ Standard Promise
    
    // FIX #1: Kontrollera att sidan inte är blank
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    console.log(`📄 Page content length: ${bodyText.length} chars`);
    
    if (bodyText.length < 50) {
      console.log('⚠️ Page body is nearly empty, waiting 10s more...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // ✅ Standard Promise
      
      // ✅ CHECK AGAIN EFTER WAIT (DETTA SAKNAS!)
      const bodyTextAfterWait = await page.evaluate(() => document.body.innerText || '');
      console.log(`📄 After extra wait: ${bodyTextAfterWait.length} chars`);
      
      if (bodyTextAfterWait.length < 50) {
        console.log('🚨 Page STILL empty after 15s total wait.');
        console.log('🚨 This likely means Next.js compiled /_not-found instead of /page');
        
        // Throw så fallback-logiken (bulletproof inject) triggas
        throw new Error('Page failed to render after 15s - likely 404 state');
      } else {
        console.log('✅ Page loaded successfully after extra wait!');
      }
    }
    
    // 3. "Inject Life" - Tvinga fram lite mock-data om sidan ser tom ut
    // Detta är ett trick för att se hur designen ser ut MED innehåll
    await page.evaluate(() => {
      // Exempel: Om det finns tomma listor, fyll dem visuellt (valfritt hack)
      // document.body.style.background = "#f8fafc"; // Tvinga light mode om osäkert
      
      // Försök hitta tomma listor/containers och fyll dem med mock-data
      const emptyLists = document.querySelectorAll('ul:empty, ol:empty, [data-empty="true"]');
      emptyLists.forEach((list, index) => {
        if (list.children.length === 0) {
          // Skapa några mock-items för visuell feedback
          for (let i = 0; i < 3; i++) {
            const item = document.createElement('li');
            item.textContent = `Sample Item ${i + 1}`;
            item.style.padding = '8px';
            item.style.borderBottom = '1px solid #e5e7eb';
            list.appendChild(item);
          }
        }
      });
      
      // Försök hitta tomma cards/containers och fyll dem
      const emptyCards = document.querySelectorAll('[class*="card"]:empty, [class*="Card"]:empty');
      emptyCards.forEach((card, index) => {
        if (card.textContent?.trim() === '') {
          const placeholder = document.createElement('div');
          placeholder.textContent = 'Sample Content';
          placeholder.style.padding = '16px';
          placeholder.style.color = '#6b7280';
          card.appendChild(placeholder);
        }
      });
    });

    // 4. Ta screenshot
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // 5. Låt Claude döma
    console.log("⚖️ The Dictator is judging the pixels...");
    const critique = await callAI("FRONTEND", DESIGN_DICTATOR_PROMPT, undefined, screenshot as string);

    console.log("---------------------------------------------------");
    console.log(critique);
    console.log("---------------------------------------------------");

    // ✅ Check for "no code / cannot audit" errors - treat as score 0
    const critiqueLower = critique.toLowerCase();
    if (critiqueLower.includes('no source code') || 
        critiqueLower.includes('could not perform audit') ||
        critiqueLower.includes('cannot audit') ||
        critiqueLower.includes('no code provided') ||
        critiqueLower.includes('no context')) {
      console.error("❌ Visual Audit: No code/context available - treating as score 0");
      return {
        success: false,
        score: 0,
        cannotEvaluate: true,
        reason: 'No source code was provided or could not perform audit',
        critique,
        screenshotBase64: screenshot as string,
      };
    }

    // ✅ Extract score if present (some models return scores)
    let score = 10; // Default to pass if no score found
    const scoreMatch = critique.match(/score[:\s]+(\d+)\/10/i) || 
                      critique.match(/(\d+)\/10/i) ||
                      critique.match(/score[:\s]+(\d+)/i);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1], 10);
    }

    // ✅ Hard gate: Score must be >= 8 to pass
    if (critique.includes("VERDICT: FAIL") || score < 8) {
      console.error(`❌ DESIGN REJECTED! Score: ${score}/10 (below threshold of 8)`);
      // Extract critique text
      const critiqueMatch = critique.match(/CRITIQUE:\s*([\s\S]*?)(?:\n\n|$)/i);
      const critiqueText = critiqueMatch ? critiqueMatch[1].trim() : critique;
      // Return screenshot så Coder kan se vad som är fel
      return { 
        success: false, 
        score,
        critique: critiqueText, 
        screenshotBase64: screenshot as string 
      };
    }
    
    console.log(`✅ DESIGN APPROVED: Product looks premium. Score: ${score}/10`);
    return { success: true, score, screenshotBase64: screenshot as string };

  } catch (error: any) {
    console.error("❌ Visual Audit Error:", error?.message);
    return { success: false, critique: error?.message || "Visual audit failed" }; 
  } finally {
    if (browser) await browser.close();
    // Döda servern (Cross-platform kill) - Behåller den förbättrade kill-logiken
    try { 
      if (server.pid) {
        if (process.platform === 'win32') {
          // Windows: Använd taskkill för att döda hela process-trädet
          try {
            execSync(`taskkill /F /T /PID ${server.pid} 2>nul`, { stdio: 'ignore' });
          } catch (e) {
            // Fallback till process.kill om taskkill misslyckas
            try {
              process.kill(server.pid, 'SIGTERM');
            } catch (e2) {}
          }
        } else {
          // Linux/Mac: Använd SIGTERM först, sedan SIGKILL om nödvändigt
          try {
            process.kill(-server.pid, 'SIGTERM');
            // Vänta lite och döda hårdare om det behövs
            setTimeout(() => {
              try {
                process.kill(-server.pid, 'SIGKILL');
              } catch (e) {}
            }, 1000);
          } catch (e) {
            // Ignorera om processen redan är död
          }
        }
      }
    } catch (e) {
      // Ignorera om processen redan är död
    }
  }
}

