import { callAI } from "./modelClient";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate documentation in background (non-blocking)
 */
async function generateDocsInBackground(prompt: string, projectPath: string) {
  try {
    const output = await callAI("AUDIT", prompt);
    
    // Parse and write files
    const fileRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)\[GOAL\]/g;
    let match;
    let filesCreated = 0;
    
    while ((match = fileRegex.exec(output)) !== null) {
      const fileName = match[1]?.trim();
      let content = match[2]?.trim();
      if (!fileName || !content) continue;
      
      // Sanitize markdown artifacts
      content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");
      content = content.replace(/^### FILE:.*\n/i, "");
      
      const filePath = path.join(projectPath, fileName);
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, content);
      console.log(`📝 [Async] Wrote ${fileName}`);
      filesCreated++;
    }
    
    if (filesCreated === 0) {
      console.warn("[Documentation] ⚠️ No files were parsed from AI output.");
    }
  } catch (err: any) {
    console.error("❌ Background Docs Failed:", err?.message);
  }
}

export async function runDocumentationStep(projectPath: string, techStack: string) {
  console.log("📝 Queuing Documentation Generation (Batch Mode)...");

  // 1. Läs in filstruktur och nyckelfiler för kontext
  const fileList: string[] = [];
  function collectFiles(dir: string, baseDir: string = projectPath) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        // Ignorera node_modules, .next, venv, etc.
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'venv' || 
            entry.name === '__pycache__' || entry.name === '.git' || entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          collectFiles(fullPath, baseDir);
        } else {
          fileList.push(relativePath);
        }
      }
    } catch (e) {
      // Ignorera fel vid läsning
    }
  }
  
  collectFiles(projectPath);
  const fileListStr = fileList.slice(0, 200).join('\n'); // Begränsa till första 200 filerna
  
  let criticalFilesContent = "";
  
  // Försök läsa main-filer för att förstå hur man startar
  try {
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
      criticalFilesContent += `package.json:\n${fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')}\n\n`;
    }
    if (fs.existsSync(path.join(projectPath, 'docker-compose.yml'))) {
      criticalFilesContent += `docker-compose.yml:\n${fs.readFileSync(path.join(projectPath, 'docker-compose.yml'), 'utf-8')}\n\n`;
    }
    if (fs.existsSync(path.join(projectPath, 'backend', 'main.py'))) {
      criticalFilesContent += `backend/main.py:\n${fs.readFileSync(path.join(projectPath, 'backend', 'main.py'), 'utf-8').substring(0, 2000)}\n\n`;
    }
    if (fs.existsSync(path.join(projectPath, 'backend', 'requirements.txt'))) {
      criticalFilesContent += `backend/requirements.txt:\n${fs.readFileSync(path.join(projectPath, 'backend', 'requirements.txt'), 'utf-8')}\n\n`;
    }
    if (fs.existsSync(path.join(projectPath, '.env.local'))) {
      // Läs .env.local för att se vilka variabler som används
      const envContent = fs.readFileSync(path.join(projectPath, '.env.local'), 'utf-8');
      criticalFilesContent += `.env.local (for reference, create .env.example from this):\n${envContent}\n\n`;
    }
  } catch (e) {
    console.warn("[Documentation] Could not read some critical files:", (e as Error).message);
  }

  const prompt = `
    ROLE: You are the Lead Developer Advocate.

    TASK: Write the definitive README.md and .env.example for this project.

    PROJECT STRUCTURE:
    ${fileListStr}

    CRITICAL CONFIG:
    ${criticalFilesContent}

    TECH STACK: ${techStack}

    REQUIREMENTS:

    1. README.md: Must be idiot-proof. "How to start in 1 command". 
       - If it's hybrid (Python + Next.js), explain how to start both Frontend & Backend.
       - Include a "Troubleshooting" section.
       - Include prerequisites (Node.js version, Python version, etc.)
       - Include screenshots placeholders or descriptions of what the app does.
       - Make it professional and welcoming.

    2. .env.example: Must include EVERY single variable used in the code. No missing keys.
       - Extract all process.env.* and os.getenv() calls from the codebase.
       - Provide sensible defaults or placeholders.
       - Add comments explaining what each variable does.

    OUTPUT FORMAT:
    [FILE: README.md]
    ... content ...
    [GOAL]

    [FILE: .env.example]
    ... content ...
    [GOAL]
  `;

  // Fire-and-forget: Start documentation generation in background
  generateDocsInBackground(prompt, projectPath).catch(err => 
    console.error("❌ Background Docs Failed:", err)
  );
  
  console.log("✅ Documentation job submitted in background (Non-blocking).");
  
  // --- 🚀 "FIRST TRY" START-SKRIPTET ---
  // Generera start-skript för att göra det enkelt att starta appen
  const isHybrid = fs.existsSync(path.join(projectPath, 'backend', 'main.py'));
  const isWindows = process.platform === 'win32';
  
  if (isHybrid) {
    // Hybrid: Generera både PowerShell och Bash-skript
    if (isWindows) {
      const setupScript = `# SETUP & START SCRIPT (Windows PowerShell)
Write-Host "🚀 Starting Frost Night Factory App..." -ForegroundColor Green

# 1. Installera Backend
Write-Host "📦 Setting up Python backend..." -ForegroundColor Cyan
cd backend
if (-Not (Test-Path "venv")) {
    python -m venv venv
}
.\\venv\\Scripts\\activate
pip install -r requirements.txt
cd ..

# 2. Installera Frontend
Write-Host "📦 Setting up Next.js frontend..." -ForegroundColor Cyan
npm install --legacy-peer-deps

# 3. Starta Allt
Write-Host "🚀 Starting both Frontend and Backend..." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Gray

# Starta backend i bakgrunden
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\\venv\\Scripts\\activate; uvicorn main:app --reload --port 8000"

# Starta frontend (blockerar)
npm run dev
`;
      fs.writeFileSync(path.join(projectPath, 'start_app.ps1'), setupScript);
      console.log("[Documentation] ✅ Created start_app.ps1");
    } else {
      // Linux/Mac: Bash-skript
      const setupScript = `#!/bin/bash
# SETUP & START SCRIPT (Linux/Mac)
echo "🚀 Starting Frost Night Factory App..."

# 1. Installera Backend
echo "📦 Setting up Python backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 2. Installera Frontend
echo "📦 Setting up Next.js frontend..."
npm install --legacy-peer-deps

# 3. Starta Allt
echo "🚀 Starting both Frontend and Backend..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Starta backend i bakgrunden
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Starta frontend (blockerar)
npm run dev

# Döda backend när frontend stängs
kill $BACKEND_PID
`;
      fs.writeFileSync(path.join(projectPath, 'start_app.sh'), setupScript);
      // Gör skriptet körbart
      try {
        fs.chmodSync(path.join(projectPath, 'start_app.sh'), '755');
      } catch (e) {
        // Ignorera om chmod misslyckas (Windows)
      }
      console.log("[Documentation] ✅ Created start_app.sh");
    }
  } else {
    // Monolit Next.js: Enklare skript
    if (isWindows) {
      const setupScript = `# SETUP & START SCRIPT (Windows PowerShell)
Write-Host "🚀 Starting Frost Night Factory App..." -ForegroundColor Green

# Installera dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install --legacy-peer-deps

# Starta appen
Write-Host "🚀 Starting Next.js app..." -ForegroundColor Green
Write-Host "App: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Gray

npm run dev
`;
      fs.writeFileSync(path.join(projectPath, 'start_app.ps1'), setupScript);
      console.log("[Documentation] ✅ Created start_app.ps1");
    } else {
      const setupScript = `#!/bin/bash
# SETUP & START SCRIPT (Linux/Mac)
echo "🚀 Starting Frost Night Factory App..."

# Installera dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Starta appen
echo "🚀 Starting Next.js app..."
echo "App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server."

npm run dev
`;
      fs.writeFileSync(path.join(projectPath, 'start_app.sh'), setupScript);
      try {
        fs.chmodSync(path.join(projectPath, 'start_app.sh'), '755');
      } catch (e) {}
      console.log("[Documentation] ✅ Created start_app.sh");
    }
  }
}

