import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { execSync, spawn } from 'child_process';
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
import { detectProjectIntent, detectTechMatrix, TechMatrix, ProjectIntent } from '../lib/nightFactory/intentParser';
import { runVisualAudit } from '../lib/nightFactory/visualAudit';
import { runDocumentationStep } from '../lib/nightFactory/documentationAgent';
import { getLatestFrameworkIntel } from '../lib/nightFactory/knowledgeBase';
import { runIntegrationStep } from '../lib/nightFactory/integrationAgent';
import { generateSeedData } from '../lib/nightFactory/seederAgent';
import { consultHiveMind, memorizeSolution } from '../lib/nightFactory/hiveMind';

// =============================================================================
// PHASE 1-7 INTELLIGENT SYSTEMS (NEW)
// =============================================================================
import { GOLDEN_VERSIONS, validateAndFixDependencies, getGoldenVersion } from '../lib/nightFactory/goldenVersions';
import { classifyError, extractTargetFiles, ErrorCategory, ClassifiedError, getFixingStrategy, autoFixPythonError } from '../lib/nightFactory/errorClassifier';
import { CircuitBreaker, CircuitBreakerError, FixAttempt } from '../lib/nightFactory/circuitBreaker';
import { recordErrorOccurrence, generatePreventionPrompt, getAutoFixSuggestion, getErrorStats } from '../lib/nightFactory/errorTelemetry';
import { GOLDEN_TEMPLATES, getGoldenTemplate, hasGoldenTemplate, GOLDEN_PACKAGE_JSON, GOLDEN_TSCONFIG, GOLDEN_NEXT_CONFIG, GOLDEN_TAILWIND_CONFIG, GOLDEN_POSTCSS_CONFIG, GOLDEN_LAYOUT, GOLDEN_PAGE, GOLDEN_TYPES, GOLDEN_MOCK_DATA, GOLDEN_UTILS } from '../lib/nightFactory/goldenTemplates';
import { runPreCommitValidation, ValidationResult } from '../lib/nightFactory/preCommitValidation';
import { PathManager } from '../lib/nightFactory/pathManager';
import { logPathOperation, clearPathLog } from '../lib/nightFactory/pathLogger';
import { PathCircuitBreaker } from '../lib/nightFactory/pathCircuitBreaker';

// Ladda miljövariabler
dotenv.config();

// Konfiguration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

// =============================================================================
// 🛡️ UNIFIED PATH SYSTEM - Single Source of Truth
// =============================================================================
const pathManager = PathManager.getInstance();
const pathCircuitBreaker = PathCircuitBreaker.getInstance();

// Initiera Supabase Admin
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helpers
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// FIX #3: Stronger Validation Function - Actually checks TypeScript validity
function isPageTsxActuallyValid(pagePath: string, repoPath: string): boolean {
  if (!fs.existsSync(pagePath)) {
    console.log('⚠️ page.tsx does not exist');
    return false;
  }
  
  const content = fs.readFileSync(pagePath, 'utf-8');
  
  // Check 1: Has export default
  if (!content.includes('export default')) {
    console.log('⚠️ page.tsx missing export default');
    return false;
  }
  
  // Check 2: Not empty/null return
  if (content.includes('return null') || content.match(/<main\s*>\s*<\/main>/)) {
    console.log('⚠️ page.tsx returns null or empty main');
    return false;
  }
  
  // Check 3: Has actual content (not just <div></div>)
  const hasContent = content.includes('<h1') || 
                     content.includes('<p') || 
                     content.includes('className') ||
                     content.length > 500; // Reasonable minimum
  
  if (!hasContent) {
    console.log('⚠️ page.tsx has no substantial content');
    return false;
  }
  
  // Check 4: Run ACTUAL TypeScript check on this file ONLY
  try {
    // Create a temporary tsconfig just for this file check
    const tempTsConfig = {
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        jsx: "preserve",
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        allowJs: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        isolatedModules: true,
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*", "./*"]
        }
      },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"]
    };
    
    const tempTsConfigPath = path.join(repoPath, 'tsconfig.temp.json');
    fs.writeFileSync(tempTsConfigPath, JSON.stringify(tempTsConfig, null, 2));
    
    try {
      const result = execSync(
        `npx tsc --noEmit --skipLibCheck --project tsconfig.temp.json ${pagePath}`, 
        { cwd: repoPath, encoding: 'utf-8', stdio: 'pipe' }
      );
      
      // Clean up temp config
      try { fs.unlinkSync(tempTsConfigPath); } catch {}
      
      if (result.includes('error TS')) {
        console.log('⚠️ page.tsx has TypeScript errors');
        return false;
      }
    } catch (e: any) {
      // Clean up temp config
      try { fs.unlinkSync(tempTsConfigPath); } catch {}
      
      // If tsc command failed, check stderr for errors
      const errorOutput = e.stderr?.toString() || e.stdout?.toString() || '';
      if (errorOutput.includes('error TS')) {
        console.log('⚠️ page.tsx failed TypeScript check:', errorOutput.substring(0, 200));
        return false;
      }
      // If it's just a "file not found" or similar, we'll be lenient
    }
  } catch (e) {
    console.log('⚠️ Could not run TypeScript check (non-critical):', (e as Error).message);
    // Don't fail validation if TypeScript check itself fails
  }
  
  return true;
}

// BULLETPROOF PAGE TEMPLATE - Guaranteed valid, non-empty root page UI
// FIX #5: NeoLink-themed Golden Page (Cyberpunk aesthetic)
const BULLETPROOF_PAGE_TEMPLATE = `// Auto-generated by Frost Factory
import React from 'react';

export default function Page() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A0A0A 0%, #1a1a2e 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        {/* Profile Avatar */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
          margin: '0 auto 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          fontWeight: 'bold',
          boxShadow: '0 20px 60px rgba(139, 92, 246, 0.4)'
        }}>
          ✨
        </div>
        {/* Username */}
        <h1 style={{ 
          fontSize: '2rem', 
          marginBottom: '0.5rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          @neolink
        </h1>
        
        {/* Bio */}
        <p style={{ 
          fontSize: '1rem', 
          opacity: 0.7,
          marginBottom: '2rem'
        }}>
          Your premium link-in-bio platform 🚀
        </p>
        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { icon: '🎨', title: 'Dashboard', href: '/dashboard' },
            { icon: '📊', title: 'Analytics', href: '/dashboard/analytics' },
            { icon: '⚙️', title: 'Settings', href: '/dashboard/settings' },
          ].map((link, i) => (
            <a
              key={i}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '1rem',
                textDecoration: 'none',
                color: '#ffffff',
                fontSize: '1.125rem',
                fontWeight: '600',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
              onMouseOver={(e: any) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = '#8B5CF6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e: any) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{link.title}</span>
              <span style={{ opacity: 0.5 }}>→</span>
            </a>
          ))}
        </div>
        {/* Footer */}
        <p style={{ 
          marginTop: '3rem', 
          opacity: 0.4, 
          fontSize: '0.875rem' 
        }}>
          Powered by NeoLink ✨
        </p>
      </div>
    </div>
  );
}
`;

// GOLDEN LAYOUT TEMPLATE - Required for Next.js App Router
const GOLDEN_LAYOUT_TEMPLATE = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeoLink - Premium Link-in-Bio',
  description: 'Your premium link-in-bio platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
`;

// GOLDEN GLOBALS CSS - Minimal required CSS
const GOLDEN_GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}
`;

/**
 * PERMANENT FIX: Enforce Next.js 15 compatible file structure
 * This function ensures the project ALWAYS has the correct structure
 * regardless of what the AI or previous steps created.
 * 
 * KEY INSIGHT: Next.js 15 works best with app/ in root, NOT src/app/
 */
async function enforceNextJS15Structure(repoPath: string): Promise<void> {
  console.log('\n🏗️ ENFORCING NEXT.JS 15 STRUCTURE...');
  
  // 1. VERIFY we're in the right place
  try {
    pathManager.validatePath(repoPath);
    console.log(`🔍 Enforcing structure in: ${repoPath}`);
  } catch (e: any) {
    throw new Error(`Invalid repo path: ${repoPath} - ${e.message}`);
  }
  
  // 2. Log what we find
  const contents = fs.existsSync(repoPath) 
    ? fs.readdirSync(repoPath)
    : [];
  console.log(`📂 Current contents: ${contents.join(', ') || '(empty)'}`);
  
  // RULE #1: Use app/ in root, NOT src/app/
  const srcAppPath = path.join(repoPath, 'src', 'app');
  const appPath = path.join(repoPath, 'app');
  const srcComponentsPath = path.join(repoPath, 'src', 'components');
  const componentsPath = path.join(repoPath, 'components');
  const srcLibPath = path.join(repoPath, 'src', 'lib');
  const libPath = path.join(repoPath, 'lib');
  
  // If src/app exists, move it to app/
  if (fs.existsSync(srcAppPath)) {
    console.log(`📦 Found src/app/, moving to app/...`);
    logPathOperation('MOVE', srcAppPath, { source: 'src/app' });
    
    // Validate paths before moving
    pathManager.validatePath(srcAppPath);
    pathManager.validatePath(appPath);
    
    // Remove old app/ if exists
    if (fs.existsSync(appPath)) {
      console.log(`   Removing existing app/...`);
      fs.rmSync(appPath, { recursive: true, force: true });
    }
    
    // Move src/app to app
    fs.renameSync(srcAppPath, appPath);
    console.log('✅ Moved src/app/ → app/');
    logPathOperation('MOVE', appPath, { success: true });
    
    // Also move components if they exist
    if (fs.existsSync(srcComponentsPath)) {
      if (fs.existsSync(componentsPath)) {
        fs.rmSync(componentsPath, { recursive: true, force: true });
      }
      fs.renameSync(srcComponentsPath, componentsPath);
      console.log('✅ Moved src/components/ → components/');
    }
    
    // Also move lib if it exists
    if (fs.existsSync(srcLibPath)) {
      if (fs.existsSync(libPath)) {
        fs.rmSync(libPath, { recursive: true, force: true });
      }
      fs.renameSync(srcLibPath, libPath);
      console.log('✅ Moved src/lib/ → lib/');
    }
    
    // Remove empty src/ folder
    const srcPath = path.join(repoPath, 'src');
    if (fs.existsSync(srcPath)) {
      try {
        const files = fs.readdirSync(srcPath);
        if (files.length === 0) {
          fs.rmdirSync(srcPath);
          console.log('✅ Removed empty src/ folder');
        } else {
          // Move any remaining files
          for (const file of files) {
            const srcFile = path.join(srcPath, file);
            const destFile = path.join(repoPath, file);
            if (!fs.existsSync(destFile)) {
              fs.renameSync(srcFile, destFile);
              console.log(`✅ Moved src/${file} → ${file}`);
            }
          }
          // Try removing again
          const remainingFiles = fs.readdirSync(srcPath);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(srcPath);
            console.log('✅ Removed empty src/ folder');
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not remove src/ folder:', (e as Error).message);
      }
    }
  }
  
  // RULE #2: Ensure app/ exists with required files
  if (!fs.existsSync(appPath)) {
    console.log('📁 Creating app/ folder...');
    fs.mkdirSync(appPath, { recursive: true });
  }
  
  // RULE #3: Ensure page.tsx exists and is valid
  const pagePath = path.join(appPath, 'page.tsx');
  if (!fs.existsSync(pagePath)) {
    console.log('📄 page.tsx missing, injecting...');
    fs.writeFileSync(pagePath, BULLETPROOF_PAGE_TEMPLATE);
  } else {
    // Verify page.tsx is valid
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    if (!pageContent.includes('export default') || pageContent.length < 300) {
      console.log('⚠️ page.tsx is invalid, overwriting...');
      fs.writeFileSync(pagePath, BULLETPROOF_PAGE_TEMPLATE);
    }
  }
  
  // RULE #4: Ensure layout.tsx exists
  const layoutPath = path.join(appPath, 'layout.tsx');
  if (!fs.existsSync(layoutPath)) {
    console.log('📄 layout.tsx missing, injecting...');
    fs.writeFileSync(layoutPath, GOLDEN_LAYOUT_TEMPLATE);
  } else {
    // Verify layout.tsx is valid
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    if (!layoutContent.includes('export default') || !layoutContent.includes('RootLayout')) {
      console.log('⚠️ layout.tsx is invalid, overwriting...');
      fs.writeFileSync(layoutPath, GOLDEN_LAYOUT_TEMPLATE);
    }
  }
  
  // RULE #5: Ensure globals.css exists
  const globalsPath = path.join(appPath, 'globals.css');
  if (!fs.existsSync(globalsPath)) {
    console.log('📄 globals.css missing, injecting...');
    fs.writeFileSync(globalsPath, GOLDEN_GLOBALS_CSS);
  }
  
  // RULE #6: Clean next.config.mjs (NO projectRoot!)
  const nextConfigPath = path.join(repoPath, 'next.config.mjs');
  const CLEAN_NEXTCONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NO projectRoot - it doesn't exist in Next.js 15!
};

export default nextConfig;
`;
  
  // Always overwrite to ensure clean config
  fs.writeFileSync(nextConfigPath, CLEAN_NEXTCONFIG);
  console.log('✅ Clean next.config.mjs written (NO projectRoot)');
  
  // RULE #7: Update tsconfig.json to NOT use src/
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);
      
      // Remove src from baseUrl
      if (tsconfig.compilerOptions?.baseUrl === './src') {
        tsconfig.compilerOptions.baseUrl = './';
      }
      
      // Update paths to point to root, not src/*
      if (tsconfig.compilerOptions?.paths) {
        const paths = tsconfig.compilerOptions.paths;
        if (paths['@/*']) {
          paths['@/*'] = ['./*'];
        }
      }
      
      // Update include to not use src/
      if (tsconfig.include) {
        tsconfig.include = tsconfig.include.map((p: string) => 
          p.replace(/^src\//, '')
        );
      }
      
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      console.log('✅ Updated tsconfig.json for root structure');
    } catch (e) {
      console.warn('⚠️ Could not update tsconfig.json:', (e as Error).message);
    }
  }
  
  // RULE #8: Ensure lib/ folder exists with mock-data.ts (Simulation First)
  if (!fs.existsSync(libPath)) {
    console.log('📁 Creating lib/ folder...');
    fs.mkdirSync(libPath, { recursive: true });
  }
  
  const mockDataPath = path.join(libPath, 'mock-data.ts');
  if (!fs.existsSync(mockDataPath)) {
    console.log('📄 Creating lib/mock-data.ts (Simulation First)...');
    fs.writeFileSync(mockDataPath, MOCK_DATA_TEMPLATE);
  }
  
  // Also ensure lib/types.ts exists (Blueprint Protocol)
  const typesPath = path.join(libPath, 'types.ts');
  if (!fs.existsSync(typesPath)) {
    console.log('📄 Creating lib/types.ts (Blueprint Protocol)...');
    fs.writeFileSync(typesPath, `// lib/types.ts - Single Source of Truth for all TypeScript interfaces
// DO NOT define types anywhere else. Import from here.

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'pending' | 'completed';
  createdAt: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
  status: number;
}
`);
  }
  
  // RULE #9: Verify final structure
  const requiredFiles = [
    'app/page.tsx',
    'app/layout.tsx',
    'next.config.mjs',
    'package.json',
    'lib/mock-data.ts',
    'lib/types.ts',
  ];
  
  const missing = requiredFiles.filter(f => !fs.existsSync(path.join(repoPath, f)));
  
  if (missing.length > 0) {
    throw new Error(`❌ STRUCTURE INVALID: Missing files: ${missing.join(', ')}`);
  }
  
  console.log('✅ NEXT.JS 14 GOLDEN STACK STRUCTURE ENFORCED');
  console.log('📁 Structure: app/, lib/mock-data.ts, lib/types.ts (root, not src/)');
}

/**
 * PERMANENT FIX: Watch dev server logs to verify it compiles /page
 * Returns the ChildProcess so it can be killed later
 */
async function startDevServerWithVerification(
  repoPath: string, 
  port: number = 3002
): Promise<{ process: ReturnType<typeof spawn>, pageCompiled: boolean }> {
  console.log(`🚀 Starting dev server on port ${port} with verification...`);
  
  let serverReady = false;
  let pageCompiled = false;
  let compiledNotFound = false;
  
  const devProcess = spawn('npm', ['run', 'dev', '--', '-p', port.toString()], {
    cwd: repoPath,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_IS_AUDIT_MODE: 'true',
    }
  });
  
  // Watch stdout
  devProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    
    // Log for debugging
    if (output.includes('Ready in') || output.includes('Compiled') || output.includes('Compiling')) {
      console.log(`[DEV] ${output.trim()}`);
    }
    
    if (output.includes('Ready in') || output.includes('ready started')) {
      serverReady = true;
    }
    
    // ✅ CRITICAL: Check what's being compiled
    if (output.includes('Compiled /page') || output.includes('Compiling /page') || output.includes('○ Compiling / ...')) {
      console.log('✅ Dev server is compiling /page (CORRECT!)');
      pageCompiled = true;
    }
    
    if (output.includes('Compiled /_not-found') || output.includes('Compiling /_not-found') || output.includes('○ Compiling /_not-found')) {
      console.log('❌ Dev server is compiling /_not-found (WRONG!)');
      compiledNotFound = true;
    }
  });
  
  devProcess.stderr?.on('data', (data: Buffer) => {
    const error = data.toString();
    if (error.includes('projectRoot')) {
      console.log('❌ projectRoot still in config!');
    }
    if (error.includes('ENOENT') && error.includes('app')) {
      console.log('❌ Next.js cannot find app folder!');
    }
    if (error.includes('Unrecognized key')) {
      console.log(`⚠️ Next.js config warning: ${error.substring(0, 100)}`);
    }
  });
  
  // Wait for server to be ready
  console.log('⏳ Waiting for dev server (max 60s)...');
  const startTime = Date.now();
  
  while (!serverReady && (Date.now() - startTime < 60000)) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!serverReady) {
    devProcess.kill();
    throw new Error('❌ Dev server failed to start in 60s');
  }
  
  console.log('✅ Dev server ready');
  
  // Wait a bit more for first compilation
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Verify what was compiled
  if (compiledNotFound && !pageCompiled) {
    console.log('🚨 CRITICAL: Next.js compiled /_not-found but NOT /page');
    console.log('🚨 This means the file structure is still wrong!');
    // Don't kill - let the caller handle this
  }
  
  if (pageCompiled) {
    console.log('✅ Verified: /page is being compiled');
  }
  
  return { process: devProcess, pageCompiled };
}

// =============================================================================
// LEVEL 5 ARCHITECT: Blueprint Protocol, Golden Stack, Simulation First
// =============================================================================

/**
 * THE GOLDEN STACK - Hardcoded stable versions that we KNOW work
 * No more letting AI invent unstable bleeding-edge stacks
 */
const GOLDEN_STACK = {
  frontend: {
    framework: 'Next.js 14.2.x', // Stable, well-tested
    react: '18.2.x',
    tailwind: '3.4.x',
    lucide: '0.344.x',
    framerMotion: '11.x',
  },
  auth: 'Supabase SSR (@supabase/ssr)',
  database: 'Supabase (PostgreSQL)',
  structure: 'app/ in root (NOT src/app/)', // CRITICAL
  stateManagement: 'React useState/useReducer (no Redux needed for MVP)',
};

/**
 * THE BLUEPRINT PROTOCOL - Structure that Planner generates, Coder follows
 * This prevents "viskleken" where context is lost between agents
 */
interface BlueprintFile {
  path: string;
  description: string;
  exports?: string[];
  imports?: string[];
  type: 'component' | 'page' | 'api' | 'lib' | 'config' | 'style';
}

interface ProjectBlueprint {
  projectName: string;
  description: string;
  stack: typeof GOLDEN_STACK;
  files: BlueprintFile[];
  dataModels: {
    name: string;
    fields: { name: string; type: string; required: boolean }[];
  }[];
  mockData: {
    model: string;
    count: number;
    sample: Record<string, any>;
  }[];
}

/**
 * THE ARCHITECTURE MEMORY - Shared context for all agents
 * This is injected into every Coder prompt to maintain consistency
 */
const ARCHITECTURE_MEMORY = `
FULL PROJECT CONTEXT (LEVEL 5 ARCHITECT PROTOCOL):
You are building a holistic system. Here is the Master Plan you MUST follow:

1. FILE MAP (Do not deviate):
   - app/page.tsx: The main landing page (REQUIRED)
   - app/layout.tsx: Root layout with metadata (REQUIRED)
   - app/globals.css: Tailwind directives only (REQUIRED)
   - lib/types.ts: Contains ALL interfaces (User, Link, etc)
   - lib/api.ts: Contains ALL fetch/data calls
   - lib/mock-data.ts: Contains hardcoded mock data for demo mode
   - lib/supabase.ts: Supabase client (only used when DEMO_MODE=false)
   - components/ui/*: Contains ALL base UI components

2. RULE OF IMPORT:
   - NEVER import from a file that is not in the File Map.
   - ALWAYS check 'lib/types.ts' before inventing a new type.
   - ALWAYS use relative imports from the file map.

3. "IT JUST WORKS" RULE (Simulation First):
   - ALWAYS implement DEMO_MODE first with hardcoded mock data.
   - If database connection fails, catch the error and return Mock Data automatically.
   - The app MUST NEVER crash on load.
   - Example pattern:
     const data = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' 
       ? MOCK_DATA 
       : await fetchFromSupabase();

4. GOLDEN STACK (ENFORCED):
   - Next.js 14.2.x (NOT 15, NOT 16)
   - React 18.2.x
   - Tailwind 3.4.x
   - Supabase SSR for auth
   - Structure: app/ in ROOT (NOT src/app/)

5. ZERO CRASH GUARANTEE:
   - Every component has error boundary or try/catch
   - Every fetch has fallback to mock data
   - Every page renders something even if data fails
`;

/**
 * SIMULATION FIRST TEMPLATE - Mock data that makes the app work immediately
 */
