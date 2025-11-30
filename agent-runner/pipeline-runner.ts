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
  runKimiQA
} from '../lib/nightFactory/modelClient';
import { GOLDEN_COMPONENTS } from './lib/golden-components';

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

  const researchPrompt = `Analyze this app idea: "${pipeline.initial_prompt || pipeline.prompt}". 
  Provide a technical implementation strategy for Next.js 15 (App Router) + Supabase + Tailwind.
  List specific core features, data models, and critical libraries needed.`;

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

  const planPrompt = `
    ${promptPrefix}
    
    Request: "${pipeline.initial_prompt}"
    
    Based on the research below, create a detailed implementation plan for a Next.js 15 app.
    
    RESEARCH:
    ${JSON.stringify(researchData).substring(0, 5000)}

    Create a detailed coding plan. Return a JSON structure with:
    - file_structure (tree with all files needed)
    - dependencies (list of npm packages)
    - step_by_step_implementation (ordered list of tasks)
    - database_schema (tables and relationships)
  `;

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
      output: { content: plan } 
    });
    await updatePipeline(pipeline.id, { current_phase: 'coder' });
  } catch (error) {
    console.error('[Planner] Failed:', error);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

// ------------------------------------------------------------------
// STEG 3: CODER (Med Fixar för Config/CSS)
// ------------------------------------------------------------------
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
  const systemContext = `You are a World-Class Fullstack Engineer building a Next.js 15 App.

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

OUTPUT FORMAT:
Use this exact format for every file:
### FILE: path/to/file.ext
File content here...
    ### END_FILE

REQUIRED FILES:
- package.json (scripts: dev, build, start + pinned dependencies)
- tailwind.config.ts (with content paths)
- postcss.config.js (with tailwindcss and autoprefixer)
- app/layout.tsx, app/page.tsx
- app/globals.css (ONLY Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;)
- lib/supabase/client.ts, lib/supabase/server.ts
- components/ui/* (Create all UI components you use)

NEXT.JS 15 RULES:
- No 'use client' in layout.tsx if possible.
- Use 'next/link' for navigation.
- Do NOT include markdown code blocks inside file content.`;

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
    let rawOutput: string;
    let maxIterations = 3; // Max antal review-iterationer
    let iteration = 0;
    
    // SMART ROUTER: Välj rätt AI
    if (isNewProject) {
      console.log("[Coder] 🚀 New project detected. Using Claude 4.5 Sonnet (premium quality)...");
      rawOutput = await generateClaudeCoder(taskPrompt, systemContext);
    } else {
      console.log("[Coder] 🔧 Small change detected. Trying Localhost (Qwen) first...");
      try {
        rawOutput = await generateLocalCoder(taskPrompt, systemContext);
        console.log("[Coder] ✅ Localhost generation successful!");
      } catch (localError) {
        console.log("[Coder] ⚠️ Localhost failed, falling back to Claude...");
        rawOutput = await generateClaudeCoder(taskPrompt, systemContext);
      }
    }
    
    // Regex parsing strategy
    const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
    let match;
    let filesCreated = 0;

    while ((match = fileRegex.exec(rawOutput)) !== null) {
      let [_, fileName, content] = match;
      fileName = fileName.trim();
      
      // Cleanup paths
      if (!fileName.startsWith('app') && !fileName.startsWith('src') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('lib') && !fileName.startsWith('components')) {
        // Remove potentially hallucinated root folders like 'my-app/'
        const parts = fileName.split('/');
        if (parts.length > 1) fileName = parts.slice(1).join('/');
      }

      // 1. THE SANITIZER: Ta bort alla Markdown-artefakter
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

    if (filesCreated === 0) throw new Error("AI generated 0 valid files.");

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
      const codeFiles = ['app', 'components', 'lib'];
      
      for (const dir of codeFiles) {
        const dirPath = path.join(repoPath, dir);
        if (fs.existsSync(dirPath)) {
          const files = getAllFiles(dirPath);
          for (const file of files) {
            if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
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
      
      // Skicka till Localhost Reviewer
      console.log(`[Coder] 📝 Review iteration ${iteration + 1}/${maxIterations}...`);
      const reviewComments = await generateLocalReview(allCode.substring(0, 10000), "Check for bugs regarding Next.js 15 App Router compatibility, TypeScript errors, and React hooks misuse.");
      
      // Kolla svaret
      if (reviewComments.toUpperCase().includes('LGTM') || reviewComments.toUpperCase().includes('LOOKS GOOD')) {
        console.log("[Coder] ✅ Local Review Passed! Code looks good.");
        needsFix = false;
        break; // Avbryt review-loopen, koden är bra
      } else {
        console.log(`[Coder] ⚠️ Local Review found issues:`);
        console.log(reviewComments);
        needsFix = true;
        iteration++;
        
        if (iteration < maxIterations) {
          console.log(`[Coder] 🔧 Generating fixes...`);
          // Skicka tillbaka till Claude för fix (Claude fixar, Qwen granskar)
          // Men om Qwen (Local) timeoutade och returnerade "LGTM", så slipper du betala Claude för en onödig fix-runda.
          const fixPrompt = `
The code reviewer found these issues:
${reviewComments}

Please fix these issues in the code. Return the fixed code using the same ### FILE: format.
Only fix the files that have issues. Keep everything else unchanged.
          `;
          
          try {
            // Försök med Localhost för fixes
            rawOutput = await generateLocalCoder(fixPrompt, systemContext);
            console.log("[Coder] ✅ Localhost fix generation successful!");
          } catch (localError) {
            // Fallback till Claude för fixes
            rawOutput = await generateClaudeCoder(fixPrompt, systemContext);
            console.log("[Coder] ✅ Claude fix generation successful!");
          }
          
          // Parsa och uppdatera filer igen
          const fixRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
          let fixMatch;
          let filesFixed = 0;
          
          while ((fixMatch = fixRegex.exec(rawOutput)) !== null) {
            let [_, fileName, content] = fixMatch;
            fileName = fileName.trim();
            
            // Cleanup paths
            if (!fileName.startsWith('app') && !fileName.startsWith('src') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('lib') && !fileName.startsWith('components')) {
              const parts = fileName.split('/');
              if (parts.length > 1) fileName = parts.slice(1).join('/');
            }
            
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

  Generate an idempotent migration file for the following project.

  

  INPUT PLAN:

  ${JSON.stringify(plannerStep?.output || {})}



  STRICT REQUIREMENTS:

      1. Use "CREATE TABLE IF NOT EXISTS".

  2. Enable RLS on all tables: "ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;".

  3. Create Policies for SELECT, INSERT, UPDATE, DELETE for authenticated users (using "auth.uid() = user_id").

  4. Use "DROP POLICY IF EXISTS <name> ON <table_name>;" before creating policies.

  

  CRITICAL: CLEAN SLATE PROTOCOL

  - Before creating tables, generate "DROP TABLE IF EXISTS table_name CASCADE;" for every table you intend to create.

  - This ensures we don't have schema mismatches with old data.

  - Exception: Do NOT drop 'pipelines', 'pipeline_steps', or 'tickets' (System tables).

  

  TRIGGER SYNTAX (CRITICAL):

  - You MUST include "BEFORE UPDATE" or "AFTER INSERT" in create trigger statements.

  - ERROR EXAMPLE: "CREATE TRIGGER x ON y" -> FAILS.

  - CORRECT EXAMPLE: "CREATE TRIGGER x BEFORE UPDATE ON y FOR EACH ROW EXECUTE FUNCTION ..."

  - For DROP TRIGGER, you MUST specify the table: "DROP TRIGGER IF EXISTS x ON y;"

  - If you use a trigger for 'updated_at', YOU MUST include this complete block:

    CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

    CREATE OR REPLACE FUNCTION public.moddatetime()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_updated_at ON table_name;
    CREATE TRIGGER update_updated_at
      BEFORE UPDATE ON table_name
      FOR EACH ROW
      EXECUTE FUNCTION public.moddatetime();



  TASK 2: SEED DATA GENERATION
  - At the end of the SQL file, add INSERT statements.
  - Insert 3-5 realistic rows into main tables (e.g. 'users', 'events', 'posts').
  - Use "ON CONFLICT DO NOTHING" to prevent errors on re-runs.
  - This is CRITICAL so the UI isn't empty and users can see real data immediately.
  - Make the data realistic and relevant to the app's purpose (e.g. if it's a sports app, use sports-related data).

  CRITICAL: SEED DATA RULES
  1. Always use gen_random_uuid() for IDs.
  2. When using "ON CONFLICT (column_name) DO NOTHING", you MUST ensure that 'column_name' has a UNIQUE constraint created earlier in the script.
  3. Example: 
     CREATE TABLE users (email TEXT UNIQUE, ...); 
     ...
     INSERT INTO users ... ON CONFLICT (email) DO NOTHING;
  4. Ensure all foreign keys reference valid IDs (use subqueries or variables if needed, or just insert independent data).

  OUTPUT FORMAT:

  Return ONLY the raw SQL code. No markdown formatting, no explanations.
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
      await updateStep(pipeline.id, 'sql', { status: 'failed', output: { error: dbError.message } });
      await updatePipeline(pipeline.id, { status: 'failed' });
      return; // Stop pipeline
        } finally {
            await sql.end();
        }

  } catch (error) {
    console.error('[SQL] Agent Failed:', error);
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
      The Code Auditor (Kimi k2) found the following issues (likely Mock Data or logical gaps):
      
      ${auditResult}
      
      YOUR TASK:
      1. Fix the issues immediately. Replace mocks with real Supabase calls.
      2. Return ONLY the fixed file content using ### FILE: <filename> format.
      3. Use real database queries: supabase.from('table_name').select(), fetch(), or server actions.
      4. Remove any hardcoded arrays like const users = [{id: 1, name: 'John'}].
      `;

      // Använd Claude (eller DeepSeek V3 om du vill spara pengar) för att fixa
      const fixedCode = await generateClaudeCoder(fixPrompt, "You are a Senior Developer fixing code review issues. No explanations. Return only code files.");

      // 4. Skriv över filerna
      const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
      let match;
      let fixedCount = 0;
      
      while ((match = fileRegex.exec(fixedCode)) !== null) {
        const fileName = match[1].trim();
        let content = match[2].trim();
        
        // Sanitizer (samma som vi lade in förut)
        content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "").trim();
        
        const filePath = path.join(repoPath, fileName);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, content);
        console.log(`-> 🛠️ Audit Fix Applied: ${fileName}`);
        fixedCount++;
      }
      
      if (fixedCount === 0) {
        console.warn("⚠️ No files were fixed. Audit loop will retry...");
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
async function runTesterStep(pipeline: any, repoPath: string) {
  console.log(`[Tester] Starting verification for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'tester' });
  await createStep(pipeline.id, 'tester', 'running');

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

      // Strategi: Om det är ett import-fel ("Cannot find module"), måste vi ofta SKAPA en fil.
      // Vi försöker hitta vilken fil som har felet.
      // TSC Output format: "src/app/page.tsx(1,1): error TS..."
      const match = fullLog.match(/([a-zA-Z0-9_\-\/\\]+\.(tsx|ts|js|jsx))\(/);
      let brokenFile = match ? match[1] : "";
      
      // Städa sökvägen (ta bort eventuellt 'agent-runner/workspace/...' prefix om det kom med)
      if (brokenFile.includes("sandbox")) {
        const parts = brokenFile.split("sandbox");
        if (parts.length > 1) {
          // Hitta pipeline-mappen och ta allt efter den
          const relativePath = parts[1].split(path.sep).slice(2).join(path.sep);
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

      let brokenFileContent = "";
      if (brokenFile) {
        try {
          // Försök läsa filen som kastar felet
          brokenFileContent = fs.readFileSync(path.join(repoPath, brokenFile), 'utf-8');
        } catch (e) {
          console.log(`Could not read broken file: ${brokenFile}`);
        }
      }

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
      const promptContext = `
      You are a Senior TypeScript Fixer.
      
      ERROR CONTEXT:
      - Build failed. Review the LOG and the CURRENT PROJECT STRUCTURE above.
      
      TASKS FOR "TS2307 / Cannot find module":
      1. SEARCH the "CURRENT PROJECT STRUCTURE" list for the missing file.
      2. IF FOUND (e.g. wrong casing or path): Fix the import path in the broken file.
      3. IF NOT FOUND: You MUST CREATE the missing file (e.g. 'components/auth/LoginForm.tsx') with valid boilerplate code.
      
      TASKS FOR "TS2349 / Syntax Errors":
      1. Remove any Markdown artifacts (like \`\`\`typescript at line 1).
      2. Fix syntax errors.

      RETURN FORMAT:
      Return the fixed file (or the NEW file) using strictly:
      ### FILE: <path>
      ... code ...
      ### END_FILE
      `;

      // 3. ANROPA AGENT (DeepSeek eller Local)
      if (attempt <= 3) {
        console.log("🐕 Watchdog (DeepSeek V3) analyzing with File System Vision...");
        // Vi lägger till fileTreeContext i prompten!
        fixOutput = await generateBuildFix(promptContext + "\nLOG:\n" + fullLog + "\n" + fileTreeContext, brokenFileContent);
      } else {
        console.log("🏠 Local Watchdog (Qwen 14B) taking over...");
        fixOutput = await generateLocalFix(promptContext + "\nLOG:\n" + fullLog + "\n" + fileTreeContext, brokenFileContent);
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

      if (fixedCount === 0) console.log("[Watchdog] ⚠️ No code changes applied.");
    }
  }

  if (success) {
    await updateStep(pipeline.id, 'tester', { status: 'completed' });
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

async function runPublisherStep(pipeline: any, repoPath: string) {
  console.log(`[Publisher] Starting deployment for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'publisher' });
  await createStep(pipeline.id, 'publisher', 'running');

  try {
    // 1. GENERERA DOKUMENTATION FÖRST
    generateDocs(repoPath, pipeline);

    // 2. SÄKRA .GITIGNORE (Kritiskt!)
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

    // 3. NOLLSTÄLL GIT (För att bli av med den trasiga 170MB committen)
    const gitDir = path.join(repoPath, '.git');
    if (fs.existsSync(gitDir)) {
      console.log("[Publisher] 🧹 Cleaning up old git history (fixing large file error)...");
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // 4. INITIERA NY GIT
    execSync('git init', { cwd: repoPath });
    execSync('git branch -M main', { cwd: repoPath });
    
    // Stäng av LF/CRLF varningar
    try {
        execSync('git config core.autocrlf false', { cwd: repoPath });
        execSync('git config core.safecrlf false', { cwd: repoPath });
    } catch(e) {}

    // 5. GIT ADD & COMMIT (Nu är node_modules ignorerad!)
    console.log("[Publisher] Adding files (clean)...");
    execSync('git add .', { cwd: repoPath, stdio: 'inherit' });

    console.log("[Publisher] Committing...");
    try {
        execSync(`git commit -m "Frost Launch: ${new Date().toISOString()}"`, { 
            cwd: repoPath, 
            stdio: 'inherit' 
        });
    } catch (e) {
        console.log("[Publisher] Commit failed (maybe nothing to commit?), continuing...");
    }

    // 6. GIT PUSH
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

    if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
      console.log("Missing GitHub creds, skipping push.");
      await updatePipeline(pipeline.id, { current_phase: 'cleanup' });
      return;
    }

    const repoName = `frost-${pipeline.id.substring(0, 8)}`;
    const repoUrl = `https://github.com/${GITHUB_USERNAME}/${repoName}.git`;

    // Skapa repo via API
    try {
        await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: repoName, private: true })
        });
    } catch (e) {
        console.log("Repo might already exist, trying to push anyway...");
    }

    // Injicera token i URL för auth
    let pushUrl = repoUrl;
    if (GITHUB_TOKEN && !pushUrl.includes(GITHUB_TOKEN)) {
        // Hantera https://github.com/user/repo format
        pushUrl = pushUrl.replace("https://", `https://${GITHUB_TOKEN}@`);
    }

    console.log("[Publisher] Pushing to GitHub...");
    // Vi använder --force eftersom vi skrev över historiken
    execSync(`git push "${pushUrl}" main --force`, { 
        cwd: repoPath, 
        stdio: 'inherit' 
    });

    console.log("✅ Publish Successful!");
    await updatePipeline(pipeline.id, { repo_url: repoUrl });
    await updateStep(pipeline.id, 'publisher', { status: 'completed', output: { url: repoUrl } });
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
    console.log(`[Cleanup] Removing sandbox: ${repoPath}`);
    
    try {
        // Skarp radering
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
        console.log("Sandbox deleted successfully.");
    } catch (e) {
        console.error("Cleanup failed (permissions?):", e);
    }

    await updatePipeline(pipeline.id, { status: 'completed', current_phase: 'done' });
}

// ------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------
async function runPipelineLoop(sandboxPath: string) {
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

// Starta
const sandboxDir = path.join(process.cwd(), 'workspace', 'sandbox');
export { runPipelineLoop };
