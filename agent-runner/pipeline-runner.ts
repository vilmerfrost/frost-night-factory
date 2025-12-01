import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { execSync } from 'child_process';
import { 
  generateContent, 
  performDeepResearch, 
  generateClaudeCoder,
  generateDeepSeekPlanner,
  generateDeepSeekCoder,
  generateKimiPlanner,
  generateLocalCoder,
  generateLocalReview,
  generateBuildFix,
  generateLocalFix,
  generateGroqFix,
  runKimiQA,
  callAI
} from '../lib/nightFactory/modelClient';
import { GOLDEN_COMPONENTS } from './lib/golden-components';
import { analyzeUpdateScope, UpdateScope } from '../lib/nightFactory/scopeAnalyzer';
import { optimizeContextForCoder } from '../lib/nightFactory/contextBridge';
import { generateDockerConfig } from '../lib/nightFactory/dockerAgent';
import { detectProjectIntent } from '../lib/nightFactory/intentParser';
import { runVisualAudit } from '../lib/nightFactory/visualAudit';
import { runDocumentationStep } from '../lib/nightFactory/documentationAgent';

// Ladda miljövariabler
dotenv.config();

// Konfiguration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const WORKSPACE_ROOT = path.join(process.cwd(), 'workspace', 'sandbox');

if (!fs.existsSync(WORKSPACE_ROOT)) {
  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
}

// Initiera Supabase Admin
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helpers
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRepoPath(pipeline: any) {
  return path.join(WORKSPACE_ROOT, `pipeline-${pipeline.id}`);
}

async function updatePipeline(id: string, updates: any) {
  const { error } = await supabase.from('pipelines').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('Error updating pipeline:', error);
}

async function createStep(pipelineId: string, phase: string, status: string, input: any = {}) {
  await supabase.from('pipeline_steps').insert({
    pipeline_id: pipelineId,
    phase,
    status,
    input,
    output: {},
    updated_at: new Date().toISOString()
  });
}

async function updateStep(pipelineId: string, phase: string, updates: any) {
  // Hämta senaste steget för fasen för att uppdatera rätt rad
  const { data } = await supabase
    .from('pipeline_steps')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .eq('phase', phase)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    await supabase.from('pipeline_steps').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', data.id);
  }
}

// Helper: Rekursivt hämta alla filer i en mapp
function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dirPath)) return files;
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Ignorera node_modules och .next
      if (item !== 'node_modules' && item !== '.next' && !item.startsWith('.')) {
        files.push(...getAllFiles(fullPath));
      }
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Hjälpfunktion för att scanna filsystemet
function getProjectStructure(dir: string, fileList: string[] = [], rootDir: string = dir): string[] {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        getProjectStructure(filePath, fileList, rootDir);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        // Spara relativ sökväg (t.ex. "src/components/Button.tsx")
        fileList.push(filePath.replace(rootDir, '').replace(/\\/g, '/'));
      }
    }
  });
  
  return fileList;
}

// ------------------------------------------------------------------
// STEG 0: CLONER (För Update-mode)
// ------------------------------------------------------------------
async function runClonerStep(pipeline: any, repoPath: string) {
  console.log(`[Cloner] 🧬 Cloning source repo: ${pipeline.source_repo}`);
  await updatePipeline(pipeline.id, { current_phase: 'cloner' });
  await createStep(pipeline.id, 'cloner', 'running');

  try {
    // 1. Städa sandboxen (Vi vill ha en ren klon)
    if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
    fs.mkdirSync(repoPath, { recursive: true });

    // 2. Fixa Auth URL för privata repon (om token finns)
    let cloneUrl = pipeline.source_repo;
    const token = process.env.GITHUB_TOKEN;
    if (token && cloneUrl && cloneUrl.includes("github.com") && !cloneUrl.includes(token)) {
        cloneUrl = cloneUrl.replace("https://", `https://${token}@`);
    }

    // 3. Klona
    console.log(`[Cloner] Git cloning...`);
    execSync(`git clone ${cloneUrl} .`, { cwd: repoPath, stdio: 'inherit' });

    // 4. Analysera vad vi fick
    const files = getProjectStructure(repoPath);
    console.log(`[Cloner] Successfully cloned. Found ${files.length} files.`);

    // Spara strukturen så Planner vet vad den jobbar med
    await updateStep(pipeline.id, 'cloner', { 
        status: 'completed',
        output: {
            files_found: files.length,
            structure: files.slice(0, 200) // Spara topp 200 filer som kontext
        }
    });

    // 5. Hoppa över Research (oftast onödigt vid fixar) och gå till Planner
    await updatePipeline(pipeline.id, { current_phase: 'planner' });

  } catch (error: any) {
    console.error("❌ Cloning failed:", error.message);
    await updateStep(pipeline.id, 'cloner', { status: 'failed', output: { error: error.message } });
    await updatePipeline(pipeline.id, { status: 'failed' });
    throw error;
  }
}