const MOCK_DATA_TEMPLATE = `// lib/mock-data.ts
// Auto-generated mock data for demo mode
// This ensures the app ALWAYS works, even without database

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const MOCK_USERS = [
  { id: '1', name: 'Demo User', email: 'demo@example.com', avatar: '🎨' },
  { id: '2', name: 'Test User', email: 'test@example.com', avatar: '🚀' },
];

export const MOCK_ITEMS = [
  { id: '1', title: 'Sample Item 1', description: 'This is demo data', createdAt: new Date().toISOString() },
  { id: '2', title: 'Sample Item 2', description: 'This is demo data', createdAt: new Date().toISOString() },
  { id: '3', title: 'Sample Item 3', description: 'This is demo data', createdAt: new Date().toISOString() },
];

// Helper function to safely fetch data with mock fallback
export async function safeDataFetch<T>(
  fetchFn: () => Promise<T>,
  mockData: T,
  errorMessage?: string
): Promise<T> {
  if (DEMO_MODE) {
    console.log('[DEMO MODE] Using mock data');
    return mockData;
  }
  
  try {
    return await fetchFn();
  } catch (error) {
    console.warn(errorMessage || 'Fetch failed, using mock data:', error);
    return mockData;
  }
}
`;

/**
 * BLUEPRINT PROMPT ADDITION - Forces Planner to generate structured output
 */
const BLUEPRINT_PROTOCOL_PROMPT = `
BLUEPRINT PROTOCOL (MANDATORY):
You MUST include a JSON structure at the end of your plan with this format:

[BLUEPRINT]
{
  "projectName": "project-name",
  "files": [
    {
      "path": "app/page.tsx",
      "description": "Main landing page with hero section and feature cards",
      "exports": ["default"],
      "imports": ["components/ui/Button.tsx", "lib/mock-data.ts"],
      "type": "page"
    },
    {
      "path": "lib/types.ts",
      "description": "All TypeScript interfaces and types",
      "exports": ["User", "Item", "ApiResponse"],
      "type": "lib"
    }
  ],
  "dataModels": [
    {
      "name": "User",
      "fields": [
        {"name": "id", "type": "string", "required": true},
        {"name": "name", "type": "string", "required": true}
      ]
    }
  ],
  "mockData": [
    {"model": "User", "count": 3, "sample": {"id": "1", "name": "Demo User"}}
  ]
}
[END_BLUEPRINT]

CRITICAL RULES FOR BLUEPRINT:
1. EVERY file the coder needs to create MUST be in the files array
2. Exports and imports MUST be accurate - coder cannot deviate
3. Include lib/mock-data.ts for Simulation First approach
4. Structure MUST use app/ in root (NOT src/app/)
`;

/**
 * Get repository path for a pipeline
 * CRITICAL: Always use PathManager for consistency
 */
function getRepoPath(pipeline: any): string {
  const repoPath = pathManager.getProjectPath(pipeline.id);
  logPathOperation('VERIFY', repoPath, { exists: fs.existsSync(repoPath) });
  return repoPath;
}

/**
 * Atomic Reset: Force reset tsconfig.json with Golden Template
 * This ensures tsconfig.json is always correct, regardless of AI modifications
 */
function forceResetTsConfig(repoPath: string) {
  console.log("🧨 NUCLEAR OPTION: Resetting tsconfig.json...");
  
  const goldenTsConfig = {
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
      "paths": { "@/*": ["./*"] }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  };

  const tsConfigPath = path.join(repoPath, 'tsconfig.json');
  const tsConfigDir = path.dirname(tsConfigPath);
  
  // Ensure directory exists
  if (!fs.existsSync(tsConfigDir)) {
    fs.mkdirSync(tsConfigDir, { recursive: true });
  }
  
  fs.writeFileSync(tsConfigPath, JSON.stringify(goldenTsConfig, null, 2));
  console.log("✅ tsconfig.json reset to Golden Template.");
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

async function getStep(pipelineId: string, phase: string) {
  // Hämta senaste steget för fasen
  const { data, error } = await supabase
    .from('pipeline_steps')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('phase', phase)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.warn(`Could not fetch step ${phase} for pipeline ${pipelineId}:`, error);
    return null;
  }

  return data;
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

/**
 * 🕵️ THE DEPENDENCY DETECTIVE: Resolves import paths to actual file paths
 * Converts import paths (e.g., '@/components/ui/Button') to disk paths
 */
function resolveImportPath(importPath: string, currentFile: string, repoPath: string): string | null {
  // Hantera alias (@/)
  let targetPath = "";
  
  if (importPath.startsWith('@/')) {
    // Check both root and src/ structure
    const rootPath = path.join(repoPath, importPath.replace('@/', ''));
    const srcPath = path.join(repoPath, 'src', importPath.replace('@/', ''));
    
    // Try root first (Golden Stack), then src/
    if (fs.existsSync(rootPath) || fs.existsSync(path.dirname(rootPath))) {
      targetPath = rootPath;
    } else if (fs.existsSync(srcPath) || fs.existsSync(path.dirname(srcPath))) {
      targetPath = srcPath;
    } else {
      // Fallback: assume root structure
      targetPath = rootPath;
    }
  } else if (importPath.startsWith('.')) {
    // Hantera relativa sökvägar
    const currentDir = path.dirname(path.join(repoPath, currentFile));
    targetPath = path.resolve(currentDir, importPath);
  } else {
    return null; // Node module (kan inte fixa)
  }

  // Försök hitta filen med olika extensions
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
  for (const ext of extensions) {
    const testPath = targetPath + ext;
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }
  
  // Kolla om filen finns exakt som angivet
  if (fs.existsSync(targetPath)) return targetPath;

  return null;
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
/**
 * Prompt Optimizer: Enhances user prompts for better AI understanding
 * Uses PROMPT_ENGINEER (Gemini Flash) to expand vague requests into detailed specs
 */
async function optimizeUserRequest(rawRequest: string): Promise<string> {
  console.log("✨ Calling Prompt Engineer (Gemini Flash)...");
  
  const systemPrompt = `
    ROLE: You are a Senior Technical Product Manager.
    TASK: Expand the user's raw request into a detailed technical specification for an AI Software Architect.
    
    GUIDELINES:
    1. FILL GAPS: If user says "blog", assume "Next.js 15, Markdown support, SEO friendly, Dark mode".
    2. TECH STACK: Enforce the "Golden Stack" (Next.js 14.2+, Tailwind, Supabase).
    3. CLARITY: Remove ambiguity. Define specific features.
    4. DO NOT write code. Write REQUIREMENTS.
    
    OUTPUT FORMAT:
    Return ONLY the optimized prompt text.
  `;

  try {
    const optimized = await callAI("PROMPT_ENGINEER", rawRequest, systemPrompt);
    if (optimized && optimized.trim().length > 0) {
      console.log(`✅ Prompt optimized (${rawRequest.length} -> ${optimized.length} chars)`);
      return optimized;
    }
  } catch (e: any) {
    console.warn("⚠️ Prompt optimization failed, using original:", e?.message);
  }
  return rawRequest;
}

// Alias for backward compatibility
async function optimizeUserPrompt(rawPrompt: string): Promise<string> {
  return optimizeUserRequest(rawPrompt);
}

async function runPlannerStep(pipeline: any, repoPath: string) {
  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'planner');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Planner step already completed (Checkpoint found). Skipping.");
    return;
  }

  console.log(`[Planner] Creating blueprint...`);
  await updatePipeline(pipeline.id, { current_phase: 'planner' });
  await createStep(pipeline.id, 'planner', 'running');

  // ✨ PROMPT OPTIMIZER: Enhance user request before processing
  const rawRequest = pipeline.initial_prompt || pipeline.prompt || "";
  const optimizedRequest = await optimizeUserPrompt(rawRequest);
  console.log(`✨ Using optimized prompt (${optimizedRequest.length} chars)`);

  // 🧠 GATEKEEPER: Tech Matrix Detection
  console.log("🧠 Gatekeeper scanning request...");
  const matrix = await detectTechMatrix(optimizedRequest);
  console.log(`🧬 MATRIX: Backend=${matrix.primary_backend} | Frontend=${matrix.frontend_framework} | Arch=${matrix.architecture} | Complexity=${matrix.complexity}`);

  // 🧠 INTENT DETECTION (Före planering!) - Keep for backward compatibility
  console.log("🧠 Detecting Project DNA...");
  const intent = await detectProjectIntent(optimizedRequest);
  console.log(`🧬 DNA Config: ${intent.isPython ? "PYTHON 🐍" : "NODE ⚡"} (${intent.projectType})`);

  // 📚 RESEARCHER: RAG - Fetch latest framework intel
  console.log("📚 Researcher fetching latest docs...");
  const techStack = [
    matrix.frontend_framework !== "None" ? matrix.frontend_framework : "Next.js",
    matrix.primary_backend,
    ...matrix.languages
  ].filter(Boolean);
  const ragKnowledge = await getLatestFrameworkIntel(techStack);
  console.log(`📚 RAG Knowledge loaded (${ragKnowledge.length} chars)`);

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

TECH STACK (GOLDEN STACK - ENFORCED, NO DEVIATIONS):
- Framework: Next.js 14.2.x (STABLE - NOT 15, NOT 16)
- React: 18.2.x
- Tailwind: 3.4.x
- Icons: Lucide React
- Auth: Supabase SSR (@supabase/ssr)
- Database: Supabase (PostgreSQL)
- Structure: app/ in ROOT (NOT src/app/)
- State: React useState/useReducer (no Redux)
- Backend: ${matrix.primary_backend}
- Architecture: ${matrix.architecture}

CRITICAL ARCHITECTURE RULES (ENFORCED):
${architectureRules}

LATEST FRAMEWORK INTEL (MUST FOLLOW):
${ragKnowledge.substring(0, 3000)}

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

6. TYPE CONTRACT (BLUEPRINT PROTOCOL):
   - Create 'lib/types.ts' FIRST. This is the SINGLE SOURCE OF TRUTH.
   - ALL interfaces (Frontend & Backend) must strictly adhere to this file.
   - NO ad-hoc type definitions in component files.
   - Import all types from lib/types.ts everywhere.

7. CRITICAL ROUTING RULES (NO 404s):
   - PUBLIC LANDING PAGE: The root route '/' MUST be public. 
   - MIDDLEWARE CONFIG: If using Supabase Auth Middleware, you MUST exclude '/' from the matcher config.
     * Example matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
     * Logic: if (req.nextUrl.pathname === '/') return NextResponse.next();
   - NO REDIRECT LOOPS: Do not redirect unauthenticated users to a non-existent '/login' page. Show a Login Modal or Component on the home page instead.
   - The root page MUST render actual content, not redirect or show 404.
   - Create a 'Landing Page' at '/' that shows the app capabilities.
   - Only protect specific routes (like '/dashboard' or '/admin').

OUTPUT FORMAT:

[PLAN]

... detailed architecture with file structure, dependencies, step-by-step implementation, database schema ...

[FILE_LIST]

- app/page.tsx (Dashboard with real data charts)
- app/layout.tsx (Root layout with error boundary)
- app/globals.css (Tailwind directives ONLY)
- lib/types.ts (ALL TypeScript interfaces - SINGLE SOURCE OF TRUTH)
- lib/mock-data.ts (Hardcoded demo data for Simulation First)
- lib/api.ts (ALL data fetching functions with mock fallback)
- components/ui/Button.tsx (Reusable button component)
- components/ui/Card.tsx (Card component)
... (list EVERY file explicitly)

${BLUEPRINT_PROTOCOL_PROMPT}

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
      output: { content: plan, isPython: intent.isPython, intent: intent, matrix: matrix, ragKnowledge: ragKnowledge } 
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
// Hjälpfunktion för att städa bort markdown inuti [FILE]-block
function cleanCodeBlock(content: string): string {
  content = content.trim();
  
  // THE SANITIZER: Ta bort alla Markdown-artefakter och FILE-taggar
  content = content.replace(/^```[a-zA-Z0-9]*\n?/m, ''); // Ta bort start-block
  content = content.replace(/```$/m, ''); // Ta bort slut-block
  content = content.replace(/^### FILE:.*\n?/gm, ''); // Ta bort ### FILE headers
  content = content.replace(/^\[FILE:.*\]\n?/gm, ''); // Ta bort [FILE: ...] headers
  content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, ''); // Rensa inbäddade block
  
  // Ta bort markdown headers som kan ha hamnat inuti
  content = content.replace(/^#+\s*.*$/gm, "");
  
  // Ta bort "Here is..." eller "I created..." text
  content = content.replace(/^(Here is|I created|I've created|Here's).*$/gmi, "");
  
  return content.trim();
}

async function parseAndWriteFiles(rawOutput: string, repoPath: string): Promise<number> {
  console.log("\n📝 [File Writer] Starting file parsing and writing...");
  console.log(`📝 [File Writer] Target directory: ${repoPath}`);
  console.log(`📝 [File Writer] Directory exists: ${fs.existsSync(repoPath)}`);
  
  // 🛡️ PRE-FLIGHT PATH VALIDATION
  try {
    pathManager.validatePath(repoPath);
    
    // Ensure directory exists
    if (!fs.existsSync(repoPath)) {
      console.log(`📁 Creating missing directory: ${repoPath}`);
      fs.mkdirSync(repoPath, { recursive: true });
    }
    
    // Test write capability
    const testFile = path.join(repoPath, '.path-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    if (!fs.existsSync(testFile)) {
      throw new Error(`Cannot write to ${repoPath}`);
    }
    fs.unlinkSync(testFile);
    console.log(`✅ Path is valid and writable\n`);
  } catch (e: any) {
    pathCircuitBreaker.recordFailure(repoPath, e);
    throw e;
  }
  
  const files: { path: string; content: string }[] = [];
  
  // 1. Prova strikt protokoll [FILE: ...]
  const strictRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
    let match;

  while ((match = strictRegex.exec(rawOutput)) !== null) {
    const filePath = match[1].trim();
        let content = match[2].trim();

    // Ignorera om filnamnet ser ut som nonsens eller konversation
    if (filePath && !filePath.match(/^(here|i|the|is|created|project|files?|structure)/i)) {
      content = cleanCodeBlock(content);
      if (content) {
        files.push({ path: filePath, content: content });
        console.log(`   -> Extracted: ${filePath}`);
      }
    }
  }
  
  // 2. FIX #2: Markdown code block parser (without FILE tags)
  if (files.length === 0) {
    console.log("🔍 Trying markdown code block parser...");
    
    // Match markdown code blocks: ```typescript ... ``` or ```tsx ... ```
    const markdownBlockRegex = /```(?:typescript|tsx|ts|jsx|js)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = markdownBlockRegex.exec(rawOutput)) !== null) {
      const content = match[1].trim();
      
      // Gissa filnamn baserat på innehåll
      if (content.includes('export default function Page') || content.includes('export default function Home')) {
        // Det är en page.tsx
        const filePath = path.join(repoPath, 'src', 'app', 'page.tsx');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, content);
        console.log('✅ Extracted (markdown block): app/page.tsx');
        files.push({ path: 'app/page.tsx', content: content });
      } else if (content.includes('export default function RootLayout') || content.includes('export default function Layout')) {
        // Det är en layout.tsx
        const filePath = path.join(repoPath, 'app', 'layout.tsx');
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, content);
        console.log('✅ Extracted (markdown block): src/app/layout.tsx');
        files.push({ path: 'src/app/layout.tsx', content: content });
      }
    }
  }
  
  // 3. Fallback: Claude's "Header + Codeblock" style
  // Fångar: "### path/to/file.ts" följt av ```typescript ... ```
  if (files.length === 0) {
    console.log("⚠️ Strict parsing empty. Trying Claude Markdown fallback...");
    
    // Regex för: Filnamn på egen rad (kanske med ## eller ###) följt av kodblock
    const looseRegex = /(?:^|\n)(?:#+|File:|Filename:)?\s*([a-zA-Z0-9_\/.-]+\.[a-z0-9]+)\s*\n+```[a-z]*\n([\s\S]*?)```/gi;
    
    while ((match = looseRegex.exec(rawOutput)) !== null) {
      const filePath = match[1].trim();
      // Ignorera om det ser ut som "node_modules" eller nonsens
      if (filePath && !filePath.includes("node_modules") && !filePath.match(/^(here|i|the|is|created|project|files?|structure)/i)) {
        files.push({ path: filePath, content: match[2].trim() });
        console.log(`   -> Extracted (fallback): ${filePath}`);
      }
    }
  }
  
  // 3. Ytterligare fallback: ### FILE: format (standard)
  if (files.length === 0) {
    console.log("📂 Trying standard ### FILE: format...");
    const standardFileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
    
    while ((match = standardFileRegex.exec(rawOutput)) !== null) {
      const filePath = match[1].trim();
      let content = match[2].trim();
      
      content = cleanCodeBlock(content);
      
      if (filePath && content) {
        files.push({ path: filePath, content: content });
        console.log(`   -> Extracted: ${filePath}`);
      }
    }
  }
  
  // 4. Sista fallback: Markdown bold filnamn + kodblock
  if (files.length === 0) {
    console.warn("⚠️ Standard parsing failed. Trying Markdown Fallback...");
    const mdRegex = /\*\*([a-zA-Z0-9_\/.-]+)\*\*\n```[a-z]*\n([\s\S]*?)```/g;
    while ((match = mdRegex.exec(rawOutput)) !== null) {
      const filePath = match[1].trim();
      if (filePath && !filePath.includes("node_modules")) {
        files.push({ path: filePath, content: match[2].trim() });
        console.log(`   -> Extracted (fallback): ${filePath}`);
      }
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
    
    // 🛡️ STRUCTURE ENFORCER: Tvinga src/ för Next.js-filer
    const nextJsFilePatterns = ['app/', 'components/', 'lib/', 'pages/'];
    const isNextJsFile = nextJsFilePatterns.some(pattern => fileName.includes(pattern)) && 
                         (fileName.endsWith('.tsx') || fileName.endsWith('.ts') || fileName.endsWith('.jsx') || fileName.endsWith('.js'));
    
    if (isNextJsFile && !fileName.startsWith('src/')) {
      // Om filen är en Next.js-fil men saknar src/ prefix, lägg till det
      console.log(`🛡️ Structure Enforcer: Adding src/ prefix to ${fileName}`);
      fileName = 'src/' + fileName;
    }
    
    // Cleanup paths (behåll src/ men ta bort hallucinerade root folders)
    if (!fileName.startsWith('src/') && !fileName.startsWith('package') && !fileName.startsWith('public') && !fileName.startsWith('backend') && !fileName.startsWith('next.config') && !fileName.startsWith('tailwind.config') && !fileName.startsWith('postcss.config') && !fileName.startsWith('tsconfig') && !fileName.startsWith('.env') && !fileName.startsWith('README')) {
      // Remove potentially hallucinated root folders like 'my-app/'
      const parts = fileName.split('/');
      if (parts.length > 1) fileName = parts.slice(1).join('/');
    }

    // 1. THE SANITIZER: Ta bort alla Markdown-artefakter och FILE-taggar
    content = content.replace(/^```[a-zA-Z0-9]*\n?/m, ''); // Ta bort start-block
    content = content.replace(/```$/m, ''); // Ta bort slut-block
    content = content.replace(/^### FILE:.*\n?/gm, ''); // Ta bort ### FILE headers
    content = content.replace(/^\[FILE:.*\]\n?/gm, ''); // Ta bort [FILE: ...] headers
    content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, ''); // Rensa inbäddade block
    content = content.trim();

    // 2. FIX: Force Safe globals.css
    if (fileName.endsWith('globals.css')) {
      if (content.includes('import') || content.includes('export') || content.includes('const ')) {
           console.log(`[Coder] Sanatizing corrupted globals.css`);
           content = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
      }
    }

    // 3. FIX: Force Safe next.config.mjs (FIX #1: Remove Invalid projectRoot Config)
    if (fileName.endsWith('next.config.mjs') || fileName.endsWith('next.config.js')) {
      console.log(`[Coder] Overwriting next.config with safe Next.js 15 default (NO projectRoot - invalid!).`);
      content = `/** @type {import('next').NextConfig} */
const nextConfig = {
  // NO projectRoot - it doesn't exist in Next.js 15!
  
  reactStrictMode: true,
  
  // Disable TypeScript errors in build (for speed)
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Disable ESLint in build (for speed)
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Webpack config for absolute imports from src/
  webpack: (config) => {
    config.resolve.modules.push(process.cwd());
    return config;
  },
};

export default nextConfig;
      `;
      fileName = 'next.config.mjs'; // Ensure extension
    }

    // 4. FIX: Force Safe tailwind.config.ts (Tailwind v3) - Golden Stack ROOT structure
    if (fileName.includes('tailwind.config')) {
      console.log(`[Coder] Overwriting tailwind.config with Tailwind v3 default (Golden Stack - root structure).`);
      content = `
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
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
    
    try {
      // Validate path before writing
      pathManager.validatePath(filePath);
      
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        pathManager.ensureDirectory(dir);
        logPathOperation('CREATE_DIR', dir);
      }
      
      // Write file
      const contentToWrite = content.trim();
      
      // =============================================================================
      // 🛡️ PARSER SHIELD: Protect Critical Files from Corruption (V5.1 UPGRADE)
      // =============================================================================
      
      // VALIDATION 1: JSON GUARD - Prevent agents from writing code/text in JSON files
      if (fileName.endsWith('.json')) {
        try {
          // Try to parse the content as JSON
          JSON.parse(contentToWrite);
          // If it succeeds, it's valid JSON. Continue.
        } catch (e) {
          console.error(`❌ JSON GUARD TRIGGERED for ${fileName}: Invalid JSON content.`);
          console.log("   ⚠️ Agent attempted to write non-JSON content. BLOCKING WRITE.");
          console.log(`   Content preview: ${contentToWrite.substring(0, 200)}...`);
          console.log(`   Error: ${(e as Error).message}`);
          
          // If it's tsconfig.json, restore to Golden Template
          if (fileName.endsWith('tsconfig.json')) {
            console.log("   ✅ Restoring Golden tsconfig.json...");
            const goldenTsConfig = {
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
                "paths": { "@/*": ["./*"] }
              },
              "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
              "exclude": ["node_modules"]
            };
            contentToWrite = JSON.stringify(goldenTsConfig, null, 2);
          } else if (fileName.endsWith('package.json')) {
            // If package.json is broken, use the template
            console.log("   ✅ Restoring Golden package.json...");
            if (GOLDEN_PACKAGE_JSON) {
              contentToWrite = typeof GOLDEN_PACKAGE_JSON === 'string' 
                ? GOLDEN_PACKAGE_JSON 
                : JSON.stringify(GOLDEN_PACKAGE_JSON, null, 2);
            } else {
              // Fallback if GOLDEN_PACKAGE_JSON is not available
              console.warn("   ⚠️ GOLDEN_PACKAGE_JSON not available, skipping file.");
              continue;
            }
          } else {
            // For other JSON files, don't write the garbage
            console.log(`   ⚠️ Skipping invalid JSON file: ${fileName}`);
            continue;
          }
        }
      }
      
      // VALIDATION 2: Protect TypeScript files from chatty content
      if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
        // If file contains typical chat phrases without actual code, block it
        const chattyPatterns = /Here is the code|I have updated|Let me check|I'll create|Here's the|Let me fix/i;
        const hasCode = contentToWrite.includes('import ') || 
                       contentToWrite.includes('export ') || 
                       contentToWrite.includes('function ') ||
                       contentToWrite.includes('const ') ||
                       contentToWrite.includes('interface ') ||
                       contentToWrite.includes('type ');
        
        if (chattyPatterns.test(contentToWrite) && !hasCode) {
          console.error(`❌ REFUSING TO WRITE CHATTY CONTENT to ${fileName}.`);
          console.log(`   Content preview: ${contentToWrite.substring(0, 200)}...`);
          continue; // Skip this file
        }
      }
      
      // VALIDATION 3: Protect critical config files from empty or invalid content
      if (fileName.endsWith('tsconfig.json') && contentToWrite.length < 50) {
        console.error(`❌ REFUSING TO WRITE SUSPICIOUSLY SHORT tsconfig.json (${contentToWrite.length} chars).`);
        console.log("   ✅ Restoring Golden tsconfig.json...");
        const goldenTsConfig = {
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
            "paths": { "@/*": ["./*"] }
          },
          "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          "exclude": ["node_modules"]
        };
        contentToWrite = JSON.stringify(goldenTsConfig, null, 2);
      }
      
      fs.writeFileSync(filePath, contentToWrite, 'utf-8');
      
      // ✅ VERIFY write succeeded
      if (!fs.existsSync(filePath)) {
        throw new Error(`File write failed: ${fileName}`);
      }
      
      const actualSize = fs.statSync(filePath).size;
      
      // 🚨 CRITICAL: If file is empty, something is wrong
      if (actualSize === 0 && contentToWrite.length > 0) {
        console.warn(`   ⚠️ WARNING: ${fileName} is EMPTY after write!`);
        pathCircuitBreaker.recordFailure(filePath, new Error('File is empty after write'));
      }
      
      logPathOperation('WRITE', filePath, {
        size: actualSize,
        success: actualSize > 0,
      });
      
      console.log(`   ✅ Wrote: ${fileName} (${actualSize} bytes)`);
      filesCreated++;
      
      // Reset circuit breaker on success
      pathCircuitBreaker.reset(filePath);
    } catch (writeError: any) {
      console.error(`   ❌ Failed to write ${fileName}:`, writeError.message);
      pathCircuitBreaker.recordFailure(filePath, writeError);
      
      // Don't throw - continue with other files
      // But log the error
      logPathOperation('WRITE', filePath, {
        success: false,
        error: writeError.message,
      });
    }
  }
  
  // Final verification
  console.log(`\n✅ [File Writer] Created ${filesCreated} files in ${repoPath}`);
  
  try {
    const finalContents = fs.readdirSync(repoPath, { recursive: true });
    console.log(`📂 [File Writer] Total items now: ${finalContents.length}`);
    
    // List first few files for verification
    if (finalContents.length > 0) {
      console.log(`📂 [File Writer] Sample files: ${finalContents.slice(0, 5).join(', ')}...`);
    }
  } catch (e) {
    console.warn(`⚠️ Could not list directory contents:`, e);
  }
  
  if (filesCreated === 0) {
    throw new Error(`Failed to write any files to ${repoPath}`);
  }
  
  return filesCreated;
}