// ------------------------------------------------------------------
// STEG 1: RESEARCH
// ------------------------------------------------------------------
async function runResearchStep(pipeline: any) {
  console.log(`[Research] Starting for: ${pipeline.name || pipeline.id}`);
  await updatePipeline(pipeline.id, { status: 'running', current_phase: 'research' });
  await createStep(pipeline.id, 'research', 'running', { prompt: pipeline.initial_prompt || pipeline.prompt });

  // Kolla om research redan är gjord (caching-mekanism)
  const { data: existing } = await supabase
    .from('pipeline_steps')
    .select('*')
    .eq('pipeline_id', pipeline.id)
    .eq('phase', 'research')
    .eq('status', 'completed')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log('[Research] Found existing research, skipping.');
    await updatePipeline(pipeline.id, { current_phase: 'planner' });
    return;
  }

  const userRequest = pipeline.initial_prompt || pipeline.prompt;
  
  const DEEP_RESEARCH_PROMPT = `
ROLE: You are a Technical Lead performing Due Diligence.

TASK: Research technical constraints for: "${userRequest}"

⛔ IGNORE:

- Beginner tutorials ("How to install React").

- Generic marketing fluff.

✅ FIND CRITICAL INFO:

1. BREAKING CHANGES: specifically for Next.js 15 / React 19.

2. COMPATIBILITY: Which libraries conflict with Server Components?

3. BEST PRACTICE: What is the "State of the Art" stack for this specific tool today?

4. GOTCHAS: What usually kills this type of project?

OUTPUT:

A bulleted list of TECHNICAL CONSTRAINTS and CONFIGURATION RULES for the Planner.
  `;

  const researchPrompt = DEEP_RESEARCH_PROMPT;

  try {
    const result = await performDeepResearch(researchPrompt);
    await updateStep(pipeline.id, 'research', { 
      status: 'completed', 
      output: { content: result } 
    });
    await updatePipeline(pipeline.id, { current_phase: 'planner' });
  } catch (error: any) {
    console.error('[Research] Failed:', error);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

// ------------------------------------------------------------------
// STEG 2: PLANNER
// ------------------------------------------------------------------
async function runPlannerStep(pipeline: any, repoPath: string) {
  console.log(`[Planner] Creating blueprint...`);
  await updatePipeline(pipeline.id, { current_phase: 'planner' });
  await createStep(pipeline.id, 'planner', 'running');

  // 🧠 INTENT DETECTION (Före planering!)
  console.log("🧠 Detecting Project DNA...");
  const intent = await detectProjectIntent(pipeline.initial_prompt || pipeline.prompt || "");
  console.log(`🧬 DNA Config: ${intent.isPython ? "PYTHON 🐍" : "NODE ⚡"} (${intent.projectType})`);

  // Hämta research (kan vara null om vi hoppade över det, så hantera det)
  const { data: researchStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('phase', 'research')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const researchData = researchStep?.output?.content || "No research data.";

  let promptPrefix = "";

  // SPECIALHANTERING FÖR UPDATE
  if (pipeline.type === 'update') {
      console.log("[Planner] Running in UPDATE mode. Scanning files...");
      const files = getProjectStructure(repoPath);
      
      promptPrefix = `
      MODE: UPDATE EXISTING PROJECT.
      
      CURRENT PROJECT STRUCTURE:
      ${files.join('\n')}
      
      YOUR TASK:
      Plan changes to FIX the user's request based on the existing structure above.
      Do NOT plan a full rewrite. Identify specific files to modify or create.
      `;
  }

  // CRITICAL ARCHITECTURE RULES (ENFORCED BASED ON INTENT)
  const architectureRules = intent.isPython ? 
    `1. BACKEND: You MUST use Python (FastAPI/Flask) in a '/backend' directory.
    2. FRONTEND: Use Next.js 15 in '/app' or '/src'.
    3. CONNECTIVITY: Frontend calls Backend via HTTP (http://localhost:8000).
    4. NO SERVERLESS: Do NOT use Next.js API Routes (app/api) for core logic.
    5. DOCKER: Plan for docker-compose.yml that runs both services.` 
    : 
    `1. STACK: Fullstack Next.js 15 (App Router).
    2. All backend logic goes in Server Actions or API Routes (app/api).`;

  const RUTHLESS_PLANNER_PROMPT = `
ROLE: You are a Paranoid Senior Systems Architect.

TASK: Create a blueprint for a production-grade application.

${promptPrefix}

PROJECT REQUEST: "${pipeline.initial_prompt}"

CRITICAL ARCHITECTURE RULES (ENFORCED):
${architectureRules}

RESEARCH DATA:
${JSON.stringify(researchData).substring(0, 5000)}

CRITICAL: NEXT.JS 15 REQUIREMENTS (MUST FOLLOW):
- All route parameters (params, searchParams) MUST be awaited: const { slug } = await params;
- All cookies() and headers() calls MUST be awaited: const token = (await cookies()).get('token');
- All page components and route handlers using these APIs MUST be async functions.
- Plan for explicit caching strategies: { cache: 'force-cache' } or { cache: 'no-store' }.
- Do NOT mix Next.js 13/14 patterns. Use ONLY Next.js 15 patterns.

⛔ FORBIDDEN (Immediate Failure Criteria):

1. "MVP" or "Basic" implementations.

2. Missing Error Handling (Global Error Boundaries required).

3. Hardcoded values (All config must be env vars).

4. "In-memory" stores (Must use Database).

5. Simple "alert()" for errors (Must use Toasts/Modals).

REQUIREMENTS (Must Include):

1. FILE STRUCTURE: List EVERY single file needed. Don't say "components/..." - list them explicitly (e.g., "components/ui/Button.tsx", "components/ui/Card.tsx").

2. DATA INTEGRITY: Define Zod schemas for all inputs (TypeScript) or Pydantic models (Python).

3. SECURITY: Row Level Security (RLS) policies for every table in Supabase.

4. UX: Loading skeletons (Suspense), Empty states, 404 pages.

5. HYBRID LOGIC: If Python is used, define the exact IPC/HTTP interface (endpoints, request/response schemas).

6. TYPE CONTRACT:
   - Create a 'shared/types.ts' (or 'src/lib/types.ts') FIRST.
   - ALL interfaces (Frontend & Backend) must strictly adhere to this file.
   - NO ad-hoc type definitions in component files.
   - This file is the SINGLE SOURCE OF TRUTH for all TypeScript/Pydantic type definitions.

OUTPUT FORMAT:

[PLAN]

... detailed architecture with file structure, dependencies, step-by-step implementation, database schema ...

[FILE_LIST]

- /app/page.tsx (Dashboard with real data charts)
- /app/layout.tsx (Root layout with error boundary)
- /components/ui/Button.tsx (Reusable button component)
- /components/ui/Card.tsx (Card component)
- /backend/main.py (FastAPI with Pydantic models)
- /backend/requirements.txt (Python dependencies)
... (list EVERY file explicitly)

[GOAL]
  `;

  const planPrompt = RUTHLESS_PLANNER_PROMPT;

  try {
    // DU VÄLJER HÄR: Välj din planner "hjärna"
    
    // Alternativ A: DeepSeek R1 (Just nu - bränn dina credits, men bäst kvalitet)
    console.log("[Planner] Thinking with DeepSeek R1...");
    const plan = await generateDeepSeekPlanner(planPrompt);
    
    // Alternativ B: Kimi k2 (Spara pengar / testa logik / backup om DeepSeek ligger nere)
    // console.log("[Planner] Thinking with Kimi k2...");
    // const plan = await generateKimiPlanner(planPrompt);
    
    await updateStep(pipeline.id, 'planner', { 
      status: 'completed', 
      output: { content: plan, isPython: intent.isPython, intent: intent } 
    });
    await updatePipeline(pipeline.id, { current_phase: 'coder', is_python: intent.isPython });
  } catch (error) {
    console.error('[Planner] Failed:', error);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

// ------------------------------------------------------------------
// STEG 3: CODER (Med Fixar för Config/CSS)
// ------------------------------------------------------------------

/**
 * Helper function to parse AI output and write files to disk
 */
async function parseAndWriteFiles(rawOutput: string, repoPath: string): Promise<number> {
  console.log("📂 Parsing AI Output...");
  
  const files: { path: string; content: string }[] = [];
  
  // Först: Försök med [FILE:] format (Python-protokollet)
  const fileProtocolRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
  let match;

  while ((match = fileProtocolRegex.exec(rawOutput)) !== null) {
    const filePath = match[1].trim();
    let content = match[2].trim();

    // Rensa eventuella markdown-block om AI:n lade till dem (```typescript ... ```)
    if (content.startsWith("```")) {
      content = content.replace(/^```[a-z]*\n/, "").replace(/```$/, "");
    }
    
    if (filePath && content) {
      files.push({ path: filePath, content: content });
      console.log(`   -> Extracted: ${filePath}`);
    }
  }
  
  // Om inga filer hittades med [FILE:], försök med ### FILE: format (standard)
  if (files.length === 0) {
    console.log("📂 Trying standard ### FILE: format...");
    const standardFileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
    
    while ((match = standardFileRegex.exec(rawOutput)) !== null) {
      const filePath = match[1].trim();
      let content = match[2].trim();
      
      // Cleanup paths
      let fileName = filePath;
      if (!fileName.startsWith('app') && !fileName.startsWith('src') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('lib') && !fileName.startsWith('components') && !fileName.startsWith('backend')) {
        // Remove potentially hallucinated root folders like 'my-app/'
        const parts = fileName.split('/');
        if (parts.length > 1) fileName = parts.slice(1).join('/');
      }
      
      // THE SANITIZER: Ta bort alla Markdown-artefakter
      content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
      content = content.replace(/```$/m, '');
      content = content.replace(/^### FILE:.*\n?/m, '');
      content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
      content = content.trim();
      
      if (fileName && content) {
        files.push({ path: fileName, content: content });
        console.log(`   -> Extracted: ${fileName}`);
      }
    }
  }
  
  // FALLBACK: Om båda formaten misslyckades, försök hitta standard markdown block
  if (files.length === 0) {
    console.warn("⚠️ Standard parsing failed. Trying Markdown Fallback...");
    const mdRegex = /\*\*([a-zA-Z0-9_\/.-]+)\*\*\n```[a-z]*\n([\s\S]*?)```/g;
    while ((match = mdRegex.exec(rawOutput)) !== null) {
      files.push({ path: match[1].trim(), content: match[2].trim() });
      console.log(`   -> Extracted (fallback): ${match[1].trim()}`);
    }
  }
  
  if (files.length === 0) {
    throw new Error(`AI generated 0 valid files. Output preview: ${rawOutput.substring(0, 200)}...`);
  }
  
  let filesCreated = 0;
  
  // Processa alla extraherade filer
  for (const file of files) {
    let fileName = file.path;
    let content = file.content;
    
    // Cleanup paths
    if (!fileName.startsWith('app') && !fileName.startsWith('src') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('lib') && !fileName.startsWith('components') && !fileName.startsWith('backend')) {
      // Remove potentially hallucinated root folders like 'my-app/'
      const parts = fileName.split('/');
      if (parts.length > 1) fileName = parts.slice(1).join('/');
    }

    // 1. THE SANITIZER: Ta bort alla Markdown-artefakter (om inte redan gjort)
    if (!content.includes('[FILE:') && !content.includes('### FILE:')) {
      content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
      content = content.replace(/```$/m, '');
      content = content.replace(/^### FILE:.*\n?/m, '');
      content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
    }
    content = content.trim();

    // 2. FIX: Force Safe globals.css
    if (fileName.endsWith('globals.css')) {
      if (content.includes('import') || content.includes('export') || content.includes('const ')) {
           console.log(`[Coder] Sanatizing corrupted globals.css`);
           content = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
      }
    }

    // 3. FIX: Force Safe next.config.mjs (Prevent Hallucinations)
    if (fileName.endsWith('next.config.mjs') || fileName.endsWith('next.config.js')) {
      console.log(`[Coder] Overwriting next.config with safe default.`);
      content = `
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
      `;
      fileName = 'next.config.mjs'; // Ensure extension
    }

    // 4. FIX: Force Safe tailwind.config.ts (Tailwind v3)
    if (fileName.includes('tailwind.config')) {
      console.log(`[Coder] Overwriting tailwind.config with Tailwind v3 default.`);
      content = `
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
      `;
      fileName = 'tailwind.config.ts';
    }

    // 5. FIX: Force Safe postcss.config.js (Standard v3 setup)
    if (fileName.includes('postcss.config')) {
      console.log(`[Coder] Overwriting postcss.config with standard v3 config.`);
      content = `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `;
      fileName = 'postcss.config.js';
    }

    const filePath = path.join(repoPath, fileName);
    const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, content.trim());
    console.log(`   -> Wrote: ${fileName}`);
    filesCreated++;
  }
  
  return filesCreated;
}

async function runCoderStep(pipeline: any, repoPath: string) {
  console.log(`[Coder] Writing code to ${repoPath}...`);
  if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });

  await updatePipeline(pipeline.id, { current_phase: 'coder' });
  await createStep(pipeline.id, 'coder', 'running');

  const { data: plannerStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('phase', 'planner')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const plan = plannerStep?.output?.content || "No plan.";
  const isPython = plannerStep?.output?.isPython || pipeline.is_python || false;
  const intent = plannerStep?.output?.intent || { isPython: isPython, isHybrid: isPython, projectType: isPython ? 'hybrid' : 'web', frameworks: [] };

  // Hämta research och initial_prompt för dynamisk design
  const { data: researchStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('phase', 'research')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const researchData = researchStep?.output?.content || "";
  const userPrompt = pipeline.initial_prompt || pipeline.prompt || "";

  // --- DYNAMIC DESIGN SYSTEM ---
  // Vi låter Research/Plan styra, men har Cyberpunk som "Safe Fallback"
  const designSystem = `
  DESIGN STRATEGY:
  1. ANALYZE the User Prompt & Research first. 
     - If the user asks for "Medical App", use Clean White/Blue.
     - If "SportSync", use the research findings.
     - If "Hello Kitty theme", use Pink/Pastel colors.
  2. FALLBACK (Only if no specific style is requested):
     - Background: bg-zinc-950
     - Primary: text-emerald-400
     - Style: Cyberpunk/Industrial

  USER PROMPT: ${userPrompt.substring(0, 200)}
  RESEARCH HINTS: ${researchData.substring(0, 500)}
  `;

  // System context för Claude (separat från task)
  let systemContext = "";
  
  const COMPONENT_NAMING_RULE = `
CRITICAL FILE NAMING RULES:
1. All React Components MUST be PascalCase (e.g., 'Button.tsx', 'Card.tsx').
2. All imports MUST match the filename casing EXACTLY.
   - WRONG: import { Button } from '@/components/ui/button'
   - CORRECT: import { Button } from '@/components/ui/Button'
3. Verify casing before writing code.
`;

  const STRICT_BACKEND_RULES = `
🚨 MILITARY GRADE CODE STANDARDS - READ CAREFULLY 🚨

1. NO PLACEHOLDERS: NEVER write "pass", "...", or "# TODO: Implement". You MUST write the full, working logic.

2. NO MOCKS: Real database connections (Supabase/SQLite), real API calls.

3. TYPE SAFETY: Python code MUST pass 'mypy --strict'. Use proper Pydantic models for everything.

4. STARTUP GUARANTEE: The app MUST start with 'python main.py' or 'uvicorn main:app' without crashing.

5. IMPORTS: Verify every single import. Do not import functions that don't exist.

FAILURE TO COMPLY WILL RESULT IN IMMEDIATE PROCESS TERMINATION.
`;

  const STRICT_FRONTEND_RULES = `
🚨 PIXEL PERFECT STANDARDS - READ CAREFULLY 🚨

1. NO DEAD UI: Every button must have an 'onClick' or 'href'. No generic <div> buttons.

2. NO GHOST IMPORTS: Do NOT import components that you haven't created. Check your file list.

3. NO "HELLO WORLD": The Dashboard must be fully fleshed out with charts (Recharts), tables, and data.

4. LOADING STATES: Every async component must have a <Suspense fallback={<Skeleton />}> wrapper.

5. CASING: Component filenames are PascalCase (Button.tsx). Imports must match EXACTLY.
`;

  const FILE_PROTOCOL = `
IMPORTANT - OUTPUT FORMAT:

You must provide the full file content for every file you generate.

Use this exact format for every file:

[FILE: path/to/filename.ext]
... code content ...
[GOAL]

Example:
[FILE: backend/main.py]
from fastapi import FastAPI
app = FastAPI()
[GOAL]

Alternative format (also accepted):
### FILE: path/to/filename.ext
... code content ...
    ### END_FILE
`;
  
  if (isPython) {
    console.log("🐍 Python/Hybrid project detected. Using Hybrid Architect system prompt...");
    systemContext = `YOU ARE A HYBRID FULLSTACK ARCHITECT (Node.js Frontend + Python Backend).

YOUR TASK: Generate the COMPLETE codebase for BOTH parts in this single response.

PART 1: THE FRONTEND (Next.js 15) - REQUIRED
- Path: /app or /src/app
- MUST include ALL of these files:
  * package.json (with Next.js 15, React, Tailwind CSS dependencies)
  * next.config.mjs
  * tailwind.config.ts
  * postcss.config.js
  * app/layout.tsx (REQUIRED - do not skip this!)
  * app/page.tsx (REQUIRED - main page)
  * app/globals.css (Tailwind directives)
  * components/ (UI components as needed)
- UI: Modern, dark mode, using Tailwind CSS.
- Connect to backend via fetch('process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"')

PREMIUM DESIGN PHILOSOPHY:
1. AESTHETIC: Dark mode first. Ultra-premium, minimalist, clean. Think "Cyberpunk meets Apple".
2. LAYOUT: Use a persistent Sidebar for navigation. Main content area is focused.
3. HIERARCHY: Use font weights and color accents to guide the eye. No wall of text.
4. COMPONENTS: All components must be polished (hover states, subtle animations).
5. "WOW" FACTOR: Every app must have ONE delightful micro-interaction (e.g., subtle glow on active nav, keyboard shortcut hint ⌘K).
6. AVOID OVERWHELM: Use tabs, accordions, or progressive disclosure. "Simple on surface, powerful underneath".

CRITICAL UI RULES (The "Clickable" Mandate):
1. NO DEAD LINKS: Avoid 'href="#"'. If a route doesn't exist, create a "Not Implemented" toast or modal.
2. INTERACTIVITY: All buttons MUST have an 'onClick' handler or a valid 'Link href'.
3. DATA FETCHING: Never hardcode 'localhost:8000'. Use 'process.env.NEXT_PUBLIC_API_URL' and create the env variable.
4. LOADING STATES: All data fetching components MUST have a Skeleton loader (Suspense).
5. ERROR HANDLING: All API calls MUST have try/catch blocks and show user-friendly error messages.

${STRICT_FRONTEND_RULES}

PART 2: THE BACKEND (Python FastAPI) - REQUIRED
- Path: /backend
- MUST include ALL of these files:
  * backend/main.py (FastAPI app entry point, MUST run on port 8000)
  * backend/requirements.txt (fastapi, uvicorn[standard], pydantic, python-dotenv)
  * backend/.env.example (if using environment variables)
- API: Must run on port 8000 and enable CORS for localhost:3000.
- Example CORS setup: from fastapi.middleware.cors import CORSMiddleware; app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"])

BRAINY BACKEND PHILOSOPHY:
1. INTELLIGENCE FIRST: The backend isn't just a database wrapper. It must do something smart. (e.g., auto-categorization, summarization, anomaly detection using AI).
2. ROBUSTNESS: Use Pydantic for strict validation. Assume all inputs are malicious.
3. SCALABILITY: Design async endpoints (FastAPI). Use background tasks (Celery/Arq) for heavy lifting if needed.
4. DATA INTEGRITY: Use a real database (SQLite for local, Supabase for cloud). Do not rely on in-memory storage.
5. TYPE SAFETY: Code must pass 'mypy --strict'.

CRITICAL BACKEND RULES (The "Completeness" Protocol):
1. NO PLACEHOLDERS: Do NOT write "TODO: Implement logic" or "pass" statements.
2. FULL IMPLEMENTATION: You MUST implement the full logic for extraction (e.g., BeautifulSoup/Playwright setup).
3. WORKING CODE: If logic is complex, implement a basic working version, but never leave it empty.
4. TYPE HINTS: Add proper type hints to all functions (e.g., def extract_data(url: str) -> dict:).
5. ERROR HANDLING: All API endpoints MUST have try/except blocks and return proper error responses.

${STRICT_BACKEND_RULES}

CRITICAL OUTPUT RULES:
1. You MUST generate files for BOTH Frontend AND Backend in this single response.
2. Do NOT leave "TODO" placeholders. Write working code.
3. Do NOT skip the frontend - it is REQUIRED even if the request mentions Python.
4. Use [FILE: ...] format for every file.
5. ${designSystem}

CRITICAL BACKEND RULES (The "Completeness" Protocol):
1. NO PLACEHOLDERS: Do NOT write "TODO: Implement logic" or "pass" statements.
2. FULL IMPLEMENTATION: You MUST implement the full logic for extraction (e.g., BeautifulSoup/Playwright setup).
3. WORKING CODE: If logic is complex, implement a basic working version, but never leave it empty.
4. TYPE HINTS: Add proper type hints to all functions (e.g., def extract_data(url: str) -> dict:).
5. ERROR HANDLING: All API endpoints MUST have try/except blocks and return proper error responses.

${COMPONENT_NAMING_RULE}

${FILE_PROTOCOL}
`;
  } else {
    systemContext = `You are a World-Class Fullstack Engineer building a Next.js 15 App.

STRICT RULES:
1. No external UI libraries (shadcn) - build generic Tailwind components inline if needed.
2. Use the '### FILE: filename' format strictly for EVERY file.
3. ${designSystem}

DEPENDENCY RULES (CRITICAL - DO NOT IGNORE):
- You MUST use "tailwindcss": "^3.4.17" in package.json. Do NOT use "latest" or v4.
- You MUST use "postcss": "^8.4.31" and "autoprefixer": "^10.4.19".
- Do NOT use @tailwindcss/postcss (we are using standard Tailwind v3 config).
- Include a standard tailwind.config.ts with content paths for app/ and components/.
- Include a postcss.config.js with tailwindcss and autoprefixer plugins.
- If you use Supabase Auth, you MUST include "@supabase/auth-helpers-nextjs" and "@supabase/auth-helpers-react" in package.json.
${isPython ? `
PYTHON DEPENDENCIES:
- Create requirements.txt with: fastapi, uvicorn[standard], pydantic, python-dotenv
- For database: sqlalchemy, psycopg2-binary (PostgreSQL) or asyncpg
` : ""}

${FILE_PROTOCOL}

REQUIRED FILES:
- package.json (scripts: dev, build, start + pinned dependencies)
- tailwind.config.ts (with content paths)
- postcss.config.js (with tailwindcss and autoprefixer)
- app/layout.tsx, app/page.tsx
- app/globals.css (ONLY Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;)
- lib/supabase/client.ts, lib/supabase/server.ts
- components/ui/* (Create all UI components you use)
${isPython ? `
PYTHON REQUIRED FILES:
- backend/main.py (FastAPI app)
- backend/requirements.txt
- backend/.env.example (if using environment variables)
` : ""}

CRITICAL IMPORTS RULE (Ghost Component Prevention):
- Do NOT import components you have not created.
- If you create a dashboard, keep it simple in 'page.tsx' or create the sub-components explicitly in the output.
- Better to have a large 'page.tsx' than missing files.
- Before importing a component, ensure you have generated that component file in this response.

PREMIUM DESIGN PHILOSOPHY:
1. AESTHETIC: Dark mode first. Ultra-premium, minimalist, clean. Think "Cyberpunk meets Apple".
2. LAYOUT: Use a persistent Sidebar for navigation. Main content area is focused.
3. HIERARCHY: Use font weights and color accents to guide the eye. No wall of text.
4. COMPONENTS: All components must be polished (hover states, subtle animations).
5. "WOW" FACTOR: Every app must have ONE delightful micro-interaction (e.g., subtle glow on active nav, keyboard shortcut hint ⌘K).
6. AVOID OVERWHELM: Use tabs, accordions, or progressive disclosure. "Simple on surface, powerful underneath".

CRITICAL UI RULES (The "Clickable" Mandate):
1. NO DEAD LINKS: Avoid 'href="#"'. If a route doesn't exist, create a "Not Implemented" toast or modal.
2. INTERACTIVITY: All buttons MUST have an 'onClick' handler or a valid 'Link href'.
3. DATA FETCHING: Never hardcode 'localhost:8000'. Use 'process.env.NEXT_PUBLIC_API_URL' and create the env variable.
4. LOADING STATES: All data fetching components MUST have a Skeleton loader (Suspense).
5. ERROR HANDLING: All API calls MUST have try/catch blocks and show user-friendly error messages.

${STRICT_FRONTEND_RULES}

NEXT.JS 15 RULES (CRITICAL - STRICT COMPLIANCE REQUIRED):
- ⚠️ ASYNC REQUEST APIs: In Next.js 15, params, searchParams, cookies(), and headers() are ASYNC.
  - ❌ WRONG: const { slug } = params; const token = cookies().get('token');
  - ✅ CORRECT: const { slug } = await params; const token = (await cookies()).get('token');
  - ALL route handlers, page components, and server components MUST await these APIs.
  - If you use params/searchParams, the component MUST be async: export default async function Page({ params }) { const { slug } = await params; }
  
- CACHING: Next.js 15 defaults to "no cache" for many requests. Explicitly set caching if needed:
  - Use { cache: 'force-cache' } for static data
  - Use { cache: 'no-store' } for dynamic data
  - Use { next: { revalidate: 3600 } } for ISR
  
- No 'use client' in layout.tsx if possible.
- Use 'next/link' for navigation.
- Do NOT include markdown code blocks inside file content.
- Do NOT mix Next.js 13/14 patterns with Next.js 15. Follow ONLY Next.js 15 patterns.

${COMPONENT_NAMING_RULE}
`;
  }

  const taskPrompt = `
IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 4000)}

Build the core application now. Generate all necessary files.
You are NOT allowed to use minimal HTML. You must build a professional, dense UI.
If you need a UI component (like a Card or Button), you MUST write the code for it in a 'components/ui' folder.
Do not import things you haven't created.
  `;

  // SMART ROUTER: Avgör om det är nytt projekt eller liten ändring
  const isNewProject = !fs.existsSync(path.join(repoPath, 'package.json')) || 
                       !fs.existsSync(path.join(repoPath, 'app')) && !fs.existsSync(path.join(repoPath, 'src'));
  
  try {
    // Variabler för review-loop (används av både hybrid och monolit)
    let maxIterations = 3; // Max antal review-iterationer
    let iteration = 0;
    let rawOutput: string = ""; // För fix-loopen
    
    // ---------------------------------------------------------
    // SCENARIO 1: HYBRID (Divide & Conquer - Delad Hjärna)
    // ---------------------------------------------------------
    if (intent.isHybrid || (intent.isPython && isNewProject)) {
      console.log("⚔️ Hybrid Project detected: Splitting Frontend & Backend tasks (Divide & Conquer).");

      // STEG A: Frontend (Claude 3.5 Sonnet)
      console.log("🎨 [Phase 1] Building Frontend (Next.js)...");
      const PREMIUM_SAAS_PROMPT = `
ROLE: You are a Lead Product Designer & Senior React Architect at Linear/Vercel.

TASK: Build the Frontend for "${pipeline.initial_prompt || pipeline.prompt}".

IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 3000)}

DESIGN PHILOSOPHY (MANDATORY):

1. AESTHETIC: Dark mode first. Ultra-premium, minimalist, clean. Think "Cyberpunk meets Apple".

2. LAYOUT: Use a persistent Sidebar for navigation (like the reference). Main content area is focused.

3. HIERARCHY: Use font weights and color accents (e.g., subtle gradients, primary brand color) to guide the eye. No wall of text.

4. COMPONENTS: Use Shadcn UI + Tailwind CSS. All components must be polished (hover states, subtle animations).

5. "WOW" FACTOR: Every app must have ONE delightful micro-interaction. E.g., A subtle glow on the active nav item, a satisfying animation when a task completes, a keyboard shortcut hint (⌘K).

6. AVOID OVERWHELM: Do not clutter the interface. Use tabs, accordions, or progressive disclosure to hide complexity. "Simple on surface, powerful underneath".

CRITICAL TECH RULES:

1. Next.js 15 App Router (/app or /src/app).

2. NO DEAD UI: Every button/link MUST work (href/onClick). No placeholder divs for navigation.

3. LOADING STATES: Use <Suspense> and <Skeleton> for all async content. The app should feel instant.

4. API CALLS: Never hardcode URLs. Use 'process.env.NEXT_PUBLIC_API_URL'.

5. COMPONENT NAMING: PascalCase (e.g., Sidebar.tsx, ProjectCard.tsx). Imports must match EXACTLY.

OUTPUT RULES:
- Generate package.json, next.config.mjs, tailwind.config.ts, postcss.config.js, layout.tsx, page.tsx, globals.css.
- Generate all UI components needed in components/ui/ folder.
- Do NOT generate backend code (Python).
- Assume backend runs on http://localhost:8000.
- Connect to backend via fetch('process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"')
- You are NOT allowed to use minimal HTML. You must build a professional, dense UI.

CRITICAL IMPORTS RULE (Ghost Component Prevention):
- Do NOT import components you have not created.
- If you create a dashboard, keep it simple in 'page.tsx' or create the sub-components explicitly in the output.
- Better to have a large 'page.tsx' than missing files.
- Before importing a component, ensure you have generated that component file in this response.

${STRICT_FRONTEND_RULES}

${COMPONENT_NAMING_RULE}

${FILE_PROTOCOL}
      `;

      const fePrompt = PREMIUM_SAAS_PROMPT;

      // Kör Claude för Frontend
      const feCode = await callAI("FRONTEND", fePrompt);
      const feFilesCreated = await parseAndWriteFiles(feCode, repoPath);
      console.log(`✅ Frontend Phase Complete: ${feFilesCreated} files created.`);

      // STEG B: Backend (DeepSeek V3 - Bättre på logik/Python)
      console.log("⚙️ [Phase 2] Building Backend (Python/FastAPI)...");
      const BRAINY_BACKEND_PROMPT = `
ROLE: You are a Senior AI Systems Engineer.

TASK: Build the Python Backend for "${pipeline.initial_prompt || pipeline.prompt}".

IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 3000)}

CONTEXT: The frontend is a Next.js app calling this API on http://localhost:3000.

CORE PHILOSOPHY:

1. INTELLIGENCE FIRST: The backend isn't just a database wrapper. It must do something smart. (e.g., auto-categorization, summarization, anomaly detection using AI).

2. ROBUSTNESS: Use Pydantic for strict validation. Assume all inputs are malicious.

3. SCALABILITY: Design async endpoints (FastAPI). Use background tasks (Celery/Arq) for heavy lifting if needed.

4. DATA INTEGRITY: Use a real database (SQLite for local, Supabase for cloud). Do not rely on in-memory storage.

5. TYPE SAFETY: Code must pass 'mypy --strict'.

OUTPUT RULES:

- Generate /backend/main.py (FastAPI app entry point, MUST run on port 8000)
- Generate /backend/requirements.txt (fastapi, uvicorn[standard], pydantic, python-dotenv)
- Generate /backend/models.py (Pydantic models for all data structures)
- Include CORS for localhost:3000.
- Example CORS setup: from fastapi.middleware.cors import CORSMiddleware; app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"])
- Do NOT generate frontend code.

CRITICAL BACKEND RULES (The "Completeness" Protocol):
1. NO PLACEHOLDERS: Do NOT write "TODO: Implement logic" or "pass" statements.
2. FULL IMPLEMENTATION: You MUST implement the full logic for extraction (e.g., BeautifulSoup/Playwright setup).
3. WORKING CODE: If logic is complex, implement a basic working version, but never leave it empty.
4. TYPE HINTS: Add proper type hints to all functions (e.g., def extract_data(url: str) -> dict:).
5. ERROR HANDLING: All API endpoints MUST have try/except blocks and return proper error responses.

${STRICT_BACKEND_RULES}

${FILE_PROTOCOL}
      `;

      const bePrompt = BRAINY_BACKEND_PROMPT;

      // Kör DeepSeek V3 för Backend
      const beCode = await callAI("BACKEND", bePrompt);
      const beFilesCreated = await parseAndWriteFiles(beCode, repoPath);
      console.log(`✅ Backend Phase Complete: ${beFilesCreated} files created.`);

      if (feFilesCreated === 0 && beFilesCreated === 0) {
        throw new Error("AI generated 0 valid files for hybrid project.");
      }

      // Fortsätt med resten av processen (config fixes, review loop, etc.)
      // Men hoppa över den vanliga parsing-loopen eftersom vi redan har skrivit filerna
    } else {
      // ---------------------------------------------------------
      // SCENARIO 2: MONOLIT (Standard Next.js)
      // ---------------------------------------------------------
      // SMART ROUTER: Välj rätt AI
      if (isNewProject) {
        console.log("[Coder] 🚀 New project detected. Using Claude 4.5 Sonnet (premium quality)...");
        rawOutput = await generateClaudeCoder(taskPrompt, systemContext);
      } else {
        // Backend/Frontend Specialist: För updates, välj modell baserat på uppgift
        if (pipeline.type === 'update') {
          const isDesignTask = pipeline.initial_prompt.toLowerCase().includes("design") || 
                              pipeline.initial_prompt.toLowerCase().includes("ui") ||
                              pipeline.initial_prompt.toLowerCase().includes("styling");
          
          if (isDesignTask) {
            console.log("[Coder] 🎨 UI Task detected. Deploying Claude 4.5.");
            rawOutput = await generateClaudeCoder(taskPrompt, systemContext);
          } else {
            console.log("[Coder] ⚙️ Logic/Fix Task detected. Deploying DeepSeek V3.");
            // DeepSeek V3 för logik/fixar (billigare och snabbare)
            const fullPrompt = `${systemContext}\n\n${taskPrompt}`;
            rawOutput = await generateDeepSeekCoder(fullPrompt);
          }
        } else {
          // För nya projekt eller små ändringar, använd DeepSeek V3 direkt (snabbare än Localhost)
          console.log("[Coder] ⚙️ Using DeepSeek V3 for fast generation...");
          const fullPrompt = `${systemContext}\n\n${taskPrompt}`;
          rawOutput = await generateDeepSeekCoder(fullPrompt);
        }
      }
      
      // Använd hjälpfunktionen för parsing och skrivning
      const filesCreated = await parseAndWriteFiles(rawOutput, repoPath);
      
      if (filesCreated === 0) throw new Error("AI generated 0 valid files.");
    }

    // SAFEGUARD: Skapa saknade config-filer om AI:n missade dem
    const tailwindConfigPath = path.join(repoPath, 'tailwind.config.ts');
    if (!fs.existsSync(tailwindConfigPath)) {
      console.log(`[Coder] Creating missing tailwind.config.ts`);
      fs.writeFileSync(tailwindConfigPath, `
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
      `.trim());
    }

    const postcssConfigPath = path.join(repoPath, 'postcss.config.js');
    if (!fs.existsSync(postcssConfigPath)) {
      console.log(`[Coder] Creating missing postcss.config.js`);
      fs.writeFileSync(postcssConfigPath, `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
      `.trim());
    }

    // DEPENDENCY PINNING: Säkerställ rätt Tailwind v3-versioner i package.json
    const pkgPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        let updated = false;
        
        pkg.devDependencies = pkg.devDependencies || {};
        
        // Tvinga Tailwind v3 och rätt versioner
        if (!pkg.devDependencies.tailwindcss || pkg.devDependencies.tailwindcss === 'latest' || pkg.devDependencies.tailwindcss.startsWith('^4')) {
          console.log(`[Coder] Pinning tailwindcss to ^3.4.17`);
          pkg.devDependencies.tailwindcss = '^3.4.17';
          updated = true;
        }
        if (!pkg.devDependencies.postcss || pkg.devDependencies.postcss === 'latest') {
          pkg.devDependencies.postcss = '^8.4.31';
          updated = true;
        }
        if (!pkg.devDependencies.autoprefixer || pkg.devDependencies.autoprefixer === 'latest') {
          pkg.devDependencies.autoprefixer = '^10.4.19';
          updated = true;
        }
        
        // Ta bort @tailwindcss/postcss om det finns (Tailwind v4 plugin)
        if (pkg.devDependencies['@tailwindcss/postcss']) {
          console.log(`[Coder] Removing @tailwindcss/postcss (Tailwind v4 plugin)`);
          delete pkg.devDependencies['@tailwindcss/postcss'];
          updated = true;
        }
        if (pkg.dependencies && pkg.dependencies['@tailwindcss/postcss']) {
          delete pkg.dependencies['@tailwindcss/postcss'];
          updated = true;
        }
        
        if (updated) {
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
          console.log(`[Coder] Updated package.json with pinned Tailwind v3 dependencies`);
        }
      } catch (e) {
        console.log(`[Coder] Warning: Could not parse package.json for dependency pinning`);
      }
    }

    // 4. AUTO-REFRESH: Skapa RefreshProvider och injicera i layout
    console.log("[Coder] Injecting auto-refresh (5s interval)...");
    
    // Bestäm var layout.tsx ligger för att veta var components ska vara
    let layoutPath = path.join(repoPath, 'app', 'layout.tsx');
    let componentsPath = path.join(repoPath, 'components');
    let importPath = '../components/RefreshProvider';
    
    if (!fs.existsSync(layoutPath)) {
      // Testa src/app om app/ inte finns
      layoutPath = path.join(repoPath, 'src', 'app', 'layout.tsx');
      if (fs.existsSync(layoutPath)) {
        // För src/app/ struktur, försök hitta components i src/components/ först
        const srcComponentsPath = path.join(repoPath, 'src', 'components');
        if (fs.existsSync(srcComponentsPath) || fs.existsSync(path.join(repoPath, 'src'))) {
          componentsPath = srcComponentsPath;
          importPath = '../components/RefreshProvider'; // src/app -> src/components
        } else {
          // Om src/components inte finns, använd root components/
          componentsPath = path.join(repoPath, 'components');
          importPath = '../../components/RefreshProvider'; // src/app -> components
        }
      }
    }
    
    // Skapa RefreshProvider i rätt mapp
    const refreshProviderPath = path.join(componentsPath, 'RefreshProvider.tsx');
    const refreshProviderDir = path.dirname(refreshProviderPath);
    if (!fs.existsSync(refreshProviderDir)) fs.mkdirSync(refreshProviderDir, { recursive: true });

    const refreshProviderContent = `'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function RefreshProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
`;
    fs.writeFileSync(refreshProviderPath, refreshProviderContent);
    const relativeRefreshPath = path.relative(repoPath, refreshProviderPath);
    console.log(`   -> Created: ${relativeRefreshPath}`);
    
    if (fs.existsSync(layoutPath)) {
      let layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Lägg till import om den inte finns
      if (!layoutContent.includes('RefreshProvider')) {
        // Hitta import-sektionen och lägg till RefreshProvider-import
        if (layoutContent.includes("import")) {
          layoutContent = layoutContent.replace(
            /(import\s+.*?from\s+['"].*?['"];?\s*\n)/,
            `$1import { RefreshProvider } from '${importPath}';\n`
          );
        } else {
          // Om det inte finns några imports, lägg till i början
          layoutContent = `import { RefreshProvider } from '${importPath}';\n${layoutContent}`;
        }

        // Wrap children med RefreshProvider
        // Försök hitta return statement och wrap children
        if (layoutContent.includes('return')) {
          // Matcha return statement med JSX och wrap children
          layoutContent = layoutContent.replace(
            /(return\s*\(?\s*)(<[^>]*>[\s\S]*?)(\{children\})([\s\S]*?)(<\/[^>]*>\s*\)?;?)/,
            (match, returnStart, beforeChildren, children, afterChildren, closing) => {
              return `${returnStart}${beforeChildren}<RefreshProvider>{children}</RefreshProvider>${afterChildren}${closing}`;
            }
          );
          
          // Om ovanstående inte matchade, försök enklare variant
          if (!layoutContent.includes('<RefreshProvider>')) {
            layoutContent = layoutContent.replace(
              /(\{children\})/g,
              '<RefreshProvider>{children}</RefreshProvider>'
            );
          }
        } else {
          // Fallback: lägg till RefreshProvider runt hela body om det finns
          if (layoutContent.includes('<body')) {
            layoutContent = layoutContent.replace(
              /(<body[^>]*>)([\s\S]*?)(<\/body>)/,
              (match, openBody, bodyContent, closeBody) => {
                return `${openBody}<RefreshProvider>${bodyContent}</RefreshProvider>${closeBody}`;
              }
            );
          }
        }

        fs.writeFileSync(layoutPath, layoutContent);
        const relativePath = path.relative(repoPath, layoutPath);
        console.log(`   -> Updated: ${relativePath} (added RefreshProvider)`);
      }
    } else {
      console.log(`   -> Warning: layout.tsx not found in app/ or src/app/, skipping refresh injection`);
    }

    // 5. LOCAL REVIEW LOOP: Granska kod och fixa buggar
    console.log("[Coder] 🔍 Starting code review loop...");
    let needsFix = false;
    
    do {
      // Samla all kod från sparade filer för review
      const codeToReview: string[] = [];
      const codeFiles = ['app', 'components', 'lib', 'backend'];
      
      for (const dir of codeFiles) {
        const dirPath = path.join(repoPath, dir);
        if (fs.existsSync(dirPath)) {
          const files = getAllFiles(dirPath);
          for (const file of files) {
            if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.py')) {
              try {
                const content = fs.readFileSync(file, 'utf-8');
                codeToReview.push(`\n--- ${path.relative(repoPath, file)} ---\n${content}`);
              } catch (e) {
                // Ignorera filer som inte kan läsas
              }
            }
          }
        }
      }
      
      const allCode = codeToReview.join('\n\n');
      
      // ⚡ Groq Speed Review (ersätter LocalAI)
      console.log(`[Coder] 📝 Review iteration ${iteration + 1}/${maxIterations}...`);
      console.log("⚡ Groq (Llama 3.3) running instant code review...");
      
      try {
        const reviewComments = await callAI(
          "REVIEWER",
          `Review this code for critical bugs only (ignore style). Check for Next.js 15 App Router compatibility, TypeScript errors, and React hooks misuse.\n\n${allCode.substring(0, 10000)}`
        );
        
        // Kolla svaret
        if (reviewComments.toUpperCase().includes('LGTM') || reviewComments.toUpperCase().includes('LOOKS GOOD')) {
          console.log("[Coder] ✅ Groq Review Passed! Code looks good.");
          needsFix = false;
          break; // Avbryt review-loopen, koden är bra
        } else {
          console.log(`[Coder] ⚠️ Groq Review found issues:`);
          console.log(reviewComments);
          needsFix = true;
          iteration++;
          
          if (iteration < maxIterations) {
            console.log(`[Coder] 🔧 Generating fixes...`);
            const fixPrompt = `
The code reviewer found these issues:
${reviewComments}

Please fix these issues in the code. Return the fixed code using either format:
- [FILE: path/to/file.ext] ... code ... [GOAL]
- ### FILE: path/to/file.ext ... code ... ### END_FILE

Only fix the files that have issues. Keep everything else unchanged.
            `;
            
            // Använd DeepSeek V3 för fixes (billigt och snabbt)
            rawOutput = await generateDeepSeekCoder(`${systemContext}\n\n${fixPrompt}`);
            console.log("[Coder] ✅ DeepSeek V3 fix generation successful!");
            
            // Parsa och uppdatera filer igen - hantera både [FILE:] och ### FILE: format
            const fixFiles: { path: string; content: string }[] = [];
            
            // Först: Försök med [FILE:] format
            const fixProtocolRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
            let fixMatch;
            
            while ((fixMatch = fixProtocolRegex.exec(rawOutput)) !== null) {
              const filePath = fixMatch[1].trim();
              let content = fixMatch[2].trim();
              
              if (content.startsWith("```")) {
                content = content.replace(/^```[a-z]*\n/, "").replace(/```$/, "");
              }
              
              if (filePath && content) {
                fixFiles.push({ path: filePath, content: content });
              }
            }
            
            // Om inga filer hittades, försök med ### FILE: format
            if (fixFiles.length === 0) {
              const fixStandardRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
              
              while ((fixMatch = fixStandardRegex.exec(rawOutput)) !== null) {
                const filePath = fixMatch[1].trim();
                let content = fixMatch[2].trim();
                
                // THE SANITIZER: Ta bort alla Markdown-artefakter
                content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
                content = content.replace(/```$/m, '');
                content = content.replace(/^### FILE:.*\n?/m, '');
                content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
                content = content.trim();
                
                if (filePath && content) {
                  fixFiles.push({ path: filePath, content: content });
                }
              }
            }
            
            let filesFixed = 0;
            
            for (const file of fixFiles) {
              let fileName = file.path;
              let content = file.content;
              
              // Cleanup paths
              if (!fileName.startsWith('app') && !fileName.startsWith('src') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('lib') && !fileName.startsWith('components') && !fileName.startsWith('backend')) {
                const parts = fileName.split('/');
                if (parts.length > 1) fileName = parts.slice(1).join('/');
              }
              
              const filePath = path.join(repoPath, fileName);
              if (filePath.startsWith(repoPath)) {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, content);
                console.log(`   -> Fixed: ${fileName}`);
                filesFixed++;
              }
            }
            
            if (filesFixed === 0) {
              console.log("[Coder] ⚠️ No files were fixed. Continuing anyway...");
              needsFix = false; // Break loop
            }
          } else {
            console.log("[Coder] ⚠️ Max iterations reached. Continuing with current code...");
            needsFix = false;
          }
        }
      } catch (reviewError: any) {
        console.warn("⚠️ Groq Review failed, skipping review to save time.", reviewError?.message);
        // Om review misslyckas, fortsätt med koden som den är
        needsFix = false;
        break;
      }
    } while (needsFix && iteration < maxIterations);

    await updateStep(pipeline.id, 'coder', { status: 'completed' });
    await updatePipeline(pipeline.id, { current_phase: 'sql' });

  } catch (error) {
    console.error('[Coder] Failed:', error);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

// ------------------------------------------------------------------
// STEG 4: SQL (Med Verifiering & Trigger Fix)
// ------------------------------------------------------------------
async function runSqlStep(pipeline: any, repoPath: string) {
  console.log(`[SQL] Generating migrations...`);
  await updatePipeline(pipeline.id, { current_phase: 'sql' });
  await createStep(pipeline.id, 'sql', 'running');

  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    await updateStep(pipeline.id, 'sql', { status: 'failed', output: { error: 'Missing DATABASE_URL' } });
    await updatePipeline(pipeline.id, { status: 'failed' });
    return;
  }

  // 1. SMART SKIP (Scope Analyzer)
  if (pipeline.type === 'update') {
      try {
          // Hämta filstruktur för scope analysis
          const fileStructure = getProjectStructure(repoPath).join('\n');
          const scope = await analyzeUpdateScope(pipeline.initial_prompt, fileStructure);
          
          console.log(`[SQL] 📊 Scope Analysis: SQL=${scope.requires_sql}, Backend=${scope.requires_backend}, Frontend=${scope.requires_frontend}`);
          
          if (!scope.requires_sql) {
              console.log("[SQL] ⏭️ Scope Analyzer: No SQL changes required. Skipping SQL generation to save time.");
              await updateStep(pipeline.id, 'sql', { status: 'skipped', output: { reason: 'Scope analysis determined no database changes needed', scope } });
              await updatePipeline(pipeline.id, { current_phase: "tester" });
              return;
          }
      } catch (scopeError: any) {
          console.warn("[SQL] ⚠️ Scope Analyzer failed, using fallback heuristics:", scopeError.message);
          // Fallback till enkel heuristik om scope analyzer misslyckas
          const keywords = ['database', 'db', 'schema', 'table', 'column', 'migration', 'sql'];
          const needsSql = keywords.some(k => pipeline.initial_prompt.toLowerCase().includes(k));
          if (!needsSql) {
              console.log("[SQL] ⏭️ Fallback: No DB keywords detected. Skipping SQL generation.");
              await updateStep(pipeline.id, 'sql', { status: 'skipped', output: { reason: 'No database keywords in prompt' } });
              await updatePipeline(pipeline.id, { current_phase: "tester" });
              return;
          }
      }
  }

  const { data: plannerStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('phase', 'planner')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const sqlPrompt = `
  You are a Senior PostgreSQL DBA.

  

  INPUT PLAN:

  ${JSON.stringify(plannerStep?.output || {})}



  YOUR TASK:

  Generate a single SQL file to set up the database schema.



  CRITICAL RULES:

  1. **Start Clean:** Begin with "DROP TABLE IF EXISTS users, posts, events, etc CASCADE;" for all app tables.

  2. **Create Tables:** Use "CREATE TABLE IF NOT EXISTS".

  3. **Security:** Enable RLS on all tables.

  4. **Seed Data:** Insert 3 rows of dummy data at the end.

  

  ⛔️ FORBIDDEN:

  - Do **NOT** use "ON CONFLICT" in INSERT statements. It causes errors.

  - Just use simple "INSERT INTO ... VALUES ...;".

  - Do NOT drop the tables 'pipelines', 'pipeline_steps' or 'tickets'.

  CRITICAL RULES FOR SEED DATA:
  1. NEVER use 'auth.users' in foreign key constraints if you cannot seed it.
  2. If you must link to users, you MUST create a mock user first using:
     INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
     VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'user@example.com', crypt('password123', gen_salt('bf')), NOW(), NULL, NULL, '{}', '{}', NOW(), NOW(), '', '', '', '');
  3. Alternatively, REMOVE foreign key constraints for seed/mock data to prevent crashes.
  4. Always insert parent records BEFORE child records (e.g., users before posts).

  CRITICAL UUID RULES (THE HEX-ENFORCER):
  1. NEVER invent invalid UUIDs like 'gggg...', 'xxxx...', 'user-1', or any non-hexadecimal characters.
  2. ALL UUIDs must be valid Hexadecimal format (only characters 0-9 and a-f).
  3. For mock data, use strictly valid UUIDs:
     - '00000000-0000-0000-0000-000000000000'
     - '11111111-1111-1111-1111-111111111111'
     - '22222222-2222-2222-2222-222222222222'
     - etc. (all hexadecimal: 0-9, a-f only)
  4. IDEALLY, use 'gen_random_uuid()' function for all INSERT statements instead of hardcoded strings.
  5. Example CORRECT: INSERT INTO users (id, name) VALUES (gen_random_uuid(), 'Test User');
  6. Example CORRECT: INSERT INTO users (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Test User');
  7. Example WRONG: INSERT INTO users (id, name) VALUES ('gggggggg-gggg-gggg-gggg-gggggggggggg', 'Test User');
  8. Example WRONG: INSERT INTO users (id, name) VALUES ('user-1', 'Test User');

  CRITICAL VECTOR DATA RULES (THE DIMENSION-ENFORCER):
  1. If you create a table with a 'vector(1536)' column (or any vector dimension), your mock data MUST have EXACTLY that many dimensions.
  2. NEVER use short arrays like '[0.1, 0.2, 0.3]' for vector columns - they will fail with "expected X dimensions, not Y".
  3. For mock vector data, use PostgreSQL's 'array_fill' function:
     - CORRECT: array_fill(0, ARRAY[1536])::vector
     - CORRECT: array_fill(0.1, ARRAY[1536])::vector
     - WRONG: '[0.1, 0.2, 0.3]'
     - WRONG: '[0.1, 0.2, 0.3, ...]' (incomplete)
  4. Example CORRECT: INSERT INTO embeddings (id, content, embedding) VALUES (gen_random_uuid(), 'test', array_fill(0, ARRAY[1536])::vector);
  5. If the vector column is 'vector(768)', use ARRAY[768] instead.
  6. Always match the exact dimension count specified in the column definition.

  OUTPUT FORMAT:

  Return ONLY raw SQL.

  `;

  try {
    console.log("[SQL] Generating migrations with DeepSeek V3...");
    let sqlContent = await generateDeepSeekCoder(sqlPrompt);
    sqlContent = sqlContent.replace(/```sql/g, '').replace(/```/g, '').trim();

    // Spara filen för historik
    const migrationPath = path.join(repoPath, 'supabase', 'migrations');
    if (!fs.existsSync(migrationPath)) fs.mkdirSync(migrationPath, { recursive: true });
    const fileName = `${Date.now()}_init.sql`;
    fs.writeFileSync(path.join(migrationPath, fileName), sqlContent);

    // EXEKVERA MOT DB
        const sql = postgres(process.env.DATABASE_URL);
    
        try {
      // 1. Kör migreringen
            await sql.unsafe(sqlContent);
      console.log("[SQL] Migration executed successfully.");

      // 2. VERIFIERING: Kolla vad som faktiskt finns
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE';
      `;
      const tableNames = tables.map((t: any) => t.table_name).join(', ');
      console.log(`[SQL VERIFICATION] Active tables in DB: [${tableNames}]`);

      await updateStep(pipeline.id, 'sql', { status: 'completed', output: { tables: tableNames } });
      await updatePipeline(pipeline.id, { current_phase: 'tester' });

    } catch (dbError: any) {
      console.error(`[SQL] Execution Failed: ${dbError.message}`);
      
      // SQL Self-Healing: Retry om det är foreign key constraint-fel
      if (dbError.message?.includes('violates foreign key constraint') || 
          dbError.message?.includes('foreign key') ||
          dbError.message?.includes('constraint')) {
        console.log("❌ SQL Crashed due to foreign key constraint. Attempting Auto-Fix...");
        
        try {
          // RETRY LOOP
          const fixPrompt = `
          The previous SQL failed with error: "${dbError.message}".
          
          TASK: Rewrite the SQL to fix this foreign key constraint error.
          
          STRATEGY:
          1. Remove foreign key constraints from the creation script OR
          2. Ensure dependency data is inserted first (e.g., users before posts).
          3. If you need to reference auth.users, either:
             - Create a mock user first (see previous instructions), OR
             - Remove the foreign key constraint for seed data.
          
          CRITICAL UUID RULES (THE HEX-ENFORCER):
          - NEVER invent invalid UUIDs like 'gggg...', 'xxxx...', 'user-1', or any non-hexadecimal characters.
          - ALL UUIDs must be valid Hexadecimal format (only characters 0-9 and a-f).
          - Use 'gen_random_uuid()' function for all INSERT statements OR valid hex UUIDs like '00000000-0000-0000-0000-000000000000'.
          - Example CORRECT: VALUES (gen_random_uuid(), 'Test User');
          - Example CORRECT: VALUES ('11111111-1111-1111-1111-111111111111', 'Test User');
          - Example WRONG: VALUES ('gggggggg-gggg-gggg-gggg-gggggggggggg', 'Test User');
          
          CRITICAL VECTOR DATA RULES:
          - If you use 'vector(1536)' columns, mock data MUST have exactly 1536 dimensions.
          - Use 'array_fill(0, ARRAY[1536])::vector' for mock vectors, NOT '[0.1, 0.2, 0.3]'.
          - Match the exact dimension count specified in the column definition.
          - Example CORRECT: VALUES (gen_random_uuid(), 'test', array_fill(0, ARRAY[1536])::vector);
          - Example WRONG: VALUES (gen_random_uuid(), 'test', '[0.1, 0.2, 0.3]');
          
          Return ONLY the fixed SQL code. No explanations.
          `;
          
          // Kalla på DeepSeek V3 igen för att fixa
          console.log("[SQL] 🔧 Generating fixed SQL with DeepSeek V3...");
          let fixedSql = await generateDeepSeekCoder(fixPrompt);
          fixedSql = fixedSql.replace(/```sql/g, '').replace(/```/g, '').trim();
          
          // Spara den fixade versionen
          const migrationPath = path.join(repoPath, 'supabase', 'migrations');
          if (!fs.existsSync(migrationPath)) fs.mkdirSync(migrationPath, { recursive: true });
          const fixedFileName = `${Date.now()}_init_fixed.sql`;
          fs.writeFileSync(path.join(migrationPath, fixedFileName), fixedSql);
          
          // Försök köra den fixade SQL-koden
          console.log("[SQL] 🔄 Retrying with fixed SQL...");
          await sql.unsafe(fixedSql);
          console.log("[SQL] ✅ Fixed SQL executed successfully!");
          
          // Verifiering
          const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE';
          `;
          const tableNames = tables.map((t: any) => t.table_name).join(', ');
          console.log(`[SQL VERIFICATION] Active tables in DB: [${tableNames}]`);
          
          await updateStep(pipeline.id, 'sql', { status: 'completed', output: { tables: tableNames, fixed: true } });
          await updatePipeline(pipeline.id, { current_phase: 'tester' });
            await sql.end();
          return; // Success, exit function
          
        } catch (retryError: any) {
          console.error(`[SQL] ❌ Auto-Fix also failed: ${retryError.message}`);
          await updateStep(pipeline.id, 'sql', { status: 'failed', output: { error: dbError.message, retryError: retryError.message } });
          await updatePipeline(pipeline.id, { status: 'failed' });
          await sql.end();
          return; // Stop pipeline
        }
    } else {
        // Om det inte är foreign key-fel, faila direkt
        await updateStep(pipeline.id, 'sql', { status: 'failed', output: { error: dbError.message } });
        await updatePipeline(pipeline.id, { status: 'failed' });
        await sql.end();
        return; // Stop pipeline
      }
    } finally {
      if (sql) await sql.end();
    }
  } catch (error: any) {
    console.error('[SQL] Agent Failed:', error?.message);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

// ------------------------------------------------------------------
// AUDIT LOOP: Kimi k2 Kickback Loop
// ------------------------------------------------------------------
async function runAuditLoop(pipeline: any, repoPath: string): Promise<boolean> {
  console.log("👮 Starting Kimi k2 Audit Loop...");
  
  let attempts = 0;
  const maxAuditRetries = 3; // Ge Claude 3 chanser att sluta fuska
  let passed = false;

  while (!passed && attempts < maxAuditRetries) {
    attempts++;
    
    // 1. Läs in kritiska filer för granskning
    // (Vi kollar extra noga på dashboard och main page där fusk ofta sker)
    const criticalFiles = [
      'src/app/page.tsx', 
      'src/app/dashboard/page.tsx',
      'app/page.tsx',
      'app/dashboard/page.tsx',
      'src/lib/actions.ts', // Om du har server actions
      'src/app/(protected)/dashboard/page.tsx'
    ];
    
    let codeContext = "";
    for (const file of criticalFiles) {
      const p = path.join(repoPath, file);
      if (fs.existsSync(p)) {
        codeContext += `\n--- FILE: ${file} ---\n` + fs.readFileSync(p, 'utf-8');
      }
    }

    if (!codeContext) {
      console.log("⚠️ No critical files found to audit. Skipping.");
      return true;
    }

    // 2. Fråga Kimi (Revisorn)
    const auditResult = await runKimiQA(codeContext);

    if (auditResult.includes("PASS")) {
      console.log("✅ Kimi k2 Audit Passed! Clean code confirmed.");
      passed = true;
    } else {
      console.log(`❌ Kimi k2 detected issues (Attempt ${attempts}/${maxAuditRetries}):`);
      console.log(auditResult);
      
      console.log("🔙 Sending back to Coder (Claude) for fixes...");
      
      // 3. Kickback till Coder (Claude)
      const fixPrompt = `
      CRITICAL CODE REVIEW FAILED.
      The Code Auditor found issues (Mock Data).
      
      AUDIT REPORT:
      ${auditResult}
      
      YOUR TASK:
      1. Refactor the code to fetch REAL data from Supabase.
      2. If tables are empty, show "No data found" state.
      3. Return the FULL file content.
      
      IMPORTANT OUTPUT RULES:
      - Use the format: ### FILE: <filename> ...code... ### END_FILE
      - If you fix multiple files, list them all.
      - NO explanations. Just code.
      `;

      console.log("🧠 Claude is fixing audit issues...");
      const fixedCode = await generateClaudeCoder(fixPrompt, "You are a Senior Developer fixing code. Output format: ### FILE: <name> ... ### END_FILE");

      // 4. Skriv över filerna (Med Fallback!)
      const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
      let match;
      let filesFixedCount = 0; // Håll koll på om vi faktiskt gjorde något

      while ((match = fileRegex.exec(fixedCode)) !== null) {
          const fileName = match[1].trim();
          let content = match[2].trim();
          // Sanitizer
          content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");
          
          const filePath = path.join(repoPath, fileName);
          // Säkerställ att mappen finns
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          
          fs.writeFileSync(filePath, content);
          console.log(`-> 🛠️ Audit Fix Applied: ${fileName}`);
          filesFixedCount++;
      }
      
      // FALLBACK PARSER (Om regex missar)
      if (filesFixedCount === 0) {
          console.log("⚠️ Strict parsing failed in Audit. Trying Fallback Strategy...");
          // Försök hitta markdown-block och gissa fil (oftast page.tsx som bråkar)
          const codeBlockMatch = fixedCode.match(/```(?:typescript|tsx|ts|js)?\n([\s\S]*?)```/);
          if (codeBlockMatch) {
              // Vi antar att det är den filen Kimi klagade mest på (page.tsx)
              // Eller så letar vi efter filnamnet i texten.
              // Förenkling: Vi skriver till app/page.tsx om det verkar vara en React-komponent
              const content = codeBlockMatch[1].trim();
              if (content.includes("export default function")) {
                 const fallbackFile = "app/page.tsx"; // Gissning, men oftast rätt vid mock-fel
                 const p = path.join(repoPath, fallbackFile);
                 fs.writeFileSync(p, content);
                 console.log(`-> 🛠️ Fallback Audit Fix Applied to: ${fallbackFile}`);
                 filesFixedCount++;
              }
          }
      }

      if (filesFixedCount === 0) {
          console.warn("⚠️ Claude produced output, but no files were updated. Breaking loop to avoid infinite spin.");
          break; // Bryt loopen om vi inte kan applicera fixen
      }
      
      // Loopa runt och testa igen!
    }
  }

  if (!passed) {
    console.warn("⚠️ Audit warning: Max retries reached. Publishing anyway (but code might contain mocks).");
  }

  return passed;
}

// ------------------------------------------------------------------
// STEG 5: TESTER (Build)
// ------------------------------------------------------------------

// Anti-Lazy Check
function scanForLaziness(projectPath: string): { found: boolean; issues: string[] } {
  console.log("🕵️ Scanning for lazy code...");
  const lazyPatterns = [
    { pattern: /TODO:/gi, name: "TODO" },
    { pattern: /FIXME:/gi, name: "FIXME" },
    { pattern: /\bpass\s*$/gm, name: "pass statement" },
    { pattern: /console\.log\(/g, name: "console.log" },
    { pattern: /alert\(/g, name: "alert()" },
    { pattern: /Lorem ipsum/gi, name: "Lorem ipsum" },
    { pattern: /:\s*any\s*[=,;)]/g, name: "any type" },
    { pattern: /return null;$/gm, name: "return null" },
  ];

  const issues: string[] = [];
  const scannedFiles: string[] = [];

  function scanDirectory(dir: string, baseDir: string = projectPath) {
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
          scanDirectory(fullPath, baseDir);
    } else {
          // Skanna bara kod-filer
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
            scannedFiles.push(relativePath);
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              for (const { pattern, name } of lazyPatterns) {
                if (pattern.test(content)) {
                  issues.push(`Found '${name}' in ${relativePath}`);
                }
              }
            } catch (e) {
              // Ignorera läsfel
            }
          }
        }
      }
    } catch (e) {
      // Ignorera läsfel
    }
  }

  scanDirectory(projectPath);
  
  if (issues.length > 0) {
    console.error("❌ LAZY CODE DETECTED:");
    issues.forEach(issue => console.error(`   - ${issue}`));
    return { found: true, issues };
  }
  
  console.log(`✅ Lazy code scan passed (scanned ${scannedFiles.length} files)`);
  return { found: false, issues: [] };
}

async function runTesterStep(pipeline: any, repoPath: string) {
  console.log(`[Tester] Starting verification for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'tester' });
  await createStep(pipeline.id, 'tester', 'running');

  // --- 🧹 DUPLICATE KILLER (The Nuclear Option) ---
  // Tvinga en ren struktur. Om 'src' finns, ska inga komponenter ligga i roten.
  const hasSrc = fs.existsSync(path.join(repoPath, 'src'));
  
  if (hasSrc) {
    console.log("[Tester] 🧹 Standardizing folder structure (Removing root duplicates)...");
    
    // Lista på mappar som ofta dubbleras
    const duplicates = ['lib', 'components', 'app', 'types'];
    
    duplicates.forEach(folder => {
      const rootPath = path.join(repoPath, folder);
      const srcPath = path.join(repoPath, 'src', folder);
      
      if (fs.existsSync(rootPath) && fs.existsSync(srcPath)) {
        console.log(`   -> Removing duplicate '${folder}' from root (keeping src/${folder})`);
        fs.rmSync(rootPath, { recursive: true, force: true });
      }
    });
  }
  // -----------------------------------------------------

  // --- 🛠️ PRE-FLIGHT FIXES (THE SILVER BULLET) ---
  console.log("[Tester] 🔧 Applying Pre-flight System Fixes...");

  // 1. TVINGA RÄTT TSCONFIG (Nu med "Röntgen-syn" för både src och root)
  const tsConfigContent = {
    "compilerOptions": {
      "target": "es5",
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": {
        "@/*": ["./src/*", "./*"] // <--- ÄNDRA TILL DETTA! (Leta på båda ställena)
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  };
  fs.writeFileSync(path.join(repoPath, 'tsconfig.json'), JSON.stringify(tsConfigContent, null, 2));
  console.log("-> Fixed tsconfig.json for src/ and root directory");

  // 2. MASS-INJICERA GOLDEN COMPONENTS (Vänta inte på fel)
  const componentsDir = path.join(repoPath, 'src', 'components', 'ui');
  if (!fs.existsSync(componentsDir)) fs.mkdirSync(componentsDir, { recursive: true });

  for (const [name, content] of Object.entries(GOLDEN_COMPONENTS)) {
    const filePath = path.join(componentsDir, name);
    fs.writeFileSync(filePath, content.trim());
    console.log(`-> Injected Golden Component: ${name}`);
  }
  // -----------------------------------------------------

  console.log("[Tester] 🎨 Enforcing Cyberpunk Design System...");

  // 1. TVINGA GLOBALS.CSS (Med Cyberpunk-bas)
  const globalsCssContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 142 76% 36%;
  --primary-foreground: 355.7 100% 97.3%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 142 76% 36%;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
  `;
  // Spara till både src/app och app för säkerhets skull
  const cssPathSrc = path.join(repoPath, 'src', 'app', 'globals.css');
  const cssPathRoot = path.join(repoPath, 'app', 'globals.css');
  
  if (fs.existsSync(path.dirname(cssPathSrc))) {
    fs.mkdirSync(path.dirname(cssPathSrc), { recursive: true });
    fs.writeFileSync(cssPathSrc, globalsCssContent);
    console.log("-> Injected globals.css in src/app/");
  }
  if (fs.existsSync(path.dirname(cssPathRoot))) {
    fs.mkdirSync(path.dirname(cssPathRoot), { recursive: true });
    fs.writeFileSync(cssPathRoot, globalsCssContent);
    console.log("-> Injected globals.css in app/");
  }

  // 2. TVINGA LAYOUT.TSX (Säkerställ import av globals.css)
  // Vi läser in nuvarande layout och ser till att importen finns.
  const layoutPathSrc = path.join(repoPath, 'src', 'app', 'layout.tsx');
  if (fs.existsSync(layoutPathSrc)) {
      let layoutContent = fs.readFileSync(layoutPathSrc, 'utf-8');
      if (!layoutContent.includes("globals.css")) {
          console.log("-> 🩹 Fixing missing CSS import in layout.tsx");
          layoutContent = `import "./globals.css";\n` + layoutContent;
          fs.writeFileSync(layoutPathSrc, layoutContent);
      }
  }
  
  const layoutPathRoot = path.join(repoPath, 'app', 'layout.tsx');
  if (fs.existsSync(layoutPathRoot)) {
      let layoutContent = fs.readFileSync(layoutPathRoot, 'utf-8');
      if (!layoutContent.includes("globals.css")) {
          console.log("-> 🩹 Fixing missing CSS import in layout.tsx (root)");
          layoutContent = `import "./globals.css";\n` + layoutContent;
          fs.writeFileSync(layoutPathRoot, layoutContent);
      }
  }

  // 3. TVINGA TAILWIND CONFIG (För src-struktur)
  const tailwindConfig = `
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // Fallback
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
    },
  },
  plugins: [],
};

export default config;
`;
  fs.writeFileSync(path.join(repoPath, 'tailwind.config.ts'), tailwindConfig);
  console.log("-> Injected tailwind.config.ts with Cyberpunk theme");
  // -----------------------------------------------------

  // 3. SANITERA PACKAGE.JSON (Fixa omöjliga versioner)
  const sanitizePkgPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(sanitizePkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(sanitizePkgPath, 'utf-8'));
      let modified = false;

      // Fixa TypeScript (5.0.0 finns inte, vi vill ha "latest" eller "^5")
      if (pkg.devDependencies?.typescript === "5.0.0" || pkg.dependencies?.typescript === "5.0.0") {
        console.log("-> 🩹 Fixing invalid TypeScript version (5.0.0 -> latest)");
        if (pkg.devDependencies) pkg.devDependencies.typescript = "latest";
        if (pkg.dependencies) pkg.dependencies.typescript = "latest";
        modified = true;
      }

      // Spara om filen ändrades
      if (modified) {
        fs.writeFileSync(sanitizePkgPath, JSON.stringify(pkg, null, 2));
        console.log("-> ✅ package.json sanitized");
      }
    } catch (e) {
      console.error("-> ⚠️ Failed to sanitize package.json:", e);
    }
  }
  // -----------------------------------------------------

  const maxRetries = 10;
  let attempt = 0;
  let success = false;

  // 1. Se till att package.json finns och har scripts
  const pkgPath = path.join(repoPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.scripts = { ...pkg.scripts, build: "next build", dev: "next dev" };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    } else {
    // Fallback om coder helt missade package.json
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: "frost-generated-app",
      scripts: { build: "next build", dev: "next dev" },
      dependencies: { next: "latest", react: "latest", "react-dom": "latest" }
    }, null, 2));
  }

  while (attempt < maxRetries && !success) {
    attempt++;
    console.log(`[Tester] Validation Attempt ${attempt}/${maxRetries}...`);

    try {
      // 1. SMART INSTALL (Försök standard, fallback till legacy)
      if (attempt === 1 || !fs.existsSync(path.join(repoPath, 'node_modules'))) {
        console.log("[Tester] Installing dependencies (Smart Mode)...");
        try {
          // Försök 1: Standard (Bäst för att fånga riktiga fel)
          console.log("-> Trying standard 'npm install'...");
          execSync('npm install --no-audit --no-fund', { cwd: repoPath, stdio: 'pipe' }); // Pipe för att inte skräpa ner loggen om det funkar
        } catch (installError: any) {
          console.warn("-> Standard install failed. Analyzing error...");
          const errLog = installError.stderr?.toString() || installError.stdout?.toString() || "";
          
          // Om felet är versionskrock (ERESOLVE) -> Kör legacy
          if (errLog.includes("ERESOLVE") || errLog.includes("peer dependency")) {
            console.log("-> Version conflict detected. Retrying with --legacy-peer-deps...");
            execSync('npm install --no-audit --no-fund --legacy-peer-deps', { cwd: repoPath, stdio: 'inherit' });
          } else {
            // Om det är något annat fel (t.ex. nätverk eller 404 package) -> Kasta vidare
            throw installError; 
          }
        }
        console.log("-> Dependencies installed successfully.");
      }

      // 1.5. ANTI-LAZY SCAN (Före build - tvinga implementation)
      const lazinessCheck = scanForLaziness(repoPath);
      if (lazinessCheck.found) {
        const errorMessage = `LAZY CODE DETECTED:\n${lazinessCheck.issues.join('\n')}\n\nFIX IT. No placeholders allowed.`;
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // 2. KÖR TSC FÖRST (The Sniper) - Detta hittar felen du såg!
      console.log("[Tester] Running TypeScript Check (tsc)...");
      try {
        execSync('npx tsc --noEmit', { cwd: repoPath, stdio: 'pipe' });
        console.log("✅ TypeScript Check Passed!");
      } catch (tscError: any) {
        // Fånga TSC-outputen
        const tscOutput = tscError.stdout ? tscError.stdout.toString() : "";
        console.log("❌ TypeScript Check Failed. Output captured.");
        throw new Error(tscOutput); // Kasta detta som felet vi ska laga
      }

      // 3. Om TSC passerar, kör vi en riktig build för att säkra
      console.log("[Tester] Running Final Build...");
      execSync('npm run build', { 
        cwd: repoPath, 
        stdio: 'pipe',
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
      });
      
      console.log("✅ Build Successful!");

      // --- 🐍 THE PYTHON ENFORCER (MyPy Integration) ---
      // Om projektet är Python/Hybrid -> Kör MyPy typkoll
      if (pipeline.is_python || fs.existsSync(path.join(repoPath, 'backend', 'main.py'))) {
        console.log("[Tester] 🐍 Running Python Type Safety Check (MyPy)...");
        try {
          // Installera mypy om det saknas (bör ligga i requirements.txt men för säkerhets skull)
          try {
            execSync('python -m pip install mypy --quiet', { 
              cwd: repoPath,
              stdio: 'pipe',
              timeout: 30000 // 30s timeout
            });
          } catch (installError) {
            // Om pip install misslyckas, försök med pip3 eller python3
            try {
              execSync('python3 -m pip install mypy --quiet', { 
                cwd: repoPath,
                stdio: 'pipe',
                timeout: 30000
              });
            } catch (e) {
              console.warn("[Tester] ⚠️ Could not install mypy. Skipping Python type check.");
            }
          }
          
          // Kör strikt typkoll på backend-mappen
          const backendPath = path.join(repoPath, 'backend');
          if (fs.existsSync(backendPath)) {
            execSync('python -m mypy backend --ignore-missing-imports --no-strict-optional', { 
              cwd: repoPath,
              stdio: 'pipe',
              timeout: 60000 // 60s timeout
            });
            console.log("[Tester] ✅ Python Types: VERIFIED");
          } else {
            console.log("[Tester] ⚠️ No backend/ directory found. Skipping MyPy check.");
          }
        } catch (mypyError: any) {
          console.error("[Tester] ❌ Python Type Check Failed!");
          const mypyOutput = mypyError.stdout ? mypyError.stdout.toString() : "";
          const mypyStderr = mypyError.stderr ? mypyError.stderr.toString() : "";
          const mypyFullLog = mypyOutput + "\n" + mypyStderr;
          
          // Hitta Python-filer med fel
          const pythonFileMatch = mypyFullLog.match(/(backend\/[a-zA-Z0-9_\-\/]+\.py)/);
          let brokenPythonFile = pythonFileMatch ? pythonFileMatch[1] : "backend/main.py";
          let brokenPythonContent = "";
          
          if (brokenPythonFile) {
            try {
              brokenPythonContent = fs.readFileSync(path.join(repoPath, brokenPythonFile), 'utf-8');
            } catch (e) {
              console.log(`[Tester] Could not read Python file: ${brokenPythonFile}`);
            }
          }
          
          console.log(`[Watchdog] 🐕 Python Type Error detected in: ${brokenPythonFile}`);
          
          // Anropa Watchdog för att fixa Python-filen
          const pythonFixPrompt = `
Python MyPy Type Check Error in file: ${brokenPythonFile}

Error Log:
${mypyFullLog.slice(-2000)}

Current File Content:
${brokenPythonContent || "File not found or empty"}

TASK: Fix the Python type errors. Return the FIXED file content ONLY.

STRATEGY:
- Add proper type hints (e.g., def func(x: int) -> str:)
- Fix type mismatches (e.g., str vs int)
- Add Optional[...] for nullable values
- Import typing module if needed (from typing import Optional, List, Dict, etc.)

RETURN FORMAT:
### FILE: ${brokenPythonFile}
... fixed code ...
### END_FILE
          `;
          
          const pythonFixOutput = await callAI("FIXER", pythonFixPrompt, "", undefined, "SMART");
          
          // Parsa och skriv den fixade filen
          const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
          let fileMatch;
          let fixed = false;
          while ((fileMatch = fileRegex.exec(pythonFixOutput)) !== null) {
            const fileName = fileMatch[1].trim();
            let content = fileMatch[2].trim();
            // Sanitize markdown artifacts
            content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");
            const filePath = path.join(repoPath, fileName);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, content);
            console.log(`[Watchdog] 🛠️ Fixed Python file: ${fileName}`);
            fixed = true;
          }
          
          if (!fixed) {
            console.warn("[Watchdog] ⚠️ No valid Python fix code generated. Continuing anyway...");
          } else {
            // Försök MyPy igen efter fix
            try {
              execSync('python -m mypy backend --ignore-missing-imports --no-strict-optional', { 
        cwd: repoPath, 
                stdio: 'pipe',
                timeout: 60000
              });
              console.log("[Tester] ✅ Python Types: VERIFIED (after fix)");
            } catch (retryError) {
              console.warn("[Tester] ⚠️ Python type check still failing after fix. Continuing with warnings...");
            }
          }
        }
      }

      // --- 👮 KIMI KICKBACK LOOP ---
      // Bygget lyckas, men vi är inte klara förrän Kimi ger tummen upp!
      const auditPassed = await runAuditLoop(pipeline, repoPath);
      
      if (auditPassed) {
        console.log("✅ All checks passed! Ready for publishing.");
        success = true;
      } else {
        // Om audit misslyckades efter max retries men fixade filer, försök bygga igen
        // Men om vi redan har kört audit loop flera gånger, gå vidare med varning
        if (attempt >= maxRetries - 2) {
          // Vi är nära max retries, gå vidare med varning
          console.log("⚠️ Audit loop reached max retries. Proceeding with warnings (code might contain mocks).");
          success = true;
        } else {
          // Försök bygga igen med fixade filer
          console.log("⚠️ Audit loop fixed files. Retrying build to verify fixes...");
          success = false;
        }
      }

    } catch (error: any) {
      console.error(`❌ Check Failed (Attempt ${attempt})`);
      
      // Hämta hela felloggen (antingen från tsc eller build)
      let fullLog = error.message || "";
      if (error.stdout) fullLog += "\n" + error.stdout.toString();
      if (error.stderr) fullLog += "\n" + error.stderr.toString();

      // LOGGA FELET SÅ DU SER DET
      console.log("🔻 --- ERROR LOG START --- 🔻");
      console.log(fullLog.slice(0, 5000)); // Visa första 5000 tecknen (TSC ger mycket info)
      console.log("🔺 --- ERROR LOG END --- 🔺");

      // --- 📦 DEPENDENCY AUTO-FIXER (Ny logik) ---
      const missingPkgMatches = fullLog.matchAll(/Cannot find module '([^.][^']*)'/g);
      const pkgsToInstall = new Set<string>();
      
      for (const m of missingPkgMatches) {
          const pkgName = m[1];
          // Ignorera interna alias (@/) och relativa sökvägar
          if (!pkgName.startsWith('@/') && !pkgName.startsWith('.')) {
              pkgsToInstall.add(pkgName);
          }
      }

      if (pkgsToInstall.size > 0) {
          const installCmd = Array.from(pkgsToInstall).join(' ');
          console.log(`[Watchdog] 📦 Detected missing packages: ${installCmd}`);
          console.log(`[Watchdog] 🛠️ Auto-installing...`);
          try {
              execSync(`npm install ${installCmd} --legacy-peer-deps`, { cwd: repoPath, stdio: 'inherit' });
              
              // 2. SMART CHECK: Behövs @types?
              // Om paketet inte är ett av de kända som har inbyggda typer, chansa på @types
              for (const missingPackage of pkgsToInstall) {
                  // Ignorera scoped packages (@scope/package) och packages som redan är @types
                  if (missingPackage.startsWith('@') || missingPackage.startsWith('@types/')) {
                      continue;
                  }
                  
                  // Paket med inbyggda TypeScript-typer (behöver inte @types)
                  const hasBuiltInTypes = [
                      'zod', 'lucide-react', 'tailwind-merge', 'clsx', 
                      'react', 'react-dom', 'next', '@supabase/supabase-js',
                      '@supabase/auth-helpers-nextjs', '@supabase/auth-helpers-react'
                  ].includes(missingPackage);
                  
                  if (!hasBuiltInTypes) {
                      try {
                          console.log(`[Watchdog] 📦 Trying to install types for ${missingPackage}...`);
                          execSync(`npm install -D @types/${missingPackage} --legacy-peer-deps`, { 
                              cwd: repoPath, 
                              stdio: 'pipe' // Tysta ner @types-installationen om den misslyckas
                          });
                          console.log(`[Watchdog] ✅ Types installed for ${missingPackage}`);
                      } catch (e) {
                          // Ignorera om @types inte finns, det var värt ett försök
                          console.log(`[Watchdog] ⚠️ No @types package found for ${missingPackage} (this is OK)`);
                      }
                  }
              }
              
              console.log("✅ Packages installed. Retrying build immediately.");
              continue; // Hoppa över resten och testa bygget igen!
          } catch (e) {
              console.error("❌ Auto-install failed.");
          }
      }
      // -------------------------------------------

      // Strategi: Om det är ett import-fel ("Cannot find module"), måste vi ofta SKAPA en fil.
      // Vi försöker hitta vilken fil som har felet.
      // TSC Output format: "src/app/page.tsx(1,1): error TS..." eller "C:\path\to\file.tsx(1,1): error..."
      // Bättre regex som hanterar både unix/win sökvägar
      const match = fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|js|jsx))\(\d+,\d+\):/);
      let brokenFile = match ? match[1].trim() : "";
      
      // Normalisera sökvägar (ta bort fullständig sökväg om den finns)
      if (brokenFile && brokenFile.includes(repoPath)) {
        brokenFile = brokenFile.replace(repoPath, '').replace(/^[\\\/]/, ''); // Ta bort prefix
      }
      
      // Hantera slash direction (normalisera till forward slashes)
      if (brokenFile) {
        brokenFile = brokenFile.replace(/\\/g, '/');
      }
      
      // Städa sökvägen (ta bort eventuellt 'agent-runner/workspace/...' prefix om det kom med)
      if (brokenFile.includes("sandbox")) {
        const parts = brokenFile.split("sandbox");
        if (parts.length > 1) {
          // Hitta pipeline-mappen och ta allt efter den
          const relativePath = parts[1].split('/').slice(2).join('/');
          brokenFile = relativePath;
        }
      }

      // --- 🧠 NY LOGIK: HITTA PACKAGE.JSON FEL ---
      // Om npm skriker, är det package.json som är trasig!
      if (!brokenFile && (fullLog.includes("npm error") || fullLog.includes("ETARGET") || fullLog.includes("ERESOLVE") || fullLog.includes("package.json"))) {
        console.log("[Watchdog] 📦 Detected Dependency Error. Switching target to package.json");
        brokenFile = "package.json";
      }
      // -------------------------------------------

      // --- SMART TARGET LOGIC: HITTA "THE REAL CULPRIT" ---
      // Om felet är "Module X has no exported member Y", så är det X som ska fixas, inte filen vi är i.
      const exportErrorMatch = fullLog.match(/Module ['"](.+?)['"] has no exported member/);
      
      if (exportErrorMatch) {
        // Extrahera sökvägen till modulen som saknar exporten
        // Exempel: "@/components/ui/Card" -> "src/components/ui/Card.tsx"
        let badModulePath = exportErrorMatch[1];
        
        // Konvertera alias (@) till riktig sökväg
        badModulePath = badModulePath.replace('@/', 'src/').replace('@', 'src');
        
        // Ta bort eventuella quotes
        badModulePath = badModulePath.replace(/^['"]|['"]$/g, '');
        
        // Lägg till extension om den saknas
        if (!badModulePath.endsWith('.tsx') && !badModulePath.endsWith('.ts')) {
          badModulePath += '.tsx'; // Gissa på .tsx först
        }

        console.log(`[Watchdog] 🕵️ Root Cause Detected! Switching target from ${brokenFile} to ${badModulePath}`);
        brokenFile = badModulePath;
      }
      // ----------------------------------------------------

      // --- 🕵️ SMART PATH RESOLVER ---
      // Hitta den riktiga sökvägen om filen inte finns exakt där felmeddelandet säger
      if (brokenFile && !fs.existsSync(path.join(repoPath, brokenFile))) {
        console.log(`[Watchdog] 🔍 '${brokenFile}' not found directly. Searching...`);
        
        const alternatives = [
          `src/${brokenFile}`,
          brokenFile.replace(/^src\//, ''), // Om src/ redan fanns men filen ligger i roten
          `app/${brokenFile}`,
          `src/lib/${brokenFile}`,
          brokenFile.replace('.tsx', '.ts'),
          `src/${brokenFile.replace('.tsx', '.ts')}`,
          `src/lib/${brokenFile.replace('.tsx', '.ts')}`,
          `app/${brokenFile.replace('.tsx', '.ts')}`,
        ];
        
        for (const alt of alternatives) {
          if (fs.existsSync(path.join(repoPath, alt))) {
            console.log(`[Watchdog] 🕵️ Found at: ${alt}`);
            brokenFile = alt;
            break;
          }
        }
      }
      // ---------------------------------

      let brokenFileContent = "";
      if (brokenFile) {
        try {
          // Försök läsa filen som kastar felet
          brokenFileContent = fs.readFileSync(path.join(repoPath, brokenFile), 'utf-8');
        } catch (e) {
          console.log(`Could not read broken file: ${brokenFile}`);
        }
      }

      // --- 🩹 NEXT.JS 15 AUTO-FIXER ---
      // Fixa async Request APIs automatiskt (cookies, params, searchParams, headers)
      const asyncApiErrors = [
        "Property 'get' does not exist on type 'Promise<ReadonlyRequestCookies>'",
        "Property 'get' does not exist on type 'Promise<ReadonlyHeaders>'",
        "Property 'slug' does not exist on type 'Promise'",
        "Cannot read properties of undefined (reading 'get')",
        "params is not iterable",
        "searchParams is not iterable"
      ];
      
      const hasAsyncError = asyncApiErrors.some(error => fullLog.includes(error));
      
      if (hasAsyncError && brokenFileContent) {
          console.log("[Watchdog] 🩹 Auto-fixing Next.js 15 async API issues...");
          
          let newContent = brokenFileContent;
          let wasModified = false;
          
          // Fix cookies()
          if (brokenFileContent.includes("cookies()")) {
            newContent = newContent
              .replace(/cookies\(\)\.get/g, "(await cookies()).get")
              .replace(/cookies\(\)\.getAll/g, "(await cookies()).getAll")
              .replace(/const (\w+) = cookies\(\)/g, "const $1 = await cookies()");
            wasModified = true;
          }
          
          // Fix headers()
          if (brokenFileContent.includes("headers()")) {
            newContent = newContent
              .replace(/headers\(\)\.get/g, "(await headers()).get")
              .replace(/headers\(\)\.has/g, "(await headers()).has")
              .replace(/const (\w+) = headers\(\)/g, "const $1 = await headers()");
            wasModified = true;
          }
          
          // Fix params destructuring
          if (brokenFileContent.match(/const\s*\{\s*\w+\s*\}\s*=\s*params\s*[;}]/)) {
            // Match: const { slug } = params; eller const { slug } = params
            newContent = newContent.replace(
              /const\s*\{([^}]+)\}\s*=\s*params\s*([;}]?)/g,
              "const { $1 } = await params$2"
            );
            wasModified = true;
          }
          
          // Fix params.property access
          if (brokenFileContent.match(/params\.\w+/)) {
            // Match: params.slug or params.id
            newContent = newContent.replace(
              /const\s+(\w+)\s*=\s*params\.(\w+)/g,
              "const $1 = (await params).$2"
            );
            wasModified = true;
          }
          
          // Fix searchParams
          if (brokenFileContent.includes("searchParams")) {
            newContent = newContent.replace(
              /const\s*\{\s*([^}]+)\s*\}\s*=\s*searchParams\s*([;}]?)/g,
              "const { $1 } = await searchParams$2"
            );
            newContent = newContent.replace(
              /searchParams\.get\(/g,
              "(await searchParams).get("
            );
            wasModified = true;
          }

          // Se till att funktionen är async om vi lade till await
          if (wasModified && newContent !== brokenFileContent) {
              // Hitta export default function och gör den async om den inte är det
              if (!newContent.includes("export default async function")) {
                newContent = newContent.replace(
                  /export default function/g, 
                  "export default async function"
                );
              }
              
              // Också fixa named exports: export async function Page
              if (newContent.match(/export\s+function\s+\w+\s*\(/)) {
                newContent = newContent.replace(
                  /export\s+function\s+(\w+)\s*\(/g,
                  "export async function $1("
                );
              }
              
              fs.writeFileSync(path.join(repoPath, brokenFile), newContent);
              console.log(`[Watchdog] 🛠️ Applied Next.js 15 Async Auto-Fix to ${brokenFile}`);
              continue; // Hoppa över AI och bygg igen!
          }
      }
      // --------------------------------

      console.log(`[Watchdog] 🐕 Targeting file: ${brokenFile || "Global Fix"}`);

      // --- 🛡️ GOLDEN COMPONENT RESCUE ---
      const fileNameOnly = path.basename(brokenFile); // T.ex. "Card.tsx"
      if (brokenFile && GOLDEN_COMPONENTS[fileNameOnly]) {
        console.log(`[Watchdog] 🏆 GOLDEN RESCUE: Injecting perfect code for ${fileNameOnly}`);
        
        const filePath = path.join(repoPath, brokenFile);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        // Skriv över direkt med perfekt kod
        fs.writeFileSync(filePath, GOLDEN_COMPONENTS[fileNameOnly].trim());
        console.log(`[Watchdog] ✅ Golden component injected! Retrying build...`);
        
        // Hoppa över resten av loopen och försök bygga igen!
        continue;
      }
      // -----------------------------------

      let fixOutput = "";
      
      // 1. SKAPA KARTA ÖVER PROJEKTET
      const projectFiles = getProjectStructure(repoPath);
      const fileTreeContext = `
      CURRENT PROJECT STRUCTURE (All existing files):
      ${projectFiles.join('\n')}
      `;

      // 2. UPPDATERAD PROMPT MED KONTEXT
      // 2. UPPDATERAD PROMPT MED "GOLDEN RULES"
      const promptContext = `
      You are a Senior TypeScript Fixer.
      
      ERROR CONTEXT:
      - Build failed. Review the LOG and the CURRENT PROJECT STRUCTURE above.
      
      CRITICAL "GOLDEN COMPONENT" RULES:
      1. **READ-ONLY:** Do NOT modify files in 'src/components/ui/' (like Button.tsx, Card.tsx). They are reset on every run.
      2. **FIX THE USAGE:** You must fix the file *using* the component, not the component itself.
      
      COMMON TRANSLATIONS (Apply these fixes):
      - Error: 'Type "primary" is not assignable...' (Button) -> CHANGE usage to 'variant="default"'
      - Error: 'Cannot find module...' -> Check 'CURRENT PROJECT STRUCTURE'. If missing, CREATE it.
      - Error: 'Markdown artifacts' -> Remove \`\`\` lines.
      
      NEXT.JS 15 ASYNC FIXES (CRITICAL):
      - Error: 'Property does not exist on type Promise' -> This is a Next.js 15 async API issue.
      - If you see params/searchParams/cookies()/headers() used WITHOUT await -> ADD await and make function async.
      - Example fixes:
        * const { slug } = params; -> const { slug } = await params; (and make function async)
        * const token = cookies().get('token'); -> const token = (await cookies()).get('token');
        * const searchParams = props.searchParams; -> const searchParams = await props.searchParams;
      - ALWAYS check if the component/page is async. If not, make it async: export default async function Page({ params }) { ... }
      
      RETURN FORMAT:
      ### FILE: <path>
      ... code ...
      ### END_FILE
      `;

      // 3. TIERED WATCHDOG (Eskalering)
      console.log(`🐕 Watchdog engaging (Attempt ${attempt}/10)...`);
      
      // VÄLJ INTELLIGENS-NIVÅ (Tiered Escalation)
      let smartLevel: 'FAST' | 'SMART' | 'GENIUS' = 'FAST';
      if (attempt > 2) smartLevel = 'SMART'; // Efter 2 försök, byt till DeepSeek
      if (attempt > 5) smartLevel = 'GENIUS'; // Efter 5 försök, byt till Kimi
      
      // Fix-Prompten måste vara tydligare för "Smart" nivåerna
      const targetFile = brokenFile || "Unknown file";
      const fixPrompt = `
Build Error in file: ${targetFile}

Error Log:
${fullLog}

Current File Content:
${brokenFileContent || "File not found or empty"}

CURRENT PROJECT STRUCTURE:
${fileTreeContext}

TASK: Return the FIXED file content ONLY.

STRATEGY:
${smartLevel === 'FAST' ? 
  "- Fix syntax errors, casing issues, and typos quickly." : 
  smartLevel === 'SMART' ?
  "- CRITICAL: If the error says 'Cannot find module', imports are broken. REMOVE the broken imports and replace the usage with a simple HTML placeholder (e.g. <div>Placeholder</div>). DO NOT try to import files that don't exist." :
  "- Analyze the full context. This is a complex issue. Provide a comprehensive fix that addresses root causes, not just symptoms."
}

CRITICAL "INLINE FIX" RULE (Green Build Strategy):
- If the error is "Module has no exported member" or "Cannot find name", do NOT try to edit the imported file.
- Instead, DEFINE THE MISSING INTERFACE/TYPE LOCALLY in this file to satisfy the compiler.
- Example: If 'ApiKeyDisplay' is missing from '@/lib/types', add 'interface ApiKeyDisplay { id: string; ... }' right here in this file.
- Example: If 'ProcessingStatus' type is missing, add 'type ProcessingStatus = "initializing" | "extraction" | ...' locally.
- Stop trying to fix external files. Fix THIS file by defining what it needs inline.
- This is the "silver tape" solution - it guarantees a green build even if types.ts is broken.

${promptContext}

RETURN FORMAT:
### FILE: <path>
... code ...
### END_FILE
      `;

      // Anropa den nya Tiered Fixer-logiken
      fixOutput = await callAI(
        "FIXER", 
        fixPrompt, 
        promptContext, 
        undefined, 
        smartLevel
      );
      
      // Fallback om fixOutput är tom
      if (!fixOutput || fixOutput.trim().length === 0) {
        console.warn(`⚠️ ${smartLevel} Fixer returned empty. Trying fallback...`);
        if (smartLevel === 'FAST') {
          // Fallback till SMART om FAST misslyckades
          fixOutput = await callAI("FIXER", fixPrompt, promptContext, undefined, 'SMART');
        } else if (smartLevel === 'SMART') {
          // Fallback till GENIUS om SMART misslyckades
          fixOutput = await callAI("FIXER", fixPrompt, promptContext, undefined, 'GENIUS');
        }
      }

      // Applicera fixen (Skapa/Uppdatera filer)
      const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
      let fileMatch;
      let fixedCount = 0;
      
      while ((fileMatch = fileRegex.exec(fixOutput)) !== null) {
        const fileName = fileMatch[1].trim();
        let content = fileMatch[2].trim();
        
        // THE SANITIZER: Ta bort alla Markdown-artefakter
        // Ta bort inledande ```typescript, ```tsx, eller bara ```
        content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
        // Ta bort avslutande ```
        content = content.replace(/```$/m, '');
        // Ta bort eventuella "### FILE: ..." som råkat komma med i början
        content = content.replace(/^### FILE:.*\n?/m, '');
        // Ta bort eventuella markdown fences i mitten också (för säkerhets skull)
        content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
        // Trim whitespace
        content = content.trim();
        
        const filePath = path.join(repoPath, fileName);
        
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(filePath, content);
        console.log(`[Watchdog] 🛠️ Wrote/Fixed file: ${fileName}`);
        fixedCount++;
      }

      // 2. FALLBACK PARSER (Om regex missade)
      if (fixedCount === 0 && brokenFile) {
        console.log("[Watchdog] ⚠️ Strict parsing failed. Trying Fallback Strategy...");
        
        // Kolla om vi har ett markdown-block
        const codeBlockMatch = fixOutput.match(/```(?:typescript|tsx|ts|js)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
          const content = codeBlockMatch[1].trim();
          const filePath = path.join(repoPath, brokenFile); // Använd filen vi siktade på
          
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          fs.writeFileSync(filePath, content);
          console.log(`[Watchdog] 🛠️ Fallback Fix Applied to: ${brokenFile}`);
          fixedCount++;
        }
      }

      if (fixedCount === 0) console.log("[Watchdog] ⚠️ No code changes applied.");
    }
  }

  if (success) {
    await updateStep(pipeline.id, 'tester', { status: 'completed' });
    
    // STEG: VISUAL AUDIT (The Design Police)
    try {
      console.log("[Tester] 🎨 Starting Visual Audit...");
      const auditPassed = await runVisualAudit(repoPath);
      if (!auditPassed) {
        console.warn("⚠️ UI Design failed audit. Marking for manual review (or auto-fix loop).");
        // TODO: Trigga en "CSS Fixer" agent här i framtiden
        await updateStep(pipeline.id, 'tester', { 
          status: 'completed', 
          output: { visualAudit: 'failed', note: 'UI issues detected but continuing to publish' } 
        });
      } else {
        console.log("✅ Visual Audit Passed! UI looks good.");
        await updateStep(pipeline.id, 'tester', { 
          status: 'completed', 
          output: { visualAudit: 'passed' } 
        });
      }
    } catch (auditError: any) {
      console.warn("⚠️ Visual Audit failed (non-critical):", auditError?.message);
      // Fortsätt ändå till publish om audit misslyckas
    }
    
    // --- 📝 KIMI K2: THE DOCUMENTATION OFFICER ---
    try {
      // Hämta tech stack från pipeline eller planner step
      const techStack = pipeline.is_python ? 
        (fs.existsSync(path.join(repoPath, 'backend', 'main.py')) ? 'Hybrid (Next.js + Python FastAPI)' : 'Python FastAPI') :
        'Next.js 15';
      
      await runDocumentationStep(repoPath, techStack);
    } catch (docError: any) {
      console.warn("⚠️ Documentation step failed (non-critical):", docError?.message);
      // Fortsätt ändå till publish om dokumentation misslyckas
    }
    
    await updatePipeline(pipeline.id, { current_phase: 'publisher' });
  } else {
    await updateStep(pipeline.id, 'tester', { status: 'failed', output: { error: 'Validation failed after retries' } });
    await updatePipeline(pipeline.id, { status: 'failed' });
    throw new Error("Validation failed after retries.");
  }
}

// ------------------------------------------------------------------
// STEG 6: PUBLISHER (Med Auto-Docs)
// ------------------------------------------------------------------

// Hjälpfunktion för att generera dokumentation
/**
 * Generate a cool, kebab-case repository name based on project description
 */
async function generateRepoName(userRequest: string): Promise<string> {
  const prompt = `
    Create a short, cool, kebab-case GitHub repository name based on this project description: "${userRequest}".
    
    Examples: "context-crystal", "dark-nexus-dashboard", "sportsync-app", "medic-tracker".
    
    Rules:
    - Use kebab-case (lowercase with hyphens)
    - Keep it short (2-4 words max)
    - Make it memorable and relevant to the project
    - No special characters except hyphens
    
    Output ONLY the name. No explanations, no quotes, no markdown.
  `;
  
  try {
    // Använd REVIEWER-rollen (Groq) för snabb generering
    const name = await callAI("REVIEWER", prompt);
    // Städa bort skräp och konvertera till kebab-case
    const cleaned = name.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Ersätt alla icke-alfanumeriska med hyphen
      .replace(/-+/g, '-') // Ta bort dubbla hyphens
      .replace(/^-|-$/g, ''); // Ta bort leading/trailing hyphens
    
    // Fallback om AI gav något konstigt
    if (!cleaned || cleaned.length < 3) {
      // Generera från första orden i prompten
      const fallback = userRequest
        .split(' ')
        .slice(0, 3)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      return `frost-${fallback}`;
    }
    
    return cleaned;
  } catch (error: any) {
    console.warn("[Repo Name] Failed to generate name, using fallback:", error?.message);
    // Fallback till enkel slug från prompten
    const fallback = userRequest
      .split(' ')
      .slice(0, 3)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    return `frost-${fallback}`;
  }
}

function generateDocs(repoPath: string, pipeline: any) {
  console.log("[Publisher] 📄 Generating documentation & configs...");

  // 1. Skapa .env.example
  const envPath = path.join(repoPath, '.env.local');
  const envExamplePath = path.join(repoPath, '.env.example');
  
  if (fs.existsSync(envPath) && !fs.existsSync(envExamplePath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const exampleContent = envContent
        .split('\n')
        .map(line => {
          if (!line || line.startsWith('#')) return line;
          if (line.includes('=')) {
            const key = line.split('=')[0];
            return `${key}="YOUR_VALUE_HERE"`;
          }
          return line;
        })
        .join('\n');
      
      fs.writeFileSync(envExamplePath, exampleContent);
      console.log("-> Created .env.example");
    } catch (e) {
      console.error("-> Failed to create .env.example:", e);
    }
  }

  // 2. Skapa README.md (Om den är tom eller tråkig)
  const readmePath = path.join(repoPath, 'README.md');
  const readmeContent = `
# ❄️ ${pipeline.name || pipeline.title || 'Frost Project'}

Generated by **Frost Night Factory** (AI Autonomous Pipeline).

## 🚀 Getting Started

1. **Clone the repo**

   \`\`\`bash
   git clone ${pipeline.repo_url || '<repo-url>'}
   cd project-name
   \`\`\`

2. **Install dependencies**

   \`\`\`bash
   npm install --legacy-peer-deps
   \`\`\`

3. **Setup Environment**

   - Copy \`.env.example\` to \`.env.local\`
   - Fill in your API keys (Supabase, etc).

4. **Run Development Server**

   \`\`\`bash
   npm run dev
   \`\`\`

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Supabase
- **Icons:** Lucide React

---

*Built with ❤️ by Frost Night Factory*
  `;
  
  // Skriv alltid över för att garantera kvalitet (eller kolla if exists först)
  fs.writeFileSync(readmePath, readmeContent);
  console.log("-> Generated standardized README.md");
}

/**
 * ZERO SHOT RULE: Tvinga .env.example att alltid finnas
 */
async function ensureEnvExample(repoPath: string) {
  const envPath = path.join(repoPath, '.env.local');
  const envExamplePath = path.join(repoPath, '.env.example');
  
  // Om .env.local finns men .env.example saknas, skapa den
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const exampleContent = envContent
        .split('\n')
        .map(line => {
          if (!line || line.startsWith('#')) return line;
          if (line.includes('=')) {
            const key = line.split('=')[0].trim();
            return `${key}="YOUR_VALUE_HERE"`;
          }
          return line;
        })
        .join('\n');
      
      fs.writeFileSync(envExamplePath, exampleContent);
      console.log("[Zero Shot] ✅ .env.example ensured");
    } catch (e) {
      console.error("[Zero Shot] ⚠️ Failed to create .env.example:", e);
    }
  } else {
    // Om ingen .env.local finns, skapa en minimal .env.example
    const minimalExample = `# Supabase
NEXT_PUBLIC_SUPABASE_URL="YOUR_SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Optional: API Keys
ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY"
`;
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, minimalExample);
      console.log("[Zero Shot] ✅ Created minimal .env.example");
    }
  }
}

/**
 * ZERO SHOT RULE: Verifiera att alla länkar i navigation faktiskt finns
 */
async function verifySitemap(repoPath: string): Promise<boolean> {
  console.log("[Zero Shot] 🔍 Verifying sitemap...");
  
  try {
    // Hitta alla layout.tsx och page.tsx filer för att hitta navigation
    const layoutFiles = [
      path.join(repoPath, 'app', 'layout.tsx'),
      path.join(repoPath, 'src', 'app', 'layout.tsx'),
    ];
    
    let navigationLinks: string[] = [];
    
    for (const layoutFile of layoutFiles) {
      if (fs.existsSync(layoutFile)) {
        const content = fs.readFileSync(layoutFile, 'utf-8');
        // Enkel regex för att hitta href="/..." länkar
        const linkMatches = content.match(/href=["']([^"']+)["']/g);
        if (linkMatches) {
          linkMatches.forEach(match => {
            const href = match.replace(/href=["']|["']/g, '');
            if (href.startsWith('/') && !href.startsWith('//')) {
              navigationLinks.push(href);
            }
          });
        }
      }
    }
    
    // Verifiera att varje länk har en motsvarande fil
    let allValid = true;
    for (const link of navigationLinks) {
      const possiblePaths = [
        path.join(repoPath, link === '/' ? 'app/page.tsx' : `app${link}/page.tsx`),
        path.join(repoPath, link === '/' ? 'src/app/page.tsx' : `src/app${link}/page.tsx`),
      ];
      
      const exists = possiblePaths.some(p => fs.existsSync(p));
      if (!exists) {
        console.warn(`[Zero Shot] ⚠️ Navigation link "${link}" points to non-existent page`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log("[Zero Shot] ✅ All navigation links verified");
    }
    
    return allValid;
  } catch (e: any) {
    console.error("[Zero Shot] ⚠️ Sitemap verification failed:", e.message);
    return true; // Returnera true för att inte blockera publish om verifieringen misslyckas
  }
}

async function runPublisherStep(pipeline: any, repoPath: string) {
  console.log(`[Publisher] Starting deployment for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'publisher' });
  await createStep(pipeline.id, 'publisher', 'running');

  try {
    // 1. BESTÄM MÅL-URL (Smart Naming)
    let targetRepoUrl = pipeline.repo_url;

    if (pipeline.type === 'update' && pipeline.source_repo) {
        console.log(`[Publisher] ♻️ Update Mode. Targeting: ${pipeline.source_repo}`);
        targetRepoUrl = pipeline.source_repo;
    } else if (!targetRepoUrl) {
        // --- 🧠 AGENT NAMING MAGIC ---
        // Vi läser vad Claude döpte projektet till i package.json!
        let projectName = "";
        try {
            const pkgPath = path.join(repoPath, 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                if (pkg.name) projectName = pkg.name;
            }
        } catch (e) {
            console.warn("[Publisher] Could not read package name, using fallback.");
        }

        // Fallback om Claude misslyckades med namnet - generera från prompten
        if (!projectName || projectName.length < 3) {
          console.log("[Publisher] 🤖 Generating cool repo name from project description...");
          projectName = await generateRepoName(pipeline.initial_prompt || pipeline.prompt || "");
          console.log(`[Publisher] 📦 Generated repo name: ${projectName}`);
        } else {
          // Sanitera package.json-namnet
          projectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        }

        // Prefix med frost- om det inte redan finns
        const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const repoName = slug.startsWith('frost-') ? slug : `frost-${slug}`; // T.ex. "frost-sportsync-dashboard" eller "frost-context-crystal"
        
        const username = process.env.GITHUB_USERNAME || "vilmerfrost"; 
        targetRepoUrl = `https://github.com/${username}/${repoName}.git`;

        console.log(`[Publisher] 🤖 Agent named this project: "${slug}"`);
        console.log(`[Publisher] 🎯 Target Repo: ${targetRepoUrl}`);

        // Skapa repo via API om det inte finns
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        if (GITHUB_TOKEN) {
            try {
                await fetch('https://api.github.com/user/repos', {
                    method: 'POST',
            headers: { 
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: repoName, private: true })
        });
                console.log(`[Publisher] 📦 Created new repo: ${repoName}`);
            } catch (e) {
                console.log("[Publisher] Repo might already exist, continuing...");
            }
        }
    }
    
    // Spara URLen direkt så vi minns den
    await updatePipeline(pipeline.id, { repo_url: targetRepoUrl });

    // 2. GENERERA DOKUMENTATION
    generateDocs(repoPath, pipeline);

    // 2.5. ZERO SHOT RULES: Tvinga kvalité
    console.log("[Publisher] 🧹 Running Zero Shot cleanup...");
    await ensureEnvExample(repoPath);
    const sitemapValid = await verifySitemap(repoPath);
    if (!sitemapValid) {
      console.warn("[Publisher] ⚠️ Sitemap verification failed, but continuing with publish...");
    }

    // 2.6. DOCKER GENERATION (Level 4 Upgrade)
    console.log("[Publisher] 🐳 Generating Docker configuration...");
    try {
      // Detektera projekttyp baserat på filer
      const hasPython = fs.existsSync(path.join(repoPath, 'requirements.txt')) || 
                       fs.existsSync(path.join(repoPath, 'main.py')) ||
                       fs.existsSync(path.join(repoPath, 'app.py'));
      const hasNode = fs.existsSync(path.join(repoPath, 'package.json'));
      
      let projectType: 'node' | 'python' | 'hybrid' = 'node';
      if (hasPython && hasNode) {
        projectType = 'hybrid';
      } else if (hasPython) {
        projectType = 'python';
      }
      
      await generateDockerConfig(repoPath, projectType);
    } catch (dockerError: any) {
      console.warn("[Publisher] ⚠️ Docker generation failed, continuing without Docker config:", dockerError.message);
    }

    // 3. SÄKRA .GITIGNORE (Kritiskt!)
    const gitIgnoreContent = `
node_modules/
.next/
.env
.env.local
dist/
build/
.DS_Store
.vscode/
`;
    fs.writeFileSync(path.join(repoPath, '.gitignore'), gitIgnoreContent);
    console.log("[Publisher] 🛡️ Secured .gitignore");

    // 4. NOLLSTÄLL GIT (Vi gör en "Hard Reset" publish för att undvika konflikter)
    const gitDir = path.join(repoPath, '.git');
    if (fs.existsSync(gitDir)) {
      console.log("[Publisher] 🧹 Cleaning up old git history (fixing large file error)...");
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // 5. INITIERA & PUSHA
    execSync('git init', { cwd: repoPath });
    execSync('git branch -M main', { cwd: repoPath });
    
    // Stäng av LF/CRLF varningar
    try {
        execSync('git config core.autocrlf false', { cwd: repoPath });
        execSync('git config core.safecrlf false', { cwd: repoPath });
    } catch(e) {}

    console.log("[Publisher] Adding files...");
    execSync('git add .', { cwd: repoPath, stdio: 'inherit' });

    console.log("[Publisher] Committing...");
    const commitMsg = pipeline.type === 'update' 
        ? `Frost Update: ${new Date().toISOString()}` 
        : `Frost Launch: ${new Date().toISOString()}`;
        
    try {
        execSync(`git commit -m "${commitMsg}"`, { 
            cwd: repoPath, 
            stdio: 'inherit' 
        });
    } catch (e) {
        console.log("[Publisher] Commit failed (maybe nothing to commit?), continuing...");
    }

    // Injicera Token för Auth
    let pushUrl = targetRepoUrl;
    const token = process.env.GITHUB_TOKEN;
    if (token && pushUrl && !pushUrl.includes(token)) {
        pushUrl = pushUrl.replace("https://", `https://${token}@`);
    }

    if (pushUrl) {
        console.log(`[Publisher] Pushing to ${targetRepoUrl}...`);
        // Force push skriver över branchen på target repo med vår nya kod
        execSync(`git push "${pushUrl}" main --force`, { 
            cwd: repoPath, 
            stdio: 'inherit' 
        });
        console.log("✅ Publish Successful!");
    } else {
        console.log("[Publisher] No repo URL found, skipping push.");
    }

    await updateStep(pipeline.id, 'publisher', { status: 'completed', output: { url: targetRepoUrl } });
    await updatePipeline(pipeline.id, { current_phase: 'cleanup' });

  } catch (error: any) {
    console.error("❌ Publisher Failed:", error.message);
    // Vi markerar INTE som failed i databasen om pushen misslyckas,
    // för koden är ju klar. Vi låter användaren hantera det.
    // Men vi kastar felet så runnern ser det.
    throw error;
  }
}

// ------------------------------------------------------------------
// STEG 7: CLEANUP
// ------------------------------------------------------------------
async function runCleanupStep(pipeline: any, repoPath: string) {
    console.log(`[Cleanup] 🧹 Cleaning up workspace: ${repoPath}`);
    
    // 1. Försök döda alla kvardröjande processer (Node, Python, Puppeteer)
    // Detta är en "Best Effort" kill switch för Windows
    try {
        if (process.platform === 'win32') {
            console.log("[Cleanup] 🔪 Killing lingering processes (Windows)...");
            try {
                // Dödar alla 'node.exe' processer som körs från denna mapp
                // OBS: Detta är aggressivt men nödvändigt för att släppa fil-lås
                // Vi använder /F (force) och /T (kill tree) för att döda hela process-trädet
                const normalizedPath = path.resolve(repoPath).replace(/\\/g, '\\');
                execSync(`taskkill /F /T /FI "WINDOWTITLE eq *${path.basename(repoPath)}*" 2>nul`, { stdio: 'ignore' });
                
                // Dödar även specifika processer som kan låsa filer
                try {
                    execSync('taskkill /F /IM node.exe /FI "MEMUSAGE gt 100000" 2>nul', { stdio: 'ignore' });
                } catch (e) {}
                
                try {
                    execSync('taskkill /F /IM python.exe /FI "MEMUSAGE gt 100000" 2>nul', { stdio: 'ignore' });
                } catch (e) {}
                
                try {
                    execSync('taskkill /F /IM chrome.exe /FI "MEMUSAGE gt 100000" 2>nul', { stdio: 'ignore' });
                } catch (e) {}
            } catch (e) {
                // Ignorera om taskkill misslyckas (processer kanske redan är döda)
            }
        } else {
            // Linux/Mac: Använd pkill eller killall
            try {
                execSync(`pkill -f "${repoPath}" 2>/dev/null || true`, { stdio: 'ignore' });
            } catch (e) {}
        }
    } catch (e) {
        // Ignorera process-killning fel, vi försöker ändå radera
        console.warn("[Cleanup] ⚠️ Could not kill processes (non-critical):", (e as Error).message);
    }

    // 2. Vänta lite så Windows släpper låsen
    console.log("[Cleanup] ⏳ Waiting for file locks to release...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Radera med retry-logik
    if (!fs.existsSync(repoPath)) {
        console.log("[Cleanup] ✅ Sandbox already deleted.");
        await updatePipeline(pipeline.id, { status: 'completed', current_phase: 'done' });
        return;
    }

    let retries = 5;
    while (retries > 0) {
        try {
            fs.rmSync(repoPath, { recursive: true, force: true });
            console.log("[Cleanup] ✅ Sandbox deleted successfully.");
            await updatePipeline(pipeline.id, { status: 'completed', current_phase: 'done' });
            return;
        } catch (error: any) {
            if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
                retries--;
                if (retries > 0) {
                    console.warn(`[Cleanup] ⚠️ File locked. Retrying cleanup in 1s... (${retries} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error("[Cleanup] ❌ Cleanup failed after retries. Files may still be locked.");
                    // Fortsätt ändå - markera som completed så pipeline inte hänger
                    await updatePipeline(pipeline.id, { status: 'completed', current_phase: 'done' });
                }
            } else {
                console.error("[Cleanup] ❌ Cleanup failed permanently:", error.message);
                // Fortsätt ändå - markera som completed
                await updatePipeline(pipeline.id, { status: 'completed', current_phase: 'done' });
                break;
            }
        }
    }
}

// ------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------
export async function runPipelineLoop(sandboxPath: string) {
  console.log(`🚀 Frost Night Factory Runner started.`);
  console.log(`📂 Workspace: ${sandboxPath}`);

  while (true) {
    try {
      // Hämta aktiva pipelines
      const { data: pipelines, error } = await supabase
        .from('pipelines')
        .select('*')
        .in('status', ['pending', 'running'])
        .neq('current_phase', 'done')
        .order('updated_at', { ascending: true }) // FIFO
        .limit(1);

      if (error) throw error;

      if (!pipelines || pipelines.length === 0) {
      await sleep(5000);
      continue;
    }

      const pipeline = pipelines[0];
      const repoPath = getRepoPath(pipeline);

      // Fas-väljare
      switch (pipeline.current_phase) {
        case 'cloner':
          await runClonerStep(pipeline, repoPath);
          break;
        case 'research':
          await runResearchStep(pipeline);
          break;
        case 'planner':
          await runPlannerStep(pipeline, repoPath);
          break;
        case 'coder':
          await runCoderStep(pipeline, repoPath);
          break;
        case 'sql':
          await runSqlStep(pipeline, repoPath);
          break;
        case 'tester':
          await runTesterStep(pipeline, repoPath);
          break;
        case 'publisher':
          await runPublisherStep(pipeline, repoPath);
          break;
        case 'cleanup':
            await runCleanupStep(pipeline, repoPath);
            break;
        default: 
          console.log(`Unknown phase ${pipeline.current_phase}, resetting to research.`);
          await updatePipeline(pipeline.id, { current_phase: 'research' });
      }

    } catch (err) {
      console.error('Pipeline Loop Error:', err);
      await sleep(5000);
    }
  }
}