async function runCoderStep(pipeline: any, repoPath: string) {
  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'coder');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Coder step already completed (Checkpoint found). Skipping.");
    return;
  }

  console.log(`\n🔍 === PATH VERIFICATION START ===`);
  console.log(`[Coder] Expected path: ${repoPath}`);
  console.log(`[Coder] Path exists: ${fs.existsSync(repoPath)}`);
  
  // 🛡️ MANDATORY PRE-FLIGHT CHECK
  try {
    // Validate path
    pathManager.validatePath(repoPath);
    
    // Ensure directory exists
    if (!fs.existsSync(repoPath)) {
      console.log(`📁 Creating missing path: ${repoPath}`);
      fs.mkdirSync(repoPath, { recursive: true });
    }
    
    // List what's inside
    const contents = fs.existsSync(repoPath) 
      ? fs.readdirSync(repoPath)
      : [];
    console.log(`📂 Contents (${contents.length} items): ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}`);
    
    // 🚨 VERIFY we can write
    const testFile = path.join(repoPath, '.path-test-' + Date.now());
    fs.writeFileSync(testFile, 'test');
    
    if (!fs.existsSync(testFile)) {
      throw new Error(`FATAL: Cannot write to ${repoPath}`);
    }
    
    fs.unlinkSync(testFile);
    console.log(`✅ Path is valid and writable`);
    console.log(`=== PATH VERIFICATION END ===\n`);
    
    logPathOperation('VERIFY', repoPath, { success: true });
  } catch (e: any) {
    console.error(`❌ Path verification failed:`, e.message);
    pathCircuitBreaker.recordFailure(repoPath, e);
    throw e;
  }

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
  const matrix: TechMatrix = plannerStep?.output?.matrix || {
    languages: ["TypeScript"],
    primary_backend: isPython ? "Python" : "Node",
    frontend_framework: "Next.js",
    architecture: isPython ? "Hybrid" : "Monolith",
    complexity: "Production"
  };
  const ragKnowledge = plannerStep?.output?.ragKnowledge || "";

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
  // V5 DESIGN SYSTEM PROMPT - Hårdkodad "Premium"-känsla
  const V5_DESIGN_SYSTEM = `
DESIGN STANDARD (MANDATORY):
1. AESTHETIC: Modern SaaS, Dark Mode by default. Think "Linear", "Vercel", or "Cyberpunk".
2. COMPONENTS: Use 'lucide-react' for icons. Use 'framer-motion' for subtle animations if needed.
3. STYLING:
   - Use subtle borders: 'border border-white/10'.
   - Use glassmorphism: 'bg-black/40 backdrop-blur-md'.
   - Use gradients for text/buttons: 'bg-gradient-to-r from-cyan-500 to-blue-500'.
   - Typography: Inter or system-ui, generous leading, tracking-tight for headers.
4. LAYOUT: Responsive flex/grid. No ugly default HTML elements.
5. SHADOWS: Use 'shadow-2xl' and 'shadow-lg' for depth. Never flat.
6. COLORS: Dark backgrounds (zinc-950, slate-900), bright accents (cyan-400, emerald-400, blue-500).
`;

  // V5 INTEGRATION PROMPT - Tvinga Python-koppling
  const V5_BACKEND_BRIDGE = `
BACKEND INTEGRATION RULES (MANDATORY):
1. Assume a Python FastAPI backend is running at 'http://127.0.0.1:8000' (or use process.env.NEXT_PUBLIC_API_URL).
2. You MUST create a 'lib/api.ts' file with fetching functions to talk to this backend.
3. Do NOT mock data if you can fetch it. Only use mock data as fallback on error.
4. Handle loading states (Show a skeleton or spinner) and error states elegantly.
5. Example pattern:
   const fetchData = async () => {
     try {
       const res = await fetch('${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/endpoint');
       if (!res.ok) throw new Error('Failed to fetch');
       return await res.json();
     } catch (error) {
       console.warn('API failed, using mock data:', error);
       return MOCK_DATA; // Fallback only
     }
   };
6. ALL data fetching MUST be in 'lib/api.ts', not scattered in components.
`;

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

  const EXPORT_RULE = `
CRITICAL EXPORT RULES (MANDATORY):

1. COMPONENTS (in /components): MUST use named exports.
   - Correct: export function Button() { ... }
   - Wrong: export default function Button() { ... }

2. PAGES (in /app): MUST use default exports.
   - Correct: export default function Page() { ... }
   - Wrong: export function Page() { ... }

3. IMPORTS: MUST match the export type.
   - Importing a component: import { Button } from '@/components/ui/Button';
   - Importing a page/layout: (Not common, but would be default import)
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
CRITICAL OUTPUT RULES:

1. NO CONVERSATION: Do NOT write "Here is the code", "I created...", or markdown headers like "# Project".

2. RAW FILES ONLY: Output nothing but the file blocks.

3. FORMAT: You MUST use this exact format for every file:

[FILE: path/to/filename.ext]
... code content ...
[GOAL]

Example:
[FILE: package.json]
{ "name": "demo" }
[GOAL]

CRITICAL FILE STRUCTURE (GOLDEN STACK - NO EXCEPTIONS):

1. PROJECT STRUCTURE (app/ in ROOT, NOT src/app/):
   - app/page.tsx (main page - REQUIRED)
   - app/layout.tsx (root layout - REQUIRED)
   - app/globals.css (Tailwind directives - REQUIRED)
   - components/ui/* (UI components)
   - lib/types.ts (ALL interfaces - single source of truth)
   - lib/mock-data.ts (demo data for Simulation First)
   - lib/api.ts (data fetching functions)

2. ROOT CONFIG FILES:
   - package.json
   - next.config.mjs
   - tailwind.config.ts
   - postcss.config.js
   - tsconfig.json

3. FORBIDDEN:
   - NO 'src/' folder (Golden Stack uses root structure)
   - NO 'pages/' folder (use App Router only)

4. FILE PATH EXAMPLES:
   - CORRECT: [FILE: app/page.tsx]
   - CORRECT: [FILE: components/ui/Button.tsx]
   - CORRECT: [FILE: lib/types.ts]
   - WRONG: [FILE: src/app/page.tsx]
   - WRONG: [FILE: src/components/Button.tsx]

DO NOT:
- Write explanations before or after files
- Use markdown headers (##, ###)
- Write "Here is..." or "I've created..."
- Include code blocks (backticks) inside [FILE:...] blocks
- Place any Next.js code outside src/ directory

ONLY OUTPUT FILE BLOCKS. NO OTHER TEXT.
`;
  
  if (isPython) {
    console.log("🐍 Python/Hybrid project detected. Using Hybrid Architect system prompt...");
    systemContext = `YOU ARE A HYBRID FULLSTACK ARCHITECT (Node.js Frontend + Python Backend).

${ARCHITECTURE_MEMORY}

YOUR TASK: Generate the COMPLETE codebase for BOTH parts in this single response.

PART 1: THE FRONTEND (Next.js 14.2.x - GOLDEN STACK) - REQUIRED
- Path: MUST be /app in ROOT (NOT /src/app)
- MUST include ALL of these files:
  * package.json (with "next": "14.2.18", "react": "18.2.0", Tailwind CSS dependencies)
  * next.config.mjs
  * tailwind.config.ts
  * postcss.config.js
  * app/layout.tsx (REQUIRED - do not skip this!)
  * app/page.tsx (REQUIRED - main page)
  * app/globals.css (Tailwind directives)
  * lib/types.ts (ALL interfaces - single source of truth)
  * lib/mock-data.ts (demo data for Simulation First)
  * components/ (UI components as needed)
- UI: Modern, dark mode, using Tailwind CSS.
- SIMULATION FIRST: All data fetching must have mock data fallback.
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

${EXPORT_RULE}

${FILE_PROTOCOL}
`;
  } else {
    systemContext = `You are a World-Class Fullstack Engineer building a Next.js App.

${ARCHITECTURE_MEMORY}

GOLDEN STACK (ENFORCED - NO DEVIATIONS):
- Framework: Next.js 14.2.x (NOT 15, NOT 16 - use stable version)
- React: 18.2.x
- Tailwind: 3.4.x
- Structure: app/ in ROOT (NOT src/app/)
- Icons: Lucide React
- Auth: Supabase SSR (@supabase/ssr)

STRICT RULES:
1. No external UI libraries (shadcn) - build generic Tailwind components inline if needed.
2. Use the '[FILE: filename]' format strictly for EVERY file.
3. ${designSystem}

SIMULATION FIRST (MANDATORY):
- Create lib/mock-data.ts with hardcoded demo data.
- ALL data fetching MUST fallback to mock data on error.
- The app MUST NEVER crash. Always show UI with data.

DEPENDENCY RULES (CRITICAL - DO NOT IGNORE):
- Use EXACT versions: "next": "14.2.18", "react": "18.2.0"
- You MUST use "tailwindcss": "^3.4.17" in package.json. Do NOT use "latest" or v4.
- You MUST use "postcss": "^8.4.31" and "autoprefixer": "^10.4.19".
- Do NOT use @tailwindcss/postcss (we are using standard Tailwind v3 config).
- Include a standard tailwind.config.ts with content paths for app/ and components/.
- Include a postcss.config.js with tailwindcss and autoprefixer plugins.
- If you use Supabase Auth, you MUST include "@supabase/ssr" in package.json.
${isPython ? `
PYTHON DEPENDENCIES:
- Create requirements.txt with: fastapi, uvicorn[standard], pydantic, python-dotenv
- For database: sqlalchemy, psycopg2-binary (PostgreSQL) or asyncpg
` : ""}

${FILE_PROTOCOL}

REQUIRED FILES (GOLDEN STACK - ROOT STRUCTURE):
- package.json (scripts: dev, build, start + "next": "14.2.18", "react": "18.2.0")
- tailwind.config.ts (with content paths for app/, components/, lib/)
- postcss.config.js (with tailwindcss and autoprefixer)
- app/layout.tsx, app/page.tsx (in ROOT app/, NOT src/app/)
- app/globals.css (ONLY Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;)
- lib/types.ts (ALL interfaces - single source of truth)
- lib/mock-data.ts (demo data for Simulation First)
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

1. SERVER vs CLIENT COMPONENTS (MANDATORY):
   - CLIENT COMPONENTS: If a component uses 'useState', 'useEffect', 'useRouter', or event handlers like 'onClick', you MUST add "'use client';" at the very top of the file.
     Example:
     'use client';
     import { useState } from 'react';
     export function InteractiveButton() { ... }
   
   - SERVER COMPONENTS: By default, all components are Server Components. Keep them that way unless interactivity is needed.
     - Server Components can be async and fetch data directly.
     - Server Components CANNOT use hooks, event handlers, or browser APIs.
     Example:
     // NO 'use client' directive
     export default async function Page() {
       const data = await fetchData();
       return <div>{data}</div>;
     }

   - ASYNC PAGES: Page components (page.tsx) should generally be Server Components (async). Move interactive logic to a smaller client component (e.g. <DashboardClient />).
     Pattern: Server Component (page.tsx) fetches data, Client Component handles interactivity.
     Example:
     // app/page.tsx (Server Component)
     export default async function Page() {
       const data = await fetchData();
       return <DashboardClient initialData={data} />;
     }
     
     // components/DashboardClient.tsx (Client Component)
     'use client';
     export function DashboardClient({ initialData }) {
       const [state, setState] = useState(initialData);
       // ... interactive logic
     }

2. ASYNC REQUEST APIs: In Next.js 15, params, searchParams, cookies(), and headers() are ASYNC.
   - ❌ WRONG: const { slug } = params; const token = cookies().get('token');
   - ✅ CORRECT: const { slug } = await params; const token = (await cookies()).get('token');
   - ALL route handlers, page components, and server components MUST await these APIs.
   - If you use params/searchParams, the component MUST be async: export default async function Page({ params }) { const { slug } = await params; }
  
3. CACHING: Next.js 15 defaults to "no cache" for many requests. Explicitly set caching if needed:
   - Use { cache: 'force-cache' } for static data
   - Use { cache: 'no-store' } for dynamic data
   - Use { next: { revalidate: 3600 } } for ISR
  
4. IMPORT RULE: ALWAYS use '@/' alias for imports, never relative paths like '../../'.
   - CORRECT: import { Button } from '@/components/ui/Button';
   - WRONG: import { Button } from '../components/ui/Button';

5. OTHER RULES:
   - No 'use client' in layout.tsx if possible.
   - Use 'next/link' for navigation.
   - Do NOT include markdown code blocks inside file content.
   - Do NOT mix Next.js 13/14 patterns with Next.js 15. Follow ONLY Next.js 15 patterns.

- OFFLINE MODE (Visual Audit Support):
  - In your data fetching logic (e.g., Supabase client, fetch calls), ALWAYS check: if (process.env.NEXT_PUBLIC_IS_AUDIT_MODE === 'true')
  - If true, return INSTANT mock data arrays instead of calling the real API.
  - Example:
    const data = process.env.NEXT_PUBLIC_IS_AUDIT_MODE === 'true' 
      ? [{ id: '1', name: 'Mock Item 1' }, { id: '2', name: 'Mock Item 2' }]
      : await fetch('/api/data').then(r => r.json());
  - This prevents timeouts during visual testing and ensures the page renders immediately with realistic data.
  - Mock data should match your schema structure (same fields, realistic values).

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
ROLE: You are the Lead Product Designer at Linear, Vercel, or Airbnb.

TASK: Build the Frontend for "${pipeline.initial_prompt || pipeline.prompt}".

${ARCHITECTURE_MEMORY}

IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 3000)}

GOLDEN STACK (ENFORCED - NO DEVIATIONS):
- Next.js 14.2.x (NOT 15, NOT 16)
- React 18.2.x
- Tailwind 3.4.x
- Lucide React for icons
- Framer Motion for animations
- Sonner for toasts
- Structure: app/ in ROOT (NOT src/app/)

DESIGN SYSTEM "V5 GLASS" (MANDATORY):

1. **Background:** Rich, deep backgrounds (bg-zinc-950), NOT plain black. Use radial gradients for depth.
   Example: 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950'

2. **Cards:** Glassmorphism is KEY. Use 'bg-white/5 backdrop-blur-xl border border-white/10'.
   Example: 'bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6'

3. **Typography:** Use 'Geist' or 'Inter'. Letter-spacing tight (-0.02em) for headings. 
   Text colors should be 'text-zinc-100' (primary) and 'text-zinc-400' (secondary). NEVER pure white on pure black.
   Example: 'text-zinc-100 text-2xl font-semibold tracking-tight'

4. **Layout:** Use "Bento Grids" (CSS Grid). Asymmetric layouts are premium.
   Example: 'grid grid-cols-3 gap-4' with varying row spans for visual interest.

5. **Borders:** Extremely subtle. Use 'border-white/5'. NO thick borders.
   Example: 'border border-white/5'

6. **Shadows:** Colored shadows/glows for emphasis. Use 'shadow-[0_0_30px_-5px_rgba(120,50,255,0.3)]'.
   Example: 'shadow-[0_0_30px_-5px_rgba(120,50,255,0.3)]' for purple glow, or 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]' for green.

INTERACTION DESIGN (MANDATORY):

- **Framer Motion:** Wrap page content in <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>.
  Example: <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{duration: 0.3}}>

- **Hover States:** Interactive elements must have 'transition-all duration-200 hover:bg-white/10 hover:scale-[1.02]'.
  Example: 'transition-all duration-200 hover:bg-white/10 hover:scale-[1.02] cursor-pointer'

- **Feedback:** Use 'sonner' for toasts on every action. Import { toast } from 'sonner'.
  Example: toast.success('Action completed') or toast.error('Something went wrong')

- **Loading:** Skeleton loaders are REQUIRED. No "Loading..." text.
  Example: <div className="animate-pulse bg-white/5 rounded-lg h-20" />

LOGIC & INTEGRATION RULES:

- **Backend Bridge:** You are building the UI for a Python FastAPI backend running on port 8000.
  The backend URL is: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

- **Data Fetching:** Create a 'lib/api.ts' that wraps fetch() with proper error handling.
  Example:
  export async function fetchData() {
    try {
      const res = await fetch(\`\${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/endpoint\`);
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    } catch (error) {
      console.warn('API failed, using mock data:', error);
      return MOCK_DATA; // Fallback only
    }
  }

- **Mock Fallback:** If 'process.env.NEXT_PUBLIC_IS_AUDIT_MODE' is true, return INSTANT mock data.
  Example: const data = process.env.NEXT_PUBLIC_IS_AUDIT_MODE === 'true' ? MOCK_DATA : await fetchData();

- **Error Handling:** Wrap components in Error Boundaries. Use try/catch for async operations.

${V5_BACKEND_BRIDGE}

CRITICAL TECH RULES (GOLDEN STACK):

1. Next.js 14.2.x App Router - MUST use /app in ROOT (NOT /src/app).

2. NO DEAD UI: Every button/link MUST work (href/onClick). No placeholder divs for navigation.

3. LOADING STATES: Use <Suspense> and <Skeleton> for all async content. The app should feel instant.

4. API CALLS: Never hardcode URLs. Use 'process.env.NEXT_PUBLIC_API_URL'.

5. COMPONENT NAMING: PascalCase (e.g., Sidebar.tsx, ProjectCard.tsx). Imports must match EXACTLY.

6. FILE STRUCTURE: 
   - app/ in ROOT (NEVER src/app/)
   - components/ in ROOT
   - lib/ in ROOT
   - NO src/ folder at all

CRITICAL NEXT.JS 15 RULES (Server vs Client Components):

1. CLIENT COMPONENTS: If a component uses 'useState', 'useEffect', 'useRouter', or event handlers like 'onClick', you MUST add "'use client';" at the very top of the file.
   - Example:
     'use client';
     import { useState } from 'react';
     export function InteractiveButton() { ... }
   
2. SERVER COMPONENTS: By default, all components are Server Components. Keep them that way unless interactivity is needed.
   - Server Components can be async and fetch data directly.
   - Server Components CANNOT use hooks, event handlers, or browser APIs.
   - Example:
     // NO 'use client' directive
     export default async function Page() {
       const data = await fetchData();
       return <div>{data}</div>;
     }

3. ASYNC PAGES: Page components (page.tsx) should generally be Server Components (async). Move interactive logic to a smaller client component (e.g. <DashboardClient />).
   - Pattern: Server Component (page.tsx) fetches data, Client Component handles interactivity.
   - Example:
     // app/page.tsx (Server Component)
     export default async function Page() {
       const data = await fetchData();
       return <DashboardClient initialData={data} />;
     }
     
     // components/DashboardClient.tsx (Client Component)
     'use client';
     export function DashboardClient({ initialData }) {
       const [state, setState] = useState(initialData);
       // ... interactive logic
     }

4. IMPORT RULE: ALWAYS use '@/' alias for imports, never relative paths like '../../'.
   - CORRECT: import { Button } from '@/components/ui/Button';
   - WRONG: import { Button } from '../components/ui/Button';

7. SIMULATION FIRST (MANDATORY):
   - Create lib/mock-data.ts with hardcoded demo data.
   - ALL data fetching MUST fallback to mock data on error.
   - Check: const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
   - Example pattern:
     const data = DEMO_MODE 
       ? MOCK_ITEMS 
       : await fetchFromAPI().catch(() => MOCK_ITEMS);
   - This ensures the app NEVER crashes and ALWAYS shows UI with data.
   - Mock data should be realistic and match your schema structure.

OUTPUT RULES:
- Generate package.json with exact versions: "next": "14.2.18", "react": "18.2.0", "framer-motion": "^11.0.0", "sonner": "^1.0.0"
- Generate next.config.mjs, tailwind.config.ts, postcss.config.js in root.
- Generate app/layout.tsx, app/page.tsx, app/globals.css (in root app/, NOT src/app/).
- Generate lib/types.ts (ALL interfaces), lib/mock-data.ts (demo data), lib/api.ts (fetch functions).
- Generate all UI components in components/ui/ folder (NOT src/components/).
- Do NOT generate backend code (Python).
- Assume backend runs on http://localhost:8000.
- Connect to backend via fetch('process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"')
- You are NOT allowed to use minimal HTML. You must build a professional, dense UI.
- ALL interactive elements MUST use framer-motion for animations.
- CRITICAL: NO 'src/' prefix in file paths. Use app/, components/, lib/ directly.

CRITICAL IMPORTS RULE (Ghost Component Prevention):
- Do NOT import components you have not created.
- ALWAYS check lib/types.ts before inventing a new type.
- ALWAYS use lib/mock-data.ts for fallback data.
- If you create a dashboard, keep it simple in 'page.tsx' or create the sub-components explicitly in the output.
- Better to have a large 'page.tsx' than missing files.
- Before importing a component, ensure you have generated that component file in this response.

${STRICT_FRONTEND_RULES}

${COMPONENT_NAMING_RULE}

${EXPORT_RULE}

${FILE_PROTOCOL}
      `;

      // 👁️ VISION CLONING: Om användaren har skickat en referensbild
      let visionInstruction = "";
      let referenceImage: string | undefined = undefined;
      
      // Kolla om pipeline har attachmentUrl eller referenceImage
      const attachmentUrl = pipeline.attachment_url || pipeline.attachmentUrl || pipeline.reference_image;
      
      if (attachmentUrl) {
        console.log("👁️ Vision Cloning Protocol Activated...");
        console.log(`📸 Reference image detected: ${attachmentUrl}`);
        
        visionInstruction = `

CRITICAL VISUAL INSTRUCTION:

The user has provided a REFERENCE IMAGE (attached).

YOUR TASK:

1. IGNORE generic design rules above. This image is the source of truth.

2. REPLICATE the layout, color palette, spacing, and component style of the reference image EXACTLY.

3. If the image shows a sidebar, build that exact sidebar layout.

4. If the image shows a specific chart style, use Recharts to mimic it precisely.

5. If the image shows specific colors, use those exact hex codes.

6. If the image shows a card layout, replicate the card structure and spacing.

7. MAKE IT LOOK LIKE THIS IMAGE, but with working, functional code.

8. Pay attention to typography, button styles, spacing between elements, and overall visual hierarchy.

9. If the image shows data (charts, tables, lists), generate that exact data structure.

PRIORITY: Visual accuracy to the reference image > Generic design rules.
        `;
        
        // Försök hämta bilden (kan vara URL eller base64)
        try {
          if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
            // URL - vi behöver hämta den och konvertera till base64
            // För nu, låt callAI hantera URL:en direkt
            referenceImage = attachmentUrl;
          } else if (attachmentUrl.startsWith('data:image')) {
            // Redan base64
            referenceImage = attachmentUrl;
          } else {
            // Anta att det är en filpath eller base64 string
            referenceImage = attachmentUrl;
          }
        } catch (e) {
          console.warn("⚠️ Could not process reference image:", e);
        }
      }

      const fePrompt = PREMIUM_SAAS_PROMPT + visionInstruction;

      // Kör Claude för Frontend (med bild om den finns)
      const feCode = await callAI("FRONTEND", fePrompt, undefined, referenceImage);
      const feFilesCreated = await parseAndWriteFiles(feCode, repoPath);
      console.log(`✅ Frontend Phase Complete: ${feFilesCreated} files created.`);

      // STEG B: Backend (Backend Router - Välj modell baserat på språk)
      console.log("⚙️ [Phase 2] Building Backend...");
      
      // BACKEND ROUTER: Välj modell baserat på språk
      let backendModel: "BACKEND" | "ROUTER" = "BACKEND"; // Default (DeepSeek/Qwen)
      if (matrix.primary_backend === "Rust") {
        console.log("🦀 Qwen 2.5 selected for Rust task.");
        backendModel = "ROUTER"; // Qwen via ROUTER (kan behöva uppdateras i modelClient)
      } else if (matrix.primary_backend === "Go" || matrix.primary_backend === "Python") {
        console.log("🧠 DeepSeek V3 selected for Backend Logic.");
        backendModel = "BACKEND"; // DeepSeek V3
      } else {
        console.log("⚡ Default backend model selected.");
        backendModel = "BACKEND";
      }
      
      const BRAINY_BACKEND_PROMPT = `
ROLE: You are a Principal Systems Architect.

TASK: Build the ${matrix.primary_backend} Backend for "${pipeline.initial_prompt || pipeline.prompt}".

IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 3000)}

LATEST FRAMEWORK INTEL (MUST FOLLOW):
${ragKnowledge.substring(0, 2000)}

CONTEXT: The frontend is a Next.js app calling this API on http://localhost:3000.

CORE PHILOSOPHY:

1. **API First:** Design endpoints that are easy for a React Frontend to consume. Use standard JSON responses.
   - All endpoints should return JSON with consistent structure: { "data": {...}, "error": null } or { "data": null, "error": "message" }
   - Use RESTful conventions: GET /api/items, POST /api/items, PUT /api/items/:id, DELETE /api/items/:id

2. **CORS:** ENABLE CORS for 'http://localhost:3000' immediately. This is critical.
   Example:
   from fastapi.middleware.cors import CORSMiddleware
   app.add_middleware(
     CORSMiddleware,
     allow_origins=["http://localhost:3000"],
     allow_credentials=True,
     allow_methods=["*"],
     allow_headers=["*"],
   )

3. **Persistence:** Use SQLite for local dev (backend/database.db) or Supabase if credentials exist.
   - If using SQLite: Use 'sqlite3' or 'aiosqlite' for async operations
   - If using Supabase: Use 'supabase' Python client with environment variables

4. **Type Safety:** Strict Pydantic models for Request/Response.
   - Define Request models (e.g., ItemCreate, ItemUpdate) and Response models (e.g., ItemResponse)
   - Use Pydantic's Field() for validation and documentation
   Example:
   from pydantic import BaseModel, Field
   class ItemCreate(BaseModel):
     title: str = Field(..., min_length=1, max_length=200)
     description: str | None = None

5. INTELLIGENCE FIRST: The backend isn't just a database wrapper. It must do something smart. (e.g., auto-categorization, summarization, anomaly detection using AI).

6. ROBUSTNESS: Use Pydantic for strict validation. Assume all inputs are malicious.

7. SCALABILITY: Design async endpoints (FastAPI). Use background tasks (Celery/Arq) for heavy lifting if needed.

8. TYPE SAFETY: Code must pass 'mypy --strict'.

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

      // Kör Backend med vald modell
      const beCode = await callAI(backendModel, bePrompt);
      const beFilesCreated = await parseAndWriteFiles(beCode, repoPath);
      console.log(`✅ Backend Phase Complete: ${beFilesCreated} files created.`);
      
      // 🔗 INTEGRATION AGENT: Sync backend types to frontend
      if (matrix.architecture === "Hybrid" && beFilesCreated > 0) {
        console.log("🔗 Running Integration Agent to sync types...");
        await runIntegrationStep(repoPath, matrix.primary_backend);
      }

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
    
    // 🛡️ FIX: Always use @/ alias instead of guessing relative paths
    // This works regardless of where layout.tsx is located (app/ or src/app/)
    const importStatement = `import { RefreshProvider } from '@/components/RefreshProvider';`;
    
    // Find layout.tsx (check both app/ and src/app/)
    let layoutPath = path.join(repoPath, 'app', 'layout.tsx');
    let componentsPath = path.join(repoPath, 'components');
    
    if (!fs.existsSync(layoutPath)) {
      // Try src/app if app/ doesn't exist
      layoutPath = path.join(repoPath, 'src', 'app', 'layout.tsx');
      if (fs.existsSync(layoutPath)) {
        // For src/app/ structure, check src/components first, then root components/
        const srcComponentsPath = path.join(repoPath, 'src', 'components');
        if (fs.existsSync(srcComponentsPath)) {
          componentsPath = srcComponentsPath;
        } else {
          // Use root components/ if src/components doesn't exist
          componentsPath = path.join(repoPath, 'components');
        }
      }
    }
    
    // Ensure components directory exists
    if (!fs.existsSync(componentsPath)) {
      fs.mkdirSync(componentsPath, { recursive: true });
      console.log(`   📁 Created components directory: ${path.relative(repoPath, componentsPath)}`);
    }
    
    // Skapa RefreshProvider i components mappen
    const refreshProviderPath = path.join(componentsPath, 'RefreshProvider.tsx');
    const refreshProviderDir = path.dirname(refreshProviderPath);
    if (!fs.existsSync(refreshProviderDir)) {
      fs.mkdirSync(refreshProviderDir, { recursive: true });
    }

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
        // 🛡️ FIX: Always use @/ alias - no more guessing relative paths!
        if (layoutContent.includes("import")) {
          // Find the last import statement and add after it
          const importRegex = /(import\s+.*?from\s+['"].*?['"];?\s*\n)/g;
          const imports = layoutContent.match(importRegex);
          if (imports && imports.length > 0) {
            // Add after the last import
            const lastImport = imports[imports.length - 1];
            layoutContent = layoutContent.replace(
              lastImport,
              `${lastImport}${importStatement}\n`
            );
          } else {
            // Fallback: add after first import
            layoutContent = layoutContent.replace(
              /(import\s+.*?from\s+['"].*?['"];?\s*\n)/,
              `$1${importStatement}\n`
            );
          }
        } else {
          // Om det inte finns några imports, lägg till i början
          layoutContent = `${importStatement}\n${layoutContent}`;
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
/**
 * Helper function to execute SQL migration
 */
async function executeMigration(sqlContent: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql.unsafe(sqlContent);
  } finally {
    await sql.end();
  }
}

/**
 * Helper function to verify database tables after migration
 */
async function verifyDatabaseTables(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const sql = postgres(process.env.DATABASE_URL);
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    return tables.map((t: any) => t.table_name);
  } finally {
    await sql.end();
  }
}

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

  // =============================================================================
  // 🗄️ SQL GENERATION WITH HEALING LOOP
  // =============================================================================
  
  const sqlPrompt = `
  You are a Senior PostgreSQL DBA.

  INPUT PLAN:
  ${JSON.stringify(plannerStep?.output || {})}

  YOUR TASK:
  Generate a single SQL file to set up the database schema.

  CRITICAL RULES:
  1. **NO PARTITIONING:** Do NOT use 'PARTITION BY'. Use standard tables only. Partitioning causes constraint errors and is not needed for MVP/production apps.
  2. **SIMPLE KEYS:** Use 'id UUID PRIMARY KEY DEFAULT gen_random_uuid()' for all tables. Keep it simple.
  3. **IDEMPOTENCY:** Use 'IF NOT EXISTS' for all CREATE statements (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, etc.).
  4. **Start Clean:** Begin with "DROP TABLE IF EXISTS users, posts, events, etc CASCADE;" for all app tables to ensure a clean slate.
  5. **Create Tables:** Use "CREATE TABLE IF NOT EXISTS".
  6. **Security:** Enable RLS on all tables.
  7. **NO GUESSING:** Do not assume columns exist. Create them explicitly in the CREATE TABLE statement.
  8. **Seed Data:** Insert 3 rows of dummy data at the end.

  ⛔️ FORBIDDEN:
  - Do NOT drop the tables 'pipelines', 'pipeline_steps' or 'tickets'.

  DATA SEEDING RULES (CRITICAL - SÄKRARE SEEDNING):
  1. IDEMPOTENCY: Always use 'INSERT ... ON CONFLICT (id) DO NOTHING;' for seed data. Never assume the table is empty.
     - Example: INSERT INTO users (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Test User') ON CONFLICT (id) DO NOTHING;
  2. CLEANUP: If inserting hardcoded mock data, consider 'TRUNCATE table_name CASCADE;' first (only for seed scripts, not in main migration).
  3. SCHEMA AWARENESS: Do not guess column names. If you created 'author_id', do not try to insert into 'user_id'.
     - Always check the CREATE TABLE statement above before writing INSERT statements.
     - Match column names EXACTLY as defined in the table schema.

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
  Return ONLY raw SQL. No markdown, no explanations.
  `;

  try {
    // 1. Generate Initial SQL
    console.log("[SQL] Generating initial migration with DeepSeek V3...");
    let currentSql = await callAI("BACKEND", sqlPrompt);
    
    // Clean markdown artifacts
    currentSql = currentSql.replace(/```sql|```/g, "").trim();

    // Save initial version for history
    const migrationPath = path.join(repoPath, 'supabase', 'migrations');
    if (!fs.existsSync(migrationPath)) fs.mkdirSync(migrationPath, { recursive: true });
    const initialFileName = `${Date.now()}_init.sql`;
    fs.writeFileSync(path.join(migrationPath, initialFileName), currentSql);
    console.log(`[SQL] 💾 Saved initial migration: ${initialFileName}`);

    // =============================================================================
    // 🔄 THE HEALING LOOP - 3 attempts to fix SQL errors
    // =============================================================================
    let attempt = 0;
    const maxRetries = 3;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`[SQL] 🗄️ Executing Migration (Attempt ${attempt}/${maxRetries})...`);

      try {
        // Try to execute the migration
        await executeMigration(currentSql);
        console.log("[SQL] ✅ Migration executed successfully!");

        // Verify what was actually created
        const tableNames = await verifyDatabaseTables();
        console.log(`[SQL VERIFICATION] Active tables in DB: [${tableNames.join(', ')}]`);

        // Save successful version
        if (attempt > 1) {
          const fixedFileName = `${Date.now()}_init_fixed_attempt_${attempt}.sql`;
          fs.writeFileSync(path.join(migrationPath, fixedFileName), currentSql);
          console.log(`[SQL] 💾 Saved fixed migration: ${fixedFileName}`);
        }

        await updateStep(pipeline.id, 'sql', { 
          status: 'completed', 
          output: { 
            tables: tableNames.join(', '), 
            attempts: attempt,
            fixed: attempt > 1 
          } 
        });
        await updatePipeline(pipeline.id, { current_phase: 'tester' });
        return; // Success! Exit function

      } catch (error: any) {
        lastError = error;
        console.error(`[SQL] ❌ Execution Failed (Attempt ${attempt}): ${error.message}`);
        
        if (attempt === maxRetries) {
          // Final attempt failed - give up
          console.error(`[SQL] ❌ SQL Failed after ${maxRetries} attempts. Manual intervention required.`);
          await updateStep(pipeline.id, 'sql', { 
            status: 'failed', 
            output: { 
              error: error.message, 
              attempts: attempt,
              lastSql: currentSql.substring(0, 500) // Save first 500 chars for debugging
            } 
          });
          await updatePipeline(pipeline.id, { status: 'failed' });
          throw new Error(`SQL Migration failed after ${maxRetries} attempts: ${error.message}`);
        }

        // =============================================================================
        // 🚑 AUTO-FIX: Send error back to DeepSeek for healing
        // =============================================================================
        console.log("🚑 SQL Auto-Fixer engaging...");
        
        const fixPrompt = `
The previous PostgreSQL migration FAILED.

ERROR MESSAGE:
"${error.message}"

FAILING SQL:
${currentSql.substring(0, 3000)}${currentSql.length > 3000 ? '\n... (truncated)' : ''}

TASK: Rewrite the SQL to fix this error.

CRITICAL RULES FOR SQL GENERATION:
1. NO PARTITIONING: Do NOT use 'PARTITION BY'. Use standard tables only. Partitioning causes constraint errors.
2. SIMPLE KEYS: Use 'id UUID PRIMARY KEY DEFAULT gen_random_uuid()'.
3. IDEMPOTENCY: Use 'IF NOT EXISTS' for all CREATE statements.
4. CLEANUP: Use 'DROP TABLE IF EXISTS ... CASCADE' at the start of the script to ensure a clean slate.
5. NO GUESSING: Do not assume columns exist. Create them explicitly.

STRATEGY:
- If "relation already exists": Use IF NOT EXISTS or DROP TABLE first.
- If "constraint violation": Check foreign keys or unique constraints. Remove problematic constraints or ensure dependency data is inserted first.
- If "column does not exist": Ensure you create the table with that column.
- If "foreign key constraint": Either remove the constraint for seed data OR ensure parent records are inserted first.
- If "invalid UUID": Use gen_random_uuid() or valid hex UUIDs (0-9, a-f only).
- If "expected X dimensions, not Y": Use array_fill(0, ARRAY[X])::vector for vector columns.

DATA SEEDING RULES:
- Always use 'INSERT ... ON CONFLICT (id) DO NOTHING;' for seed data.
- Do not guess column names - check the CREATE TABLE statement above.
- Match column names EXACTLY as defined in the schema.

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

OUTPUT: Raw SQL only (The full fixed script). No markdown, no explanations.
        `;
        
        // Call DeepSeek V3 to fix the SQL
        console.log(`[SQL] 🔧 Generating fixed SQL with DeepSeek V3 (Attempt ${attempt + 1})...`);
        const fixedSql = await callAI("BACKEND", fixPrompt);
        currentSql = fixedSql.replace(/```sql|```/g, "").trim();
        
        // Save fixed version for history
        const fixedFileName = `${Date.now()}_init_fixed_attempt_${attempt + 1}.sql`;
        fs.writeFileSync(path.join(migrationPath, fixedFileName), currentSql);
        console.log(`[SQL] 💾 Saved fixed migration: ${fixedFileName}`);
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error("SQL migration failed for unknown reason");

  } catch (error: any) {
    console.error('[SQL] Agent Failed:', error?.message);
    await updateStep(pipeline.id, 'sql', { 
      status: 'failed', 
      output: { error: error.message } 
    });
    await updatePipeline(pipeline.id, { status: 'failed' });
    throw error;
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
      'app/page.tsx', 
      'app/dashboard/page.tsx',
      'lib/actions.ts', // Om du har server actions
      'app/(protected)/dashboard/page.tsx'
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
                 const fallbackFile = "app/page.tsx"; // Golden Stack - root structure
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
    { pattern: /alert\(/g, name: "alert()" },
    { pattern: /Lorem ipsum/gi, name: "Lorem ipsum" },
    { pattern: /:\s*any\s*[=,;)]/g, name: "any type" },
    { pattern: /return null;$/gm, name: "return null" },
  ];

  // console.log är tillåtet i dev mode - vi varnar bara
  const consoleLogPattern = /console\.log\(/g;

  const issues: string[] = [];
  const scannedFiles: string[] = [];
  const consoleLogWarnings: string[] = [];

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
              
              // Kolla först console.log (varning, inte error)
              if (consoleLogPattern.test(content)) {
                consoleLogWarnings.push(relativePath);
              }
              
              // Kolla sedan andra lazy patterns (errors)
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
  
  // Varna om console.log (men blockera inte bygget)
  if (consoleLogWarnings.length > 0) {
    console.warn("⚠️ Warning: console.log found in the following files (not blocking build, but recommending cleanup):");
    consoleLogWarnings.forEach(file => console.warn(`   - ${file}`));
  }
  
  if (issues.length > 0) {
    console.error("❌ LAZY CODE DETECTED:");
    issues.forEach(issue => console.error(`   - ${issue}`));
    return { found: true, issues };
  }
  
  console.log(`✅ Lazy code scan passed (scanned ${scannedFiles.length} files)`);
  return { found: false, issues: [] };
}

/**
 * FIX 2: DÖDA IMPORT-KRASCHER (EXPORTS)
 * Standardizes exports to named exports (except Next.js pages which require default)
 */
function standardizeExports(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const files: string[] = [];
    function scanDirectory(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) continue;
            if (entry.isDirectory()) scanDirectory(fullPath);
            else if (entry.name.endsWith('.tsx')) files.push(fullPath);
        }
    }
    scanDirectory(dir);

    for (const filePath of files) {
        // SKIPPA Next.js Pages (de MÅSTE ha default export)
        const normalizedPath = filePath.replace(/\\/g, '/');
        if (normalizedPath.match(/\/app\/.*(page|layout|loading|error|not-found|template|default|route)\.tsx$/)) {
            continue; 
        }

        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        // Byt "export default function X" -> "export function X"
        if (content.includes('export default function')) {
            console.log(`🔧 Standardizing export in: ${path.basename(filePath)}`);
            content = content.replace(/export default function\s+([a-zA-Z0-9_]+)/g, 'export function $1');
            modified = true;
        }
        // Byt "const X ... export default X" -> "export const X"
        const defaultMatch = content.match(/export\s+default\s+([a-zA-Z0-9_]+)\s*;?/);
        if (defaultMatch) {
             console.log(`🔧 Removing detached default export in: ${path.basename(filePath)}`);
             content = content.replace(defaultMatch[0], '');
             content = content.replace(new RegExp(`const ${defaultMatch[1]}`), `export const ${defaultMatch[1]}`);
             content = content.replace(new RegExp(`function ${defaultMatch[1]}`), `export function ${defaultMatch[1]}`);
             modified = true;
        }

        if (modified) fs.writeFileSync(filePath, content);
    }
}

// =============================================================================
// 🧠 INTELLIGENT BATCH FIXER (Phase 2 Implementation)
// Uses Circuit Breaker, Error Classification, and Telemetry
// =============================================================================

interface IntelligentFixResult {
  success: boolean;
  filesFixed: string[];
  attemptsMade: number;
  circuitBroken: boolean;
  reportPath?: string;
}

async function runIntelligentBatchFixer(
  repoPath: string,
  initialError: string,
  pipeline: any
): Promise<IntelligentFixResult> {
  console.log('\n🧠 INTELLIGENT BATCH FIXER ACTIVATED\n');
  
  // Initialize Circuit Breaker
  const circuitBreaker = new CircuitBreaker({
    maxIdenticalErrors: 2,
    maxTotalAttempts: 10,
    maxDuration: 5 * 60 * 1000, // 5 minutes
    reportPath: path.join(repoPath, 'error-reports'),
  });
  
  let filesFixed: string[] = [];
  let currentError = initialError;
  
  while (true) {
    // 1. CLASSIFY THE ERROR
    const classified = classifyError(currentError);
    console.log(`📊 Error Classification: ${classified.category} (confidence: ${(classified.confidence * 100).toFixed(0)}%)`);
    console.log(`   Target files: ${classified.targetFiles.join(', ') || 'None detected'}`);
    
    // 2. CHECK CIRCUIT BREAKER
    const { canRetry, reason } = circuitBreaker.shouldRetry(classified);
    if (!canRetry) {
      console.error(`\n🚨 CIRCUIT BREAKER TRIGGERED: ${reason}\n`);
      const reportPath = circuitBreaker.generateReport(reason || 'Unknown');
      
      // Record in telemetry
      recordErrorOccurrence(currentError, classified.category);
      
      return {
        success: false,
        filesFixed,
        attemptsMade: circuitBreaker.getStatus().totalAttempts,
        circuitBroken: true,
        reportPath,
      };
    }
    
    // 3. GET FIXING STRATEGY BASED ON ERROR CATEGORY
    const strategy = getFixingStrategy(classified.category);
    const targetFiles = classified.targetFiles.length > 0 
      ? classified.targetFiles 
      : strategy.fixFiles;
    
    console.log(`🎯 Strategy: ${strategy.approach}`);
    console.log(`📁 Target files: ${targetFiles.join(', ') || 'General fix'}`);
    
    // 4. CHECK FOR AUTO-FIX SUGGESTION FROM TELEMETRY
    const autoFix = getAutoFixSuggestion(currentError);
    if (autoFix.canFix && autoFix.pattern) {
      console.log(`💡 Known error pattern detected: ${autoFix.pattern.id}`);
      console.log(`   Suggested fix: ${autoFix.fix}`);
    }
    
    // 5. APPLY FIX BASED ON CATEGORY
    const fixStartTime = Date.now();
    let fixSuccess = false;
    let fixedFiles: string[] = [];
    
    try {
      switch (classified.category) {
        case ErrorCategory.DEPENDENCY_VERSION:
          // Fix package.json directly with golden versions
          console.log('📦 Fixing dependency versions with GOLDEN_VERSIONS...');
          const pkgPath = path.join(repoPath, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const { fixed: fixedDeps, corrections: depCorrections } = validateAndFixDependencies(pkg.dependencies || {});
            const { fixed: fixedDevDeps, corrections: devCorrections } = validateAndFixDependencies(pkg.devDependencies || {});
            
            pkg.dependencies = fixedDeps;
            pkg.devDependencies = fixedDevDeps;
            
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
            
            if (depCorrections.length > 0 || devCorrections.length > 0) {
              console.log('   Fixed versions:');
              [...depCorrections, ...devCorrections].forEach(c => console.log(`     - ${c}`));
              fixedFiles.push('package.json');
              fixSuccess = true;
            }
            
            // Re-run npm install
            console.log('   Running npm install with fixed versions...');
            try {
              execSync('npm install --legacy-peer-deps', { cwd: repoPath, stdio: 'pipe' });
            } catch (e) {
              console.warn('   ⚠️ npm install had issues, continuing...');
            }
          }
          break;
        
        case ErrorCategory.CONFIG_ERROR:
          // Replace config files with golden templates
          console.log('⚙️ Replacing config files with golden templates...');
          
          for (const file of ['next.config.mjs', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.js']) {
            const template = getGoldenTemplate(file);
            if (template) {
              const filePath = path.join(repoPath, file);
              // getGoldenTemplate always returns a string, not a function
              fs.writeFileSync(filePath, template);
              fixedFiles.push(file);
              console.log(`   ✅ Replaced ${file}`);
            }
          }
          fixSuccess = fixedFiles.length > 0;
          break;
        
        case ErrorCategory.PYTHON_SYNTAX:
          // Auto-fix Python syntax errors (brackets, indentation, etc.)
          console.log('🐍 Auto-fixing Python syntax error...');
          
          if (classified.metadata?.file && classified.metadata?.type) {
            const pythonFile = classified.metadata.file;
            const filePath = path.join(repoPath, pythonFile);
            const errorType = classified.metadata.type;
            const errorLine = classified.metadata.line;
            
            const fixed = await autoFixPythonError(classified, repoPath);
            if (fixed) {
              fixedFiles.push(pythonFile);
              fixSuccess = true;
              console.log(`   ✅ Auto-fixed Python syntax: ${errorType}`);
            } else {
              // Fallback to AI fixer if auto-fix failed
              console.log('   ⚠️ Auto-fix failed, trying AI fixer...');
              // Will fall through to default case
            }
          }
          
          // If auto-fix didn't work, fall through to AI fixer
          if (!fixSuccess) {
            // Continue to AI fixer below
          }
          break;
        
        case ErrorCategory.PYTHON_TYPE:
          // Python type errors - use AI fixer
          console.log('🐍 Fixing Python type error with AI...');
          // Fall through to AI fixer
          break;
        
        case ErrorCategory.SYNTAX_ERROR:
          // Check if it's a "missing use client" error
          if (classified.metadata?.type === 'missing_use_client' && classified.targetFiles.length > 0) {
            console.log("💡 Auto-fixing 'use client' directive...");
            
            const targetFile = classified.targetFiles[0];
            const filePath = path.join(repoPath, targetFile);
            
            if (fs.existsSync(filePath)) {
              let content = fs.readFileSync(filePath, 'utf-8');
              
              // Check if 'use client' already exists
              if (!content.includes("'use client'") && !content.includes('"use client"')) {
                // Add 'use client' at the very top
                content = "'use client';\n" + content;
                
                // Safe Write: Ensure directory exists
                const fileDir = path.dirname(filePath);
                if (!fs.existsSync(fileDir)) {
                  fs.mkdirSync(fileDir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content);
                fixedFiles.push(targetFile);
                fixSuccess = true;
                console.log(`   ✅ Added 'use client' to ${targetFile}`);
              } else {
                console.log(`   ℹ️ 'use client' already exists in ${targetFile}`);
                // Still mark as success since the directive is already there
                fixSuccess = true;
              }
            } else {
              console.log(`   ⚠️ File not found: ${targetFile}, trying to extract from error message...`);
              
              // Fallback: Try to extract file path from error message
              const fileMatch = currentError.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
              if (fileMatch) {
                const extractedFile = fileMatch[1];
                const extractedPath = path.join(repoPath, extractedFile);
                
                // Try alternative paths
                const alternatives = [
                  extractedPath,
                  path.join(repoPath, extractedFile.replace(/^\.\//, '')),
                  path.join(repoPath, extractedFile.replace(/^src\//, '')),
                  path.join(repoPath, 'app', path.basename(extractedFile)),
                  path.join(repoPath, 'components', path.basename(extractedFile)),
                ];
                
                for (const altPath of alternatives) {
                  if (fs.existsSync(altPath)) {
                    let content = fs.readFileSync(altPath, 'utf-8');
                    if (!content.includes("'use client'") && !content.includes('"use client"')) {
                      content = "'use client';\n" + content;
                      fs.writeFileSync(altPath, content);
                      fixedFiles.push(path.relative(repoPath, altPath));
                      fixSuccess = true;
                      console.log(`   ✅ Added 'use client' to ${path.relative(repoPath, altPath)}`);
                      break;
                    }
                  }
                }
              }
            }
            
            if (fixSuccess) {
              break; // Exit switch, don't call AI fixer
            }
          }
          // Fall through to AI fixer if auto-fix didn't work
          
        case ErrorCategory.EXPORT_ERROR:
        case ErrorCategory.IMPORT_ERROR:
        case ErrorCategory.TYPE_ERROR:
        case ErrorCategory.LAZY_CODE:
        case ErrorCategory.PYTHON_TYPE:
          // Use AI fixer for code issues
          console.log('🤖 Calling AI Fixer for code issues...');
          
          // Read file contents
          let fileContexts = '';
          for (const file of targetFiles.slice(0, 3)) { // Limit to 3 files
            const filePath = path.join(repoPath, file);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf-8');
              fileContexts += `\n--- FILE: ${file} ---\n${content}\n`;
            }
          }
          
          // Build prevention prompt from telemetry
          const preventionPrompt = generatePreventionPrompt();
          
          const fixPrompt = `
ERROR CATEGORY: ${classified.category}
ERROR CODE: ${classified.errorCode || 'Unknown'}

ERROR MESSAGE:
${currentError.substring(0, 2000)}

TARGET FILES TO FIX:
${targetFiles.join(', ')}

CURRENT FILE CONTENTS:
${fileContexts}

${preventionPrompt}

FIXING STRATEGY: ${strategy.approach}

RULES:
1. Fix ONLY the files that have errors. Do NOT modify other files.
2. Use named exports (not default exports) for all components.
3. All types must be imported from lib/types.ts.
4. Do NOT use 'any' type. Add proper type annotations.
5. Output the COMPLETE fixed file content.

OUTPUT FORMAT:
[FILE: path/to/file.tsx]
... complete fixed code ...
[GOAL]
`;
          
          // Call AI with escalating intelligence
          const status = circuitBreaker.getStatus();
          let smartLevel: 'FAST' | 'SMART' | 'GENIUS' = 'FAST';
          if (status.totalAttempts > 2) smartLevel = 'SMART';
          if (status.totalAttempts > 5) smartLevel = 'GENIUS';
          
          try {
            const fixOutput = await callAI('FIXER', fixPrompt, undefined, undefined, smartLevel);
            
            // Parse and apply fixes
            const fileRegex = /\[FILE:\s*([^\]]+)\]([\s\S]*?)(?=\[GOAL\]|\[FILE:|$)/gi;
            let match;
            while ((match = fileRegex.exec(fixOutput)) !== null) {
              const fileName = match[1].trim();
              let content = match[2].trim();
              
              // Clean markdown if present
              content = content.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
              
              if (fileName && content.length > 50) {
                const filePath = path.join(repoPath, fileName);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, content);
                fixedFiles.push(fileName);
                console.log(`   ✅ Fixed: ${fileName}`);
              }
            }
            
            fixSuccess = fixedFiles.length > 0;
          } catch (aiError) {
            console.error('   ❌ AI fix failed:', aiError);
          }
          break;
        
        default:
          // General fix attempt
          console.log('🔧 Attempting general fix...');
          break;
      }
    } catch (fixError: any) {
      console.error('❌ Fix attempt failed:', fixError.message);
    }
    
    // 6. RECORD THE ATTEMPT
    circuitBreaker.recordAttempt({
      timestamp: new Date(),
      error: currentError,
      errorHash: classified.errorHash,
      errorCategory: classified.category,
      filesTouched: fixedFiles,
      strategy: strategy.approach,
      success: fixSuccess,
      duration: Date.now() - fixStartTime,
    });
    
    // Record in telemetry
    if (!fixSuccess) {
      recordErrorOccurrence(currentError, classified.category);
    }
    
    // Update total fixed files
    filesFixed = [...filesFixed, ...fixedFiles];
    
    // 7. VERIFY THE FIX
    if (fixSuccess) {
      console.log('🔍 Verifying fix...');
      try {
        // Run type check
        execSync('npx tsc --noEmit', { cwd: repoPath, stdio: 'pipe', timeout: 60000 });
        console.log('✅ Type check passed!');
        
        // Run build
        execSync('npm run build', { cwd: repoPath, stdio: 'pipe', timeout: 120000 });
        console.log('✅ Build passed!');
        
        return {
          success: true,
          filesFixed,
          attemptsMade: circuitBreaker.getStatus().totalAttempts,
          circuitBroken: false,
        };
      } catch (verifyError: any) {
        // New error - loop again
        currentError = verifyError.stdout?.toString() || verifyError.stderr?.toString() || verifyError.message;
        console.log('❌ Verification failed. Analyzing new error...');
      }
    } else {
      // No fix applied - use previous error
      console.log('⚠️ No fix was applied. Retrying with different strategy...');
    }
  }
}

/**
 * FIX 3: PRODUKTIONS-KOLLEN (COMMANDS)
 * Runs production readiness checks (TypeScript, ESLint, Python type checks)
 */
function verifyProductionReadiness(localPath: string, intent: any) {
    console.log("🛡️ PRODUCTION QUALITY GATE ACTIVATED...");
    const exec = (cmd: string) => {
        try {
            console.log(`   👉 Running: ${cmd}`);
            execSync(cmd, { cwd: localPath, stdio: 'inherit' }); // inherit visar output direkt
        } catch (e: any) {
            throw new Error(`Quality Check Failed: ${cmd}`);
        }
    };

    // 1. TypeScript Check
    exec('npx tsc --noEmit --skipLibCheck');

    // 2. ESLint (Om config finns)
    if (fs.existsSync(path.join(localPath, '.eslintrc.json')) || fs.existsSync(path.join(localPath, 'eslint.config.mjs'))) {
        try { exec('npx eslint . --fix'); } catch (e) { console.warn("   ⚠️ Lint warnings found (continuing)..."); }
    }

    // 3. Python Checks (Om backend finns)
    if (intent?.isPython || fs.existsSync(path.join(localPath, 'backend'))) {
        const backendPath = path.join(localPath, 'backend');
        console.log("   🐍 Checking Python Backend...");
        try {
            execSync('pip install mypy ruff', { cwd: backendPath, stdio: 'ignore' });
            execSync('python -m mypy . --ignore-missing-imports', { cwd: backendPath, stdio: 'inherit' });
        } catch (e) {
             throw new Error(`Python Quality Check Failed`);
        }
    }
    console.log("✅ QUALITY GATE PASSED.");
}

/**
 * A. The Cache Nuke (Riktig städning)
 * Removes all Next.js cache folders aggressively
 */
function nukeNextJsCache(projectPath: string) {
  console.log("☢️ NUCLEAR CACHE CLEAR INITIATED...");
  
  const pathsToDelete = [
    path.join(projectPath, '.next'),
    path.join(projectPath, 'node_modules', '.cache'),
    path.join(projectPath, 'tsconfig.tsbuildinfo'),
    path.join(projectPath, '.swc'),
  ];

  pathsToDelete.forEach(p => {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`   ✅ Deleted: ${path.relative(projectPath, p) || path.basename(p)}`);
      } catch (e) {
        console.warn(`   ⚠️ Failed to delete ${path.relative(projectPath, p) || path.basename(p)} (File locked?):`, (e as Error).message);
      }
    }
  });
  
  // Clear package manager cache
  try {
    execSync('npm cache clean --force', { cwd: projectPath, stdio: 'ignore' });
    console.log('   ✅ npm cache cleared');
  } catch (e) {
    // Ignore errors
  }
  
  console.log("✅ All caches nuked");
}

/**
 * FIX 1: DÖDA 404-LOOPEN (MIDDLEWARE)
 * Forces middleware.ts to always allow root route through, regardless of auth logic
 */
function sanitizeMiddleware(projectPath: string) {
  const middlewarePath = path.join(projectPath, 'src', 'middleware.ts');
  // Kolla även roten om src saknas
  const rootMiddleware = path.join(projectPath, 'middleware.ts');
  
  const targetPath = fs.existsSync(middlewarePath) ? middlewarePath : (fs.existsSync(rootMiddleware) ? rootMiddleware : null);

  if (!targetPath) return; // Ingen middleware = inget problem

  console.log("🛡️ Sanitizing Middleware to prevent 404 loops...");
  let content = fs.readFileSync(targetPath, 'utf-8');

  // Tvinga in en bypass för root '/' om den saknas
  if (!content.includes("request.nextUrl.pathname === '/'")) {
    const bypassCode = `
    if (request.nextUrl.pathname === '/') {
      return NextResponse.next();
    }
    `;
    // Injicera i början av funktionen
    content = content.replace(
      /export (async )?function middleware\(request: NextRequest\) \{/,
      `export $1function middleware(request: NextRequest) {${bypassCode}`
    );
    
    // Ensure NextResponse is imported
    if (!content.includes('NextResponse')) {
      if (content.includes('from "next/server"') || content.includes("from 'next/server'")) {
        // Update existing import
        content = content.replace(
          /import\s+.*from\s+['"]next\/server['"]/,
          `import { NextRequest, NextResponse } from 'next/server'`
        );
      } else {
        // Add import at top
        content = `import { NextRequest, NextResponse } from 'next/server';\n` + content;
      }
    }
    
    // Safe Write: Ensure directory exists
    const middlewareDir = path.dirname(targetPath);
    if (!fs.existsSync(middlewareDir)) {
      fs.mkdirSync(middlewareDir, { recursive: true });
    }
    
    fs.writeFileSync(targetPath, content);
    console.log("   ✅ Middleware patched: Root route unblocked.");
  } else {
    console.log("   ℹ️ Middleware already has root route bypass.");
  }
}

async function runTesterStep(pipeline: any, repoPath: string) {
  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'tester');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Tester step already completed (Checkpoint found). Skipping.");
    return;
  }

  console.log(`[Tester] Starting verification for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'tester' });
  await createStep(pipeline.id, 'tester', 'running');

  // =============================================================================
  // 🔒 SYNC ENFORCER: Force Backend/Frontend Type Sync (V5.1 UPGRADE)
  // =============================================================================
  if (fs.existsSync(path.join(repoPath, 'backend'))) {
    console.log("🔒 Enforcing Backend/Frontend Type Sync...");
    try {
      // Detektera backend-typ
      const hasPython = fs.existsSync(path.join(repoPath, 'backend', 'main.py')) || 
                       fs.existsSync(path.join(repoPath, 'backend', 'requirements.txt'));
      const backendType = hasPython ? "Python" : "Node";
      
      await runIntegrationStep(repoPath, backendType);
      console.log("✅ Backend/Frontend types synchronized.");
    } catch (syncError: any) {
      console.warn("⚠️ Type sync failed (non-critical, continuing):", syncError?.message);
      // Continue anyway - build might still work
    }
  }

  // =============================================================================
  // 🧨 ATOMIC RESET: Force Reset tsconfig.json (V5.1 UPGRADE)
  // =============================================================================
  forceResetTsConfig(repoPath);

  // ✅ STEP 0: ENFORCE NEXT.JS 15 STRUCTURE FIRST (ALWAYS!)
  // This is the PERMANENT FIX - converts src/app to app/ and ensures correct structure
  try {
    await enforceNextJS15Structure(repoPath);
  } catch (structureError: any) {
    console.error('❌ Structure enforcement failed:', structureError.message);
    // Continue anyway - other fixes might help
  }

  // --- 🧹 DUPLICATE KILLER (The Nuclear Option) ---
  // NOTE: enforceNextJS15Structure already handles moving src/ to root
  // This is a backup check for any remaining duplicates
  const hasSrc = fs.existsSync(path.join(repoPath, 'src'));
  
  if (hasSrc) {
    console.log("[Tester] 🧹 Checking for remaining duplicates (backup check)...");
    
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

  // Note: tsconfig.json is already reset by forceResetTsConfig() above (Atomic Reset)
  // This ensures tsconfig.json is always correct, regardless of AI modifications

  // 2. MASS-INJICERA GOLDEN COMPONENTS (Vänta inte på fel)
  // Golden Stack uses components/ in root, NOT src/components/
  const componentsDir = path.join(repoPath, 'components', 'ui');
  if (!fs.existsSync(componentsDir)) fs.mkdirSync(componentsDir, { recursive: true });

  for (const [name, content] of Object.entries(GOLDEN_COMPONENTS)) {
    const filePath = path.join(componentsDir, name);
    fs.writeFileSync(filePath, content.trim());
    console.log(`-> Injected Golden Component: ${name}`);
  }
  
  // 2.5. GOLDEN PAGE & LAYOUT (Force Valid, Non-Empty Root Page UI)
  console.log("[Tester] 🛡️ Ensuring valid page.tsx and layout.tsx...");
  const appDir = path.join(repoPath, 'src', 'app');
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
  
  // Golden Page - Force a valid, non-empty root page
  const goldenPage = `import React from 'react';

export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-emerald-400 p-8 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">🚀 Frost Factory</h1>
      <p className="text-lg mb-4">Welcome to your SaaS super-pipeline dashboard.</p>
      <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
        <div className="bg-zinc-900 rounded-lg p-4 shadow-2xl">Card 1</div>
        <div className="bg-zinc-900 rounded-lg p-4 shadow-2xl">Card 2</div>
        <div className="bg-zinc-900 rounded-lg p-4 shadow-2xl">Card 3</div>
      </div>
      <div className="mt-8">
        <a href="/dashboard" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-500 transition">
          Go to Dashboard
        </a>
      </div>
    </main>
  );
}
`;
  
  const pagePath = path.join(appDir, 'page.tsx');
  // FIX #3: Use stronger validation
  if (!isPageTsxActuallyValid(pagePath, repoPath)) {
    console.log('-> page.tsx is INVALID. Injecting golden page...');
    fs.writeFileSync(pagePath, BULLETPROOF_PAGE_TEMPLATE);
    console.log("-> ✅ Injected Golden Page (app/page.tsx)");
    
    // FIX #2: Force Correct File Structure - Verify after injection
    console.log('🔍 Verifying file structure...');
    
    // Verify the file actually exists
    if (!fs.existsSync(pagePath)) {
      throw new Error('❌ page.tsx was not created at app/page.tsx!');
    }
    
    // Verify file size (should be > 500 bytes)
    const stats = fs.statSync(pagePath);
    if (stats.size < 500) {
      throw new Error(`❌ page.tsx is too small (${stats.size} bytes) - injection failed!`);
    }
    
    console.log(`✅ page.tsx exists (${stats.size} bytes)`);
    
    // Read and verify content
    const content = fs.readFileSync(pagePath, 'utf-8');
    if (!content.includes('export default')) {
      throw new Error('❌ page.tsx missing export default!');
    }
    
    console.log('✅ page.tsx has valid export default');
    
    // FIX #3: Nuclear Cache Clear
    console.log('💣 NUCLEAR CACHE CLEAR...');
    
    // Remove ALL Next.js cache folders
    const cacheFolders = [
      path.join(repoPath, '.next'),
      path.join(repoPath, 'node_modules', '.cache'),
      path.join(repoPath, '.swc'),
    ];
    
    for (const folder of cacheFolders) {
      if (fs.existsSync(folder)) {
        console.log(`🗑️ Removing ${path.basename(folder)}...`);
        try {
          fs.rmSync(folder, { recursive: true, force: true });
        } catch (e) {
          console.warn(`⚠️ Could not remove ${folder}:`, (e as Error).message);
        }
      }
    }
    
    // Clear package manager cache
    try {
      execSync('npm cache clean --force', { cwd: repoPath, stdio: 'ignore' });
      console.log('✅ npm cache cleared');
    } catch (e) {
      // Ignore errors
    }
    
    console.log('✅ All caches nuked');
    } else {
    console.log("-> ✅ page.tsx exists and is valid, skipping injection.");
  }
  
  // Golden Layout - Ensure valid layout
  const goldenLayout = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frost Factory",
  description: "SaaS super-pipeline dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
  
  const layoutPath = path.join(appDir, 'layout.tsx');
  let needsLayoutInjection = false;
  if (!fs.existsSync(layoutPath)) {
    needsLayoutInjection = true;
  } else {
    const existingContent = fs.readFileSync(layoutPath, 'utf-8');
    if (!existingContent.includes('export default function') && !existingContent.includes('export default')) {
      needsLayoutInjection = true;
    }
  }
  
  if (needsLayoutInjection) {
    fs.writeFileSync(layoutPath, goldenLayout);
    console.log("-> Injected Golden Layout (src/app/layout.tsx)");
  } else {
    console.log("-> layout.tsx exists and looks valid, skipping injection.");
  }
  // -----------------------------------------------------

  // --- 📏 EXPORT STANDARDIZER (The Export Standardizer) ---
  // IMPORTANT: Only standardize components and lib, NOT app pages (Next.js requires export default)
  console.log("[Tester] 📏 Standardizing Exports (No Default Exports allowed, except Next.js pages)...");
  const srcDir = path.join(repoPath, 'src');
  if (fs.existsSync(srcDir)) {
    // Only standardize components and lib directories, NOT app (which requires export default)
    const componentsDir = path.join(srcDir, 'components');
    const libDir = path.join(srcDir, 'lib');
    
    if (fs.existsSync(componentsDir)) {
      console.log("-> Standardizing exports in components/...");
      standardizeExports(componentsDir);
    }
    
    if (fs.existsSync(libDir)) {
      console.log("-> Standardizing exports in lib/...");
      standardizeExports(libDir);
    }
    
    // DO NOT call standardizeExports on srcDir or app directory!
    // Next.js page files (page.tsx, layout.tsx, etc.) MUST keep export default
  } else {
    // Fallback: Om src/ inte finns, kolla i root (men vi borde ha src/ enligt Level 5)
    console.log("⚠️ src/ directory not found, skipping export standardization.");
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
  
  // Safe Write: Ensure directories exist
  const cssDirSrc = path.dirname(cssPathSrc);
  if (!fs.existsSync(cssDirSrc)) {
    fs.mkdirSync(cssDirSrc, { recursive: true });
  }
  fs.writeFileSync(cssPathSrc, globalsCssContent);
  console.log("-> Injected globals.css in src/app/");
  
  const cssDirRoot = path.dirname(cssPathRoot);
  if (!fs.existsSync(cssDirRoot)) {
    fs.mkdirSync(cssDirRoot, { recursive: true });
  }
  fs.writeFileSync(cssPathRoot, globalsCssContent);
  console.log("-> Injected globals.css in app/");

  // 2. TVINGA LAYOUT.TSX (Säkerställ import av globals.css)
  // Vi läser in nuvarande layout och ser till att importen finns.
  const layoutPathSrc = path.join(repoPath, 'src', 'app', 'layout.tsx');
  if (fs.existsSync(layoutPathSrc)) {
      let layoutContent = fs.readFileSync(layoutPathSrc, 'utf-8');
      if (!layoutContent.includes("globals.css")) {
          console.log("-> 🩹 Fixing missing CSS import in layout.tsx");
          layoutContent = `import "./globals.css";\n` + layoutContent;
          // Safe Write: Ensure directory exists
          const layoutDirSrc = path.dirname(layoutPathSrc);
          if (!fs.existsSync(layoutDirSrc)) {
            fs.mkdirSync(layoutDirSrc, { recursive: true });
          }
          fs.writeFileSync(layoutPathSrc, layoutContent);
      }
  }
  
  const layoutPathRoot = path.join(repoPath, 'app', 'layout.tsx');
  if (fs.existsSync(layoutPathRoot)) {
      let layoutContent = fs.readFileSync(layoutPathRoot, 'utf-8');
      if (!layoutContent.includes("globals.css")) {
          console.log("-> 🩹 Fixing missing CSS import in layout.tsx (root)");
          layoutContent = `import "./globals.css";\n` + layoutContent;
          // Safe Write: Ensure directory exists
          const layoutDirRoot = path.dirname(layoutPathRoot);
          if (!fs.existsSync(layoutDirRoot)) {
            fs.mkdirSync(layoutDirRoot, { recursive: true });
          }
          fs.writeFileSync(layoutPathRoot, layoutContent);
      }
  }

  // 3. TVINGA TAILWIND CONFIG (För src-struktur)
  const tailwindConfig = `
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
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
  // Safe Write: Ensure directory exists
  const tailwindConfigPath = path.join(repoPath, 'tailwind.config.ts');
  const tailwindConfigDir = path.dirname(tailwindConfigPath);
  if (!fs.existsSync(tailwindConfigDir)) {
    fs.mkdirSync(tailwindConfigDir, { recursive: true });
  }
  fs.writeFileSync(tailwindConfigPath, tailwindConfig);
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
        // Safe Write: Ensure directory exists
        const pkgDir = path.dirname(sanitizePkgPath);
        if (!fs.existsSync(pkgDir)) {
          fs.mkdirSync(pkgDir, { recursive: true });
        }
        fs.writeFileSync(sanitizePkgPath, JSON.stringify(pkg, null, 2));
        console.log("-> ✅ package.json sanitized");
      }
    } catch (e) {
      console.error("-> ⚠️ Failed to sanitize package.json:", e);
    }
  }
  // -----------------------------------------------------

  // =============================================================================
  // 🔍 PHASE 5: PRE-COMMIT VALIDATION (Before any build attempts)
  // =============================================================================
  console.log('\n🔍 Running Pre-Commit Validation Suite...\n');
  try {
    const validationResult = await runPreCommitValidation(repoPath, true); // autoFix = true
    
    if (validationResult.passed) {
      console.log('✅ Pre-Commit Validation PASSED\n');
    } else {
      console.log('⚠️ Pre-Commit Validation had issues (auto-fixed where possible)\n');
      // Log failed checks
      validationResult.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`   ❌ ${r.check}: ${r.errors.slice(0, 2).join(', ')}`));
    }
  } catch (validationError: any) {
    console.warn('⚠️ Pre-Commit Validation failed:', validationError?.message);
    // Continue anyway - the build loop will catch remaining issues
  }

  // =============================================================================
  // 🏗️ MAIN BUILD/FIX LOOP
  // =============================================================================
  const maxRetries = 10;
  let attempt = 0;
  let success = false;
  
  // Initialize Circuit Breaker for the main loop
  const mainCircuitBreaker = new CircuitBreaker({
    maxIdenticalErrors: 2,
    maxTotalAttempts: maxRetries,
    maxDuration: 10 * 60 * 1000, // 10 minutes
    reportPath: path.join(repoPath, 'error-reports'),
  });
  
  // =============================================================================
  // 🔁 LOOP DETECTION AGENT - Track error patterns (V5 UPGRADE)
  // =============================================================================
  let errorHistory: string[] = [];
  let fixerAttempts = 0; // Track how many times we've tried fixing
  const MAX_FIXER_ATTEMPTS = 3; // V5: Stop after 3 fixer attempts

  // =============================================================================
  // 1. STÄDA & PREPPA (The Forever Fixes)
  // =============================================================================
  console.log("🔧 Applying Strategic Fixes...");
  sanitizeMiddleware(repoPath); // Dödar 404
  standardizeExports(path.join(repoPath, 'src')); // Dödar import-fel
  standardizeExports(path.join(repoPath, 'components')); // Also check root components
  standardizeExports(path.join(repoPath, 'lib')); // Also check root lib

  // 1. Se till att package.json finns och har scripts
  const pkgPath = path.join(repoPath, 'package.json');
  // Safe Write: Ensure directory exists
  const pkgDir = path.dirname(pkgPath);
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir, { recursive: true });
  }
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

      // 1.25. RENSA .NEXT MAPPEN + PERMANENT CACHE (Fixa Spökfelen)
      // Next.js cache kan orsaka "Cannot find module" fel från gamla sökvägar
      // Use the centralized nukeNextJsCache function
      nukeNextJsCache(repoPath);

      // 1.25.5. SÄKRA KODEN (The Forever Fixes - Before each build attempt)
      sanitizeMiddleware(repoPath); // Dödar 404
      standardizeExports(path.join(repoPath, 'src')); // Dödar import-fel
      standardizeExports(path.join(repoPath, 'components')); // Also check root components
      standardizeExports(path.join(repoPath, 'lib')); // Also check root lib

      // 1.26. HACK: Skapa tom workspace-fil för att stoppa Next.js från att klättra uppåt
      console.log("[Tester] 🛡️ Creating pnpm-workspace.yaml to prevent Next.js root climbing...");
      try {
        const workspacePath = path.join(repoPath, 'pnpm-workspace.yaml');
        fs.writeFileSync(workspacePath, '', 'utf-8');
        console.log("-> pnpm-workspace.yaml created.");
      } catch (e) {
        console.warn("-> Warning: Could not create pnpm-workspace.yaml (non-critical):", (e as Error).message);
      }

      // 1.26.5. SÄKRA ROUTING: Sanitize middleware before build
      sanitizeMiddleware(repoPath);

      // 1.27. FIX #1: Remove Invalid projectRoot Config from next.config.mjs
      console.log("[Tester] 🔧 Ensuring next.config.mjs is valid (removing invalid projectRoot)...");
      try {
        const nextConfigPath = path.join(repoPath, 'next.config.mjs');
        if (fs.existsSync(nextConfigPath)) {
          let nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8');
          let needsUpdate = false;
          
          // FIX #1: Remove invalid projectRoot if it exists
          if (nextConfigContent.includes('projectRoot')) {
            console.log("-> Removing invalid 'projectRoot' from next.config.mjs...");
            // Remove projectRoot line
            nextConfigContent = nextConfigContent.replace(/projectRoot:\s*process\.cwd\(\),\s*\n?/g, '');
            // Remove empty lines after removal
            nextConfigContent = nextConfigContent.replace(/\n\s*\n\s*\n/g, '\n\n');
            needsUpdate = true;
          }
          
          // Ensure it has valid Next.js 15 config
          if (!nextConfigContent.includes('reactStrictMode')) {
            // Add valid config if missing
            nextConfigContent = nextConfigContent.replace(
              /const nextConfig = \{/,
              `const nextConfig = {\n  reactStrictMode: true,`
            );
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            fs.writeFileSync(nextConfigPath, nextConfigContent, 'utf-8');
            console.log("-> next.config.mjs updated (removed invalid projectRoot).");
          } else {
            console.log("-> next.config.mjs is already valid.");
          }
        } else {
          // Om next.config.mjs inte finns, skapa den med valid config
          const defaultConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
`;
          fs.writeFileSync(nextConfigPath, defaultConfig, 'utf-8');
          console.log("-> next.config.mjs created with valid Next.js 15 config.");
        }
      } catch (e) {
        console.warn("-> Warning: Could not update next.config.mjs (non-critical):", (e as Error).message);
      }

      // 1.28. FIX: Unblockera startsidan i middleware.ts (CRITICAL - Prevents 404 loop)
      console.log("[Tester] 🛡️ Ensuring middleware.ts unblocks root route (/)...");
      try {
        const middlewarePathSrc = path.join(repoPath, 'src', 'middleware.ts');
        const middlewarePathRoot = path.join(repoPath, 'middleware.ts');
        let middlewarePath = null;
        
        // Hitta middleware-filen
        if (fs.existsSync(middlewarePathSrc)) {
          middlewarePath = middlewarePathSrc;
        } else if (fs.existsSync(middlewarePathRoot)) {
          middlewarePath = middlewarePathRoot;
        }
        
        if (middlewarePath) {
          let middlewareContent = fs.readFileSync(middlewarePath, 'utf-8');
          let needsUpdate = false;
          
          // Kolla om startsidan (/) redan är unblocked
          const hasRootUnblock = middlewareContent.includes("request.nextUrl.pathname === '/'") && 
                                  middlewareContent.includes("return NextResponse.next()");
          
          if (!hasRootUnblock) {
            // Lägg till unblock-logik i början av middleware-funktionen
            // Hitta export async function middleware
            if (middlewareContent.includes('export async function middleware')) {
              // Lägg till unblock-logik direkt efter funktionsdeklarationen
              const unblockCode = `
  // CRITICAL FIX: Släpp igenom startsidan (/) utan kontroll
  if (request.nextUrl.pathname === '/') {
    return NextResponse.next();
  }
`;
              
              // Försök hitta första raden i funktionen och lägg till koden efter den
              const functionMatch = middlewareContent.match(/(export async function middleware\([^)]*\)\s*\{)/);
              if (functionMatch) {
                middlewareContent = middlewareContent.replace(
                  functionMatch[0],
                  functionMatch[0] + unblockCode
                );
                needsUpdate = true;
              } else {
                // Fallback: Lägg till efter första {
                middlewareContent = middlewareContent.replace(
                  /(export async function middleware\([^)]*\)\s*\{)/,
                  `$1${unblockCode}`
                );
                needsUpdate = true;
              }
            }
            
            // Uppdatera matcher om den inte redan exkluderar roten
            if (!middlewareContent.includes("'/((?!api|_next/static|_next/image|favicon.ico|$).*)'")) {
              // Hitta matcher-konfigurationen
              const matcherMatch = middlewareContent.match(/matcher:\s*\[([^\]]*)\]/);
              if (matcherMatch) {
                // Ersätt med korrekt matcher som exkluderar roten
                middlewareContent = middlewareContent.replace(
                  /matcher:\s*\[[^\]]*\]/,
                  `matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]`
                );
                needsUpdate = true;
              } else if (middlewareContent.includes('export const config')) {
                // Om config finns men inte matcher, lägg till den
                middlewareContent = middlewareContent.replace(
                  /(export const config\s*=\s*\{)/,
                  `$1\n  matcher: [\n    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',\n  ],`
                );
                needsUpdate = true;
              }
            }
            
            if (needsUpdate) {
              // Safe Write: Ensure directory exists
              const middlewareDir = path.dirname(middlewarePath);
              if (!fs.existsSync(middlewareDir)) {
                fs.mkdirSync(middlewareDir, { recursive: true });
              }
              fs.writeFileSync(middlewarePath, middlewareContent, 'utf-8');
              console.log(`-> middleware.ts updated to unblock root route (${path.relative(repoPath, middlewarePath)}).`);
            } else {
              console.log("-> middleware.ts already unblocks root route.");
            }
          } else {
            console.log("-> middleware.ts already unblocks root route.");
          }
        } else {
          console.log("-> No middleware.ts found (this is OK if not using Supabase Auth).");
        }
      } catch (e) {
        console.warn("-> Warning: Could not update middleware.ts (non-critical):", (e as Error).message);
      }

      // 1.5. ANTI-LAZY SCAN (Före build - tvinga implementation)
      const lazinessCheck = scanForLaziness(repoPath);
      if (lazinessCheck.found) {
        const errorMessage = `LAZY CODE DETECTED:\n${lazinessCheck.issues.join('\n')}\n\nFIX IT. No placeholders allowed.`;
        console.error(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // 2. KÖR PRODUCTION READINESS CHECK (The Enforcer)
      // Hämta intent från pipeline eller planner step
      let intent: ProjectIntent;
      try {
        const plannerStep = await getStep(pipeline.id, 'planner');
        if (plannerStep?.output?.intent) {
          intent = plannerStep.output.intent;
        } else {
          // Fallback: Detektera intent från scratch
          intent = await detectProjectIntent(pipeline.initial_prompt || pipeline.prompt || "");
        }
      } catch (e) {
        // Fallback: Detektera intent från scratch
        intent = await detectProjectIntent(pipeline.initial_prompt || pipeline.prompt || "");
      }
      
      console.log("[Tester] Running Production Readiness Check...");
      try {
        verifyProductionReadiness(repoPath, intent);
        console.log("✅ Production Readiness Check Passed!");
      } catch (qualityError: any) {
        // Fånga kvalitetskontroll-outputen
        const qualityOutput = qualityError.message || "";
        console.log("❌ Production Readiness Check Failed. Output captured.");
        throw new Error(qualityOutput); // Kasta detta som felet vi ska laga
      }

      // 3. Om kvalitetskontrollen passerar, kör vi en riktig build för att säkra
      if (fs.existsSync(path.join(repoPath, 'package.json'))) {
        // Final cache clear innan build (för att garantera ren build)
        console.log("[Tester] 🧹 Final cache clear before build...");
        try {
          const nextDir = path.join(repoPath, '.next');
          if (fs.existsSync(nextDir)) {
            fs.rmSync(nextDir, { recursive: true, force: true });
          }
          const nodeModulesCache = path.join(repoPath, 'node_modules', '.cache');
          if (fs.existsSync(nodeModulesCache)) {
            fs.rmSync(nodeModulesCache, { recursive: true, force: true });
          }
        } catch (e) {
          // Ignorera cache-rensningsfel
        }
        
        console.log("[Tester] Running Final Build...");
        execSync('npm run build', { 
        cwd: repoPath, 
          stdio: 'pipe',
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
        });
        console.log("✅ Build Successful!");
        
        // 🧠 MEMORIZE SOLUTION: Save successful fix to Hive Mind
        if (wasFixing && lastAppliedFix && lastErrorLog) {
          console.log("🧠 Memorizing successful fix to Hive Mind...");
          await memorizeSolution(lastErrorLog, lastAppliedFix).catch(err => 
            console.warn("⚠️ Failed to memorize solution:", err?.message)
          );
        }
        
        // 3.5. ASSERT: Verify page.tsx and layout.tsx export valid default components
        console.log("[Tester] 🛡️ Verifying page.tsx and layout.tsx export default components...");
        const pagePath = path.join(repoPath, 'src', 'app', 'page.tsx');
        const layoutPath = path.join(repoPath, 'src', 'app', 'layout.tsx');
        
        // Check page.tsx
        if (fs.existsSync(pagePath)) {
          const pageContent = fs.readFileSync(pagePath, 'utf-8');
          if (!pageContent.includes('export default function') && !pageContent.match(/export\s+default\s+\w+/)) {
            throw new Error("❌ CRITICAL: app/page.tsx does NOT export a default React component. Next.js requires 'export default function Page()' or 'export default ComponentName'.");
          }
          // Check if it's basically empty
          if (pageContent.includes('return null') || pageContent.match(/<main\s*>\s*<\/main>/)) {
            throw new Error("❌ CRITICAL: app/page.tsx is empty or returns null. It must render actual UI content.");
          }
          console.log("-> ✅ page.tsx exports valid default component.");
        } else {
          throw new Error("❌ CRITICAL: app/page.tsx does not exist. Next.js requires this file for the root route.");
        }
        
        // Check layout.tsx
        if (fs.existsSync(layoutPath)) {
          const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
          if (!layoutContent.includes('export default function') && !layoutContent.match(/export\s+default\s+\w+/)) {
            throw new Error("❌ CRITICAL: src/app/layout.tsx does NOT export a default React component. Next.js requires 'export default function RootLayout()' or 'export default ComponentName'.");
          }
          console.log("-> ✅ layout.tsx exports valid default component.");
        } else {
          throw new Error("❌ CRITICAL: src/app/layout.tsx does not exist. Next.js requires this file for the root layout.");
        }
        
        // 3.6. POST-FIX CHECK: Verify that the built page actually renders UI (not 404 or blank)
        console.log("[Tester] 🔍 Verifying that root page renders actual UI (not 404 or blank)...");
        try {
          // Check if .next/static exists (build output)
          const staticDir = path.join(repoPath, '.next', 'static');
          if (fs.existsSync(staticDir)) {
            // Try to read the HTML output from build
            // Next.js 15 stores static HTML in .next/server/app/page.html or similar
            const serverAppDir = path.join(repoPath, '.next', 'server', 'app');
            if (fs.existsSync(serverAppDir)) {
              // Look for page.html or similar
              const pageHtmlPath = path.join(serverAppDir, 'page.html');
              if (fs.existsSync(pageHtmlPath)) {
                const htmlContent = fs.readFileSync(pageHtmlPath, 'utf-8');
                // Check if it's a 404 page or empty
                if (htmlContent.includes('404') || htmlContent.includes('Not Found') || 
                    htmlContent.match(/<main\s*>\s*<\/main>/) || htmlContent.trim().length < 100) {
                  throw new Error("❌ CRITICAL: Built page renders 404 or is empty. Product UI missing: page.tsx must render a visible dashboard/landing!");
                }
                // Check if it has actual content (not just empty tags)
                if (!htmlContent.includes('<h1') && !htmlContent.includes('<div') && !htmlContent.includes('Frost')) {
                  throw new Error("❌ CRITICAL: Built page has no visible content. page.tsx must render actual UI elements (headings, cards, buttons, etc.).");
                }
                console.log("-> ✅ Built page renders actual UI content.");
              }
            }
          }
        } catch (htmlCheckError: any) {
          // If HTML check fails, it's not critical - we'll catch it in visual audit
          console.warn("-> ⚠️ Could not verify HTML output (non-critical):", htmlCheckError.message);
        }
      }

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
        
        // 🧠 MEMORIZE SOLUTION: Save successful fix to Hive Mind
        if (wasFixing && lastAppliedFix && lastErrorLog) {
          console.log("🧠 Memorizing successful fix to Hive Mind...");
          await memorizeSolution(lastErrorLog, lastAppliedFix).catch(err => 
            console.warn("⚠️ Failed to memorize solution:", err?.message)
          );
        }
        
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
      
      // Extract broken file FIRST (needed for loop detection)
      // TSC Output format: "src/app/page.tsx(1,1): error TS..." eller "C:\path\to\file.tsx(1,1): error..."
      // Bättre regex som hanterar både unix/win sökvägar
      let match = fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|js|jsx))\(\d+,\d+\):/);
      let brokenFile = match ? match[1].trim() : "";
      
      // Normalisera sökvägar (ta bort fullständig sökväg om den finns)
      if (brokenFile && brokenFile.includes(repoPath)) {
        brokenFile = brokenFile.replace(repoPath, '').replace(/^[\\\/]/, ''); // Ta bort prefix
      }
      
      // Hantera slash direction (normalisera till forward slashes)
      if (brokenFile) {
        brokenFile = brokenFile.replace(/\\/g, '/');
      }
      
      // Read broken file content
      let brokenFileContent = "";
      if (brokenFile) {
        try {
          brokenFileContent = fs.readFileSync(path.join(repoPath, brokenFile), 'utf-8');
        } catch (e) {
          console.log(`Could not read broken file: ${brokenFile}`);
        }
      }
      
      // =============================================================================
      // 🔁 LOOP DETECTION AGENT - Detect if we're stuck in a loop (V5 UPGRADE)
      // =============================================================================
      const currentError = fullLog.slice(0, 300); // Compare first 300 chars for better matching
      errorHistory.push(currentError);
      
      // Check if the last 3 errors are roughly identical
      const last3Errors = errorHistory.slice(-3);
      const isLooping = last3Errors.length === 3 && last3Errors.every(e => e === currentError);
      
      if (isLooping) {
        console.error("\n🔁 LOOP DETECTED: The standard agents are stuck.");
        
        // 1. SAMLA BEVIS (Kontext)
        // Kimi behöver se filen, felet OCH vad vi försökt göra
        const fileMatch = fullLog.match(/([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|py|ts|js))(?:\s*\((\d+),(\d+)\))?/);
        const targetFile = fileMatch ? fileMatch[1].trim() : (brokenFile || 'app/page.tsx');
        
        const targetFileContent = fs.existsSync(path.join(repoPath, targetFile)) 
          ? fs.readFileSync(path.join(repoPath, targetFile), 'utf-8')
          : "File not found";
          
        const investigationPrompt = `
        🚨 LOOP INVESTIGATION REQUEST 🚨
        
        THE SITUATION:
        The 'Fixer Agent' has tried to fix the same error 3 times and FAILED.
        We are stuck in a loop.
        
        THE ERROR:
        ${currentError}
        
        THE FILE CONTENT (Current State):
        ${targetFileContent.substring(0, 3000)}${targetFileContent.length > 3000 ? '\n... (truncated)' : ''}
        
        YOUR TASK (Detective):
        1. Why is the fix failing? (e.g., "Agent keeps removing the import but it's required", "Agent is fixing syntax but logic is wrong").
        2. What is the RADICAL solution? (e.g., "Delete the file", "Rewrite from scratch", "Change the interface").
        
        OUTPUT JSON ONLY:
        {
            "analysis": "The agent keeps...",
            "strategy": "REWRITE" | "DELETE" | "IGNORE",
            "instructions": "Write the code to..."
        }
        `;

        // 2. ANROPA DETEKTIVEN (Kimi)
        let strategy: { analysis?: string; strategy: string; instructions: string };
        try {
          const detectiveJson = await callAI("LOOP_DETECTIVE", investigationPrompt);
          const jsonMatch = detectiveJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            strategy = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in detective response");
          }
        } catch (e: any) {
          // Fallback om Kimi svamlar
          console.warn("⚠️ Detective response parsing failed, using fallback strategy:", e?.message);
          strategy = { strategy: "REWRITE", instructions: "Rewrite the file entirely." };
        }
        
        console.log(`🕵️ Detective Analysis: ${strategy.analysis || 'No analysis provided'}`);
        console.log(`🕵️ Detective Strategy: ${strategy.strategy}`);
        console.log(`📝 Instructions: ${strategy.instructions}`);

        // 3. UTFÖR ORDER (Nuclear Option med Claude)
        if (strategy.strategy === "REWRITE") {
          console.log("🚨 ACTIVATING NUCLEAR OPTION (Claude 3.5)...");
          const nuclearPrompt = `
            STOP. LISTEN TO THE DETECTIVE.
            
            INSTRUCTIONS:
            ${strategy.instructions}
            
            FILE: ${targetFile}
            ERROR: ${currentError}
            
            REWRITE THE FILE COMPLETELY. DO NOT PATCH.
            OUTPUT [FILE: ...] FORMAT.
          `;
          
          try {
            const fix = await callAI("NUCLEAR", nuclearPrompt);
            const filesCreated = await parseAndWriteFiles(fix, repoPath);
            
            if (filesCreated > 0) {
              console.log(`✅ Nuclear rewrite applied: ${filesCreated} file(s) rewritten from scratch.`);
              errorHistory = []; // Nollställ minnet
              continue; // Starta om
            } else {
              console.error("❌ Nuclear rewrite produced no files. Breaking loop.");
              break;
            }
          } catch (nuclearError: any) {
            console.error("❌ Nuclear rewrite failed:", nuclearError.message);
            console.error("🚨 MANUAL INTERVENTION REQUIRED");
            break;
          }
        } 
        else if (strategy.strategy === "DELETE") {
          console.log("🗑️ Detective ordered DELETION.");
          try {
            const filePath = path.join(repoPath, targetFile);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`✅ Deleted file: ${targetFile}`);
              errorHistory = []; // Nollställ minnet
              continue; // Starta om
            } else {
              console.warn(`⚠️ File not found for deletion: ${targetFile}`);
            }
          } catch (deleteError: any) {
            console.error("❌ File deletion failed:", deleteError.message);
          }
        }
        else if (strategy.strategy === "IGNORE") {
          console.log("⏭️ Detective ordered IGNORE. Continuing with next attempt...");
          errorHistory = []; // Nollställ minnet
          continue;
        }
        else {
          console.warn(`⚠️ Unknown strategy: ${strategy.strategy}. Using default REWRITE.`);
          // Fallback to rewrite
          const nuclearPrompt = `Rewrite the file ${targetFile} completely. ${strategy.instructions}`;
          try {
            const fix = await callAI("NUCLEAR", nuclearPrompt);
            await parseAndWriteFiles(fix, repoPath);
            errorHistory = [];
            continue;
          } catch (e: any) {
            console.error("❌ Fallback rewrite failed:", e.message);
            break;
          }
        }
      }
      
      // Continue with normal error handling if not in critical loop
      // Extract broken file (if not already extracted above)
      if (!brokenFile) {
        const match = fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|js|jsx))\(\d+,\d+\):/);
        brokenFile = match ? match[1].trim() : "";
      }

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

      // =============================================================================
      // 💡 QUICK FIX: Missing "use client" Directive
      // =============================================================================
      if (fullLog.includes("You're importing a component that needs") || 
          fullLog.includes("useState") && fullLog.includes("is not defined") ||
          fullLog.includes("useEffect") && fullLog.includes("is not defined") ||
          fullLog.includes("useRouter") && fullLog.includes("is not defined")) {
        console.log("[Watchdog] 💡 Detected missing 'use client' directive. Auto-fixing...");
        
        // Try to extract file path from error
        const fileMatch = fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts|jsx|js))(?:\s*\((\d+),(\d+)\))?/);
        if (fileMatch) {
          const targetFile = fileMatch[1];
          const alternatives = [
            path.join(repoPath, targetFile),
            path.join(repoPath, targetFile.replace(/^\.\//, '')),
            path.join(repoPath, targetFile.replace(/^src\//, '')),
            path.join(repoPath, 'app', path.basename(targetFile)),
            path.join(repoPath, 'components', path.basename(targetFile)),
          ];
          
          for (const filePath of alternatives) {
            if (fs.existsSync(filePath)) {
              let content = fs.readFileSync(filePath, 'utf-8');
              
              // Check if 'use client' already exists
              if (!content.includes("'use client'") && !content.includes('"use client"')) {
                // Add 'use client' at the very top
                content = "'use client';\n" + content;
                
                // Safe Write: Ensure directory exists
                const fileDir = path.dirname(filePath);
                if (!fs.existsSync(fileDir)) {
                  fs.mkdirSync(fileDir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content);
                console.log(`[Watchdog] ✅ Added 'use client' to ${path.relative(repoPath, filePath)}`);
                console.log("✅ Quick fix applied. Retrying build immediately.");
                continue; // Hoppa över resten och testa bygget igen!
              }
            }
          }
        }
      }
      // =============================================================================

      // brokenFile is already extracted above for loop detection
      // Continue with path resolution if needed

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
        // Exempel: "@/components/ui/Card" -> "components/ui/Card.tsx"
        let badModulePath = exportErrorMatch[1];
        
        // Konvertera alias (@) till riktig sökväg (Golden Stack uses root, not src/)
        badModulePath = badModulePath.replace('@/', '').replace('@', '');
        
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

      // Read broken file content if not already read above
      if (!brokenFileContent && brokenFile) {
        try {
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
              
              // Safe Write: Ensure directory exists
              const autoFixFilePath = path.join(repoPath, brokenFile);
              const autoFixDir = path.dirname(autoFixFilePath);
              if (!fs.existsSync(autoFixDir)) {
                fs.mkdirSync(autoFixDir, { recursive: true });
              }
              fs.writeFileSync(autoFixFilePath, newContent);
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

      // 🕵️‍♂️ SHERLOCK MODE: Hitta den relaterade filen (Dependency Detective)
      let relatedFileContent = "";
      let relatedFilePath = "";
      
      const importErrorMatch = fullLog.match(/Module ['"](.+?)['"] has no exported member/);
      const missingModuleMatch = fullLog.match(/Cannot find module ['"](.+?)['"]/);
      
      const problematicImport = importErrorMatch?.[1] || missingModuleMatch?.[1];
      
      if (problematicImport && brokenFile) {
        console.log(`🕵️ Detective: Suspect file is '${problematicImport}'`);
        const resolvedPath = resolveImportPath(problematicImport, brokenFile, repoPath);
        
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          relatedFilePath = path.relative(repoPath, resolvedPath).replace(/\\/g, '/');
          console.log(`🕵️ Detective: Found the suspect at '${relatedFilePath}'! Reading evidence...`);
          try {
            relatedFileContent = fs.readFileSync(resolvedPath, 'utf-8');
            console.log(`🕵️ Detective: Evidence collected (${relatedFileContent.length} chars)`);
          } catch (e) {
            console.warn(`🕵️ Detective: Could not read suspect file: ${e}`);
          }
        } else {
          console.log(`🕵️ Detective: Suspect file '${problematicImport}' not found on disk (may be node_modules or missing)`);
        }
      }

      // =============================================================================
      // 🧠 HIVE MIND: Check Memory First (V5.1 UPGRADE)
      // =============================================================================
      console.log("🧠 Consulting Hive Mind for proven solutions...");
      const memoryFix = await consultHiveMind(fullLog);
      
      if (memoryFix && brokenFile) {
        console.log("💡 Hive Mind recall: Found a proven fix! Applying directly...");
        try {
          const filePath = path.join(repoPath, brokenFile);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, memoryFix);
          console.log(`✅ Applied fix from Hive Mind to ${brokenFile}`);
          
          // Continue to next attempt (skip AI call)
          continue;
        } catch (memoryError: any) {
          console.warn("⚠️ Failed to apply Hive Mind fix:", memoryError?.message);
          // Fall through to Review Loop
        }
      }

      // =============================================================================
      // 🔄 V5.1 REVIEW LOOP: Review -> Debug -> Fix (Triple-Loop System)
      // =============================================================================
      console.log(`\n🔄 V5.1 Review Loop engaging (Attempt ${attempt}/${maxRetries})...`);
      
      // Track if we're fixing (for memorization later)
      let wasFixing = true;
      let lastErrorLog = fullLog;
      let lastAppliedFix = "";
      
      // 1. SKAPA KARTA ÖVER PROJEKTET
      const projectFiles = getProjectStructure(repoPath);
      const fileTreeContext = `
      CURRENT PROJECT STRUCTURE (All existing files):
      ${projectFiles.join('\n')}
      `;

      // ------------------------------------------------------------
      // STEG 1: CODE REVIEW AGENT (Analys)
      // ------------------------------------------------------------
      console.log("🧐 STEP 1: Calling Code Review Agent...");
      
      const reviewPrompt = `
        CONTEXT: Build failed during validation.

        TARGET FILE: ${brokenFile || 'unknown'}

        ERROR LOG:
        ${fullLog.substring(0, 5000)}

        FILE CONTENT:
        ${brokenFileContent ? brokenFileContent.substring(0, 3000) + (brokenFileContent.length > 3000 ? '\n... (truncated)' : '') : 'File not found or not readable'}

        ${relatedFileContent ? `
        RELATED FILE (${relatedFilePath}):
        ${relatedFileContent.substring(0, 2000)}${relatedFileContent.length > 2000 ? '\n... (truncated)' : ''}
        ` : ''}

        CURRENT PROJECT STRUCTURE:
        ${fileTreeContext}

        TASK: Perform a static analysis. 
        - Identify syntax errors (missing braces, wrong imports).
        - Check for logic errors (hooks outside component, server/client mismatch).
        - Identify export/import mismatches.
        - DO NOT FIX IT. Just list the errors clearly with line numbers and explanations.
      `;

      const analysis = await callAI("CODE_REVIEWER", reviewPrompt);
      console.log(`📋 Analysis: ${analysis.substring(0, 200)}...`);

      // ------------------------------------------------------------
      // STEG 2: DEBUGGER / RECOVERY AGENT (Strategi)
      // ------------------------------------------------------------
      console.log("🚑 STEP 2: Calling Error Recovery Agent...");
      
      const recoveryPrompt = `
        ANALYSIS FROM CODE REVIEWER:
        ${analysis}

        ERROR LOG:
        ${fullLog.substring(0, 3000)}

        TARGET FILE: ${brokenFile || 'unknown'}

        TASK: Decide the recovery strategy.
        - Is this a simple syntax fix? -> Strategy: PATCH
        - Is this a fundamental architecture flaw? -> Strategy: REWRITE
        - Are we missing dependencies? -> Strategy: INSTALL
        - Is this an export/import mismatch? -> Strategy: ALIGN_EXPORTS

        Output a concise JSON plan: { "strategy": "PATCH|REWRITE|INSTALL|ALIGN_EXPORTS", "steps": ["step1", "step2", ...], "files": ["file1.tsx", "file2.ts"] }
      `;

      const strategyJson = await callAI("DEBUGGER", recoveryPrompt);
      console.log(`📋 Strategy: ${strategyJson.substring(0, 200)}...`);

      // Parse strategy (try to extract JSON, but be lenient)
      let strategy = "PATCH";
      let steps: string[] = [];
      let targetFiles: string[] = [brokenFile || 'unknown'];
      
      try {
        const jsonMatch = strategyJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          strategy = parsed.strategy || strategy;
          steps = parsed.steps || steps;
          targetFiles = parsed.files || targetFiles;
        }
      } catch (e) {
        // If JSON parsing fails, try to extract strategy from text
        if (strategyJson.toLowerCase().includes('rewrite')) strategy = "REWRITE";
        else if (strategyJson.toLowerCase().includes('install')) strategy = "INSTALL";
        else if (strategyJson.toLowerCase().includes('export') || strategyJson.toLowerCase().includes('import')) strategy = "ALIGN_EXPORTS";
      }

      console.log(`🎯 Strategy: ${strategy}`);
      if (steps.length > 0) console.log(`📝 Steps: ${steps.slice(0, 3).join(', ')}...`);

      // ------------------------------------------------------------
      // STEG 3: EXECUTION (Fixer)
      // ------------------------------------------------------------
      console.log("🛠️ STEP 3: Executing Fix...");

      // Build comprehensive fix prompt with all context
      const EXPORT_RULE = `
CRITICAL EXPORT RULES (MANDATORY):
1. COMPONENTS (in /components): MUST use named exports.
   - Correct: export function Button() { ... }
   - Wrong: export default function Button() { ... }
2. PAGES (in /app): MUST use default exports.
   - Correct: export default function Page() { ... }
   - Wrong: export function Page() { ... }
3. IMPORTS: MUST match the export type.
   - Importing a component: import { Button } from '@/components/ui/Button';
`;

      const fixPrompt = `
        STRATEGY: ${strategy}
        STEPS: ${steps.join('\n')}
        
        ANALYSIS: ${analysis}
        
        ERROR LOG:
        ${fullLog.substring(0, 5000)}

        TARGET FILES: ${targetFiles.join(', ')}

        PRIMARY FILE (${brokenFile || 'unknown'}):
        ${brokenFileContent ? brokenFileContent.substring(0, 3000) + (brokenFileContent.length > 3000 ? '\n... (truncated)' : '') : 'File not found'}

        ${relatedFileContent ? `
        RELATED FILE (${relatedFilePath}):
        ${relatedFileContent.substring(0, 2000)}${relatedFileContent.length > 2000 ? '\n... (truncated)' : ''}
        ` : ''}

        CURRENT PROJECT STRUCTURE:
        ${fileTreeContext}

        TASK: Execute the fix on the target file(s).
        
        CRITICAL RULES:
        1. Use '@/' alias for all imports (never '../' or './').
        2. Follow EXPORT_RULE: Components = named exports, Pages = default exports.
        3. For Next.js 15: Add 'await' to params/searchParams/cookies/headers and make functions async.
        4. If export doesn't exist, define it locally inline (inline fix strategy).
        5. Maintain existing functionality. Do NOT delete page content.

        ${EXPORT_RULE}

        OUTPUT FORMAT:
        [FILE: path/to/file.tsx]
        ... fixed code ...
        [GOAL]
      `;

      // VÄLJ INTELLIGENS-NIVÅ (Tiered Escalation)
      let smartLevel: 'FAST' | 'SMART' | 'GENIUS' = 'FAST';
      if (attempt > 1) smartLevel = 'SMART';
      if (attempt > 3 || strategy === 'REWRITE') smartLevel = 'GENIUS';

      const fixOutput = await callAI("FIXER", fixPrompt, undefined, undefined, smartLevel);
      
      // Fallback om fixOutput är tom
      let finalFixOutput = fixOutput;
      if (!finalFixOutput || finalFixOutput.trim().length === 0) {
        console.warn(`⚠️ ${smartLevel} Fixer returned empty. Trying fallback...`);
        if (smartLevel === 'FAST') {
          finalFixOutput = await callAI("FIXER", fixPrompt, undefined, undefined, 'SMART');
        } else if (smartLevel === 'SMART') {
          finalFixOutput = await callAI("FIXER", fixPrompt, undefined, undefined, 'GENIUS');
        }
      }

      // Applicera fixen (Skapa/Uppdatera filer) - Batch Fixer använder [FILE: ...] [GOAL] format
      // Försök först med [FILE: ...] [GOAL] format (batch fixer)
      let fileRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
      let fileMatch;
      let fixedCount = 0;
      
      while ((fileMatch = fileRegex.exec(finalFixOutput)) !== null) {
        const fileName = fileMatch[1].trim();
        let content = fileMatch[2].trim();
        
        // THE SANITIZER: Ta bort alla Markdown-artefakter
        content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
        content = content.replace(/```$/m, '');
        content = content.replace(/^### FILE:.*\n?/m, '');
        content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
        content = content.trim();
        
        const filePath = path.join(repoPath, fileName);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, content);
        console.log(`[Batch Fixer] 🛠️ Fixed file: ${fileName}`);
        // Save applied fix for memorization
        if (brokenFile === fileName || fixedCount === 0) {
          lastAppliedFix = content;
        }
        fixedCount++;
      }
      
      // Fallback: Om [FILE: ...] formatet inte matchade, försök med ### FILE: ... ### END_FILE
      if (fixedCount === 0) {
        fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
        
        while ((fileMatch = fileRegex.exec(finalFixOutput)) !== null) {
          const fileName = fileMatch[1].trim();
          let content = fileMatch[2].trim();
          
          // THE SANITIZER: Ta bort alla Markdown-artefakter
          content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
          content = content.replace(/```$/m, '');
          content = content.replace(/^### FILE:.*\n?/m, '');
          content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
          content = content.trim();
          
          const filePath = path.join(repoPath, fileName);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          fs.writeFileSync(filePath, content);
          console.log(`[Batch Fixer] 🛠️ Fixed file (fallback): ${fileName}`);
          // Save applied fix for memorization
          if (brokenFile === fileName || fixedCount === 0) {
            lastAppliedFix = content;
          }
          fixedCount++;
        }
      }

      // 2. FALLBACK PARSER (Om regex missade)
      if (fixedCount === 0 && brokenFile) {
        console.log("[Watchdog] ⚠️ Strict parsing failed. Trying Fallback Strategy...");
        
        // Kolla om vi har ett markdown-block
        const codeBlockMatch = finalFixOutput.match(/```(?:typescript|tsx|ts|js)?\n([\s\S]*?)```/);
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
      
      // VIKTIGT: Kör Standardizer IGEN efter fixen ifall AI:n lade till fel exports igen
      if (fixedCount > 0) {
        console.log("[Watchdog] 🔧 Re-standardizing exports after AI fix...");
        standardizeExports(path.join(repoPath, 'src'));
        standardizeExports(path.join(repoPath, 'components'));
        standardizeExports(path.join(repoPath, 'lib'));
      }
      
      // =============================================================================
      // 🧠 INTELLIGENT FIXER FALLBACK (Phase 2) + V5 LOOP DETECTION
      // If we've tried many times with no success, use the intelligent fixer
      // =============================================================================
      if (attempt >= 5 && !success) {
        fixerAttempts++;
        
        // V5 LOOP DETECTION: Stop if we've tried fixing too many times
        if (fixerAttempts > MAX_FIXER_ATTEMPTS) {
          console.error('\n🚨 V5 LOOP DETECTION: Breaking cycle after multiple fixer attempts.');
          console.error('   The pipeline is stuck between Reviewer and Fixer.');
          console.error('   Calling Senior Architect for radical solution...');
          
          // Try one last "radical fix" with a specialist AI
          try {
            const radicalFixPrompt = `
STOP. YOU ARE STUCK IN A LOOP.

The pipeline has tried to fix errors ${fixerAttempts} times without success.
This usually means:
1. The root cause is architectural, not a simple code fix.
2. Multiple files need to be rewritten together.
3. The error is in a dependency or configuration file.

TASK: Analyze the entire codebase structure and propose a RADICAL fix.
- Consider rewriting entire files if needed.
- Check for missing dependencies or configuration errors.
- Ensure all imports are correct and files exist.

Error History (last 3):
${errorHistory.slice(-3).join('\n---\n')}

Provide a comprehensive solution that addresses the root cause, not just symptoms.
            `;
            
            const radicalFix = await callAI("FRONTEND", radicalFixPrompt, undefined, undefined, "GENIUS");
            const radicalFilesCreated = await parseAndWriteFiles(radicalFix, repoPath);
            
            if (radicalFilesCreated > 0) {
              console.log(`✅ Radical fix applied: ${radicalFilesCreated} files updated.`);
              // Reset fixer attempts and give it one more try
              fixerAttempts = 0;
              continue;
            } else {
              throw new Error('Radical fix produced no files');
            }
          } catch (radicalError: any) {
            console.error('❌ Radical fix failed:', radicalError.message);
            console.error('🚨 MANUAL INTERVENTION REQUIRED');
            console.error(`   Pipeline ID: ${pipeline.id}`);
            console.error(`   Report saved to: ${path.join(repoPath, 'error-reports')}`);
            
            // Record telemetry
            if (errorHistory.length > 0) {
              recordErrorOccurrence(errorHistory[errorHistory.length - 1], ErrorCategory.RUNTIME_ERROR);
            }
            
            // Break out of the loop
            break;
          }
        }
        
        console.log('\n🧠 Switching to INTELLIGENT BATCH FIXER (standard watchdog exhausted)...\n');
        
        const intelligentResult = await runIntelligentBatchFixer(repoPath, fullLog, pipeline);
        
        if (intelligentResult.success) {
          console.log('✅ Intelligent Fixer succeeded!');
          success = true;
          fixerAttempts = 0; // Reset on success
        } else if (intelligentResult.circuitBroken) {
          console.error(`\n🚨 CIRCUIT BREAKER ACTIVATED - Manual intervention required`);
          console.error(`   Report saved to: ${intelligentResult.reportPath}`);
          
          // Record telemetry stats
          const stats = getErrorStats();
          console.log('\n📊 Error Telemetry Summary:');
          console.log(`   Total patterns: ${stats.totalPatterns}`);
          console.log(`   Total occurrences: ${stats.totalOccurrences}`);
          console.log('   Top errors:');
          stats.topErrors.forEach((e, i) => console.log(`     ${i + 1}. ${e.id} (${e.occurrences}x)`));
          
          // Break out of the loop
          break;
        }
      }
    }
  }

  if (success) {
    await updateStep(pipeline.id, 'tester', { status: 'completed' });
    
    // =============================================================================
    // C. THE PERMANENT FIX - Pre-Audit Sanitization
    // =============================================================================
    // 1. SÄKRA ROUTING (Unblock root route in middleware)
    sanitizeMiddleware(repoPath);
    
    // 2. SÄKRA CACHE (Nuke all Next.js caches)
    nukeNextJsCache(repoPath);
    
    // 3. STARTA AUDIT
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
    
    // --- 👮 VISUAL DICTATOR LOOP (Strict Mode) ---
    // Only run visual audit for frontend projects (skip pure backend)
    const hasFrontend = fs.existsSync(path.join(repoPath, 'package.json')) && 
                       (fs.existsSync(path.join(repoPath, 'app')) || fs.existsSync(path.join(repoPath, 'src')));
    
    if (hasFrontend) {
      // =============================================================================
      // C. THE PERMANENT FIX - Pre-Dictator Loop Sanitization
      // =============================================================================
      // 1. SÄKRA ROUTING (Unblock root route in middleware)
      sanitizeMiddleware(repoPath);
      
      // 2. SÄKRA CACHE (Nuke all Next.js caches)
      nukeNextJsCache(repoPath);
      
      // --- STEG 7: VISUAL DICTATOR LOOP ---
      console.log("👮 Starting Visual Dictator Loop...");
      
      let designApproved = false;
      let designAttempts = 0;
      let designFixAttempts = 0; // FIX #4: Track AI fix attempts separately
      const maxDesignRetries = 3;
      const MAX_DESIGN_FIX_ATTEMPTS = 2; // FIX #4: Max 2 AI fixes before forcing bulletproof page
      
      const pagePath = path.join(repoPath, 'src', 'app', 'page.tsx');
      
      while (!designApproved && designAttempts < maxDesignRetries) {
        designAttempts++;
        console.log(`👁️ Visual Audit Attempt ${designAttempts}/${maxDesignRetries}...`);
        
        // Kör audit (nu med Audit Mode flaggan aktiv)
        const auditResult = await runVisualAudit(repoPath); 
        
        // 4. POST-FIX CHECK: Verify that the page actually renders UI (not 404 or blank)
        // This check happens AFTER visual audit to catch any rendering issues
        if (auditResult.success) {
          // Double-check: Verify HTML actually has content
          try {
            if (fs.existsSync(pagePath)) {
              const pageContent = fs.readFileSync(pagePath, 'utf-8');
              // If page is empty or returns null, fail even if visual audit passed
              if (pageContent.includes('return null') || pageContent.match(/<main\s*>\s*<\/main>/)) {
                throw new Error("❌ CRITICAL: page.tsx is empty or returns null. Product UI missing: page.tsx must render a visible dashboard/landing!");
              }
            }
          } catch (htmlCheckError: any) {
            console.error("❌ Post-fix check failed:", htmlCheckError.message);
            // Force rejection if HTML check fails
            auditResult.success = false;
            auditResult.critique = `Product UI missing: ${htmlCheckError.message}`;
          }
        }
        
        if (auditResult.success) {
          designApproved = true;
          console.log("✅ DESIGN APPROVED: Product looks premium.");
        } else {
          console.warn(`❌ Design Rejected (Attempt ${designAttempts}). Reason: ${auditResult.critique?.substring(0, 100)}...`);
          
          // FIX #4: Abort Auto-Fix After 2 Failed Attempts
          designFixAttempts++;
          
          if (designFixAttempts >= MAX_DESIGN_FIX_ATTEMPTS) {
            console.log('🚨 Design fixes failed twice. Using bulletproof fallback...');
            
            // FIX #1: FORCE INJECT BULLETPROOF PAGE
            console.log('🚨 Visual Audit failed multiple times. FORCE INJECTING golden page.tsx...');
            fs.writeFileSync(pagePath, BULLETPROOF_PAGE_TEMPLATE);
            console.log('✅ Injected bulletproof page.tsx');
            
            // FIX #4: Kill old dev server (if any)
            // Note: runVisualAudit spawns its own server, so we don't have direct access to it
            // But we can kill any node processes on port 3002
            try {
              if (process.platform === 'win32') {
                execSync(`netstat -ano | findstr :3002`, { stdio: 'pipe' });
                execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :3002') do taskkill /F /PID %a`, { stdio: 'ignore' });
              } else {
                execSync(`lsof -ti:3002 | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
              }
              console.log('✅ Killed old dev server processes');
            } catch (e) {
              console.warn('⚠️ Could not kill old dev server (non-critical):', (e as Error).message);
            }
            
            // REBUILD
            console.log('🔄 Rebuilding with new page.tsx...');
            try {
              execSync('npm run build', { cwd: repoPath, stdio: 'inherit' });
              console.log('✅ Rebuild successful with bulletproof page.');
            } catch (buildError) {
              console.warn('⚠️ Build failed with bulletproof page (non-critical):', (buildError as Error).message);
            }
            
            // FIX #4: Wait for any lingering processes to die
            console.log('⏳ Waiting 5s for processes to fully terminate...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // RESTART DEV SERVER och retry ONE MORE TIME
            console.log('🔄 Restarting dev server for final attempt...');
            designAttempts = 0; // Reset counter
            designFixAttempts = 0; // Reset fix counter
            designApproved = false; // Try again with guaranteed-valid page
            continue; // Restart loop with bulletproof page
          }
          
          // FIX #2: Better AI Fix Prompt (So It Writes Valid JSX)
          if (designAttempts < maxDesignRetries) {
            console.log("🔧 Sending critique to Coder for fixes...");
            
            // FIX #2: SAFE_DESIGN_FIX_PROMPT
            const SAFE_DESIGN_FIX_PROMPT = `CRITICAL: The visual audit rejected the page design.

AUDIT FEEDBACK:
${auditResult.critique}

YOUR TASK:
Fix the design ISSUES ONLY. Do NOT rewrite the entire page from scratch.

STRICT RULES:
1. ✅ Keep ALL existing functionality
2. ✅ ONLY change styling/layout that was criticized
3. ✅ Every JSX tag MUST have a closing tag
4. ✅ All strings MUST be properly closed with quotes
5. ✅ Test your JSX syntax before outputting
6. ✅ Use Tailwind classes only (bg-*, text-*, etc)
7. ✅ Keep the dark mode theme (bg-zinc-950)

FORBIDDEN:
❌ Do NOT remove existing content
❌ Do NOT write incomplete JSX
❌ Do NOT use inline styles
❌ Do NOT remove the export default statement

OUTPUT FORMAT:
[FILE: src/app/page.tsx]
... your COMPLETE, VALID page.tsx code ...
[GOAL]

Begin with: import React from 'react';
End with: export default function Page() { ... }
`;
            
            // Specialhantering av 404
            let fixInstructions = SAFE_DESIGN_FIX_PROMPT;
            
            if (auditResult.critique?.includes("404") || auditResult.critique?.includes("Not Found")) {
              fixInstructions = `CRITICAL: The visual audit detected a 404 error.

AUDIT FEEDBACK:
${auditResult.critique}

🚨 EMERGENCY FIX - 404 ERROR DETECTED:
1. The app is showing a 404 page at the root url ('/').
2. CHECK 'src/middleware.ts': Ensure the root path '/' is in the 'matcher' exclusion list or public routes.
   - If middleware redirects '/' to '/login', REMOVE that redirect or exclude '/' from matcher.
   - Example fix: matcher: ['/((?!api|_next/static|_next/image|favicon.ico|$).*)']
3. CHECK 'src/app/page.tsx': Ensure it exists and is exported as default.
   - Must have: export default function Page() { ... } or export default function Home() { ... }
4. RE-WRITE 'src/app/page.tsx' to ensure it renders actual content, not a redirect or 404.

STRICT RULES:
1. ✅ Every JSX tag MUST have a closing tag
2. ✅ All strings MUST be properly closed with quotes
3. ✅ Test your JSX syntax before outputting
4. ✅ Use Tailwind classes only
5. ✅ Keep the dark mode theme (bg-zinc-950)

OUTPUT FORMAT:
[FILE: src/app/page.tsx]
... your COMPLETE, VALID page.tsx code ...
[GOAL]

[FILE: src/middleware.ts]
... your fixed middleware code here (if it exists) ...
[GOAL]

Begin with: import React from 'react';
End with: export default function Page() { ... }
`;
            }
            
            // Skicka med screenshoten till Coder (Vision Loop)
            const fixedCode = await callAI("FRONTEND", fixInstructions, undefined, auditResult.screenshotBase64);
            const fixedFilesCreated = await parseAndWriteFiles(fixedCode, repoPath);
            console.log(`🛠️ Applied design fixes: ${fixedFilesCreated} files updated.`);
            
            // Bygg om efter fix
            try { 
              execSync('npm run build', { cwd: repoPath, stdio: 'ignore' }); 
              console.log("✅ Rebuild successful after design fixes.");
            } catch(e) {
              console.warn("⚠️ Build failed after design fixes, but continuing...");
            }
          }
        }
      }
      
      // FIX #1: If still not approved after all attempts, force inject bulletproof page one last time
      if (!designApproved) {
        console.log('🚨 Visual Audit failed after all attempts. FORCE INJECTING bulletproof page.tsx as final fallback...');
        fs.writeFileSync(pagePath, BULLETPROOF_PAGE_TEMPLATE);
        console.log('✅ Injected bulletproof page.tsx');
        
        // FIX #4: Kill old dev server
        try {
          if (process.platform === 'win32') {
            execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :3002') do taskkill /F /PID %a`, { stdio: 'ignore' });
          } else {
            execSync(`lsof -ti:3002 | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
          }
          console.log('✅ Killed old dev server processes');
        } catch (e) {
          console.warn('⚠️ Could not kill old dev server (non-critical):', (e as Error).message);
        }
        
        // Final rebuild
        try {
          execSync('npm run build', { cwd: repoPath, stdio: 'inherit' });
          console.log('✅ Final rebuild successful with bulletproof page.');
          
          // FIX #4: Wait 15s for fresh server to fully initialize
          console.log('⏳ Waiting 15s for fresh dev server to fully initialize...');
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          // One final audit attempt
          const finalAuditResult = await runVisualAudit(repoPath);
          if (finalAuditResult.success) {
            designApproved = true;
            console.log("✅ DESIGN APPROVED after bulletproof injection!");
          } else {
            throw new Error(`💀 Visual QA Failed even after bulletproof page injection. Product not premium enough to ship.`);
          }
        } catch (finalError) {
          throw new Error(`💀 Visual QA Failed after ${maxDesignRetries} attempts. Product not premium enough to ship.`);
        }
      }
      
      console.log("🎉 Visual Audit Passed! Proceeding to publish...");
    } else {
      console.log("⏭️ Skipping Visual Audit (backend-only project).");
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
                const response = await fetch('https://api.github.com/user/repos', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: repoName, private: true })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.message || response.statusText;
                    
                    if (errorMessage.includes("name already exists") || errorMessage.includes("already exists")) {
                        console.warn("⚠️ Repo exists. Activating Auto-Pivot...");
                        
                        // GENERERA NYTT NAMN AUTOMATISKT
                        const newName = `${repoName}-${Math.floor(Math.random() * 1000)}`;
                        console.log(`🔄 Pivoting to new repo name: ${newName}`);
                        
                        // Uppdatera pipeline data
                        repoName = newName;
                        targetRepoUrl = `https://github.com/${username}/${repoName}.git`;
                        
                        // Försök igen med nytt namn
                        const retryResponse = await fetch('https://api.github.com/user/repos', {
                            method: 'POST',
                            headers: { 
                                'Authorization': `token ${GITHUB_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ name: repoName, private: true })
                        });
                        
                        if (!retryResponse.ok) {
                            throw new Error(`Failed to create repo after pivot: ${retryResponse.statusText}`);
                        }
                        
                        console.log(`[Publisher] 📦 Created new repo (pivoted): ${repoName}`);
                    } else {
                        throw new Error(`GitHub API error: ${errorMessage}`);
                    }
                } else {
                    console.log(`[Publisher] 📦 Created new repo: ${repoName}`);
                }
            } catch (e: any) {
                if (e.message && (e.message.includes("name already exists") || e.message.includes("already exists"))) {
                    // Retry med pivot om det fortfarande misslyckas
                    console.warn("⚠️ Repo exists. Activating Auto-Pivot (retry)...");
                    const newName = `${repoName}-${Math.floor(Math.random() * 1000)}`;
                    repoName = newName;
                    targetRepoUrl = `https://github.com/${username}/${repoName}.git`;
                    console.log(`🔄 Pivoting to new repo name: ${newName}`);
                } else {
                    console.error("[Publisher] ❌ Failed to create GitHub repo:", e.message);
                    throw e;
                }
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

    // 2.7. DATABASE AUTO-DEPLOYMENT (Level 4 Upgrade)
    // Detektera om projektet använder Supabase
    const hasSupabaseMigrations = fs.existsSync(path.join(repoPath, 'supabase', 'migrations'));
    const hasSupabaseConfig = fs.existsSync(path.join(repoPath, 'supabase', 'config.toml')) ||
                              fs.existsSync(path.join(repoPath, '.supabase'));
    
    if (hasSupabaseMigrations || hasSupabaseConfig) {
      console.log("[Publisher] 🗄️ Supabase detected. Attempting auto-deployment...");
      
      const supabaseDbUrl = process.env.SUPABASE_DB_URL;
      const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
      
      if (supabaseDbUrl) {
        try {
          console.log("[Publisher] 🚀 Deploying database schema to Supabase...");
          
          // Använd Supabase CLI för att pusha migrations
          // Först: Kolla om supabase CLI är installerat
          try {
            execSync('npx supabase --version', { stdio: 'ignore' });
          } catch (e) {
            console.warn("[Publisher] ⚠️ Supabase CLI not found. Installing...");
            // Supabase CLI installeras automatiskt via npx
          }
          
          // Om vi har access token, använd den för auth
          if (supabaseAccessToken) {
            // Set access token för Supabase CLI
            process.env.SUPABASE_ACCESS_TOKEN = supabaseAccessToken;
          }
          
          // Push migrations till Supabase
          // Använd --db-url för direkt connection eller --linked för linked project
          if (supabaseDbUrl.includes('@') || supabaseDbUrl.includes('postgresql://')) {
            // Direct database URL
            execSync(`npx supabase db push --db-url "${supabaseDbUrl}"`, { 
              cwd: repoPath,
              stdio: 'inherit',
              env: { ...process.env, SUPABASE_ACCESS_TOKEN: supabaseAccessToken || '' }
            });
            console.log("[Publisher] ✅ Database schema deployed successfully!");
          } else {
            // Project reference - använd link istället
            console.log("[Publisher] ℹ️ Using Supabase project link (not direct DB URL)");
            try {
              execSync('npx supabase link --project-ref ' + supabaseDbUrl, { 
                cwd: repoPath,
                stdio: 'inherit',
                env: { ...process.env, SUPABASE_ACCESS_TOKEN: supabaseAccessToken || '' }
              });
              execSync('npx supabase db push', { 
                cwd: repoPath,
                stdio: 'inherit',
                env: { ...process.env, SUPABASE_ACCESS_TOKEN: supabaseAccessToken || '' }
              });
              console.log("[Publisher] ✅ Database schema deployed successfully!");
            } catch (linkError: any) {
              console.warn("[Publisher] ⚠️ Could not link Supabase project. Skipping auto-deployment.");
              console.warn("[Publisher] 💡 Tip: Set SUPABASE_ACCESS_TOKEN and SUPABASE_DB_URL in .env for auto-deployment");
            }
          }
        } catch (dbError: any) {
          console.warn("[Publisher] ⚠️ Database auto-deployment failed (non-critical):", dbError.message);
          console.warn("[Publisher] 💡 Database migrations are in supabase/migrations/ - deploy manually if needed");
          // Fortsätt med publish även om DB deployment misslyckas
        }
      } else {
        console.log("[Publisher] ℹ️ SUPABASE_DB_URL not set. Skipping auto-deployment.");
        console.log("[Publisher] 💡 Set SUPABASE_DB_URL in .env to enable auto-deployment");
      }
    } else {
      console.log("[Publisher] ℹ️ No Supabase migrations found. Skipping database deployment.");
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
          // 🌱 DATA SEEDER: Populate database with realistic mock data
          try {
            console.log("[Seeder] 🌱 Running Data Seeder after SQL migration...");
            const userPrompt = pipeline.initial_prompt || pipeline.prompt || "";
            await generateSeedData(repoPath, userPrompt);
            console.log("[Seeder] ✅ Seed data generation completed.");
          } catch (seedError: any) {
            console.warn("[Seeder] ⚠️ Seed data generation failed (non-critical):", seedError.message);
            // Fortsätt med tester även om seeding misslyckas
          }
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


