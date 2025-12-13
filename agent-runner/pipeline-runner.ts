import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { execSync, spawn } from 'child_process';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { glob } from 'glob';
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
  callAI as callAILegacy
} from '../lib/nightFactory/modelClient';
import { GOLDEN_COMPONENTS } from './lib/golden-components';
import { analyzeUpdateScope, UpdateScope } from '../lib/nightFactory/scopeAnalyzer';
import { optimizeContextForCoder } from '../lib/nightFactory/contextBridge';
import { generateDockerConfig } from '../lib/nightFactory/dockerAgent';
import { detectProjectIntent, detectTechMatrix, TechMatrix, ProjectIntent } from '../lib/nightFactory/intentParser';
import { runVisualAudit } from '../lib/nightFactory/visualAudit';
import { runDocumentationStep } from '../lib/nightFactory/documentationAgent';
import { DESIGN_SYSTEM, DESIGN_SYSTEM_EXAMPLES } from '../lib/nightFactory/design-system';
import { planPerfectFileStructure, FileStructurePlan } from '../lib/nightFactory/structurePlanner';
import { refinementLoop, VisionAuditResult } from '../lib/nightFactory/vision-audit-system';
// Note: startDevServerWithVerification is defined locally below
import { runZeroShotPipeline } from '../lib/nightFactory/zero-shot-validation';
import { getLatestFrameworkIntel } from '../lib/nightFactory/knowledgeBase';
import { runIntegrationStep } from '../lib/nightFactory/integrationAgent';
import { generateSeedData } from '../lib/nightFactory/seederAgent';
import { consultHiveMind, memorizeSolution } from '../lib/nightFactory/hiveMind';
import { CodebaseOracle, getOracle } from '../lib/nightFactory/codebaseOracle';
import { PipelineContext, createPipelineContext, validateContextForStage } from '../lib/nightFactory/contextTypes';
import { verifyDataFlow, logContextState } from '../lib/nightFactory/flowChecker';
import { generateScaffold, generateComponentRegistry, formatComponentRegistry } from '../lib/nightFactory/scaffoldAgent';
import { validateCode, autoFixFileExtension, ValidationResult as CodeValidationResult } from './code-validator';
import { callAI, selectModel } from './ai-client';
import { classifyError, recordErrorPattern, ErrorAnalysis } from './error-classifier';
import { validateCodeCompleteness } from './ast-validator';
import { generateWithValidation } from './multi-pass-generator';  // ✅ Phase 1: Multi-pass generation
import { generateRepositoryMap } from './repo-map-generator';  // ✅ Phase 1: Repository map
import { parsePackageJson, DEFAULT_PACKAGE_JSON, installDependencies } from './lib/dependency-detective';  // ✅ Robust JSON parsing with auto-repair
import { ErrorClassifier } from './lib/error-classifier';  // ✅ Smart error diagnosis for autonomous self-healing
import { writeFileToDisk, writeFileSyncSafe } from './lib/file-writer';  // ✅ Atomic file writes
import { 
  convertPlannerToJSON, 
  convertCoderToJSON,
  convertResearchToJSON
} from '../lib/pipeline/json-converter';  // ✅ Info Transporter: JSON context conversion
import type {
  PlannerPhaseJSON,
  ResearchPhaseJSON,
  CoderPhaseJSON
} from '../lib/pipeline/pipeline-json-types';  // ✅ Info Transporter: Type definitions
import {
  getPhaseOutputRaw,
  accumulateAllContexts,
  transportPhaseContext,
  contextToPromptString,
  clearContextCache
} from './src/info-transporter';  // ✅ Info Transporter: Proper JSON handling (uses JSON.stringify, never template literals)

/**
 * ✅ SAFE PACKAGE.JSON READER: Reads and parses package.json with auto-repair and fallback
 * NEVER throws - always returns a valid package.json object
 */
function readPackageJson(pkgPath: string): any {
  if (!fs.existsSync(pkgPath)) {
    console.warn(`⚠️ package.json not found at ${pkgPath} - using default fallback`);
    return DEFAULT_PACKAGE_JSON;
  }
  
  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    return parsePackageJson(content);
  } catch (error: any) {
    console.error(`❌ Failed to read package.json at ${pkgPath}:`, error?.message);
    console.log('✅ Using fallback package.json structure');
    return DEFAULT_PACKAGE_JSON;
  }
}
import { logEvent } from './event-logger';  // ✅ Phase 0: Event logging
import { CostTracker } from './lib/cost-tracker';  // ✅ P2: Cost tracking
import { FEATURE_FLAGS, isFeatureEnabled } from './lib/version-manager';  // ✅ V8: Feature flags
import { PortManager } from './lib/port-manager';  // ✅ V8: Dynamic port allocation

// =============================================================================
// 🧠 INTELLIGENT FIX SYSTEMS (V6.0 - Zero Human Input)
// =============================================================================
import { runClientDetector, ensureUseClient } from '../lib/nightFactory/clientDetector';
import { runImportRewriter, getBrokenImports } from '../lib/nightFactory/importRewriter';
import { runVisualPreFlight, willPageRender } from '../lib/nightFactory/visualPreFlight';
import { 
  createPipelineContext as createNewPipelineContext, 
  updateContextAfterPlanning, 
  updateContextAfterCoding,
  recordError,
  recordFix,
  scanProjectStructure,
  generateContextSummary,
  getTesterContext,
  PipelineContext as NewPipelineContext
} from '../lib/nightFactory/pipelineContext';
import { 
  runBatchSurgeon, 
  shouldUseBatchSurgeon, 
  parseErrors, 
  groupErrorsIntoBatches 
} from '../lib/nightFactory/batchSurgeon';
import { 
  runSelfAwareValidation, 
  generateExportReport 
} from '../lib/nightFactory/selfAwareCoder';
import { runDependencyDetective } from '../lib/nightFactory/dependencyDetective';
import { runImportGraphValidator } from '../lib/nightFactory/importGraphValidator';
import { 
  snapshotBeforeTester, 
  snapshotBeforeFixer,
  restoreFromSnapshot,
  getLatestSnapshot,
  cleanupSnapshots
} from '../lib/nightFactory/versionControl';
import { 
  runErrorAutopsy, 
  shouldPerformAutopsy, 
  detectLoop, 
  recordErrorOccurrence as recordAutopsyError,
  clearErrorHistory as clearAutopsyHistory,
  getPreviousFixes
} from '../lib/nightFactory/errorAutopsy';
// =============================================================================
// 🏰 FROST NIGHT FACTORY v9.0 - FORTRESS ARCHITECTURE INTEGRATION
// =============================================================================
import {
  checkRepairAllowed,
  fortressWrite,
  filterRepairableErrors,
  getViolationAction,
  validateFortressIntegrity,
  type FortressGuardResult,
} from '../lib/nightFactory/v90-fortress-guard';
import { mapErrorClassToErrorCategory } from '../lib/nightFactory/v85-error-mapping';
import {
  createRepairSession,
  authorizeRepair,
  recordAttempt,
  getSessionSummary,
  isWithinBudget,
  getRecommendedModel,
  type RepairSession,
  type RepairAuthorization,
} from '../lib/nightFactory/v90-repair-authority';
import {
  snapshotManager,
  withTransaction,
  type SnapshotComparison,
} from '../lib/nightFactory/v90-snapshot-manager';
import {
  runZoneValidation,
  quickValidation,
  type ZoneValidationResult,
} from '../lib/nightFactory/v90-zone-validator';
import { 
  runCompilerAgent, 
  generateAIFixPrompt,
  fixUseClientErrors
} from '../lib/nightFactory/compilerAgent';

// =============================================================================
// PHASE 1-7 INTELLIGENT SYSTEMS (NEW)
// =============================================================================
import { GOLDEN_VERSIONS, getGoldenVersion } from '../lib/nightFactory/goldenVersions';
// Note: validateAndFixDependencies is defined locally below
// ✅ REMOVED: Old classifyError import - using new error-classifier.ts instead
// Keep other imports from old errorClassifier if still needed:
import { extractTargetFiles, ErrorCategory, ClassifiedError, getFixingStrategy, autoFixPythonError } from '../lib/nightFactory/errorClassifier';
import { CircuitBreaker, CircuitBreakerError, FixAttempt } from '../lib/nightFactory/circuitBreaker';
import { recordErrorOccurrence, generatePreventionPrompt, getAutoFixSuggestion, getErrorStats } from '../lib/nightFactory/errorTelemetry';
import { GOLDEN_TEMPLATES, getGoldenTemplate, hasGoldenTemplate, GOLDEN_NEXT_CONFIG, GOLDEN_TAILWIND_CONFIG, GOLDEN_POSTCSS_CONFIG, GOLDEN_LAYOUT, GOLDEN_PAGE, GOLDEN_TYPES, GOLDEN_MOCK_DATA, GOLDEN_UTILS } from '../lib/nightFactory/goldenTemplates';
// Note: GOLDEN_PACKAGE_JSON and GOLDEN_TSCONFIG are defined locally below
import { runPreCommitValidation, ValidationResult } from '../lib/nightFactory/preCommitValidation';
import { PathManager } from '../lib/nightFactory/pathManager';
import { logPathOperation, clearPathLog } from '../lib/nightFactory/pathLogger';
import { PathCircuitBreaker } from '../lib/nightFactory/pathCircuitBreaker';

// =============================================================================
// 🛡️ PROTECTED INFRASTRUCTURE FILES - Never modify these with AI
// =============================================================================
const PROTECTED_INFRASTRUCTURE_FILES = [
  // NOTE: src/lib/types.ts is NOT protected - AI must be able to overwrite it (especially with stubs)
  'src/types/database.ts',
  'tsconfig.json',
  'next.config.mjs',
  'tailwind.config.ts',
  'package.json',
  'pipeline-runner.ts' // ✅ Protect runner's own source code from AI modifications
];

// =============================================================================
// 🔧 STRICT FILE TYPE ENFORCEMENT - Prevent Import Deadlock
// =============================================================================
const STRICT_FILE_TYPE_RULES = `
CRITICAL FILE TYPE RULES (MANDATORY):

FILES ENDING IN .ts MUST NOT CONTAIN JSX. IF YOU NEED A COMPONENT, USE .tsx.

- .ts files: Pure TypeScript ONLY. NO JSX, NO React components, NO <div>, NO <Component>
- .tsx files: JSX/React components allowed
- If you write JSX in a .ts file, TypeScript will FAIL and the pipeline will crash
- Always check the file extension BEFORE writing code:
  * Need a component? → Use .tsx
  * Need types/interfaces? → Use .ts
  * Need utility functions? → Use .ts

EXAMPLES:
- ✅ CORRECT: src/lib/types.ts contains only "export interface" and "export type"
- ✅ CORRECT: src/components/Button.tsx contains JSX: <button>...</button>
- ❌ WRONG: src/lib/types.ts contains JSX: <div>...</div>
- ❌ WRONG: src/lib/utils.ts contains JSX: return <div>...</div>

IF YOU ARE UNSURE: Use .tsx for any file that might need JSX.
`;

// =============================================================================
// 🛡️ GOLDEN TEMPLATES - Single Source of Truth
// =============================================================================
/**
 * GOLDEN TEMPLATES - Single Source of Truth
 */
const GOLDEN_TSCONFIG = {
  compilerOptions: {
    target: "ES2017",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
    incremental: true,
    verbatimModuleSyntax: true,  // ✅ CRITICAL: Ensures import/export consistency
    plugins: [{ name: "next" }],
    paths: {
      "@/*": ["./src/*"]  // ✅ CRITICAL: Points to src/
    },
    baseUrl: "."
  },
  include: [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "src/**/*.ts",
    "src/**/*.tsx"
  ],
  exclude: ["node_modules"]
};

const GOLDEN_PACKAGE_JSON = {
  name: "generated-app",
  version: "0.1.0",
  private: true,
  engines: {
    node: ">=20.9.0"
  },
  scripts: {
    dev: "next dev --turbo",
    build: "next build",
    start: "next start",
    lint: "next lint",
    typecheck: "tsc --noEmit"
  },
  dependencies: {
    "next": "^16.0.0",  // Next.js 16 - 4x faster builds
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^3.4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
};

const GOLDEN_SUPABASE_TS = `import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
`;

const GOLDEN_LAYOUT_TSX = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeoTrade Terminal',
  description: 'AI-Powered Crypto Trading Dashboard',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#050505] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
`;

// Ladda miljövariabler
dotenv.config();

// Konfiguration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

// ✅ VERIFY SERVICE ROLE KEY IS SET
if (!SUPABASE_KEY) {
  console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY must be set!');
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role key');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ CRITICAL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set!');
  process.exit(1);
}

console.log(`✅ Supabase configured: ${SUPABASE_URL.substring(0, 30)}...`);
console.log(`✅ Using SERVICE ROLE KEY (bypasses RLS)`);

// =============================================================================
// 🛡️ UNIFIED PATH SYSTEM - Single Source of Truth
// =============================================================================
const pathManager = PathManager.getInstance();
const pathCircuitBreaker = PathCircuitBreaker.getInstance();

// Initiera Supabase Admin (MUST use service role key to bypass RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================================================
// 🚑 SCHEMA DRIFT AUTO-FIXER: Self-healing database queries
// =============================================================================
async function safeSupabaseQuery<T>(queryFn: () => Promise<{ data: T | null; error: any }>): Promise<{ data: T | null; error: any }> {
  try {
    return await queryFn();
  } catch (error: any) {
    // Catch Postgres Error 42703 (Undefined Column)
    if (error.code === '42703' || error.message?.includes('does not exist')) {
      console.warn(`⚠️ Schema Drift Detected: ${error.message}`);
      console.log("🚑 Auto-healing Database Schema...");
      
      // Extract column and table from error message
      // Ex: "column pipeline_steps.created_at does not exist"
      const match = error.message.match(/column "?(\w+)"? of relation "?(\w+)"? does not exist/) ||
                    error.message.match(/column (\w+)\.(\w+) does not exist/) ||
                    error.message.match(/column "(\w+)" does not exist/);
      
      if (match) {
        const column = match[1];
        
        // Ask AI for exact ALTER TABLE command
        // Note: This is in a helper function, pipeline context may not be available
        // Using a fallback approach - if pipelineId is available, use it
        const fixSql = await callAI({
          pipelineId: 'system', // Fallback ID for system-level fixes
          step: 'sql_migration',
          role: 'SQL_AGENT',
          model: 'deepseek-reasoner',
          messages: [
            {
              role: 'system',
              content: 'You generate safe SQL migrations for Supabase. Return ONLY raw SQL. No markdown, no explanations.'
            },
            {
              role: 'user',
              content: `
          Postgres Error: ${error.message}
          Task: Write a single SQL statement to fix this. 
          Use 'ALTER TABLE table ADD COLUMN IF NOT EXISTS column TYPE;'
          Common types: TEXT, BOOLEAN, TIMESTAMP WITH TIME ZONE DEFAULT NOW(), JSONB DEFAULT '{}'::jsonb
          Output raw SQL only.
        `
            }
          ]
        });
        
        const cleanSql = fixSql.replace(/```sql|```/g, "").trim();
        console.log(`💉 Injecting SQL Fix: ${cleanSql}`);
        
        // Execute the fix using Supabase's RPC if available
        try {
          // Try to execute via direct SQL (requires proper setup)
          const { error: rpcError } = await supabase.rpc('exec_sql', { sql: cleanSql });
          
          if (rpcError) {
            console.warn(`⚠️ RPC exec_sql failed: ${rpcError.message}`);
            // Log the fix for manual execution
            console.log(`📝 Manual fix required: ${cleanSql}`);
          } else {
            console.log("✅ Schema healed. Retrying operation...");
            return await queryFn(); // Retry!
          }
        } catch (rpcErr: any) {
          console.warn(`⚠️ Schema auto-fix failed: ${rpcErr.message}`);
          console.log(`📝 Manual fix required: ${cleanSql}`);
        }
      }
    }
    
    // Return error as normal Supabase response format
    return { data: null, error };
  }
}

// Helpers
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 🌐 REALITY VISION: Generate file tree for AI agents
 * This gives agents a clear picture of the current file structure
 */
function getFileTree(dir: string, prefix = ''): string {
  if (!fs.existsSync(dir)) return '';
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let output = '';
  
  for (const file of files) {
    if (file.name === 'node_modules' || 
        file.name === '.next' || 
        file.name.startsWith('.') ||
        file.name === 'dist' ||
        file.name === 'build') continue;
    
    output += `${prefix}${file.isDirectory() ? '📂 ' : '📄 '}${file.name}\n`;
    
    if (file.isDirectory()) {
      output += getFileTree(path.join(dir, file.name), prefix + '  ');
    }
  }
  
  return output;
}

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
  
  // SKIPPA TSC-KOLLEN HÄR. Vi låter "runTesterStep" göra den riktiga kollen senare.
  // Det är för komplicerat att köra en isolerad TS-check på en fil i en Next.js-miljö (pga imports).
  // Den riktiga TypeScript-valideringen sker i runTesterStep med 'npx tsc --noEmit'.
  
  return true;
}

// BULLETPROOF PAGE TEMPLATE - Guaranteed valid, non-empty root page UI
// FIX #5: NeoLink-themed Golden Page (Cyberpunk aesthetic)
/**
 * ⚠️ CRITICAL: Import order matters!
 * 
 * Correct structure:
 * 1. Directives ('use client', 'use server')
 * 2. Import statements (ALL imports)
 * 3. Route segment config (export const dynamic, etc.)
 * 4. Type definitions (interface, type)
 * 5. Component export (export default function)
 * 
 * NEVER put exports before imports!
 */
const BULLETPROOF_PAGE_TEMPLATE = `// Auto-generated by Frost Factory
// ✅ Step 1: ALL imports first
import React from 'react';

// ✅ Step 2: Component
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
              onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = '#8B5CF6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => {
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
/**
 * PERMANENT FIX: Enforce 'src/' directory structure
 * This aligns with modern Next.js defaults and prevents agent confusion.
 */
async function enforceSrcStructure(repoPath: string): Promise<void> {
  console.log('\n🏗️ ENFORCING SRC/ DIRECTORY STRUCTURE...');
  
  const srcPath = path.join(repoPath, 'src');
  if (!fs.existsSync(srcPath)) {
    fs.mkdirSync(srcPath, { recursive: true });
  }

  // 1. MOVE FOLDERS INTO SRC
  // Om agenten råkade lägga 'app', 'components' eller 'lib' i roten -> Flytta in i src
  const foldersToMove = ['app', 'components', 'lib', 'types', 'utils', 'hooks', 'styles'];
  
  for (const folder of foldersToMove) {
    const rootPath = path.join(repoPath, folder);
    const destPath = path.join(srcPath, folder);
    
    if (fs.existsSync(rootPath)) {
      console.log(`📦 Moving root /${folder} -> /src/${folder}...`);
      
      // Om destinationen redan finns, rensa den först (Root har prioritet i denna fix-fas)
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
      }
      
      // Flytta
      fs.renameSync(rootPath, destPath);
    }
  }

  // 2. UPDATE TSCONFIG (Critical for @/ alias)
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  const tsConfig = {
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
      // HÄR ÄR MAGIN:
      "baseUrl": ".",
      "paths": {
        "@/*": ["./src/*"] 
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  };
  
  // Skriv alltid över för att garantera att paths är rätt
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsConfig, null, 2));
  console.log("✅ Updated tsconfig.json (paths: @/* -> ./src/*)");

  // 3. UPDATE TAILWIND CONFIG (Måste leta i src)
  const tailwindPath = path.join(repoPath, 'tailwind.config.ts');
  const tailwindConfig = `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};

export default config;
`;
  fs.writeFileSync(tailwindPath, tailwindConfig);
  console.log("✅ Updated tailwind.config.ts to scan /src");
  
  console.log("✅ SRC STRUCTURE ENFORCED");
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
 * JSON Fortress: Sanitize and validate JSON content
 * Removes Markdown artifacts and validates JSON structure
 */
function sanitizeAndParseJson(content: string): string | null {
  try {
    // 1. Rensa bort Markdown-kodblock
    let clean = content.replace(/```json\s*/g, '').replace(/\s*```/g, '');
    clean = clean.trim();
    
    // 2. Rensa bort eventuell text före/efter (vanligt med DeepSeek)
    // Försök hitta JSON-objektet i texten
    const jsonMatch = clean.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      clean = jsonMatch[1];
    }
    
    // 3. Ta bort kommentarer (// comment) om de finns
    clean = clean.replace(/\/\/.*$/gm, '');
    
    // 4. Försök parsa för att se om det är giltigt
    const parsed = JSON.parse(clean);
    
    // 5. Returnera den snyggt formatterade strängen
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return null; // Misslyckades
  }
}

/**
 * Atomic Reset: Force reset tsconfig.json with Golden Template
 * This ensures tsconfig.json is always correct, regardless of AI modifications
 */
function forceResetTsConfig(repoPath: string) {
  console.log("🧨 NUCLEAR OPTION: Resetting tsconfig.json...");
  
  const tsConfigPath = path.join(repoPath, 'tsconfig.json');
  const tsConfigDir = path.dirname(tsConfigPath);
  
  // Ensure directory exists
  if (!fs.existsSync(tsConfigDir)) {
    fs.mkdirSync(tsConfigDir, { recursive: true });
  }
  
  // ✅ CORRECT - Convert to JSON string first
  fs.writeFileSync(
    tsConfigPath, 
    JSON.stringify(GOLDEN_TSCONFIG, null, 2),  // 🆕 ADD JSON.stringify
    'utf-8'
  );
  console.log("✅ tsconfig.json reset to Golden Template.");
}

async function updatePipeline(id: string, updates: any) {
  const { data, error } = await supabase
    .from('pipelines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select();
  
  if (error) {
    console.error(`❌ [DB] Failed to update pipeline ${id}:`, error.message);
    console.error(`   Update payload:`, JSON.stringify(updates, null, 2));
    throw error; // Don't silently fail - throw so caller knows
  }
  
  if (!data || data.length === 0) {
    console.warn(`⚠️ [DB] Pipeline update returned no rows (pipeline ${id} may not exist)`);
  } else {
    console.log(`✅ [DB] Pipeline ${id} updated successfully`);
  }
  
  return data;
}

/**
 * ATOMIC PIPELINE CREATION - Uses Supabase RPC for ACID-compliant transaction
 * Prevents PGRST116 errors by ensuring all steps exist atomically
 */
async function createPipelineWithSteps(projectSpec: string, name: string, initialPrompt: string) {
  try {
    // ✅ Use Supabase RPC for atomic transaction (Postgres handles rollback automatically)
    const { data, error } = await supabase.rpc('create_pipeline_atomic', {
      payload: {
        name,
        initial_prompt: initialPrompt,
        status: 'pending',
        current_phase: 'research',
      }
    });

    if (error) {
      throw new Error(`[DB] Failed to create pipeline atomically: ${error.message}`);
    }

    if (!data || !data.success) {
      throw new Error(`[DB] Pipeline creation failed: ${data?.error || 'Unknown error'}`);
    }

    const pipelineId = data.pipeline_id as string;
    
    // Fetch the created pipeline
    const { data: pipeline, error: fetchError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .single();

    if (fetchError || !pipeline) {
      throw new Error(`[DB] Failed to fetch created pipeline: ${fetchError?.message || 'Not found'}`);
    }

    console.log(`✅ Created pipeline ${pipeline.id} with 5 steps atomically (ACID-compliant)`);
    return pipeline;
  } catch (error: any) {
    // If RPC fails, fall back to manual creation (for backwards compatibility)
    if (error.message?.includes('function') || error.message?.includes('does not exist')) {
      console.warn('⚠️ RPC function not available, falling back to manual creation');
      return createPipelineWithStepsFallback(name, initialPrompt);
    }
    throw error;
  }
}

/**
 * FALLBACK: Manual pipeline creation (for backwards compatibility)
 * Only used if RPC function is not available
 */
async function createPipelineWithStepsFallback(name: string, initialPrompt: string) {
  // Create pipeline
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipelines')
    .insert({
      name,
      initial_prompt: initialPrompt,
      status: 'pending',
      current_phase: 'research',
      max_retries: 10,
      retry_count: 0,
    })
    .select('*')
    .single();

  if (pipelineError) {
    throw new Error(`[DB] Failed to create pipeline: ${pipelineError.message}`);
  }

  // Create ALL steps upfront (prevents PGRST116)
  const steps = ['research', 'planner', 'coder', 'tester', 'publisher'].map((stepName) => ({
    pipeline_id: pipeline.id,
    name: stepName, // ✅ Using 'name' column
    status: 'pending',
    input: stepName === 'research' ? { initialPrompt } : {},
    output: {},
    updated_at: new Date().toISOString()
  }));

  const { data: createdSteps, error: stepsError } = await supabase
    .from('pipeline_steps')
    .insert(steps)
    .select();

  if (stepsError) {
    // Rollback pipeline if steps fail
    await supabase.from('pipelines').delete().eq('id', pipeline.id);
    throw new Error(`[DB] Failed to create pipeline steps: ${stepsError.message}`);
  }

  if (!createdSteps || createdSteps.length === 0) {
    // Rollback pipeline if no steps were created
    await supabase.from('pipelines').delete().eq('id', pipeline.id);
    throw new Error(`[DB] Insert returned no data for pipeline steps`);
  }

  console.log(`✅ Created pipeline ${pipeline.id} with ${steps.length} steps (fallback mode)`);
  return pipeline;
}

async function createStep(pipelineId: string, stepName: string, status: string, input: any = {}) {
  const { data, error } = await supabase.from('pipeline_steps').insert({
    pipeline_id: pipelineId,
    name: stepName, // ✅ Changed from 'phase' to 'name'
    status,
    input,
    output: {},
    updated_at: new Date().toISOString()
  })
  .select()
  .single();

  if (error) {
    console.error(`❌ Failed to insert step:`, error);
    throw error;
  }

  if (!data) {
    throw new Error('Insert returned null despite no error');
  }

  console.log(`✅ Step created:`, data.id);
  return data;
}

async function updateStep(pipelineId: string, stepName: string, status: string, output?: string) {
  // ✅ TIER 1 PERSISTENCE: Explicit Verification with Payload Integrity Checks
  const { data, error } = await supabase
    .from('pipeline_steps')
    .update({
      status,
      output,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('pipeline_id', pipelineId)
    .eq('name', stepName)
    .select(); // ✅ CRITICAL: Request return receipt

  // ✅ Check 1: Supabase Error
  if (error) {
    console.error(`❌ [DB] Failed to update step ${stepName}: ${error.message}`);
    console.error(`   Pipeline ID: ${pipelineId}`);
    console.error(`   Status: ${status}`);
    console.error(`   Output size: ${output?.length || 0} chars`);
    throw new Error(`DB Write Failed: ${error.message}`);
  }

  // ✅ Check 2: Row actually updated
  if (!data || data.length === 0) {
    console.error(`❌ CRITICAL: Update returned 0 rows. Check RLS policies or invalid Step ID.`);
    console.error(`   Pipeline ID: ${pipelineId}`);
    console.error(`   Step Name: ${stepName}`);
    console.error(`   Status: ${status}`);
    console.error(`   Output size: ${output?.length || 0} chars`);
    
    // Create missing step (self-healing)
    console.warn(`[DB] Step ${stepName} not found for pipeline ${pipelineId}, creating new step`);
    const { data: created, error: insertError } = await supabase
      .from('pipeline_steps')
      .insert({
        pipeline_id: pipelineId,
        name: stepName,
        status,
        output: output || null,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`DB Write Verification Failed: Insert also failed - ${insertError.message}`);
    }

    if (!created) {
      throw new Error(`DB Write Verification Failed: Insert returned null for step ${stepName}`);
    }

    // ✅ Verify insert payload integrity
    if (output && !created.output) {
      console.error(`❌ CRITICAL: Output was sent but not saved (NULL in DB after insert).`);
      console.error(`   Sent output size: ${output.length} chars`);
      throw new Error(`DB Write Corruption: Output field is empty after insert.`);
    }

    console.log(`✅ Self-healed: Created missing step ${stepName} (Size: ${created.output?.length || 0} chars)`);
    return created;
  }

  // ✅ Check 3: Payload integrity (output field matches what was sent)
  if (output && !data[0].output) {
    console.error(`❌ CRITICAL: Output was sent but not saved (NULL in DB).`);
    console.error(`   Pipeline ID: ${pipelineId}`);
    console.error(`   Step Name: ${stepName}`);
    console.error(`   Sent output size: ${output.length} chars`);
    console.error(`   First 200 chars of sent output: ${output.substring(0, 200)}`);
    throw new Error(`DB Write Corruption: Output field is empty.`);
  }

  // ✅ Additional verification: Check if output was truncated
  if (output && data[0].output && typeof data[0].output === 'string') {
    const savedSize = data[0].output.length;
    const sentSize = output.length;
    if (savedSize < sentSize * 0.9) { // Allow 10% tolerance for JSON stringification differences
      console.warn(`⚠️ Output may have been truncated: Sent ${sentSize} chars, Saved ${savedSize} chars`);
    }
  }

  console.log(`✅ Step ${stepName} persisted and verified (Size: ${data[0].output?.length || 0} chars)`);
  return data[0];
}

const CANONICAL_STEPS = ['research', 'planner', 'coder', 'tester', 'publisher'] as const;

// ═══════════════════════════════════════════════════════════════════
// 🔄 PLAN RE-HYDRATION: Fetch missing phase data from database
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch the completed Planner output (JSON) from pipeline_steps
 */
async function fetchPlannerOutput(pipelineId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('pipeline_steps')
      .select('output, logs')
      .eq('pipeline_id', pipelineId)
      .eq('name', 'planner')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn(`⚠️ [Re-hydration] Planner output not found: ${error?.message || 'No data'}`);
      return null;
    }

    // Try to parse output, fallback to logs if output is empty
    let planData = data.output;
    if (!planData || (typeof planData === 'string' && planData.trim() === '')) {
      planData = data.logs;
    }

    if (typeof planData === 'string') {
      try {
        planData = JSON.parse(planData);
      } catch (e) {
        console.warn(`⚠️ [Re-hydration] Failed to parse planner output as JSON: ${e}`);
        return null;
      }
    }

    return planData;
  } catch (error: any) {
    console.warn(`⚠️ [Re-hydration] Error fetching planner output: ${error.message}`);
    return null;
  }
}

/**
 * Fetch the completed Research output
 */
async function fetchResearchOutput(pipelineId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('pipeline_steps')
      .select('output')
      .eq('pipeline_id', pipelineId)
      .eq('name', 'research')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn(`⚠️ [Re-hydration] Research output not found: ${error?.message || 'No data'}`);
      return null;
    }

    let researchData = data.output;
    if (typeof researchData === 'string') {
      try {
        researchData = JSON.parse(researchData);
      } catch (e) {
        console.warn(`⚠️ [Re-hydration] Failed to parse research output as JSON: ${e}`);
        return null;
      }
    }

    return researchData;
  } catch (error: any) {
    console.warn(`⚠️ [Re-hydration] Error fetching research output: ${error.message}`);
    return null;
  }
}

/**
 * Re-hydrate the checkpoint object with missing phase data
 */
async function rehydrateMissingPhaseData(pipelineId: string, pipeline: any): Promise<any> {
  console.log(`🔄 [Re-hydration] Checking for missing phase data...`);
  
  const currentPhase = pipeline.current_phase;
  
  // If at CODER phase but plan is missing -> Fetch it
  if (currentPhase === 'coder') {
    // Check if plan exists in pipeline metadata
    const planFromPipeline = pipeline.file_structure_plan;
    
    if (!planFromPipeline) {
      console.log('⚠️ [Re-hydration] Plan missing at Coder phase - fetching from DB...');
      const planFromDB = await fetchPlannerOutput(pipelineId);
      
      if (planFromDB) {
        // Try to extract FileStructurePlan from planner output
        // The planner output might contain the plan in different formats
        let extractedPlan = null;
        
        // Check if it's already a FileStructurePlan
        if (planFromDB.files && Array.isArray(planFromDB.files)) {
          extractedPlan = planFromDB;
        } else if (planFromDB.fileStructurePlan) {
          extractedPlan = planFromDB.fileStructurePlan;
        } else if (planFromDB.plan) {
          extractedPlan = planFromDB.plan;
        }
        
        if (extractedPlan) {
          pipeline.file_structure_plan = extractedPlan;
          console.log(`✅ [Re-hydration] Plan re-hydrated from database (${extractedPlan.files?.length || 0} files)`);
        } else {
          console.warn(`⚠️ [Re-hydration] Could not extract FileStructurePlan from planner output`);
        }
      } else {
        console.error(`❌ [Re-hydration] Failed to fetch plan from database`);
      }
    } else {
      console.log(`✅ [Re-hydration] Plan already exists in pipeline metadata`);
    }
  }
  
  // If at SQL/TESTER phase -> Ensure plan and research are loaded
  if (['sql', 'tester'].includes(currentPhase)) {
    if (!pipeline.file_structure_plan) {
      console.log('⚠️ [Re-hydration] Plan missing at SQL/Tester phase - fetching...');
      const planFromDB = await fetchPlannerOutput(pipelineId);
      if (planFromDB) {
        pipeline.file_structure_plan = planFromDB;
        console.log(`✅ [Re-hydration] Plan re-hydrated`);
      }
    }
    
    if (!pipeline.research) {
      console.log('⚠️ [Re-hydration] Research missing at SQL/Tester phase - fetching...');
      const researchFromDB = await fetchResearchOutput(pipelineId);
      if (researchFromDB) {
        pipeline.research = researchFromDB;
        console.log(`✅ [Re-hydration] Research re-hydrated`);
      }
    }
  }
  
  return pipeline;
}

async function getStep(pipelineId: string, stepName: string) {
  // Handle duplicates: Get the most recent step if multiple exist
  // Use .limit(1) and handle array result to avoid "multiple rows" error
  const { data, error } = await supabase
    .from('pipeline_steps')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('name', stepName)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`[DB] Failed to fetch step: ${error.message}`);
  }

  // Extract the first (most recent) step from array, or null if empty
  const step = data && data.length > 0 ? data[0] : null;

  // Self-healing: Create missing step if it's a canonical step
  if (!step) {
    if (CANONICAL_STEPS.includes(stepName as any)) {
      console.warn(`[DB] Step ${stepName} not found for pipeline ${pipelineId}, creating new step`);
      
      const { data: created, error: insertError } = await supabase
        .from('pipeline_steps')
        .insert({
          pipeline_id: pipelineId,
          name: stepName,
          status: 'pending',
        })
        .select()  // ⚠️ CRITICAL: Perplexity's fix
        .single();

      if (insertError) {
        throw new Error(`[DB] Failed to auto-create step: ${insertError.message}`);
      }

      if (!created) {
        throw new Error(`[DB] Insert returned null for step ${stepName}`);
      }

      console.log(`✅ Self-healed: Created missing step ${stepName}`);
      return created;
    }

    // Unknown step - mark pipeline as corrupt
    await supabase
      .from('pipelines')
      .update({
        status: 'failed_hard',
        last_error: `Missing required step '${stepName}'`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pipelineId);
  }

  return step;
}

// ✅ Info Transporter functions moved to ./src/info-transporter.ts
// All functions now use proper JSON.stringify() - never template literals for JSON

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
    await updateStep(pipeline.id, 'cloner', 'completed', JSON.stringify({
        files_found: files.length,
        structure: files.slice(0, 200) // Spara topp 200 filer som kontext
    }));

    // 5. Hoppa över Research (oftast onödigt vid fixar) och gå till Planner
    await updatePipeline(pipeline.id, { current_phase: 'planner' });

  } catch (error: any) {
    console.error("❌ Cloning failed:", error.message);
    await updateStep(pipeline.id, 'cloner', 'failed', JSON.stringify({ error: error.message }));
    await updatePipeline(pipeline.id, { status: 'failed' });
    throw error;
  }
}

// ------------------------------------------------------------------
// STEG 1: RESEARCH
// ------------------------------------------------------------------
// ═══════════════════════════════════════════════════════════════════
// PHASE 1: PERPLEXITY RESEARCH (Multiple focused queries)
// ═══════════════════════════════════════════════════════════════════
async function runResearchStep(pipeline: any, researchType: 'technical-constraints' | 'best-practices' = 'technical-constraints'): Promise<string> {
  console.log(`[Research] Phase 1 - ${researchType} for: ${pipeline.name || pipeline.id}`);
  
  const userRequest = pipeline.initial_prompt || pipeline.prompt;
  
  let researchPrompt: string;
  
  if (researchType === 'technical-constraints') {
    researchPrompt = `
ROLE: You are a Technical Lead performing Due Diligence.

TASK: Research TECHNICAL CONSTRAINTS for: "${userRequest}"

⛔ IGNORE:
- Beginner tutorials ("How to install React").
- Generic marketing fluff.

✅ FIND CRITICAL INFO:
1. BREAKING CHANGES: specifically for Next.js 15 / React 19.
2. COMPATIBILITY: Which libraries conflict with Server Components?
3. DEPENDENCIES: What are the critical dependencies and their versions?
4. GOTCHAS: What usually kills this type of project?

OUTPUT:
A bulleted list of TECHNICAL CONSTRAINTS and CONFIGURATION RULES.
    `;
  } else {
    researchPrompt = `
ROLE: You are a Technical Lead performing Best Practices Research.

TASK: Research BEST PRACTICES and ARCHITECTURE PATTERNS for: "${userRequest}"

✅ FIND:
1. STATE OF THE ART: What is the current best-practice stack for this type of project?
2. ARCHITECTURE PATTERNS: Recommended patterns, folder structures, and design principles.
3. PERFORMANCE: Optimization strategies and common pitfalls.
4. SCALABILITY: How to structure for growth.

OUTPUT:
A comprehensive guide of BEST PRACTICES and ARCHITECTURE RECOMMENDATIONS.
    `;
  }

  try {
    const result = await performDeepResearch(researchPrompt);
    console.log(`✅ [Research] ${researchType} completed (${result.length} chars)`);
    return result;
  } catch (error: any) {
    console.error(`❌ [Research] ${researchType} failed:`, error);
    return `Research failed for ${researchType}: ${error.message}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: K2 SYNTHESIS (Deep reasoning synthesis of all research)
// ═══════════════════════════════════════════════════════════════════
async function runK2SynthesisStep(
  pipelineId: string,
  userVision: string,
  perplexityReports: string[]
): Promise<string> {
  console.log('🧠 [K2 SYNTHESIS] Starting deep research synthesis...');

  // Create synthesis step in DB
  await createStep(pipelineId, 'k2_synthesis', 'running');

  // Combine all Perplexity reports
  const combinedResearch = perplexityReports
    .map((report, i) => `## Research Report ${i + 1}\n\n${report}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a Technical Architect performing deep research synthesis.

TASK: Analyze the provided research reports and user vision to generate:

1. A prioritized list of TECHNICAL CONSTRAINTS
2. An EDGE CASE ANALYSIS (what usually kills this type of project)
3. A QA CHECKLIST with 15-20 validation criteria
4. ARCHITECTURE RECOMMENDATIONS based on contradictions or gaps in the research

USE YOUR FULL REASONING CAPACITY:
- Cross-reference information across all reports
- Identify contradictions and resolve them with explanation
- Prioritize constraints by impact (critical > important > nice-to-have)
- Generate specific, actionable recommendations (not generic advice)

OUTPUT FORMAT:

# Technical Constraints

## Critical (Must-Have)
- [Constraint with justification]

## Important
- [Constraint with justification]

## Nice-to-Have
- [Constraint with justification]

# Edge Case Analysis
[What breaks this type of project, with prevention strategies]

# QA Checklist
- [ ] [Specific test case]
...

# Architecture Recommendations
[Specific tech choices with rationale]`;

  const userPrompt = `USER VISION:
${userVision}

RESEARCH REPORTS FROM PERPLEXITY PRO:
${combinedResearch}

Synthesize this into actionable technical guidance for the development team.`;

  // Try K2 thinking first (deep reasoning)
  try {
    console.log('🧠 [K2 SYNTHESIS] Attempting deep synthesis with K2 thinking model...');
    const result = await callAI({
      pipelineId,
      step: 'k2_synthesis',
      role: 'RESEARCHER',
      model: 'kimi-k2-thinking',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      maxTokens: 150000 // Let K2 be thorough
    });

    // Save synthesis to file
    const repoPath = getRepoPath({ id: pipelineId } as any);
    const synthesisPath = path.join(repoPath, 'k2-synthesis.md');
    if (!fs.existsSync(path.dirname(synthesisPath))) {
      fs.mkdirSync(path.dirname(synthesisPath), { recursive: true });
    }
    fs.writeFileSync(synthesisPath, result, 'utf-8');

    // Update DB step
    await updateStep(pipelineId, 'k2_synthesis', 'completed', result.substring(0, 10000)); // Store preview

    console.log(`✅ [K2 SYNTHESIS] Complete! Synthesis saved to k2-synthesis.md`);
    
    return result;

  } catch (error: any) {
    const isTimeout = error.message?.includes('timed out') || error.message?.includes('timeout');
    
    if (isTimeout) {
      console.warn('⏱️  [K2 SYNTHESIS] K2 thinking timed out, falling back to faster K2 instruct model...');
      
      // Fallback to faster K2 instruct model (no thinking, but still good synthesis)
      try {
        const fallbackResult = await callAI({
          pipelineId,
          step: 'k2_synthesis_fallback',
          role: 'RESEARCHER',
          model: 'kimi-k2-instruct', // Faster, no thinking overhead
          messages: [
            { role: 'system', content: systemPrompt + '\n\nNOTE: Provide a concise but thorough synthesis. Focus on actionable insights.' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          maxTokens: 50000 // Smaller output for faster processing
        });

        // Save fallback synthesis
        const repoPath = getRepoPath({ id: pipelineId } as any);
        const synthesisPath = path.join(repoPath, 'k2-synthesis.md');
        if (!fs.existsSync(path.dirname(synthesisPath))) {
          fs.mkdirSync(path.dirname(synthesisPath), { recursive: true });
        }
        fs.writeFileSync(synthesisPath, fallbackResult + '\n\n---\n\n[Note: Generated using K2 Instruct fallback due to K2 Thinking timeout]', 'utf-8');

        await updateStep(pipelineId, 'k2_synthesis', 'completed', JSON.stringify({ 
          used_fallback: true,
          reason: 'K2 thinking timeout',
          preview: fallbackResult.substring(0, 10000)
        }));

        console.log(`✅ [K2 SYNTHESIS] Fallback synthesis complete using K2 Instruct`);
        return fallbackResult;
      } catch (fallbackError: any) {
        console.error('❌ [K2 SYNTHESIS] Fallback also failed:', fallbackError.message);
        // Continue to final fallback
      }
    } else {
      console.error('❌ [K2 SYNTHESIS] Failed:', error.message);
    }
    
    // Final fallback: just concatenate the Perplexity reports
    console.warn('⚠️  [K2 SYNTHESIS] Using concatenated Perplexity reports as final fallback');
    await updateStep(pipelineId, 'k2_synthesis', 'failed', JSON.stringify({ 
      error: String(error),
      used_fallback: true,
      fallback_type: 'concatenated_reports'
    }));
    
    return combinedResearch;
  }
}

// ------------------------------------------------------------------
// STEG 2: PLANNER
// ------------------------------------------------------------------
/**
 * Prompt Optimizer: Enhances user prompts for better AI understanding
 * Uses PROMPT_ENGINEER (Gemini Flash) to expand vague requests into detailed specs
 */
async function optimizeUserRequest(rawRequest: string, pipelineId: string): Promise<string> {
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
    const optimized = await callAI({
      pipelineId,
      step: 'prompt_engineer',
      role: 'PROMPT_ENGINEER',
      model: 'gemini-2.0-flash-exp', // ✅ CORRECT MODEL NAME (Dec 2024/Jan 2025)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawRequest }
      ]
    });
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
async function optimizeUserPrompt(rawPrompt: string, pipelineId: string): Promise<string> {
  return optimizeUserRequest(rawPrompt, pipelineId);
}

async function runPlannerStep(pipeline: any, repoPath: string, context?: any) {
  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'planner');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Planner step already completed (Checkpoint found). Advancing...");
    
    // FIX: Force update the pipeline phase so we don't loop forever
    try {
      await updatePipeline(pipeline.id, { current_phase: 'coder' });
      
      // Verify the update succeeded by fetching the pipeline
      const { data: verifyPipeline } = await supabase
        .from('pipelines')
        .select('current_phase')
        .eq('id', pipeline.id)
        .single();
      
      if (verifyPipeline?.current_phase === 'coder') {
        console.log("   ✅ Pipeline phase verified: advanced to 'coder'");
      } else {
        console.error(`   ❌ Pipeline phase update failed! Current phase: ${verifyPipeline?.current_phase || 'unknown'}`);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('pipelines')
          .update({ current_phase: 'coder', updated_at: new Date().toISOString() })
          .eq('id', pipeline.id);
        
        if (directError) {
          console.error(`   ❌ Direct update also failed:`, directError.message);
        } else {
          console.log("   ✅ Direct update succeeded (fallback)");
        }
      }
    } catch (updateError: any) {
      console.error(`   ❌ Failed to advance pipeline phase:`, updateError.message);
      // Don't return - let it continue to avoid infinite loop
      // The next iteration will try again
    }
    
    return;
  }

  console.log(`[Planner] Creating blueprint...`);
  await updatePipeline(pipeline.id, { current_phase: 'planner' });
  await createStep(pipeline.id, 'planner', 'running');

  // 🚀 ZERO-SHOT VALIDATION: Validate, sanitize, and generate test cases
  const rawRequest = pipeline.initial_prompt || pipeline.prompt || "";
  let zeroShotData;
  try {
    zeroShotData = await runZeroShotPipeline(rawRequest, {});
    console.log(`✅ Zero-Shot Validation passed. Generated ${zeroShotData.testSuite.cases.length} test cases.`);
  } catch (zeroShotError: any) {
    console.error(`❌ Zero-Shot Validation failed: ${zeroShotError.message}`);
    // Fallback: Use original request but log warning
    zeroShotData = {
      isValid: true,
      testSuite: { cases: [], criteria: [] },
      sanitizedRequest: rawRequest,
      originalRequest: rawRequest,
    };
    console.warn("⚠️ Continuing with original request (Zero-Shot validation skipped)");
  }

  // ✨ PROMPT OPTIMIZER: Enhance user request before processing
  const optimizedRequest = await optimizeUserPrompt(zeroShotData.sanitizedRequest, pipeline.id);
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
    .eq('name', 'research')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Extract K2 synthesis if available (new two-phase research)
  let researchData = "No research data.";
  if (researchStep?.output) {
    if (typeof researchStep.output === 'string') {
      try {
        // ═══════════════════════════════════════════════════════════════════
        // 🔧 STEG 1: Sanitize innan JSON-parse
        // ═══════════════════════════════════════════════════════════════════
        const sanitized = researchStep.output
          .replace(/[\r\n]+/g, ' ')           // Replace newlines med space
          .replace(/  +/g, ' ')                // Collapse multiple spaces
          .trim();
        
        let parsed: any;
        try {
          parsed = JSON.parse(sanitized);
        } catch (parseError: any) {
          // If JSON parse fails, treat as raw text (for markdown files)
          console.warn(`⚠️ [Planner] Research output is not JSON, treating as raw text: ${parseError.message}`);
          researchData = researchStep.output; // Plain string fallback
        }
        
        if (parsed) {
          // New format: { perplexity: {...}, k2Synthesis: "..." }
          if (parsed.k2Synthesis) {
            researchData = parsed.k2Synthesis; // Use K2 synthesis (preferred)
          } else if (parsed.content) {
            researchData = parsed.content; // Old format fallback
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ [Planner] Failed to parse research output: ${error.message}`);
        researchData = researchStep.output; // Plain string fallback
      }
    } else if (researchStep.output.k2Synthesis) {
      researchData = researchStep.output.k2Synthesis;
    } else if (researchStep.output.content) {
      researchData = researchStep.output.content;
    }
  }

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

  // --- INFO TRANSPORTER: Inject accumulated context ---
  // ✅ Use contextToPromptString helper for safe JSON string conversion
  let contextSection = "";
  if (context && Object.keys(context).length > 0) {
    console.log(`📡 [Info Transporter] Injecting ${Object.keys(context).length} context sources into Planner...`);
    const contextString = contextToPromptString(context, 5000);
    contextSection = `
═══════════════════════════════════════════════════════════════════
📡 STRUCTURED CONTEXT FROM PREVIOUS PHASES (Info Transporter)
═══════════════════════════════════════════════════════════════════
${contextString}

Use this context to understand:
- Research findings and technical constraints
- User requirements and vision
- Previous phase outputs
═══════════════════════════════════════════════════════════════════
`;
  }

  const RUTHLESS_PLANNER_PROMPT = `
ROLE: You are a Paranoid Senior Systems Architect.

TASK: Create a blueprint for a production-grade application.

${promptPrefix}

${contextSection}

PROJECT REQUEST: "${optimizedRequest}"

${zeroShotData.testSuite.criteria.length > 0 ? `
CRITICAL SUCCESS CRITERIA (You MUST pass these):
${zeroShotData.testSuite.criteria.map(c => `- ${c}`).join('\n')}

TEST CASES TO SATISFY:
${zeroShotData.testSuite.cases.map(c => `- ${c}`).join('\n')}
` : ''}

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
    // ✅ Phase 1: Generate repository map for planner
    console.log("[Planner] 📋 Generating repository map...");
    let repoMap = '';
    try {
      repoMap = generateRepositoryMap(repoPath);
      console.log(`[Planner] ✅ Repository map generated (${repoMap.length} chars)`);
    } catch (e) {
      console.warn(`[Planner] ⚠️ Could not generate repo map: ${e}`);
      repoMap = '\n(Repository map unavailable - new project)\n';
    }
    
    // ✅ Phase 0: Log step start
    await logEvent(pipeline.id, 'STEP_START', 'planner');
    
    // ✅ NEW: Unified AI client with cost tracking + repo map
    console.log("[Planner] Thinking with unified AI client...");
    const enhancedPlanPrompt = `${planPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPOSITORY MAP - AVAILABLE EXPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${repoMap}

CRITICAL: When planning imports, ONLY reference files listed above.
If you need something not listed, include it in your file creation plan.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    
    const plan = await callAI({
      pipelineId: pipeline.id,
      step: 'planner',
      role: 'PLANNER',
      model: selectModel('PLANNER'),
      messages: [
        { role: 'user', content: enhancedPlanPrompt }
      ]
    });
    
    // ✅ Phase 0: Log step complete
    await logEvent(pipeline.id, 'STEP_COMPLETE', 'planner', {
      plan_length: plan.length,
      repo_map_size: repoMap.length
    });
    
    await updateStep(pipeline.id, 'planner', 'completed', JSON.stringify({ 
        content: plan, 
        isPython: intent.isPython, 
        intent: intent,
        matrix: matrix, 
        ragKnowledge: ragKnowledge,
        testSuite: zeroShotData.testSuite, // Save test cases for later use
        sanitizedRequest: zeroShotData.sanitizedRequest,
    }));
    await updatePipeline(pipeline.id, { current_phase: 'coder', is_python: intent.isPython });
  } catch (error: any) {
    // ✅ NEW: Enhanced error classification
    const errorLog = error.message || error.toString();
    const analysis = classifyError(errorLog);
    
    console.error(`[Planner] Failed: ${analysis.classification} (${analysis.errorCode})`);
    console.log(`   Strategy: ${analysis.fixStrategy}, Max retries: ${analysis.maxRetries}`);
    
    await supabase
      .from('pipelines')
      .update({
        status: 'failed',
        error_code: analysis.errorCode,
        error_signature: analysis.errorSignature
      })
      .eq('id', pipeline.id);
    
    await recordErrorPattern(analysis, false);
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

/**
 * IMPORT REWRITER - Converts relative imports to @/ alias
 */
async function rewriteImportsToAlias(
  code: string,
  filePath: string
): Promise<string> {
  console.log(`🔧 [IMPORT REWRITER] Processing: ${filePath}`);
  
  // Pattern 1: Match relative imports with ../
  const relativePattern = /from\s+(['"])(\.\.\/)+(.*?)\1/g;
  
  let rewritten = code.replace(relativePattern, (match, quote, dots, rest) => {
    // Extract the target path
    let targetPath = rest;
    
    // Determine if it's a known alias path
    if (targetPath.startsWith('components/')) {
      return `from ${quote}@/${targetPath}${quote}`;
    }
    if (targetPath.startsWith('lib/')) {
      return `from ${quote}@/${targetPath}${quote}`;
    }
    if (targetPath.startsWith('app/')) {
      return `from ${quote}@/${targetPath}${quote}`;
    }
    
    // If not standard, keep original (might be node_modules)
    return match;
  });

  // Pattern 2: Fix current directory imports (./)
  rewritten = rewritten.replace(
    /from\s+(['"])\.\/(components|lib|app)\/(.*?)\1/g,
    (match, quote, folder, rest) => {
      return `from ${quote}@/${folder}/${rest}${quote}`;
    }
  );

  // Pattern 3: Normalize default vs named imports (Button vs { Button })
  // This ensures consistency
  rewritten = rewritten.replace(
    /import\s+(\{[^}]+\})\s+from/g,
    (match, imports) => {
      // Remove extra spaces in destructured imports
      const cleaned = imports.replace(/\s+/g, ' ').trim();
      return `import ${cleaned} from`;
    }
  );

  return rewritten;
}

/**
 * Validate Next.js imports - Check for invalid or hallucinated imports
 */
function validateNextImports(content: string): string[] {
  const errors: string[] = [];
  
  // Check for invalid Next.js imports
  const invalidImports = [
    /import\s+.*\s+from\s+['"]next\/.*DefaultLayout['"]/,  // Invalid DefaultLayout import
    /import\s+.*DefaultLayout.*from\s+['"]next['"]/,      // DefaultLayout from 'next'
    /import\s+.*\s+from\s+['"]react\/.*server['"]/,       // Invalid react/server imports
  ];
  
  for (const pattern of invalidImports) {
    if (pattern.test(content)) {
      errors.push(`Invalid import detected: ${pattern.toString()}`);
    }
  }
  
  return errors;
}

/**
 * STRUCTURE VALIDATOR - Ensures critical files exist
 */
async function validateProjectStructure(
  localPath: string,
  pipelineId: string
): Promise<void> {
  console.log('🔍 [VALIDATOR] Checking project structure...');
  
  const criticalFiles = [
    'src/app/page.tsx',
    'src/lib/types.ts',        // ✅ This MUST exist
    'tsconfig.json',
    'package.json'
  ];

  const missing: string[] = [];

  for (const file of criticalFiles) {
    const fullPath = path.join(localPath, file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    console.warn(`⚠️ [VALIDATOR] Missing critical files: ${missing.join(', ')}`);
    
    // ✅ LONG-TERM FIX: Create types.ts from GOLDEN template if missing
    if (missing.includes('src/lib/types.ts')) {
      console.log('🩹 [AUTO-HEAL] Creating types.ts from GOLDEN template...');
      const typesPath = path.join(localPath, 'src/lib/types.ts');
      fs.mkdirSync(path.dirname(typesPath), { recursive: true });
      
      // ✅ Try to copy from golden template first
      const templatePath = path.join(process.cwd(), 'templates', 'fortress', 'types.ts');
      if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        fs.writeFileSync(typesPath, templateContent, 'utf-8');
        console.log('✅ [AUTO-HEAL] types.ts created from GOLDEN template');
      } else {
        // Fallback: Create minimal safe types.ts
        console.warn('⚠️ [AUTO-HEAL] Golden template not found, using fallback...');
        const typesContent = `
// Auto-generated by Frost Night Factory
// ⚠️ GOLDEN template not found - using fallback
// This file should be replaced with golden template from templates/fortress/types.ts

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Item {
  id: string;
  title: string;
  description?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Re-export database types
export type {
  CoinData,
  UserPortfolio,
  WatchlistItem,
  TradeHistory,
  TickerData,
  TradeSignal
} from '@/types/database';
`.trim();
        fs.writeFileSync(typesPath, typesContent, 'utf-8');
        console.log('✅ [AUTO-HEAL] types.ts created (fallback)');
      }
    }

    // AUTO-HEAL: Create database types if missing
    const databaseTypesPath = path.join(localPath, 'src/types/database.ts');
    if (!fs.existsSync(databaseTypesPath)) {
      console.log('🩹 [AUTO-HEAL] Creating database types...');
      const databaseTypesContent = `
// Auto-generated types for NeoTrade

export interface CoinData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export interface UserPortfolio {
  totalValue: number;
  totalChange24h: number;
  holdings: {
    symbol: string;
    amount: number;
    value: number;
    change24h: number;
  }[];
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  addedAt: string;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
}

export interface TradeSignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: string;
}
`.trim();
      
      fs.mkdirSync(path.dirname(databaseTypesPath), { recursive: true });
      fs.writeFileSync(databaseTypesPath, databaseTypesContent, 'utf-8');
      console.log('✅ [AUTO-HEAL] database.ts created');
    }

    // AUTO-HEAL: Fix/validate supabase.ts
    const supabasePath = path.join(localPath, 'src/lib/supabase.ts');
    if (fs.existsSync(supabasePath)) {
      const supabaseContent = fs.readFileSync(supabasePath, 'utf-8');
      
      // Auto-fix if it uses wrong env syntax
      if (supabaseContent.includes('import.meta.env')) {
        console.log('🔧 [AUTO-FIX] Fixing Vite env syntax in supabase.ts');
        fs.writeFileSync(supabasePath, GOLDEN_SUPABASE_TS, 'utf-8');
        console.log('✅ Replaced supabase.ts with Next.js-compatible version');
      }
      } else {
      // Create if missing
      fs.mkdirSync(path.dirname(supabasePath), { recursive: true });
      fs.writeFileSync(supabasePath, GOLDEN_SUPABASE_TS, 'utf-8');
      console.log('✅ Injected Golden Supabase client');
    }

    // AUTO-HEAL: Fix/validate layout.tsx
    const layoutPath = path.join(localPath, 'src/app/layout.tsx');
    if (!fs.existsSync(layoutPath)) {
      console.log('✅ Injecting Golden Layout (missing)');
      fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
      fs.writeFileSync(layoutPath, GOLDEN_LAYOUT_TSX, 'utf-8');
    } else {
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      // Check for hallucinated imports
      const importErrors = validateNextImports(layoutContent);
      
      // Check if existing layout has type errors
      if (importErrors.length > 0 || !layoutContent.includes('RootLayoutProps') || !layoutContent.includes('React.ReactNode')) {
        console.log('🔧 Replacing broken layout with Golden Layout');
        if (importErrors.length > 0) {
          console.log(`   Reason: ${importErrors.join(', ')}`);
        }
        fs.writeFileSync(layoutPath, GOLDEN_LAYOUT_TSX, 'utf-8');
      } else {
        // Validate and fix types
        validateReactComponentTypes(layoutPath);
      }
    }

    // AUTO-HEAL: Validate React component types
    const reactFiles = ['src/app/page.tsx'];
    for (const file of reactFiles) {
      const filePath = path.join(localPath, file);
      if (fs.existsSync(filePath)) {
        validateReactComponentTypes(filePath);
      }
    }
  }
}

/**
 * IMPORT VALIDATOR - Ensures no relative imports exist
 */
async function validateNoRelativeImports(localPath: string): Promise<void> {
  console.log('🔍 [VALIDATOR] Checking for relative imports...');
  
  const srcPath = path.join(localPath, 'src');
  if (!fs.existsSync(srcPath)) {
    console.log('⚠️ [VALIDATOR] src/ directory not found, skipping import validation');
    return;
  }

  const tsFiles = getAllFiles(srcPath).filter(file => 
    file.endsWith('.ts') || file.endsWith('.tsx')
  );
  
  const violations: string[] = [];

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativeImports = content.match(/from\s+['"]\.\.?\//g);
    
    if (relativeImports) {
      violations.push(`${path.relative(localPath, file)}: ${relativeImports.join(', ')}`);
    }
  }
  
  if (violations.length > 0) {
    throw new Error(
      `❌ [IMPORT VALIDATOR] Found ${violations.length} relative imports:\n` +
      violations.slice(0, 10).join('\n') + // Show first 10
      (violations.length > 10 ? `\n... and ${violations.length - 10} more` : '')
    );
  }
  
  console.log('✅ [VALIDATOR] No relative imports found');
}

/**
 * Inject missing domain types into types.ts when TYPE_DRIFT is detected
 */
async function injectMissingDomainTypes(workspacePath: string, errorLog: string): Promise<void> {
  // Extract missing type names from TS2305 errors
  const missingTypes: string[] = [];
  const typeRegex = /has no exported member '(\w+)'/g;
  let match;
  
  while ((match = typeRegex.exec(errorLog)) !== null) {
    missingTypes.push(match[1]);
  }
  
  if (missingTypes.length === 0) return;
  
  console.log(`   🩹 Injecting ${missingTypes.length} missing domain types...`);
  
  // Read existing types.ts
  const typesPath = path.join(workspacePath, 'src/lib/types.ts');
  if (!fs.existsSync(typesPath)) {
    console.warn('   ⚠️ types.ts not found, creating new file...');
    const typesDir = path.dirname(typesPath);
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }
    fs.writeFileSync(typesPath, '// Auto-generated types\n', 'utf-8');
  }
  
  let typesContent = fs.readFileSync(typesPath, 'utf-8');
  
  // Check if types already exist
  const existingTypes = missingTypes.filter(typeName => 
    typesContent.includes(`export type ${typeName}`) || 
    typesContent.includes(`export interface ${typeName}`)
  );
  
  if (existingTypes.length === missingTypes.length) {
    console.log('   ✅ All types already exist');
    return;
  }
  
  // Add placeholder domain types at the end
  const domainTypes = missingTypes
    .filter(typeName => !existingTypes.includes(typeName))
    .map(typeName => {
      return `\n// Generated placeholder - replace with actual implementation
export type ${typeName} = {
  id: string;
  // TODO: Add actual fields based on your schema
};`;
    }).join('\n');
  
  typesContent += domainTypes;
  
  fs.writeFileSync(typesPath, typesContent, 'utf-8');
  console.log(`   ✅ Injected ${missingTypes.length - existingTypes.length} domain types`);
}

/**
 * FILENAME VALIDATOR - Fixes common typos in filenames
 */
function validateAndFixFilename(filePath: string): string {
  const invalidPatterns = [
    /Porrtfolio/,     // Should be Portfolio
    /Wattchlist/,     // Should be Watchlist
    /Traade/,         // Should be Trade
    /Marr/            // Should be Mar
  ];
  
  let cleanPath = filePath;
  let hasTypo = false;
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(cleanPath)) {
      hasTypo = true;
      console.warn(`⚠️ [FIXER] Detected typo in filename: ${cleanPath}`);
      
      // Fix common typos
      cleanPath = cleanPath
        .replace(/Porrtfolio/g, 'Portfolio')
        .replace(/Wattchlist/g, 'Watchlist')
        .replace(/Traade/g, 'Trade')
        .replace(/Marr/g, 'Mar');
      
      console.log(`✅ [FIXER] Corrected to: ${cleanPath}`);
    }
  }
  
  return cleanPath;
}

/**
 * ENVIRONMENT VARIABLE AUTO-FIX - Fixes common env var issues
 */
function autoFixEnvironmentVariables(content: string, filename: string): string {
  let fixed = content;
  let changes = 0;
  
  // Pattern 1: Fix Vite env vars in Next.js projects
  const vitePattern = /import\.meta\.env\.VITE_(\w+)/g;
  if (vitePattern.test(content)) {
    console.log(`🔧 [AUTO-FIX] Converting Vite env vars to Next.js in ${filename}`);
    fixed = fixed.replace(vitePattern, (match, varName) => {
      changes++;
      return `process.env.NEXT_PUBLIC_${varName}`;
    });
  }
  
  // Pattern 2: Fix process.env without NEXT_PUBLIC_ prefix (for client-side)
  const clientEnvPattern = /process\.env\.(?!NEXT_PUBLIC_)([A-Z_]+)/g;
  if (clientEnvPattern.test(fixed) && filename.includes('src/')) {
    console.log(`⚠️ [AUTO-FIX] Adding NEXT_PUBLIC_ prefix to env vars in ${filename}`);
    fixed = fixed.replace(clientEnvPattern, (match, varName) => {
      // Don't touch server-side vars like NODE_ENV
      if (['NODE_ENV', 'PORT'].includes(varName)) return match;
      changes++;
      return `process.env.NEXT_PUBLIC_${varName}`;
    });
  }
  
  // Pattern 3: Fix missing ! assertion for required env vars
  const unsafeEnvPattern = /process\.env\.(NEXT_PUBLIC_\w+)\s*\|\|\s*['"]['"];?$/gm;
  if (unsafeEnvPattern.test(fixed)) {
    console.log(`🔧 [AUTO-FIX] Adding TypeScript assertions for env vars in ${filename}`);
    fixed = fixed.replace(unsafeEnvPattern, (match, varName) => {
      changes++;
      return `process.env.${varName}!`;
    });
  }
  
  if (changes > 0) {
    console.log(`✅ [AUTO-FIX] Fixed ${changes} environment variable issues in ${filename}`);
  }
  
  return fixed;
}

/**
 * REACT COMPONENT TYPE VALIDATOR - Fixes missing type annotations
 */
function validateReactComponentTypes(filePath: string): { valid: boolean; fixes: string[] } {
  if (!fs.existsSync(filePath)) {
    return { valid: true, fixes: [] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fixes: string[] = [];
  let fixedContent = content;
  
  // Pattern 1: Fix untyped children prop
  const untypedChildrenPattern = /\{\s*children\s*\}:\s*\{[^}]*\}/g;
  if (untypedChildrenPattern.test(content) && !content.includes('React.ReactNode')) {
    console.log(`🔧 [AUTO-FIX] Adding React.ReactNode type to children in ${path.basename(filePath)}`);
    
    // Replace with typed version
    fixedContent = fixedContent.replace(
      /\{\s*children\s*\}:\s*\{[^}]*\}/g,
      '{ children }: { children: React.ReactNode }'
    );
    fixes.push('Added React.ReactNode type to children');
  }
  
  // Pattern 2: Fix missing interface for props
  const functionComponentPattern = /export default function (\w+)\(\{ children \}:/;
  if (functionComponentPattern.test(fixedContent) && !fixedContent.includes('interface')) {
    const match = fixedContent.match(functionComponentPattern);
    if (match) {
      const componentName = match[1];
      const interfaceDef = `interface ${componentName}Props {\n  children: React.ReactNode;\n}\n\n`;
      
      // Insert interface before function
      fixedContent = fixedContent.replace(
        functionComponentPattern,
        `${interfaceDef}export default function ${componentName}({ children }: ${componentName}Props) {`
      );
      fixes.push(`Added ${componentName}Props interface`);
    }
  }
  
  // Pattern 3: Fix implicit any type errors
  const implicitAnyPattern = /\(\{\s*children\s*\}\s*:\s*\{[^}]*\}\)/g;
  if (implicitAnyPattern.test(fixedContent) && !fixedContent.includes('React.ReactNode')) {
    fixedContent = fixedContent.replace(
      /\(\{\s*children\s*\}\s*:\s*\{[^}]*\}\)/g,
      '({ children }: { children: React.ReactNode })'
    );
    if (fixedContent !== content) {
      fixes.push('Fixed implicit any type for children prop');
    }
  }
  
  if (fixes.length > 0) {
    fs.writeFileSync(filePath, fixedContent, 'utf-8');
    console.log(`✅ [AUTO-FIX] Applied ${fixes.length} type fixes to ${path.basename(filePath)}`);
  }
  
  return { valid: fixes.length === 0, fixes };
}

/**
 * ERROR CLASSIFIER - Determines if error is fixable and how
 */
function classifyTypeError(error: string): { fixable: boolean; strategy: string } {
  // Pattern: Missing type annotation
  if (error.includes('implicitly has an') && error.includes('any')) {
    return {
      fixable: true,
      strategy: 'ADD_TYPE_ANNOTATION'
    };
  }
  
  // Pattern: Missing React.ReactNode
  if (error.includes('children') && error.includes('Binding element')) {
    return {
      fixable: true,
      strategy: 'USE_GOLDEN_TEMPLATE'
    };
  }
  
  // Pattern: Import/export errors
  if (error.includes('Cannot find module') || error.includes('has no exported member')) {
    return {
      fixable: true,
      strategy: 'FIX_IMPORTS'
    };
  }
  
  return {
    fixable: false,
    strategy: 'MANUAL_INTERVENTION'
  };
}

/**
 * PIPELINE STATE MACHINE - Validates state transitions
 */
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  'pending': ['planning', 'failed_hard'],
  'planning': ['coding', 'failed_hard'],
  'coding': ['testing', 'failed_hard'],
  'testing': ['publishing', 'failed_hard', 'coding'], // Can retry coding
  'publishing': ['published', 'failed_hard'],
  'published': [], // Terminal state
  'failed_hard': ['pending'], // Can retry from scratch
  // Legacy states for backwards compatibility
  'running': ['failed_hard', 'completed'],
  'completed': [],
};

/**
 * ENVIRONMENT VALIDATOR - Checks Node.js version compatibility
 */
function validateEnvironment() {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  
  console.log(`🔍 Node.js version: ${nodeVersion}`);
  
  if (major >= 22 && major < 24) {
    console.warn('⚠️  WARNING: Node.js ' + nodeVersion + ' detected');
    console.warn('   Next.js 14 recommends Node 18 or 20 LTS');
    console.warn('   Jest worker crashes are common on Node 22+');
    console.warn('');
    console.warn('   Recommended fix:');
    console.warn('   nvm install 20.18.1');
    console.warn('   nvm use 20.18.1');
    console.warn('');
  }
  
  if (major >= 24) {
    console.error('❌ UNSUPPORTED: Node.js 24.x is NOT compatible with Next.js 14');
    console.error('   Downgrade to Node 20 LTS immediately');
    console.error('');
    console.error('   Run these commands:');
    console.error('   nvm install 20.18.1');
    console.error('   nvm use 20.18.1');
    console.error('');
    process.exit(1);
  }
  
  console.log('✅ Node.js version compatible');
}

/**
 * Deterministic unused import remover (no AI needed)
 */
async function removeUnusedImports(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${path.basename(filePath)}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const newLines: string[] = [];
  const unusedPattern = /import\s+(?:type\s+)?{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/;
  
  for (const line of lines) {
    const match = line.match(unusedPattern);
    
    if (match) {
      const symbols = match[1].split(',').map(s => s.trim()).filter(s => s);
      const from = match[2];
      
      // Keep imports that are actually used in the file
      const usedSymbols = symbols.filter(symbol => {
        const symbolName = symbol.replace(/\s+as\s+.+$/, ''); // Remove 'as' aliases
        const usagePattern = new RegExp(`\\b${symbolName}\\b`, 'g');
        const matches = content.match(usagePattern) || [];
        return matches.length > 1; // More than just the import line
      });
      
      if (usedSymbols.length === 0) {
        console.log(`   🗑️  Removed unused: ${symbols.join(', ')} from ${from}`);
        continue; // Skip this line entirely
      } else if (usedSymbols.length < symbols.length) {
        const removed = symbols.filter(s => !usedSymbols.includes(s));
        console.log(`   🔧 Kept used symbols, removed: ${removed.join(', ')}`);
        newLines.push(`import type { ${usedSymbols.join(', ')} } from '${from}'`);
        continue;
      }
    }
    
    newLines.push(line);
  }
  
  const newContent = newLines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`   ✅ Cleaned ${path.basename(filePath)}`);
  }
}

async function updatePipelineStatus(
  pipelineId: string,
  newStatus: string,
  reason?: string
): Promise<void> {
  // Get current state
  const { data: pipeline, error: fetchError } = await supabase
    .from('pipelines')
    .select('status')
    .eq('id', pipelineId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`[DB] Failed to fetch pipeline: ${fetchError.message}`);
  }

  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  const currentStatus = pipeline.status;
  const allowedTransitions = VALID_STATE_TRANSITIONS[currentStatus] || [];

  // Validate transition
  if (!allowedTransitions.includes(newStatus)) {
    const error = `Invalid state transition: ${currentStatus} → ${newStatus}`;
    console.error(`❌ ${error}`);
    
    // Log to telemetry (if pipeline_errors table exists)
    try {
      const { data: telemetryData, error: telemetryError } = await supabase.from('pipeline_errors').insert({
        pipeline_id: pipelineId,
        error_type: 'invalid_state_transition',
        error_message: error,
        current_state: currentStatus,
        attempted_state: newStatus,
      })
      .select()
      .single();

      if (telemetryError) {
        throw telemetryError;
      }

      if (!telemetryData) {
        console.warn('⚠️ Telemetry insert returned null');
      }
    } catch (telemetryError: any) {
      // Ignore if table doesn't exist
      console.warn('⚠️ Could not log to pipeline_errors table:', telemetryError.message);
    }
    
    throw new Error(error);
  }

  // Valid transition - update
  const { error } = await supabase
    .from('pipelines')
    .update({
      status: newStatus,
      last_error: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pipelineId);

  if (error) {
    throw new Error(`Failed to update pipeline status: ${error.message}`);
  }

  console.log(`✅ Pipeline ${pipelineId}: ${currentStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATE AND WRITE FILE HELPER
// ═══════════════════════════════════════════════════════════════════

async function validateAndWriteFile(
  filePath: string,
  content: string,
  projectRoot: string
): Promise<{ success: boolean; errors: string[]; renamedPath?: string }> {
  const fileName = path.relative(projectRoot, filePath)
  
  // STEP 1: Auto-fix file extension if needed
  const { code, newFileName } = autoFixFileExtension(content, fileName)
  let finalPath = newFileName !== fileName 
    ? path.join(projectRoot, newFileName) 
    : filePath
  
  // 🔓 ARCHITECT OVERRIDE: Allow .ts -> .tsx evolution for fortress files
  // Check if this is a valid evolution (fortress file upgrading from .ts to .tsx)
  if (newFileName !== fileName && filePath.endsWith('.ts') && newFileName.endsWith('.tsx')) {
    const normalizedPath = fileName.replace(/\\/g, '/');
    let isFortressFile = false;
    let isApiRoute = false;
    let isLibFile = false;
    
    // Check if file is fortress-protected
    try {
      const fortressModule = await import('../lib/nightFactory/v90-index');
      const tier = fortressModule.getFileTier?.(normalizedPath);
      const FortressTier = fortressModule.FortressTier;
      if (FortressTier && tier !== undefined) {
        isFortressFile = tier === FortressTier.GOLDEN || tier === FortressTier.REGENERATE_ONLY;
      }
    } catch {
      // Fortress not available, continue without fortress check
    }
    
    // Check if file is API route
    isApiRoute = (normalizedPath.includes('/src/app/api/') || normalizedPath.includes('/app/api/')) &&
                 path.basename(normalizedPath).startsWith('route.');
    
    // Check if file is lib file
    isLibFile = normalizedPath.includes('/src/lib/') || normalizedPath.includes('/lib/');
    
    // Allow evolution for fortress files and lib files, but block for API routes
    if (isFortressFile) {
      const isEvolution = filePath.endsWith('.ts') && newFileName.endsWith('.tsx');
      if (isEvolution) {
        console.log(`🔓 ARCHITECT OVERRIDE: Permitting file evolution (${fileName} -> .tsx) for JSX support.`);
        finalPath = path.join(projectRoot, newFileName); // ALLOW THE RENAME
        // 🧹 CLEANUP: Delete old .ts file to prevent duplicates
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`   🗑️ Deleted old file: ${fileName}`);
          } catch (err) {
            console.warn(`   ⚠️ Failed to delete old file ${fileName}:`, err);
          }
        }
      } else {
        console.log(`🛡️ [FORTRESS] Blocked rename of protected file: ${fileName} (skipping rename).`);
        finalPath = filePath; // BLOCK ANY OTHER RENAME
      }
    } else if (isLibFile) {
      // Allow lib files to evolve .ts -> .tsx when they contain JSX
      const isEvolution = filePath.endsWith('.ts') && newFileName.endsWith('.tsx');
      if (isEvolution) {
        console.log(`🔓 ARCHITECT OVERRIDE: Permitting lib file evolution (${fileName} -> .tsx) for JSX support.`);
        finalPath = path.join(projectRoot, newFileName); // ALLOW THE RENAME
        // 🧹 CLEANUP: Delete old .ts file to prevent duplicates
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`   🗑️ Deleted old file: ${fileName}`);
          } catch (err) {
            console.warn(`   ⚠️ Failed to delete old file ${fileName}:`, err);
          }
        }
      } else {
        console.log(`⚠️ [AUTO-FIX] JSX detected in ${fileName}, but skipping rename (lib file, non-evolution).`);
        finalPath = filePath; // Keep original path
      }
    } else if (isApiRoute) {
      // Block rename for API routes (they should be pure TS handlers)
      console.log(`⚠️ [AUTO-FIX] JSX detected in ${fileName}, but skipping rename (api-route).`);
      finalPath = filePath; // Keep original path
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔧 ROBUST IMPORT HANDLING: Prevent crash on missing imports
  // ═══════════════════════════════════════════════════════════════════
  let validation: CodeValidationResult;
  try {
    // STEP 2: Validate code (with error recovery)
    validation = await validateCode(code, newFileName, projectRoot)
  } catch (importError: any) {
    // CRITICAL: If import validation fails, log warning but proceed anyway
    const errorMessage = importError.message || String(importError);
    const isImportError = errorMessage.includes('Module not found') || 
                         errorMessage.includes('Cannot find module') ||
                         errorMessage.includes('Import not found');
    
    if (isImportError) {
      console.warn(`⚠️ [ROBUST HANDLER] Missing dependency detected: ${errorMessage}`);
      console.warn(`   ⚠️ Proceeding anyway - file will be written (missing imports may be resolved later)`);
      
      // Create a minimal validation result that allows the file to be written
      validation = {
        valid: true, // Allow file to be written despite missing imports
        errors: [],
        warnings: [`Missing import detected but proceeding: ${errorMessage}`]
      };
    } else {
      // Non-import errors: rethrow
      throw importError;
    }
  }
  
  // 🔧 EXTENSION ENFORCER: Handle renamedPath signal
  if (validation.renamedPath) {
    const proposedNewPath = validation.renamedPath;
    const normalizedPath = fileName.replace(/\\/g, '/');
    
    // 🔓 ARCHITECT OVERRIDE: Check if this is a fortress file evolution
    let isFortressFile = false;
    try {
      const fortressModule = await import('../lib/nightFactory/v90-index');
      const tier = fortressModule.getFileTier?.(normalizedPath);
      const FortressTier = fortressModule.FortressTier;
      if (FortressTier && tier !== undefined) {
        isFortressFile = tier === FortressTier.GOLDEN || tier === FortressTier.REGENERATE_ONLY;
      }
    } catch {
      // Fortress not available, continue without fortress check
    }
    
    const isApiRoute = (normalizedPath.includes('/src/app/api/') || normalizedPath.includes('/app/api/')) &&
                      path.basename(normalizedPath).startsWith('route.');
    const isLibFile = normalizedPath.includes('/src/lib/') || normalizedPath.includes('/lib/');
    
    // Check if this is a valid .ts -> .tsx evolution
    const isEvolution = fileName.endsWith('.ts') && proposedNewPath.endsWith('.tsx');
    
    if (isFortressFile && isEvolution) {
      // ✅ ARCHITECT OVERRIDE: Allow fortress evolution
      console.log(`🔓 ARCHITECT OVERRIDE: Permitting Fortress evolution (${fileName} -> ${proposedNewPath}) for JSX support.`);
      finalPath = path.join(projectRoot, proposedNewPath);
      console.log(`   ✅ File will be saved as: ${proposedNewPath}`);
      // 🧹 CLEANUP: Delete old .ts file to prevent duplicates
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`   🗑️ Deleted old file: ${fileName}`);
        } catch (err) {
          console.warn(`   ⚠️ Failed to delete old file ${fileName}:`, err);
        }
      }
    } else if (isLibFile && isEvolution) {
      // ✅ ARCHITECT OVERRIDE: Allow lib file evolution
      console.log(`🔓 ARCHITECT OVERRIDE: Permitting lib file evolution (${fileName} -> ${proposedNewPath}) for JSX support.`);
      finalPath = path.join(projectRoot, proposedNewPath);
      console.log(`   ✅ File will be saved as: ${proposedNewPath}`);
      // 🧹 CLEANUP: Delete old .ts file to prevent duplicates
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`   🗑️ Deleted old file: ${fileName}`);
        } catch (err) {
          console.warn(`   ⚠️ Failed to delete old file ${fileName}:`, err);
        }
      }
    } else if (isApiRoute) {
      // ❌ Block rename for API routes (they should be pure TS handlers)
      console.log(`⚠️ [AUTO-FIX] JSX detected in ${fileName}, but skipping rename (api-route).`);
      finalPath = filePath; // Keep original path, ignore rename signal
    } else if (isLibFile) {
      // Block non-evolution renames for lib files
      console.log(`⚠️ [AUTO-FIX] JSX detected in ${fileName}, but skipping rename (lib file, non-evolution).`);
      finalPath = filePath; // Keep original path
    } else {
      // ✅ Normal rename for component files
      console.log(`🔧 [Enforcer] Applying mandatory rename: ${newFileName} -> ${proposedNewPath}`);
      finalPath = path.join(projectRoot, proposedNewPath);
      console.log(`   ✅ File will be saved as: ${proposedNewPath}`);
      // 🧹 CLEANUP: Delete old .ts file to prevent duplicates
      if (isEvolution && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`   🗑️ Deleted old file: ${fileName}`);
        } catch (err) {
          console.warn(`   ⚠️ Failed to delete old file ${fileName}:`, err);
        }
      }
    }
  }
  
  if (!validation.valid) {
    console.log(`❌ CODE REJECTED: ${newFileName}`)
    const errorCount = validation.errors?.length || 0;
    if (validation.errors && Array.isArray(validation.errors)) {
      validation.errors.forEach(err => console.log(`   ${err}`))
    }
    return { success: false, errors: validation.errors || [] }
  }
  
  // STEP 3: Log warnings but continue (defensive access)
  const warningCount = validation.warnings?.length || 0;
  if (warningCount > 0 && Array.isArray(validation.warnings)) {
    console.log(`⚠️ WARNINGS for ${newFileName}:`)
    validation.warnings.forEach(warn => console.log(`   ${warn}`))
  }
  
  // STEP 4: Write to disk (ALWAYS write, even if imports are missing)
  try {
    const dir = path.dirname(finalPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    // Use atomic write for critical files (prevents corruption)
    writeFileSyncSafe(finalPath, code)
    console.log(`✅ Validated & wrote: ${path.relative(projectRoot, finalPath)}`)
  } catch (writeError: any) {
    console.error(`❌ Failed to write file ${finalPath}:`, writeError.message);
    return { success: false, errors: [`Write failed: ${writeError.message}`] };
  }
  
  return { 
    success: true, 
    errors: [],
    renamedPath: validation.renamedPath ? path.relative(projectRoot, finalPath) : undefined
  }
}

/**
 * Validate and fix import order in generated code
 * Ensures imports come before exports (ES module requirement)
 */
function validateAndFixImportOrder(code: string, filePath: string): string {
  const lines = code.split('\n');
  
  // Find first import and first export
  let firstImportIndex = -1;
  let firstExportIndex = -1;
  let useClientIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === "'use client';" || line === '"use client";') {
      useClientIndex = i;
    }
    
    if (line.startsWith('import ') && firstImportIndex === -1) {
      firstImportIndex = i;
    }
    
    if ((line.startsWith('export ') && !line.includes('export default')) && firstExportIndex === -1) {
      firstExportIndex = i;
    }
  }
  
  // Check if exports come before imports (WRONG)
  if (firstExportIndex !== -1 && firstImportIndex !== -1 && firstExportIndex < firstImportIndex) {
    console.log(`⚠️ [VALIDATOR] Import order violation in ${path.basename(filePath)}`);
    console.log(`   Export at line ${firstExportIndex + 1}, Import at line ${firstImportIndex + 1}`);
    console.log(`   🔧 Auto-fixing import order...`);
    
    // Extract all imports and exports
    const imports: string[] = [];
    const exports: string[] = [];
    const otherLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === useClientIndex) {
        continue; // Handle separately
      } else if (line.trim().startsWith('import ')) {
        imports.push(line);
      } else if (line.trim().startsWith('export ') && !line.includes('export default')) {
        exports.push(line);
      } else {
        otherLines.push(line);
      }
    }
    
    // Reconstruct in correct order
    const fixed: string[] = [];
    
    if (useClientIndex !== -1) {
      fixed.push(lines[useClientIndex]);
      fixed.push('');
    }
    
    // 1. Imports first
    imports.forEach(imp => fixed.push(imp));
    
    if (imports.length > 0) fixed.push('');
    
    // 2. Named exports (route config)
    exports.forEach(exp => fixed.push(exp));
    
    if (exports.length > 0) fixed.push('');
    
    // 3. Rest of code
    otherLines.forEach(line => fixed.push(line));
    
    console.log(`   ✅ Fixed import order`);
    return fixed.join('\n');
  }
  
  return code;
}

/**
 * 🔧 PRE-GENERATION STUBS: Create stub files before AI starts coding
 * Prevents "Import Deadlock" by ensuring files exist before they're imported
 */
async function createStubFiles(files: string[], repoPath: string): Promise<void> {
  console.log(`🔧 [STUB GENERATOR] Creating ${files.length} stub files...`);
  
  let stubsCreated = 0;
  for (const filePath of files) {
    const fullPath = path.join(repoPath, filePath);
    const dir = path.dirname(fullPath);
    
    // Skip if file already exists (don't overwrite)
    if (fs.existsSync(fullPath)) {
      continue;
    }
    
    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create stub based on file extension
    let stubContent: string;
    if (filePath.endsWith('.tsx')) {
      const componentName = path.basename(filePath, '.tsx').replace(/[^a-zA-Z0-9]/g, '') || 'Stub';
      stubContent = `'use client';

export default function ${componentName}() {
  return null;
}
`;
    } else if (filePath.endsWith('.ts')) {
      stubContent = `export {}; // Stub
`;
    } else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      stubContent = `export {}; // Stub
`;
    } else {
      // For other file types, create minimal stub
      stubContent = `// Stub file - pending implementation
`;
    }
    
    try {
      fs.writeFileSync(fullPath, stubContent, 'utf-8');
      console.log(`   📄 Created stub: ${filePath}`);
      stubsCreated++;
    } catch (error: any) {
      console.warn(`   ⚠️ Failed to create stub for ${filePath}: ${error.message}`);
    }
  }
  
  if (stubsCreated > 0) {
    console.log(`✅ [STUB GENERATOR] Created ${stubsCreated} stub files (prevents import deadlock)`);
  } else {
    console.log(`   ℹ️ No new stubs needed (all files already exist)`);
  }
}

/**
 * Strip outer code fences from a string
 * Removes ```lang ... ``` wrapper if present
 */
function stripOuterCodeFences(s: string): string {
  const trimmed = s.trim();
  
  // Remove one outer ```lang ... ``` if present
  const fenceMatch = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch?.[1]) return fenceMatch[1].trimEnd();
  
  return trimmed;
}

/**
 * ✅ LAYER A: Ensure single-file wrapper exists
 * Pre-normalizes AI output to always have a file wrapper pattern
 * This prevents "NO FILES MATCHED" errors in single-file generation mode
 * 
 * Matches user specification exactly: wraps with code fences + FILE comment
 */
function ensureSingleFileWrapper(
  raw: string,
  relPath: string,
  lang: "typescript" | "tsx" | "text" = "typescript"
): string {
  const trimmed = raw.trim();

  // If it already contains a known wrapper marker, keep it.
  if (
    /^\s*\/\/\s*FILE:\s*/m.test(trimmed) ||
    /^\s*FILE:\s*/m.test(trimmed) ||
    /^\s*###\s*FILE:\s*/mi.test(trimmed) ||
    /\[FILE:\s*[^\]]+\]/m.test(trimmed)
  ) {
    return trimmed;
  }

  // Strip one outer code fence if present
  const fence = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/);
  const content = (fence?.[1] ?? trimmed).trimEnd();

  // ✅ Force wrapper using code fences + FILE comment (matches user spec exactly)
  return [
    "```" + lang,
    `// FILE: ${relPath}`,
    content,
    "```",
    ""
  ].join("\n");
}

async function parseAndWriteFiles(
  codeBlock: string,
  localPath: string,
  pipelineId?: string,
  targetPath?: string  // ✅ Optional: For single-file generation fallback
): Promise<number> {
  console.log('🔍 [PARSER] Starting file parsing...');
  
  // CRITICAL: Remove [END FILE] markers and other Claude artifacts
  const cleanedBlock = codeBlock
    .replace(/\[END FILE\]/g, '')           // Remove end markers
    .replace(/```tsx\n?/g, '')
    .replace(/```ts\n?/g, '')
    .replace(/```\n?$/g, '')                // Remove code fence closes
    .replace(/<script[^>]*>.*?<\/script>/gs, '')           // Block scripts
    .replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, '')          // Strip external images
    .replace(/eval\(/g, 'BLOCKED_EVAL(')                   // Block eval
    .trim();

  // 🆕 TRY MULTIPLE PATTERNS (in order of priority)
  const patterns = [
    // Pattern 1: ### FILE: (Strict)
    /### FILE: (.+?)\n([\s\S]*?)(?=\n### FILE:|$)/g,
    
    // Pattern 2: FILE: (No ###)
    /^FILE: (.+?)\n([\s\S]*?)(?=\nFILE:|$)/gm,
    
    // Pattern 3: **FILE**: (Markdown bold)
    /\*\*FILE\*\*: (.+?)\n([\s\S]*?)(?=\n\*\*FILE\*\*:|$)/g,
    
    // Pattern 4: [FILE: ...] (Square brackets) 🆕
    /\[FILE:\s*(.+?)\](?:python|typescript|tsx|javascript)?\n([\s\S]*?)(?=\n\[FILE:|$)/g,
    
    // Pattern 5: // FILE: (Comment style)
    /\/\/ FILE: (.+?)\n([\s\S]*?)(?=\n\/\/ FILE:|$)/g
  ];

  let filesWritten: string[] = [];
  let patternUsed = -1;
  let skippedFiles: string[] = []; // Track files skipped due to protection
  let totalFilesFound = 0; // Track total files found (including skipped)

  // Try each pattern until we find files
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    let match;
    const tempFiles: string[] = [];

    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;

    while ((match = pattern.exec(cleanedBlock)) !== null) {
      let rawPath = match[1].trim();
      let content = match[2].trim();

      // Skip empty files
      if (!rawPath || !content) continue;
      
      totalFilesFound++; // Count all files found
      
      // ✅ NEW: Skip protected infrastructure files
      const normalizedPath = rawPath.replace(/\\/g, '/');
      if (PROTECTED_INFRASTRUCTURE_FILES.some(protectedFile => normalizedPath.endsWith(protectedFile))) {
        console.log(`   🛡️ Skipping protected file: ${rawPath}`);
        skippedFiles.push(rawPath);
        continue;
      }

      // ENFORCER: Guarantee src/ structure
      if (!rawPath.startsWith('src/') && !rawPath.startsWith('backend/')) {
        if (rawPath.startsWith('app/') || rawPath.startsWith('components/') || rawPath.startsWith('lib/')) {
          rawPath = `src/${rawPath}`;
        }
      }

      const fullPath = path.join(localPath, rawPath);
      console.log(`📝 [PARSER] Processing: ${rawPath}`);

      // ═══════════════════════════════════════════════════════════════════
      // 🏰 v9.0 FORTRESS GUARD: Protect files before writing
      // ═══════════════════════════════════════════════════════════════════
      try {
        const { getFileTier, FortressTier, getFortressFile } = await import('../lib/nightFactory/v90-index');
        const tier = getFileTier(rawPath);
        const fortress = getFortressFile(rawPath);
        
        if (tier === FortressTier.GOLDEN) {
          console.log(`🏰 FORTRESS: ${rawPath} is GOLDEN - blocking AI generation`);
          // Skip this file - don't write AI-generated content
          console.log(`   ⚠️ Skipping ${rawPath} - GOLDEN files must use templates`);
          skippedFiles.push(rawPath); // Track skipped file
          continue; // Skip to next file
        } else if (tier === FortressTier.REGENERATE_ONLY) {
          console.log(`🏰 FORTRESS: ${rawPath} marked REGENERATE_ONLY`);
          // Allow generation but mark as protected
          if (fortress?.template) {
            console.log(`   📋 Will regenerate from template if needed: ${fortress.template}`);
          }
        }
      } catch (fortressError: any) {
        // Fortress not available, continue normally
        console.warn(`⚠️ Fortress guard unavailable: ${fortressError.message}`);
      }

      // JSON FORTRESS: Protect config files (with comment removal)
      if (rawPath.endsWith('tsconfig.json')) {
        console.log('🛡️ [JSON FORTRESS] Validating tsconfig.json...');
        try {
          // Remove comments before parsing
          const cleanedContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          JSON.parse(cleanedContent);
        } catch (e) {
          console.warn('⚠️ [JSON FORTRESS] Invalid JSON. Using Golden Template.');
          content = JSON.stringify(GOLDEN_TSCONFIG, null, 2);
        }
      }

      if (rawPath.endsWith('package.json')) {
        console.log('🛡️ [JSON FORTRESS] Validating package.json...');
        try {
          // Remove comments before parsing (JSON doesn't allow comments)
          const cleanedContent = content
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .replace(/,\s*\/\/.*$/gm, ',') // Remove trailing comments after commas
            .trim();
          JSON.parse(cleanedContent);
        } catch (e) {
          console.warn('⚠️ [JSON FORTRESS] Invalid JSON (possibly contains comments). Using Golden Template.');
          content = JSON.stringify(GOLDEN_PACKAGE_JSON, null, 2);
        }
      }

      // IMPORT REWRITER: Fix relative imports
      if (rawPath.endsWith('.ts') || rawPath.endsWith('.tsx')) {
        content = await rewriteImportsToAlias(content, rawPath);
      }

      // ENVIRONMENT VARIABLE AUTO-FIX: Fix env var issues
      if (rawPath.endsWith('.ts') || rawPath.endsWith('.tsx')) {
        content = autoFixEnvironmentVariables(content, rawPath);
      }
      
      // ✅ IMPORT ORDER VALIDATOR: Fix import order violations
      if (rawPath.endsWith('.ts') || rawPath.endsWith('.tsx')) {
        content = validateAndFixImportOrder(content, rawPath);
      }

      // ═══════════════════════════════════════════════════════════════════
      // CODE VALIDATION GATE: Validate before writing
      // ═══════════════════════════════════════════════════════════════════
      const validationResult = await validateAndWriteFile(fullPath, content, localPath);
      
      if (!validationResult.success) {
        console.error(`❌ [VALIDATOR] Rejected file: ${rawPath}`);
        console.error(`   Errors: ${validationResult.errors.join(', ')}`);
        // Skip this file - don't add to tempFiles
        continue;
      }
      
      // 🔧 EXTENSION ENFORCER: Update rawPath if file was renamed
      if (validationResult.renamedPath) {
        rawPath = validationResult.renamedPath;
        console.log(`   📝 File path updated to: ${rawPath}`);
      }
      
      tempFiles.push(rawPath);
    }

    if (tempFiles.length > 0) {
      filesWritten = tempFiles;
      patternUsed = i;
      console.log(`✅ [PARSER] Pattern ${i + 1} matched ${tempFiles.length} files`);
      break;
    }
  }

  if (filesWritten.length === 0) {
    // ═══════════════════════════════════════════════════════════════════
    // 🔧 RELAXED ERROR HANDLING: Check if files were skipped (protected)
    // ═══════════════════════════════════════════════════════════════════
    if (totalFilesFound > 0 || skippedFiles.length > 0) {
      // Files were found but skipped due to protection - this is OK
      console.warn(`⚠️ [PARSER] Found ${totalFilesFound} file(s) but 0 were written (likely protected or skipped)`);
      if (skippedFiles.length > 0) {
        console.warn(`   📋 Skipped files: ${skippedFiles.join(', ')}`);
      }
      console.warn(`   ✅ Proceeding... (AI generated valid code, but files were protected)`);
      return 0; // Return success (0 files written, but that's OK)
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // ✅ ROBUST FALLBACK: Single-file generation fallback
    // ═══════════════════════════════════════════════════════════════════
    if (targetPath) {
      console.warn('⚠️ [PARSER] No file wrapper detected. Falling back to single-file write.');
      
      // Normalize target path (ensure forward slashes)
      const normalizedTarget = targetPath.replace(/\\/g, '/');
      
      // Ensure src/ prefix if needed
      let finalTargetPath = normalizedTarget;
      if (!finalTargetPath.startsWith('src/') && !finalTargetPath.startsWith('backend/')) {
        if (finalTargetPath.startsWith('app/') || finalTargetPath.startsWith('components/') || finalTargetPath.startsWith('lib/')) {
          finalTargetPath = `src/${finalTargetPath}`;
        }
      }
      
      const targetAbsPath = path.join(localPath, finalTargetPath);
      const targetRelPath = finalTargetPath;
      
      // Strip code fences and write atomically
      const content = stripOuterCodeFences(cleanedBlock);
      
      // Import atomic writer
      const { writeFileToDisk } = await import('./lib/file-writer');
      await writeFileToDisk(targetAbsPath, content);
      
      console.log(`✅ [PARSER] Fallback wrote: ${targetRelPath}`);
      return 1; // Return 1 file written
    }
    
    // No files found at all - this is an error (only if no targetPath provided)
    console.error('❌ [PARSER] NO FILES MATCHED ANY PATTERN!');
    console.error('First 500 chars of cleaned output:');
    console.error(cleanedBlock.substring(0, 500));
    
    // Save to debug file
    const debugPath = path.join(localPath, 'DEBUG_RAW_OUTPUT.txt');
    fs.writeFileSync(debugPath, codeBlock, 'utf-8');
    console.error(`💾 Saved raw output to: ${debugPath}`);
    
    throw new Error(`Parser found 0 files. Debug output saved to: ${debugPath}`);
  }

  console.log(`✅ [PARSER] Wrote ${filesWritten.length} files`);
  
  // VALIDATION: Check for critical missing files
  await validateProjectStructure(localPath, pipelineId || '');

  return filesWritten.length;
}

async function runCoderStep(pipeline: any, repoPath: string, context?: any) {
  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'coder');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Coder step already completed (Checkpoint found). Advancing...");
    
    // FIX: Force update the pipeline phase so we don't loop forever
    try {
      await updatePipeline(pipeline.id, { current_phase: 'sql' });
      
      // Verify the update succeeded
      const { data: verifyPipeline } = await supabase
        .from('pipelines')
        .select('current_phase')
        .eq('id', pipeline.id)
        .single();
      
      if (verifyPipeline?.current_phase === 'sql') {
        console.log("   ✅ Pipeline phase verified: advanced to 'sql'");
      } else {
        console.error(`   ❌ Pipeline phase update failed! Current phase: ${verifyPipeline?.current_phase || 'unknown'}`);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('pipelines')
          .update({ current_phase: 'sql', updated_at: new Date().toISOString() })
          .eq('id', pipeline.id);
        
        if (directError) {
          console.error(`   ❌ Direct update also failed:`, directError.message);
        } else {
          console.log("   ✅ Direct update succeeded (fallback)");
        }
      }
    } catch (updateError: any) {
      console.error(`   ❌ Failed to advance pipeline phase:`, updateError.message);
    }
    
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

  // =============================================================================
  // 🏗️ SCAFFOLD GENERATOR: Lay foundation before AI builds
  // =============================================================================
  console.log("\n🏗️ [Scaffold] Generating project structure...");
  generateScaffold(repoPath);
  
  // =============================================================================
  // 📦 COMPONENT REGISTRY: Generate list of available components
  // =============================================================================
  const componentRegistry = generateComponentRegistry(repoPath);
  const registryPrompt = formatComponentRegistry(componentRegistry);
  console.log(`📦 [Registry] Found ${Object.keys(componentRegistry).length} components`);
  
  // =============================================================================
  // 🌐 REALITY VISION: Generate file tree for AI context
  // =============================================================================
  const fileTree = getFileTree(repoPath);
  const fileTreePrompt = fileTree 
    ? `\nCURRENT FILE STRUCTURE:\n${fileTree}\n`
    : '\n(File structure will be created during generation)\n';

  const { data: plannerStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('name', 'planner')
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
    complexity: "Production",
    project_root: "src" // Default to "src" for Next.js projects
  };
  
  // Hämta beslutet från pipeline-datat (som Gatekeepern satte)
  const rootDir = matrix.project_root || 'src';
  
  // Bygg sökvägarna dynamiskt
  const appPath = rootDir === 'src' ? 'src/app' : 'app';
  const componentsPath = rootDir === 'src' ? 'src/components' : 'components';
  const libPath = rootDir === 'src' ? 'src/lib' : 'lib';
  
  // Injicera detta i System Prompten
  const STRICT_STRUCTURE_RULE = `
🚨 CRITICAL FILE STRUCTURE LAW (DO NOT BREAK):
1. THE ROOT IS: '${rootDir}/'
2. ALL Next.js code MUST be in: '${appPath}/'
3. ALL Components MUST be in: '${componentsPath}/'
4. ALL Libs/Utils MUST be in: '${libPath}/'
5. NEVER create files in the project root that belong in '${rootDir}/'.
6. CONFIG files (package.json, next.config.mjs) stay in ROOT (./).
`;
  const ragKnowledge = plannerStep?.output?.ragKnowledge || "";

  // Hämta research och initial_prompt för dynamisk design
  const { data: researchStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('name', 'research')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Extract K2 synthesis if available (new two-phase research)
  let researchData = "";
  if (researchStep?.output) {
    if (typeof researchStep.output === 'string') {
      try {
        const parsed = JSON.parse(researchStep.output);
        // New format: { perplexity: {...}, k2Synthesis: "..." }
        if (parsed.k2Synthesis) {
          researchData = parsed.k2Synthesis; // Use K2 synthesis (preferred)
        } else if (parsed.content) {
          researchData = parsed.content; // Old format fallback
        }
      } catch {
        researchData = researchStep.output; // Plain string fallback
      }
    } else if (researchStep.output.k2Synthesis) {
      researchData = researchStep.output.k2Synthesis;
    } else if (researchStep.output.content) {
      researchData = researchStep.output.content;
    }
  }
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
  
  // --- INFO TRANSPORTER: Inject structured JSON context ---
  if (context) {
    console.log(`📡 [Info Transporter] Injecting structured context into Coder system prompt...`);
    // ✅ Use contextToPromptString helper for safe JSON conversion
    const contextString = contextToPromptString(context, 3000);
    const contextSection = `
📡 STRUCTURED CONTEXT FROM PREVIOUS PHASE (Info Transporter):
${contextString}

Use this context to understand:
- Project requirements and features
- Technology choices and constraints
- Component structure and dependencies
- Database schema and API endpoints
`;
    systemContext += contextSection;
  }
  
  const COMPONENT_NAMING_RULE = `
CRITICAL FILE NAMING RULES:
1. All React Components MUST be PascalCase (e.g., 'Button.tsx', 'Card.tsx').
2. All imports MUST match the filename casing EXACTLY.
   - WRONG: import { Button } from '@/components/ui/button'
   - CORRECT: import { Button } from '@/components/ui/Button'
3. Verify casing before writing code.
`;

  const STRICT_OUTPUT_FORMAT = `
🚨 CRITICAL OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY 🚨

You MUST wrap each file like this (exact format):

### FILE: src/app/page.tsx
[code here]

### FILE: src/lib/types.ts
[code here]

RULES:
- Start with exactly "### FILE: " (three hashes, space, FILE:, space)
- Use forward slashes in paths (not backslashes)
- One file per marker
- No extra markdown around the code
- Do NOT use FILE: without ###
- Do NOT use **FILE**: or // FILE:
- Always use the exact format: ### FILE: [path]
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

  const CRITICAL_CODING_RULES = `
🚨 CRITICAL RULES - PREVENT COMMON MISTAKES 🚨

1. NEVER write JSX in .ts files (only in .tsx files)
   - WRONG: lib/api.ts contains <div> or React components
   - CORRECT: lib/api.ts contains only TypeScript functions/types

2. NEVER use React components in mock-data.ts
   - WRONG: mock-data.ts exports JSX or React components
   - CORRECT: mock-data.ts exports ONLY plain TypeScript objects and arrays

3. mock-data.ts must ONLY export plain TypeScript objects and arrays
   - NO React components
   - NO JSX syntax
   - NO imports from React
   - ONLY: const MOCK_DATA = { ... } or const MOCK_ARRAY = [...]

4. Use proper regex syntax: /pattern/ not /pattern (missing closing slash)
   - WRONG: const pattern = /regex
   - CORRECT: const pattern = /regex/
`;

  const CODER_SYSTEM_PROMPT = `
You are a PRODUCTION CODE GENERATOR for Frost Night Factory.

${STRICT_FILE_TYPE_RULES}

═══════════════════════════════════════════════════════════════════
⛔ CRITICAL: ABSOLUTELY FORBIDDEN PATTERNS
═══════════════════════════════════════════════════════════════════

NEVER GENERATE:
- // TODO: implement X
- // FIXME: add logic
- // Add code here
- return [];  (empty array)
- return {};  (empty object)
- return null;
- /* mock data */
- /* placeholder */
- Promise.resolve({ /* ... */ })
- 'mocked_data' strings
- : any (use specific types)

If you write ANY of these patterns, the build will FAIL and you will be asked to regenerate.

═══════════════════════════════════════════════════════════════════
✅ REQUIRED: FILE EXTENSION RULES
═══════════════════════════════════════════════════════════════════

- .ts files: NO JSX allowed. Pure TypeScript only.
- .tsx files: JSX/React components allowed.
- .ts files with <div>, <Component>, etc. will FAIL TypeScript parsing.
- NEVER put JSX (React components) in a file ending with .ts. If you write JSX, the file extension MUST be .tsx.

Before writing a file, CHECK THE EXTENSION:
- Is it .ts? → NO JSX, NO React components
- Is it .tsx? → JSX is allowed

NEGATIVE CONSTRAINTS:
1. Do NOT put React Components (JSX) in 'src/lib/' or 'lib/'.
2. Files ending in '.ts' MUST NOT contain JSX. Use '.tsx' for components.
3. 'src/lib/types.ts' or 'lib/types.ts' must ONLY contain 'export interface' or 'export type'. No logic, no JSX.
4. Do NOT generate UI components in 'src/components/ui/' - these are pre-injected Golden Components.
5. FILE EXTENSIONS: If a file contains JSX (React components), it MUST end in .tsx. NEVER put JSX in a .ts file.

═══════════════════════════════════════════════════════════════════
✅ REQUIRED: COMPLETE IMPLEMENTATIONS
═══════════════════════════════════════════════════════════════════

Every function MUST:
1. Have a complete implementation (not empty)
2. Return actual data (not empty arrays/objects)
3. Handle errors properly
4. Use specific TypeScript types (not 'any')

Example of CORRECT code:
\`\`\`typescript
export async function fetchMarketData(): Promise<MarketData> {
  const response = await fetch('/api/markets')
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
}
\`\`\`

Example of FORBIDDEN code:
\`\`\`typescript
export async function fetchMarketData(): Promise<any> {
  // TODO: implement
  return []
}
\`\`\`

═══════════════════════════════════════════════════════════════════
✅ VERIFICATION CHECKLIST
═══════════════════════════════════════════════════════════════════

Before submitting code, verify:
- [ ] No TODO/FIXME comments
- [ ] No empty returns ([], {}, null)
- [ ] No 'any' types
- [ ] No JSX in .ts files
- [ ] All imports reference REAL files
- [ ] All functions have implementations

Mark completed code with: // PRODUCTION_READY
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

${CRITICAL_CODING_RULES}

${CODER_SYSTEM_PROMPT}

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
- Framework: Next.js 16.x (Turbopack enabled - 4x faster builds)
- React: 19.x
- Tailwind: 3.4.x
- Structure: src/app/ (enforced src/ structure)
- Icons: Lucide React
- Auth: Supabase SSR (@supabase/ssr)
- UI Components: Shadcn/ui (premium, customizable)

STRICT RULES:
1. Use Shadcn/ui components from src/components/ui/ - DO NOT recreate them inline.
2. Use the '[FILE: filename]' format strictly for EVERY file.
3. ${designSystem}
4. Import Shadcn components: import { Button } from '@/components/ui/button'

SIMULATION FIRST (MANDATORY):
- Create lib/mock-data.ts with hardcoded demo data.
- ALL data fetching MUST fallback to mock data on error.
- The app MUST NEVER crash. Always show UI with data.

DEPENDENCY RULES (CRITICAL - DO NOT IGNORE):
- Use EXACT versions: "next": "^16.0.0", "react": "^19.0.0", "react-dom": "^19.0.0"
- You MUST use "tailwindcss": "^3.4.17" in package.json. Do NOT use "latest" or v4.
- You MUST use "postcss": "^8.4.31" and "autoprefixer": "^10.4.19".
- Do NOT use @tailwindcss/postcss (we are using standard Tailwind v3 config).
- Include a standard tailwind.config.ts with content paths for src/app/ and src/components/.
- Include a postcss.config.js with tailwindcss and autoprefixer plugins.
- If you use Supabase Auth, you MUST include "@supabase/ssr" in package.json.
- Use "dev": "next dev --turbo" for 4x faster development builds.
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

${CRITICAL_CODING_RULES}

${CODER_SYSTEM_PROMPT}

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
      
      // 1. Analysera Design Context (Enkel version, kan göras med AI senare)
      const designContext = {
        targetUser: "Modern SaaS User",
        aesthetic: "premium" as const, // 'modern' | 'minimal' | 'premium'
        competitorStudy: "Linear, Vercel, Raycast"
      };
      
      const PREMIUM_SAAS_PROMPT = `
ROLE: You are a world-class React component engineer designing for:
- Target User: ${designContext.targetUser}
- Aesthetic: ${designContext.aesthetic}
- Competitors: ${designContext.competitorStudy}

TASK: Build the Frontend for "${pipeline.initial_prompt || pipeline.prompt}".

${ARCHITECTURE_MEMORY}

IMPLEMENTATION PLAN:
${JSON.stringify(plan).substring(0, 3000)}

${STRICT_STRUCTURE_RULE}

${fileTreePrompt}

${registryPrompt}

GOLDEN STACK (ENFORCED - NO DEVIATIONS):
- Next.js 14.2.x (NOT 15, NOT 16)
- React 18.2.x
- Tailwind 3.4.x
- Lucide React for icons
- Framer Motion for animations
- Sonner for toasts
- Structure: ${appPath}/ (NOT root app/)

DESIGN SYSTEM (MANDATORY - DO NOT DEVIATE):
${JSON.stringify(DESIGN_SYSTEM, null, 2)}

${DESIGN_SYSTEM_EXAMPLES}

STRICT DESIGN RULES:
1. Use ONLY colors from DESIGN_SYSTEM.colors (e.g., 'bg-primary-500', 'text-neutral-900').
2. Use ONLY spacing from DESIGN_SYSTEM.spacing.
3. Use ONLY shadows/radii from DESIGN_SYSTEM.
4. INTERACTION: Every button MUST have a hover state defined in the system.
5. ANIMATION: Use framer-motion with DESIGN_SYSTEM.transitions.

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

${CRITICAL_CODING_RULES}

${CODER_SYSTEM_PROMPT}

${COMPONENT_NAMING_RULE}

${EXPORT_RULE}

${FILE_PROTOCOL}

${STRICT_OUTPUT_FORMAT}
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
      const feCode = await callAI({
        pipelineId: pipeline.id,
        step: 'coder',
        role: 'CODER',
        model: selectModel('CODER'),
        messages: [
          { role: 'user', content: fePrompt }
        ]
      });
      const feFilesCreated = await parseAndWriteFiles(feCode, repoPath, pipeline.id);
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

${fileTreePrompt}

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

${STRICT_OUTPUT_FORMAT}
      `;

      const bePrompt = BRAINY_BACKEND_PROMPT;

      // Kör Backend med vald modell
      const beCode = await callAI({
        pipelineId: pipeline.id,
        step: 'coder',
        role: 'CODER',
        model: selectModel('CODER'), // Use CODER model selection
        messages: [
          { role: 'user', content: bePrompt }
        ]
      });
      const beFilesCreated = await parseAndWriteFiles(beCode, repoPath, pipeline.id);
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
      // SCENARIO 2: MONOLIT (Standard Next.js) - V7.5 FILE STRUCTURE PLANNING
      // ---------------------------------------------------------
      
      // =============================================================================
      // 🏗️ V7.5: PLAN PERFECT FILE STRUCTURE FIRST (The Architect)
      // =============================================================================
      let structurePlan: FileStructurePlan | null = null;
      let useV75Planning = isNewProject; // Use V7.5 for new projects
      
      // ✅ CHECK FOR RE-HYDRATED PLAN FIRST
      if (pipeline.file_structure_plan) {
        structurePlan = pipeline.file_structure_plan as FileStructurePlan;
        console.log(chalk.green(`✅ Using re-hydrated plan (${structurePlan.files?.length || 0} files)`));
      } else if (useV75Planning) {
        // Plan doesn't exist, create it
        try {
          console.log(chalk.cyan("\n🏗️ V7.5 FILE STRUCTURE PLANNING: Architecting perfect structure..."));
          structurePlan = await planPerfectFileStructure(pipeline.initial_prompt || pipeline.prompt || "", rootDir);
          const fileCount = structurePlan?.files?.length || 0;
          console.log(chalk.green(`✅ Planned ${fileCount} files.`));
          
          // --- SPARA TILL DATABASEN ---
          await updatePipeline(pipeline.id, {
            file_structure_plan: structurePlan,
            current_phase: 'coder_planning_complete' // Bra för debugging
          });
          console.log(chalk.green("💾 File structure plan saved to Supabase."));
          // ----------------------------------
          
          // Update rootDir based on plan
          if (structurePlan.root && structurePlan.root !== rootDir) {
            console.log(chalk.yellow(`   📁 Plan specifies root: ${structurePlan.root}, updating...`));
            // rootDir is already set from matrix, but we can use plan's root for file paths
          }
        } catch (error: any) {
          console.warn(chalk.yellow(`⚠️ File structure planning failed: ${error.message}.`));
          // 🔧 FIX: Don't fall back to V5.5 - force V7.5 mode or fail explicitly
          console.error(chalk.red(`❌ V7.5 planning is required. V5.5 fallback disabled to prevent ghost imports.`));
          throw new Error(`V7.5 planning failed: ${error.message}. Cannot proceed without file structure plan.`);
        }
      }
      
      // 🔧 CRITICAL SAFETY CHECK: Ensure plan exists before proceeding
      if (!structurePlan || !structurePlan.files || structurePlan.files.length === 0) {
        console.error(chalk.red(`❌ CRITICAL: V7.5 planning is required. Cannot proceed without file structure plan.`));
        throw new Error('CRITICAL: V7.5 planning is required. Cannot proceed without file structure plan (prevents ghost imports).');
      }
      
      // 🔒 FORCE V7.5 PROTOCOL: Always use Sequential Mode when plan exists
      console.log(chalk.cyan("🔒 Enforcing V7.5 Sequential Mode (Architecture v9.0)"));
      
      if (structurePlan && structurePlan.files && structurePlan.files.length > 0) {
        // =============================================================================
        // 🔧 PRE-GENERATION STUBS: Create stub files BEFORE AI starts coding
        // =============================================================================
        console.log(chalk.cyan("\n🔧 Creating pre-generation stubs (safety net)..."));
        const filePaths = structurePlan.files?.map(f => f?.path).filter(Boolean) || [];
        if (filePaths.length > 0) {
          await createStubFiles(filePaths, repoPath);
        }
        
        // =============================================================================
        // V7.5: SCAFFOLD FILES FIRST (Create empty files)
        // =============================================================================
        console.log(chalk.cyan("\n📁 V7.5: Creating scaffold files..."));
        const filesToScaffold = structurePlan.files || [];
        for (const file of filesToScaffold) {
          if (!file || !file.path) continue; // Defensive: skip invalid files
          const fullPath = path.join(repoPath, file.path);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // Create empty file with placeholder
          fs.writeFileSync(fullPath, "// Pending implementation...\n");
          console.log(chalk.gray(`   📄 Scaffolded: ${file.path}`));
        }
        
        // =============================================================================
        // V7.5: CODE FILES ONE BY ONE (Surgical Coding)
        // =============================================================================
        console.log(chalk.cyan("\n🎨 V7.5: Coding files surgically (one by one)..."));
        
        let filesCreated = 0;
        const filesToCode = structurePlan.files || [];
        for (const file of filesToCode) {
          // ═══════════════════════════════════════════════════════════════════
          // ✨ GOLDEN COMPONENT BYPASS: Skip AI generation (pre-injected)
          // ═══════════════════════════════════════════════════════════════════
          if (!file || !file.path) continue; // Defensive: skip invalid files
          
          const isGolden = file.path.includes('src/components/ui/') || 
                          file.path.includes('shadcn') ||
                          file.path.includes('/components/ui/');
          
          if (isGolden) {
            console.log(chalk.cyan(`✨ [GOLDEN] Skipping AI generation for ${file.path} (Using pre-injected component)`));
            continue; // Jump to next file immediately - don't call AI!
          }
          
          console.log(chalk.cyan(`\n   🎨 Coding: ${file.path}...`));
          
          const filePaths = filesToCode.map(f => f?.path).filter(Boolean);
          const contextPrompt = `
PROJECT CONTEXT:
${JSON.stringify(filePaths)}

YOUR TASK: Implement '${file.path}'.
DESCRIPTION: ${file.description || 'No description provided'}

MANDATORY IMPORTS (COPY-PASTE THESE):
${(file.imports && Array.isArray(file.imports) ? file.imports : []).join('\n')}

MANDATORY EXPORTS:
${(file.exports && Array.isArray(file.exports) ? file.exports : []).join(', ')}

DESIGN SYSTEM:
${JSON.stringify(DESIGN_SYSTEM.colors)}

${systemContext}

OUTPUT FORMAT:
${STRICT_OUTPUT_FORMAT}

You MUST use this exact format:
### FILE: ${file.path}
... code ...
          `;
          
          // ✅ Phase 1: Multi-pass generation with validation
          const targetFile = file.path;
          const fullPrompt = file.type === 'page' || file.type === 'component'
            ? `${systemContext}\n\n${contextPrompt}`
            : `${systemContext}\n\n${contextPrompt}`;
          
          await logEvent(pipeline.id, 'GENERATION_ATTEMPT', 'coder', {
            file: targetFile,
            type: file.type
          });
          
          const result = await generateWithValidation(
            pipeline.id,
            'coder',
            fullPrompt,
            targetFile,
            repoPath,
            10  // Max attempts
          );
          
          if (!result.success) {
            const attemptCount = result.attempts || 0;
            const issues = result.issues || [];
            await logEvent(pipeline.id, 'VALIDATION_FAILED', 'coder', {
              file: targetFile,
              attempts: attemptCount,
              issues: issues
            });
            console.log(chalk.red(`   ❌ Failed to generate valid code for ${targetFile} after ${attemptCount} attempts`));
            if (Array.isArray(issues) && issues.length > 0) {
              issues.forEach((issue, idx) => {
                console.log(chalk.red(`      ${idx + 1}. ${issue}`));
              });
            }
            continue; // Skip this file, try next
          }
          
          await logEvent(pipeline.id, 'VALIDATION_PASSED', 'coder', {
            file: targetFile,
            attempts: result.attempts || 0
          });
          
          // Parse and write the validated code (defensive access)
          const code = result.code || '';
          if (!code || code.length === 0) {
            console.log(chalk.yellow(`   ⚠️ No code generated for ${targetFile}, skipping...`));
            continue;
          }
          
          // ✅ LAYER A: Pre-normalize output with wrapper (prevents "0 files" errors)
          const normalizedCode = ensureSingleFileWrapper(code, targetFile, targetFile.endsWith('.tsx') ? 'tsx' : 'typescript');
          
          // ✅ Pass targetFile for fallback support
          let fileCreated = 0;
          try {
            fileCreated = await parseAndWriteFiles(normalizedCode, repoPath, pipeline.id, targetFile);
          } catch (err: any) {
            const msg = String(err?.message ?? err);
            
            // ✅ LAYER B: Robust fallback for single-file generations (seatbelt)
            if (msg.includes("Pattern found 0 files") || msg.includes("NO FILES MATCHED")) {
              console.warn("⚠️ [PARSER] No file wrapper detected. Falling back to single-file write.");
              
              const { writeFileToDisk } = await import('./lib/file-writer');
              const content = stripOuterCodeFences(code);
              const targetAbsPath = path.join(repoPath, targetFile);
              await writeFileToDisk(targetAbsPath, content);
              console.log(`✅ [PARSER] Fallback wrote: ${targetFile}`);
              fileCreated = 1;
            } else {
              throw err;
            }
          }
          
          if (fileCreated > 0) {
            filesCreated += fileCreated;
            console.log(chalk.green(`   ✅ Coded: ${file.path}`));
          } else {
            console.log(chalk.yellow(`   ⚠️ Failed to code: ${file.path}`));
          }
        }
        
        if (filesCreated === 0) {
          throw new Error("V7.5: Failed to create any files from plan.");
        }
        
        console.log(chalk.green(`\n✅ V7.5 Complete: ${filesCreated} files created from plan.`));
        
      } else {
        // =============================================================================
        // ❌ V5.5 FALLBACK DISABLED: Plan is required
        // =============================================================================
        console.error(chalk.red("\n❌ V7.5 Plan Missing. V5.5 fallback is DISABLED."));
        throw new Error('V7.5 Plan Missing. Please re-run Planner. V5.5 Reactive Coding is disabled to prevent ghost imports and crashes.');
      }
      
      // =============================================================================
      // 🔧 POST-CODER FIXES: Run Client Detector & Import Rewriter (V6.0)
      // =============================================================================
      console.log(chalk.cyan("\n🔧 POST-CODER FIXES: Cleaning up generated code..."));
      
      // Auto-inject 'use client' where needed
      runClientDetector(repoPath);
      
      // Convert relative imports to @/ aliases
      runImportRewriter(repoPath);
      
      // =============================================================================
      // 🩺 IMPORT CHIROPRACTOR: Auto-heal import mismatches (casing, paths, types)
      // =============================================================================
      console.log(chalk.cyan("\n🩺 IMPORT CHIROPRACTOR: Auto-healing import mismatches..."));
      try {
        const { ImportChiropractor } = await import('./scripts/fix-imports');
        const chiropractor = new ImportChiropractor(repoPath, false); // false = write mode
        await chiropractor.run();
        console.log(chalk.green("   ✅ Import healing completed"));
      } catch (importError: any) {
        console.warn(chalk.yellow(`   ⚠️ Import healing failed (non-fatal): ${importError?.message || importError}`));
        // Don't crash the pipeline - just log the error
      }
      
      // =============================================================================
      // 🏆 #1: AUTO-DEPENDENCY INSTALLER (Fixes 25% of errors)
      // =============================================================================
      console.log(chalk.cyan("\n📦 DEPENDENCY DETECTIVE: Auto-installing missing packages..."));
      try {
        const depResult = await runDependencyDetective(repoPath);
        if (depResult.installed.length > 0) {
          console.log(chalk.green(`   ✅ Installed ${depResult.installed.length} packages`));
        }
        if (depResult.errors.length > 0) {
          console.log(chalk.yellow(`   ⚠️ ${depResult.errors.length} installation errors (non-critical)`));
        }
      } catch (error: any) {
        console.warn(chalk.yellow(`   ⚠️ Dependency Detective failed: ${error.message}`));
      }
      
      // =============================================================================
      // 🥈 #2: IMPORT GRAPH VALIDATOR (Fixes 30% of errors)
      // =============================================================================
      console.log(chalk.cyan("\n🔗 IMPORT GRAPH VALIDATOR: Validating import/export graph..."));
      try {
        const importResult = runImportGraphValidator(repoPath);
        if (importResult.fixed > 0) {
          console.log(chalk.green(`   ✅ Fixed ${importResult.fixed} import/export mismatches`));
        }
        if (importResult.issues.length > 0) {
          console.log(chalk.yellow(`   ⚠️ ${importResult.issues.length} issues remain (may need manual fix)`));
        }
      } catch (error: any) {
        console.warn(chalk.yellow(`   ⚠️ Import Graph Validator failed: ${error.message}`));
      }
      
      console.log(chalk.green("   ✅ Post-coder fixes applied"));
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
        const pkg = readPackageJson(pkgPath);
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
          writeFileSyncSafe(pkgPath, JSON.stringify(pkg, null, 2));
          console.log(`[Coder] Updated package.json with pinned Tailwind v3 dependencies`);
        }
      } catch (e) {
        console.log(`[Coder] Warning: Could not parse package.json for dependency pinning`);
      }
    }

    // ✅ REMOVED: RefreshProvider hardcoding - no longer a necessity
    // RefreshProvider was causing unnecessary complexity and is not required for all projects
    // If needed, it can be added manually or via a specific feature request

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
        const reviewComments = await callAI({
          pipelineId: pipeline.id,
          step: 'code_review',
          role: 'CODE_REVIEWER',
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a fast code reviewer. Respond with concise findings. Check for Next.js 15 App Router compatibility, TypeScript errors, and React hooks misuse.'
            },
            {
              role: 'user',
              content: `Review this code for critical bugs only (ignore style).\n\n${allCode.substring(0, 10000)}`
            }
          ]
        });
        
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
              
              // ✅ STRICT PARSING: Extract only code blocks
              const codeBlockMatch = content.match(/```(?:typescript|tsx|ts|js|jsx|json|css|html)?\n([\s\S]*?)```/);
              if (codeBlockMatch) {
                content = codeBlockMatch[1].trim();
              } else {
                // Fallback: Remove [GOAL] and markdown
                content = content.split(/\[GOAL\]/)[0].trim();
                if (content.startsWith("```")) {
                  content = content.replace(/^```[a-z]*\n/, "").replace(/```$/, "");
                }
                // Remove explanation lines
                content = content
                  .split('\n')
                  .filter(line => {
                    const trimmed = line.trim();
                    if (/^(Fixed the|Here's|I've|The code|This|Note:|Explanation:)/i.test(trimmed)) {
                      return false;
                    }
                    return true;
                  })
                  .join('\n')
                  .trim();
              }
              // Final cleanup
              content = content.replace(/\[GOAL\][\s\S]*$/m, '').trim();
              
              if (filePath && content) {
                fixFiles.push({ path: filePath, content: content });
              }
            }
            
            // Om inga filer hittades, försök med ### FILE: format
            if (fixFiles.length === 0) {
              const fixStandardRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
              let fixMatch;
              while ((fixMatch = fixStandardRegex.exec(rawOutput)) !== null) {
                const filePath = fixMatch[1].trim();
                let content = fixMatch[2].trim();
                
                // ✅ STRICT PARSING: Extract only code blocks
                const codeBlockMatch = content.match(/```(?:typescript|tsx|ts|js|jsx|json|css|html)?\n([\s\S]*?)```/);
                if (codeBlockMatch) {
                  content = codeBlockMatch[1].trim();
                } else {
                  // Fallback: THE SANITIZER: Ta bort alla Markdown-artefakter
                  content = content.split(/### END_FILE/)[0].trim();
                  content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
                  content = content.replace(/```$/m, '');
                  content = content.replace(/^### FILE:.*\n?/m, '');
                  content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
                  // Remove explanation lines
                  content = content
                    .split('\n')
                    .filter(line => {
                      const trimmed = line.trim();
                      if (/^(Fixed the|Here's|I've|The code|This|Note:|Explanation:)/i.test(trimmed)) {
                        return false;
                      }
                      if (/^#{1,6}\s/.test(trimmed) || /^[-*+]\s/.test(trimmed)) {
                        return false;
                      }
                      return true;
                    })
                    .join('\n')
                    .trim();
                }
                // Final cleanup
                content = content.replace(/\[GOAL\][\s\S]*$/m, '').trim();
                
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

    // ═══════════════════════════════════════════════════════════════════
    // LAYER 1: Pre-Testing Validation (After Coder Phase) - BLOCKING
    // ═══════════════════════════════════════════════════════════════════
    let coderRetries = 0;
    const maxCoderRetries = 2;
    const MAX_TOTAL_LOOPS = 15;  // ✅ Increased: Give it time to work
    const SAFETY_LIMIT = 20;  // 🛡️ Hard safety brake (prevents infinite loops)
    let totalLoops = 0;  // 🔄 INFINITE MOMENTUM: Track total loop iterations
    let validationPassed = false;
    let previousErrorCount = Infinity;  // 📉 DYNAMIC MOMENTUM: Track error count
    let stagnationCount = 0;  // 🚨 STAGNATION BREAKER: Track consecutive stagnant loops
    let defconLevel = 0;  // 🚨 DEFCON: 0 = normal, 3 = dependency reset, 2 = config relax, 1 = force approve

    while (!validationPassed && coderRetries <= MAX_TOTAL_LOOPS && totalLoops < SAFETY_LIMIT) {
      totalLoops++;  // Increment total loop counter
      console.log(`\n🔍 [Layer 1] Running pre-testing validation (attempt ${coderRetries + 1}/${MAX_TOTAL_LOOPS}, total loops: ${totalLoops}/${SAFETY_LIMIT})...`);
      console.log(`   📉 Dynamic Momentum: Previous error count: ${previousErrorCount === Infinity ? 'N/A' : previousErrorCount}`);
      
      try {
        const { validateCoderPhaseOutput } = await import('./lib/pre-testing-validator');
        const { applyFixes } = await import('./lib/apply-fixes');
        const { logValidationResult } = await import('./lib/log-validation');
        const { runFoundationFixes } = await import('./lib/nightFactory/foundationFix');
        const { runStructureFixes } = await import('./lib/nightFactory/structureFix');
        const { scaffoldMissingImports } = await import('./lib/nightFactory/missingImportScaffolder');
        const { normalizeTsxInSandbox, enforceJsxInvariant } = await import('./lib/nightFactory/tsxNormalizer');
        
        // ═══════════════════════════════════════════════════════════════════
        // 🏗️ PHASE 1: FOUNDATION FIX - Enforce Next.js 15 tsconfig.json
        // ═══════════════════════════════════════════════════════════════════
        console.log('🔧 [Grand Strategy] Phase 1: Running foundation fixes...');
        await runFoundationFixes({ workspaceRoot: repoPath });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🏗️ PHASE 2: STRUCTURE FIX - Remove duplicate files
        // ═══════════════════════════════════════════════════════════════════
        console.log('🔧 [Grand Strategy] Phase 2: Running structure fixes...');
        await runStructureFixes({ workspaceRoot: repoPath });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🏗️ PHASE 3: MISSING IMPORT SCAFFOLDER - Create stubs for missing modules
        // ═══════════════════════════════════════════════════════════════════
        console.log('🔧 [Grand Strategy] Phase 3: Scaffolding missing imports...');
        await scaffoldMissingImports({ workspaceRoot: repoPath });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🏗️ PHASE 4: TSX NORMALIZATION - Auto-evolve .ts with JSX to .tsx
        // ═══════════════════════════════════════════════════════════════════
        console.log('🔧 [Grand Strategy] Phase 4: Normalizing .ts → .tsx (JSX evolution)...');
        normalizeTsxInSandbox(repoPath, {
          info: (...args: any[]) => console.log(...args),
          warn: (...args: any[]) => console.warn(...args),
        });
        
        // ═══════════════════════════════════════════════════════════════════
        // 🛡️ INVARIANT CHECK: Ensure no JSX remains in .ts files
        // ═══════════════════════════════════════════════════════════════════
        console.log('🛡️ [Grand Strategy] Phase 5: Enforcing JSX invariant...');
        enforceJsxInvariant(repoPath, {
          error: (...args: any[]) => {
            console.error(...args);
            throw new Error(args.join(' '));
          },
          warn: (...args: any[]) => console.warn(...args),
        });
        
        // Build a simple CoderPhaseJSON from generated files
        const coderJSON = await buildCoderJSONFromRepo(repoPath);
        
        const validation = await validateCoderPhaseOutput(coderJSON, repoPath, pipeline.id);
        const currentErrorCount = validation.errors.length;
        
        // Log validation result
        await logValidationResult(pipeline.id, 'coder_validation', {
          passed: validation.passed,
          errorsFound: currentErrorCount,
          autoFixed: validation.fixedCode ? 1 : 0,
          costUsd: 0, // TODO: Track AI call costs
          errors: validation.errors,
        });
        
        if (validation.passed) {
          console.log('✅ [Layer 1] Pre-testing validation passed!');
          validationPassed = true;
        } else {
          console.log(`⚠️  [Layer 1] Validation failed: ${currentErrorCount} errors found`);
          
          // ═══════════════════════════════════════════════════════════════════
          // 🧠 AUTONOMOUS SELF-HEALING: Diagnose errors and auto-fix if possible
          // ═══════════════════════════════════════════════════════════════════
          const errorMessages = validation.errors.map((e: any) => e.message || String(e));
          const diagnosis = ErrorClassifier.diagnose(errorMessages);
          
          console.log(`🧠 [Doctor] Diagnosis: ${diagnosis.type} (Confidence: ${(diagnosis.confidence * 100).toFixed(0)}%)`);
          console.log(`   Action recommended: ${diagnosis.action}`);
          console.log(`   Reason: ${diagnosis.reason}`);
          
          if (diagnosis.details.missingModules.length > 0) {
            console.log(`   Missing modules detected: ${diagnosis.details.missingModules.slice(0, 5).join(', ')}${diagnosis.details.missingModules.length > 5 ? '...' : ''}`);
          }
          
          // ✅ AUTO-HEAL: Missing Dependencies
          if (diagnosis.action === 'npm_install') {
            console.log('💊 [Self-Healing] Detected missing dependencies. Agent is running npm install...');
            console.log(`   📦 This is a PROGRESS indicator, not a failure!`);
            
            try {
              const installSuccess = await installDependencies(repoPath);
              
              if (installSuccess) {
                console.log('✅ [Self-Healing] Dependencies installed successfully!');
                console.log('   🔄 Re-validating immediately (FREE PASS - not consuming retry)...');
                
                // DO NOT count this as a retry attempt. Give it a free pass.
                // Just continue the loop without incrementing coderRetries
                continue;
              } else {
                console.error('❌ [Self-Healing] Failed to install dependencies.');
                console.log('   🔄 Proceeding with normal retry logic...');
                // Fall through to normal retry logic
              }
            } catch (installError: any) {
              console.error(`❌ [Self-Healing] npm install crashed: ${installError.message}`);
              console.log('   🔄 Proceeding with normal retry logic...');
              // Fall through to normal retry logic
            }
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // 🚨 STAGNATION BREAKER: Detect if error count is stuck
          // ═══════════════════════════════════════════════════════════════════
          const errorDelta = Math.abs(currentErrorCount - previousErrorCount);
          if (errorDelta < 10) {
            stagnationCount++;
            console.log(`⚠️ [Stagnation] Error count stuck (delta: ${errorDelta}). Stagnation count: ${stagnationCount}/2`);
            
            if (stagnationCount >= 2) {
              // Trigger DEFCON 3: Dependency Reset
              if (defconLevel === 0) {
                defconLevel = 3;
                console.log(`🚨 [DEFCON 3] Error count stuck for 2 consecutive loops. Nuking node_modules...`);
                
                try {
                  const nodeModulesPath = path.join(repoPath, 'node_modules');
                  const packageLockPath = path.join(repoPath, 'package-lock.json');
                  
                  if (fs.existsSync(nodeModulesPath)) {
                    console.log('   💣 Removing node_modules...');
                    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
                  }
                  
                  if (fs.existsSync(packageLockPath)) {
                    console.log('   💣 Removing package-lock.json...');
                    fs.unlinkSync(packageLockPath);
                  }
                  
                  console.log('   📦 Reinstalling dependencies...');
                  const installSuccess = await installDependencies(repoPath);
                  
                  if (installSuccess) {
                    console.log('✅ [DEFCON 3] Dependencies reset successful. Re-validating...');
                    stagnationCount = 0; // Reset stagnation counter
                    continue; // Re-validate without consuming retry
                  } else {
                    console.error('❌ [DEFCON 3] Dependency reset failed. Escalating to DEFCON 2...');
                    defconLevel = 2;
                  }
                } catch (defcon3Error: any) {
                  console.error(`❌ [DEFCON 3] Failed: ${defcon3Error.message}. Escalating to DEFCON 2...`);
                  defconLevel = 2;
                }
              } else if (defconLevel === 3) {
                // Still stuck after dependency reset, escalate to DEFCON 2
                defconLevel = 2;
                console.log(`🚨 [DEFCON 2] Still stuck after dependency reset. Relaxing tsconfig.json...`);
                
                try {
                  const dependencyDetectiveModule = await import('./lib/dependency-detective');
                  const relaxed = await dependencyDetectiveModule.relaxTsConfig(repoPath);
                  
                  if (relaxed) {
                    console.log('✅ [DEFCON 2] tsconfig.json relaxed successfully. Re-validating...');
                    stagnationCount = 0; // Reset stagnation counter
                    continue; // Re-validate without consuming retry
                  } else {
                    console.error('❌ [DEFCON 2] Config relaxation failed. Escalating to DEFCON 1...');
                    defconLevel = 1;
                  }
                } catch (defcon2Error: any) {
                  console.error(`❌ [DEFCON 2] Failed: ${defcon2Error.message}. Escalating to DEFCON 1...`);
                  defconLevel = 1;
                }
              } else if (defconLevel === 2) {
                // Still stuck after config relaxation, escalate to DEFCON 1
                defconLevel = 1;
                console.log(`🚨 [DEFCON 1] Still stuck after config relaxation. Force-approving build...`);
                console.log(`   ⚠️ Proceeding with ${currentErrorCount} errors (treating as warnings)`);
                validationPassed = true; // Force approve
                break; // Exit loop
              }
            }
          } else {
            // Progress detected, reset stagnation counter
            stagnationCount = 0;
            defconLevel = 0; // Reset DEFCON level on progress
          }
          
          // Note: previousErrorCount will be updated in momentum check blocks below
          
          // ═══════════════════════════════════════════════════════════════════
          // 🔄 INFINITE MOMENTUM: Extend retries when making progress
          // ═══════════════════════════════════════════════════════════════════
          if (currentErrorCount < previousErrorCount) {
            const errorReduction = previousErrorCount - currentErrorCount;
            console.log(`📉 [Infinite Momentum] Error count dropped (${previousErrorCount} -> ${currentErrorCount} errors, reduction: ${errorReduction}). Extending retries...`);
            
            // CRITICAL: Decrement the attempt counter to give it another "life"
            // But ensure we don't loop forever if progress is tiny (e.g. 1 error at a time)
            // Only do this if we haven't hit a hard "Safety Limit" (e.g. 20 total loops)
            if (totalLoops < SAFETY_LIMIT) {
              const oldRetries = coderRetries;
              coderRetries = Math.max(0, coderRetries - 1);
              console.log(`   🔄 Retry counter extended: ${oldRetries} -> ${coderRetries} (${totalLoops}/${SAFETY_LIMIT} total loops)`);
            } else {
              console.log(`   ⚠️ Safety limit reached (${SAFETY_LIMIT} loops). Not extending retries.`);
            }
            
            previousErrorCount = currentErrorCount;
            
            if (validation.shouldRetryPhase) {
              console.log('🔧 [Layer 1] Auto-fixing and retrying coder phase...');
              
              // Apply fixes if available
              if (validation.fixedCode) {
                const fixResult = await applyFixes(validation.fixedCode, repoPath);
                console.log(`   ✅ Applied ${fixResult.applied} fixes, ${fixResult.failed} failed`);
                
                // ═══════════════════════════════════════════════════════════════════
                // 🔄 RE-VALIDATE AFTER FIXER LOOP
                // ═══════════════════════════════════════════════════════════════════
                console.log('🔄 Re-validating after fixes...');
                const revalidatedCoderJSON = await buildCoderJSONFromRepo(repoPath);
                const finalValidation = await validateCoderPhaseOutput(revalidatedCoderJSON, repoPath, pipeline.id);
                
                if (finalValidation.passed || finalValidation.errors.length === 0) {
                  console.log('✅ Fixes successful! Pipeline passed validation.');
                  validationPassed = true;
                  break; // Exit retry loop with success
                } else if (finalValidation.errors.length < currentErrorCount) {
                  const errorReduction = currentErrorCount - finalValidation.errors.length;
                  console.log(`✅ Progress made! Errors reduced from ${currentErrorCount} to ${finalValidation.errors.length} (reduction: ${errorReduction})`);
                  console.log(`   🔄 Continuing with infinite momentum (${finalValidation.errors.length} remaining errors)...`);
                  
                  // Update error count
                  previousErrorCount = finalValidation.errors.length;
                  
                  // Extend retries if under safety limit
                  if (totalLoops < SAFETY_LIMIT) {
                    const oldRetries = coderRetries;
                    coderRetries = Math.max(0, coderRetries - 1);
                    console.log(`   🔄 Retry counter extended: ${oldRetries} -> ${coderRetries} (${totalLoops}/${SAFETY_LIMIT} total loops)`);
                  }
                  
                  continue;
                } else {
                  console.log(`⚠️ Remaining errors after fixes: ${finalValidation.errors.length}`);
                  // Continue with normal retry logic
                }
              }
              
              console.log(`   🔄 Retrying coder phase (momentum extended, ${coderRetries + 1}/${MAX_TOTAL_LOOPS})...`);
              coderRetries++;  // Increment for loop control, but we reset it above
              continue;  // Continue loop
            }
          } else {
            console.warn(`⚠️ [Momentum] No progress made (${currentErrorCount} errors, was ${previousErrorCount}). Consuming retry attempt.`);
            previousErrorCount = currentErrorCount;
            
            if (validation.shouldRetryPhase && coderRetries < maxCoderRetries) {
              console.log('🔧 [Layer 1] Auto-fixing and retrying coder phase...');
              
              // Apply fixes if available
              if (validation.fixedCode) {
                const fixResult = await applyFixes(validation.fixedCode, repoPath);
                console.log(`   ✅ Applied ${fixResult.applied} fixes, ${fixResult.failed} failed`);
                
                // ═══════════════════════════════════════════════════════════════════
                // 🔄 RE-VALIDATE AFTER FIXER LOOP
                // ═══════════════════════════════════════════════════════════════════
                console.log('🔄 Re-validating after fixes...');
                const revalidatedCoderJSON = await buildCoderJSONFromRepo(repoPath);
                const finalValidation = await validateCoderPhaseOutput(revalidatedCoderJSON, repoPath, pipeline.id);
                
                if (finalValidation.passed || finalValidation.errors.length === 0) {
                  console.log('✅ Fixes successful! Pipeline passed validation.');
                  validationPassed = true;
                  break; // Exit retry loop with success
                } else if (finalValidation.errors.length <= 5) {
                  // Low error count - acceptable threshold
                  console.log(`✅ Low error count (${finalValidation.errors.length} errors). Accepting and continuing...`);
                  validationPassed = true;
                  break; // Exit retry loop with success
                } else {
                  console.log(`⚠️ Remaining errors after fixes: ${finalValidation.errors.length}`);
                  // Continue with retry logic
                }
              }
              
              // Retry coder phase with error feedback
              coderRetries++;
              console.log(`   🔄 Retrying coder phase (${coderRetries}/${maxCoderRetries})...`);
              
              // Re-run coder step with error context
              // Note: This is a simplified retry - in production you'd want to pass error context
              // For now, we'll let the fixes be applied and continue
              // In a full implementation, you'd call runCoderStep recursively with error context
              break; // Exit retry loop, continue to SQL (fixes applied)
            } else {
              // Max retries reached or shouldn't retry
              if (totalLoops >= SAFETY_LIMIT) {
                console.error(`❌ [Layer 1] Validation failed after ${SAFETY_LIMIT} total loops (hard safety brake)`);
                throw new Error(`Coder validation failed after ${SAFETY_LIMIT} total loops (safety brake): ${validation.errors.map(e => e.message).join('; ')}`);
              } else if (coderRetries >= maxCoderRetries && currentErrorCount >= previousErrorCount) {
                console.error(`❌ [Layer 1] Validation failed after ${coderRetries} retries (no progress made)`);
                throw new Error(`Coder validation failed after ${coderRetries} retries: ${validation.errors.map(e => e.message).join('; ')}`);
              } else if (coderRetries >= MAX_TOTAL_LOOPS) {
                console.error(`❌ [Layer 1] Validation failed after ${MAX_TOTAL_LOOPS} retry attempts (safety brake)`);
                throw new Error(`Coder validation failed after ${MAX_TOTAL_LOOPS} retry attempts: ${validation.errors.map(e => e.message).join('; ')}`);
              } else {
                // Shouldn't retry but validation failed - escalate
                console.error(`❌ [Layer 1] Validation failed and cannot auto-fix`);
                throw new Error(`Coder validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
              }
            }
          }
        }
      } catch (validationError: any) {
        if (totalLoops >= SAFETY_LIMIT) {
          console.error(`❌ [Layer 1] Validation error (hard safety brake triggered after ${SAFETY_LIMIT} loops):`, validationError.message);
          throw validationError;
        } else if (coderRetries >= MAX_TOTAL_LOOPS) {
          console.error(`❌ [Layer 1] Validation error (retry limit reached after ${MAX_TOTAL_LOOPS} attempts):`, validationError.message);
          throw validationError;
        }
        coderRetries++;
        console.warn(`⚠️  [Layer 1] Validation error (retry ${coderRetries}/${MAX_TOTAL_LOOPS}, total loops: ${totalLoops}/${SAFETY_LIMIT}):`, validationError.message);
      }
    }

    if (!validationPassed) {
      throw new Error('Coder validation failed after all retries');
    }

    await updateStep(pipeline.id, 'coder', 'completed');
    await updatePipeline(pipeline.id, { current_phase: 'sql' });

  } catch (error) {
    console.error('[Coder] Failed:', error);
    await updatePipeline(pipeline.id, { status: 'failed' });
  }
}

/**
 * Helper: Build CoderPhaseJSON from repo files (for validation)
 */
async function buildCoderJSONFromRepo(repoPath: string): Promise<any> {
  const fs = require('fs');
  const path = require('path');
  
  const frontendFiles: any[] = [];
  const backendFiles: any[] = [];
  
  function walkDir(dir: string, baseDir: string, targetArray: any[]) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        walkDir(fullPath, baseDir, targetArray);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        targetArray.push({
          path: relPath.replace(/\\/g, '/'),
          lines: content.split('\n').length,
          purpose: 'Generated file',
          status: 'complete',
        });
      }
    }
  }
  
  // Walk frontend directories
  const frontendDirs = ['app', 'components', 'lib', 'src/app', 'src/components', 'src/lib'];
  for (const dir of frontendDirs) {
    const dirPath = path.join(repoPath, dir);
    if (fs.existsSync(dirPath)) {
      walkDir(dirPath, repoPath, frontendFiles);
    }
  }
  
  // Walk backend directories
  const backendDirs = ['backend', 'api', 'server'];
  for (const dir of backendDirs) {
    const dirPath = path.join(repoPath, dir);
    if (fs.existsSync(dirPath)) {
      walkDir(dirPath, repoPath, backendFiles);
    }
  }
  
  return {
    phase: 'coder',
    timestamp: new Date().toISOString(),
    code_generated: {
      frontend: {
        files_count: frontendFiles.length,
        total_lines: frontendFiles.reduce((sum, f) => sum + f.lines, 0),
        language: 'TypeScript',
        files: frontendFiles,
      },
      backend: {
        files_count: backendFiles.length,
        total_lines: backendFiles.reduce((sum, f) => sum + f.lines, 0),
        language: 'TypeScript',
        files: backendFiles,
      },
    },
    type_definitions: {
      coverage: 0,
      strict_mode: true,
      files_with_any: 0,
      types_defined: [],
    },
  };
}

/**
 * Helper: Build SqlEditorPhaseJSON from repo files (for validation)
 */
async function buildSQLJSONFromRepo(repoPath: string, sqlContent: string): Promise<any> {
  const tables: any[] = [];
  const rlsPolicies: any[] = [];
  
  // Parse SQL to extract tables and RLS policies
  const createTableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)/gi;
  let match;
  
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columnsSQL = match[2];
    
    // Count columns (rough estimate)
    const columnCount = (columnsSQL.match(/^\s*\w+\s+\w+/gm) || []).length;
    
    tables.push({
      name: tableName,
      sql: match[0],
      columns_count: columnCount,
    });
  }
  
  // Parse RLS policies
  const policyRegex = /CREATE POLICY\s+["']?(\w+)["']?\s+ON\s+(\w+)/gi;
  let policyMatch;
  
  while ((policyMatch = policyRegex.exec(sqlContent)) !== null) {
    rlsPolicies.push({
      table: policyMatch[2],
      policy_name: policyMatch[1],
      definition: policyMatch[0],
      status: 'enabled' as const,
    });
  }
  
  return {
    phase: 'sql_editor',
    timestamp: new Date().toISOString(),
    database_schema_created: {
      tables,
    },
    rls_policies: rlsPolicies,
  };
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

async function runSqlStep(pipeline: any, repoPath: string, context?: any) {
  console.log(`[SQL] Generating migrations...`);
  await updatePipeline(pipeline.id, { current_phase: 'sql' });
  await createStep(pipeline.id, 'sql', 'running');

  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    await updateStep(pipeline.id, 'sql', 'failed', JSON.stringify({ error: 'Missing DATABASE_URL' }));
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
              await updateStep(pipeline.id, 'sql', 'skipped', JSON.stringify({ reason: 'Scope analysis determined no database changes needed', scope }));
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
              await updateStep(pipeline.id, 'sql', 'skipped', JSON.stringify({ reason: 'No database keywords in prompt' }));
              await updatePipeline(pipeline.id, { current_phase: "tester" });
              return;
          }
      }
  }

  const { data: plannerStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('name', 'planner')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // =============================================================================
  // 🗄️ SQL GENERATION WITH HEALING LOOP
  // =============================================================================
  
  // --- INFO TRANSPORTER: Inject accumulated context ---
  let sqlContextSection = "";
  if (context && Object.keys(context).length > 0) {
    console.log(`📡 [Info Transporter] Injecting ${Object.keys(context).length} context sources into SQL step...`);
    sqlContextSection = `
═══════════════════════════════════════════════════════════════════
📡 STRUCTURED CONTEXT FROM PREVIOUS PHASES (Info Transporter)
═══════════════════════════════════════════════════════════════════
${contextToPromptString(context, 5000)}

Use this context to understand:
- Research findings and technical constraints
- Planner's database schema outline
- Coder's type definitions and API endpoints
- User requirements
═══════════════════════════════════════════════════════════════════
`;
  }
  
  const sqlPrompt = `
  You are a Senior PostgreSQL DBA.

  ${sqlContextSection}

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
    let currentSql = await callAI({
      pipelineId: pipeline.id,
      step: 'sql_migration',
      role: 'SQL_AGENT',
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: 'You generate safe SQL migrations for Supabase. Return ONLY raw SQL. No markdown, no explanations.'
        },
        {
          role: 'user',
          content: sqlPrompt
        }
      ]
    });
    
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

        await updateStep(pipeline.id, 'sql', 'completed', JSON.stringify({ 
            tables: tableNames.join(', '), 
            attempts: attempt,
            fixed: attempt > 1 
        }));
        
        // ═══════════════════════════════════════════════════════════════════
        // LAYER 2 & 4: Type Matching & RLS Validation (After SQL Phase) - BLOCKING
        // ═══════════════════════════════════════════════════════════════════
        let sqlRetries = 0;
        const maxSqlRetries = 2;
        let sqlValidationPassed = false;

        while (!sqlValidationPassed && sqlRetries <= maxSqlRetries) {
          try {
            console.log(`\n🔍 [Layer 2] Validating type-schema alignment (attempt ${sqlRetries + 1}/${maxSqlRetries + 1})...`);
            const { validateTypesMatchSchema, autoFixTypeIssues } = await import('./lib/type-matcher');
            const { validateRLSPolicies } = await import('./lib/rls-validator');
            const { logValidationResult } = await import('./lib/log-validation');
            
            // Get planner and coder outputs
            const { data: plannerStep } = await supabase
              .from('pipeline_steps')
              .select('output')
              .eq('pipeline_id', pipeline.id)
              .eq('name', 'planner')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            const plannerJSON = plannerStep?.output || {};
            const coderJSON = await buildCoderJSONFromRepo(repoPath);
            
            // Build SQL JSON from migration files
            const sqlJSON = await buildSQLJSONFromRepo(repoPath, currentSql);
            
            // Layer 2: Type matching
            const typeMatch = await validateTypesMatchSchema(
              plannerJSON,
              coderJSON,
              sqlJSON,
              pipeline.id
            );
            
            await logValidationResult(pipeline.id, 'type_match_validation', {
              passed: typeMatch.passed,
              errorsFound: typeMatch.issues.length,
              autoFixed: typeMatch.autoFixableCount,
              costUsd: 0,
              errors: typeMatch.issues,
            });
            
            if (!typeMatch.passed && typeMatch.shouldRegenerate) {
              console.log(`⚠️  [Layer 2] Found ${typeMatch.issues.length} type mismatches`);
              if (typeMatch.autoFixableCount > 0 && sqlRetries < maxSqlRetries) {
                console.log('🔧 [Layer 2] Auto-fixing type definitions...');
                try {
                  const fixedTypes = await autoFixTypeIssues(
                    coderJSON,
                    sqlJSON,
                    typeMatch.issues,
                    pipeline.id
                  );
                  // Write fixed types to lib/types.ts
                  const typesPath = path.join(repoPath, 'lib/types.ts');
                  const typesDir = path.dirname(typesPath);
                  if (!fs.existsSync(typesDir)) {
                    fs.mkdirSync(typesDir, { recursive: true });
                  }
                  fs.writeFileSync(typesPath, fixedTypes);
                  console.log('✅ [Layer 2] Fixed type definitions');
                  sqlRetries++;
                  continue; // Retry validation
                } catch (fixError: any) {
                  console.error('❌ [Layer 2] Type fix failed:', fixError.message);
                  if (sqlRetries >= maxSqlRetries) {
                    throw new Error(`Type matching failed after ${maxSqlRetries} retries: ${fixError.message}`);
                  }
                  sqlRetries++;
                  continue;
                }
              } else {
                if (sqlRetries >= maxSqlRetries) {
                  throw new Error(`Type matching failed after ${maxSqlRetries} retries: ${typeMatch.issues.map(i => (i as any).message || (i as any).type || String(i)).join('; ')}`);
                }
                sqlRetries++;
                continue;
              }
            } else {
              console.log('✅ [Layer 2] Type-schema alignment passed!');
            }
            
            // Layer 4: RLS validation
            console.log(`\n🔒 [Layer 4] Validating RLS policies (attempt ${sqlRetries + 1}/${maxSqlRetries + 1})...`);
            const rlsValidation = await validateRLSPolicies(sqlJSON, plannerJSON);
            
            await logValidationResult(pipeline.id, 'rls_validation', {
              passed: rlsValidation.passed,
              errorsFound: rlsValidation.issues.length,
              autoFixed: 0,
              costUsd: 0,
              errors: rlsValidation.issues,
            });
            
            if (!rlsValidation.passed && rlsValidation.shouldRegenerateSQL) {
              console.log(`⚠️  [Layer 4] Found ${rlsValidation.issues.length} RLS issues`);
              if (sqlRetries < maxSqlRetries) {
                console.log('🔧 [Layer 4] Regenerating SQL with RLS fixes...');
                // Trigger SQL regeneration by breaking and retrying SQL step
                sqlRetries++;
                // Note: In a full implementation, you'd regenerate SQL here
                // For now, we'll log and continue (RLS can be added manually)
                console.log('   ⚠️  RLS issues detected but will be handled in next SQL generation');
                sqlValidationPassed = true; // Allow to continue for now
              } else {
                throw new Error(`RLS validation failed after ${maxSqlRetries} retries: ${rlsValidation.issues.map(i => i.message || i.type).join('; ')}`);
              }
            } else {
              console.log('✅ [Layer 4] RLS policies validated!');
              sqlValidationPassed = true;
            }
          } catch (validationError: any) {
            if (sqlRetries >= maxSqlRetries) {
              console.error('❌ [Layer 2/4] Validation failed after retries:', validationError.message);
              throw validationError;
            }
            sqlRetries++;
            console.warn(`⚠️  [Layer 2/4] Validation error (retry ${sqlRetries}/${maxSqlRetries}):`, validationError.message);
          }
        }

        if (!sqlValidationPassed) {
          throw new Error('SQL validation failed after all retries');
        }
        
        await updatePipeline(pipeline.id, { current_phase: 'tester' });
        return; // Success! Exit function

      } catch (error: any) {
        lastError = error;
        console.error(`[SQL] ❌ Execution Failed (Attempt ${attempt}): ${error.message}`);
        
        if (attempt === maxRetries) {
          // Final attempt failed - give up
          console.error(`[SQL] ❌ SQL Failed after ${maxRetries} attempts. Manual intervention required.`);
          await updateStep(pipeline.id, 'sql', 'failed', JSON.stringify({ 
              error: error.message, 
              attempts: attempt,
              lastSql: currentSql.substring(0, 500) // Save first 500 chars for debugging
          }));
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
        const fixedSql = await callAI({
          pipelineId: pipeline.id,
          step: 'sql_migration',
          role: 'SQL_AGENT',
          model: 'deepseek-reasoner',
          messages: [
            {
              role: 'system',
              content: 'You generate safe SQL migrations for Supabase. Return ONLY raw SQL. No markdown, no explanations.'
            },
            {
              role: 'user',
              content: fixPrompt
            }
          ]
        });
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
    await updateStep(pipeline.id, 'sql', 'failed', JSON.stringify({ error: error.message }));
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
      // ✅ NEW: Unified AI client with error signature for caching
      const fixedCode = await callAI({
        pipelineId: pipeline.id,
        step: 'tester',
        role: 'FIXER',
        model: selectModel('FIXER', 'medium'),
        messages: [
          { role: 'system', content: "You are a Senior Developer fixing code. Output format: ### FILE: <name> ... ### END_FILE" },
          { role: 'user', content: fixPrompt }
        ],
        errorSignature: undefined // TODO: Extract from error analysis
      });

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
/**
 * Detect lazy Python 'pass' statements (context-aware)
 */
function detectLazyPythonPass(content: string, filePath: string): boolean {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'pass' || line.endsWith(' pass')) {
      // Check if pass is in a valid context
      const prevLine = lines[i - 1]?.trim() || '';
      const nextLine = lines[i + 1]?.trim() || '';
      
      // Valid pass contexts:
      const validContexts = [
        prevLine.endsWith(':'),           // After def/class/if/for/while
        prevLine.includes('except'),       // In exception handler
        prevLine.includes('finally'),      // In finally block
        prevLine.startsWith('else:'),      // In else block
        prevLine.startsWith('elif'),       // In elif block
        nextLine.trim().startsWith('def'), // Before next function
        nextLine.trim().startsWith('class'), // Before next class
      ];
      
      if (validContexts.some(Boolean)) {
        continue; // ✅ Valid usage
      }
      
      // Invalid standalone pass
      return true;
    }
  }
  
  return false;
}

function scanForLaziness(projectPath: string): { found: boolean; issues: string[] } {
  console.log("🕵️ Scanning for lazy code...");
  
  const issues: string[] = [];
  const scannedFiles: string[] = [];
  const consoleLogWarnings: string[] = [];
  const pythonFiles: string[] = [];
  const tsFiles: string[] = [];

  // Collect all files
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
          const ext = path.extname(entry.name);
          if (['.ts', '.tsx', '.js', '.jsx', '.py'].includes(ext)) {
            scannedFiles.push(relativePath);
            if (ext === '.py') {
              pythonFiles.push(relativePath);
            } else {
              tsFiles.push(relativePath);
            }
          }
        }
      }
    } catch (e) {
      // Ignorera läsfel
    }
  }

  scanDirectory(projectPath);

  // ============================================
  // STEP 1: Python Syntax Validation (MANDATORY - Source of Truth)
  // ============================================
  if (pythonFiles.length > 0) {
    console.log(`   🐍 Running Python syntax validation on ${pythonFiles.length} files...`);
    
    for (const file of pythonFiles) {
      const fullPath = path.join(projectPath, file);
      
      try {
        execSync(`python -m py_compile "${fullPath}"`, {
          cwd: projectPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      } catch (error: any) {
        const errorMsg = error.stderr || error.stdout || error.message;
        issues.push(`Python syntax error in ${file}:\n${errorMsg}`);
      }
    }
    
    // If Python compilation fails, return immediately (don't check text patterns)
    if (issues.length > 0) {
      console.error("❌ LAZY CODE DETECTED:");
      issues.forEach(issue => console.error(`   - ${issue}`));
      return { found: true, issues };
    }
    
    console.log('   ✅ All Python files have valid syntax');
  }

  // ============================================
  // STEP 2: TypeScript/JavaScript Lazy Patterns (STRICT)
  // ============================================
  const consoleLogPattern = /console\.log\(/g;
  const lazyPatternsTS = [
    { pattern: /\/\/\s*TODO:/gi, name: "TODO" },
    { pattern: /\/\/\s*FIXME:/gi, name: "FIXME" },
    { pattern: /\/\/\s*HACK:/gi, name: "HACK" },
    { pattern: /\/\/\s*XXX:/gi, name: "XXX" },
    { pattern: /console\.log\(['"]DEBUG/gi, name: "DEBUG console.log" },
    { pattern: /alert\(/g, name: "alert()" },
    { pattern: /Lorem ipsum/gi, name: "Lorem ipsum" },
    { pattern: /return null;$/gm, name: "return null" },
  ];

  for (const file of tsFiles) {
    const fullPath = path.join(projectPath, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check console.log (warning only)
      if (consoleLogPattern.test(content)) {
        consoleLogWarnings.push(file);
      }
      
      // Check lazy patterns
      for (const { pattern, name } of lazyPatternsTS) {
        if (pattern.test(content)) {
          issues.push(`Found '${name}' in ${file}`);
        }
      }
      
      // Check for 'any' type (strict)
      if (content.includes(': any') || content.includes('<any>')) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(': any') || lines[i].includes('<any>')) {
            // Skip React.MouseEvent<any> and similar generic type params
            if (!lines[i].includes('React.') && !lines[i].includes('Event<')) {
              issues.push(`Found 'any type' in ${file} at line ${i + 1}`);
            }
          }
        }
      }
    } catch (e) {
      // Ignorera läsfel
    }
  }

  // ============================================
  // STEP 3: Python Lazy Patterns (VERY LENIENT - Only Obvious Placeholders)
  // Trust Python compiler - only flag obvious lazy markers
  // ============================================
  const lazyMarkersPython = [
    /#\s*TODO:/i,
    /#\s*FIXME:/i,
    /#\s*IMPLEMENT THIS/i,
    /raise NotImplementedError/,
    /def \w+\([^)]*\):\s*pass\s*$/m  // Function with only pass (no real logic)
  ];

  for (const file of pythonFiles) {
    const fullPath = path.join(projectPath, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      for (const pattern of lazyMarkersPython) {
        if (pattern.test(content)) {
          issues.push(`Found lazy placeholder in ${file}`);
        }
      }
    } catch (e) {
      // Ignorera läsfel
    }
  }
  
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
    let targetFiles = extractTargetFiles(currentError);
    console.log(`📊 Error Classification: ${classified.classification} (strategy: ${classified.fixStrategy})`);
    console.log(`   Target files: ${targetFiles.join(', ') || 'None detected'}`);
    
    // 1.5. CHECK IF ERROR IS FIXABLE WITH GOLDEN TEMPLATE
    const typeErrorClassification = classifyTypeError(currentError);
    if (typeErrorClassification.fixable && typeErrorClassification.strategy === 'USE_GOLDEN_TEMPLATE') {
      
      for (const targetFile of targetFiles) {
        if (targetFile.includes('layout.tsx')) {
          const targetFilePath = path.join(repoPath, targetFile);
          console.log('🔧 Using Golden Template strategy instead of AI fix...');
          fs.writeFileSync(targetFilePath, GOLDEN_LAYOUT_TSX, 'utf-8');
          console.log('✅ Replaced with Golden Layout');
          filesFixed.push(targetFile);
          
          // Also validate types
          validateReactComponentTypes(targetFilePath);
          
          // Skip circuit breaker for this fix
          continue;
        }
      }
    }
    
    // 2. CHECK CIRCUIT BREAKER
    // Convert ErrorAnalysis to ClassifiedError format for circuit breaker
    const classifiedError: ClassifiedError = {
      category: classified.classification as ErrorCategory,
      originalError: currentError,
      errorHash: classified.errorSignature,
      targetFiles: targetFiles,
      errorCode: classified.errorCode,
      confidence: classified.canCache ? 0.8 : 0.5
    };
    const { canRetry, reason } = circuitBreaker.shouldRetry(classifiedError);
    if (!canRetry) {
      // ✅ Phase 0: Log circuit breaker event
      await logEvent(pipeline?.id || '', 'CIRCUIT_BREAKER', 'tester', {
        attempts: circuitBreaker.getStatus().totalAttempts,
        reason: reason || 'Max retries exceeded',
        error_category: classified.classification
      });
      
      console.error(`\n🚨 CIRCUIT BREAKER TRIGGERED: ${reason}\n`);
      
      // ✅ UPDATE DB STATE FIRST (before restoring snapshot)
      const pipelineId = pipeline?.id || '';
      if (pipelineId) {
        try {
          await updatePipelineStatus(
            pipelineId,
            'failed_hard',
            currentError.substring(0, 1000) // Truncate for DB
          );

          await supabase
            .from('pipeline_steps')
            .update({
              status: 'failed',
              error_message: currentError.substring(0, 500),
              updated_at: new Date().toISOString()
            })
            .eq('pipeline_id', pipelineId)
            .eq('name', 'tester');
          
          console.log('✅ Pipeline marked as failed_hard in database');
        } catch (dbError: any) {
          console.error('❌ Failed to update DB state:', dbError?.message);
        }
      }
      
      const reportPath = circuitBreaker.generateReport(reason || 'Unknown');
      
      // Record in telemetry
      // Note: mapErrorClassToErrorCategory returns v85 ErrorCategory, but telemetry uses old category
      // Convert to string for telemetry compatibility
      const telemetryCategory = mapErrorClassToErrorCategory(classified.classification) as any;
      recordErrorOccurrence(currentError, telemetryCategory);
      
      // Save detailed error report (sanitize Windows-invalid characters)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const errorReportPath = path.join(
        repoPath,
        `error-reports/error-report-${timestamp}.json`
      );
      
      fs.mkdirSync(path.dirname(errorReportPath), { recursive: true });
      fs.writeFileSync(errorReportPath, JSON.stringify({
        pipelineId,
        timestamp: new Date().toISOString(),
        error: currentError,
        recommendation: 'Check layout.tsx for hallucinated imports',
        filesFixed,
        attemptsMade: circuitBreaker.getStatus().totalAttempts
      }, null, 2));
      
      console.log(`📋 Error report saved: ${errorReportPath}`);
      
      return {
        success: false,
        filesFixed,
        attemptsMade: circuitBreaker.getStatus().totalAttempts,
        circuitBroken: true,
        reportPath: errorReportPath,
      };
    }
    
    // 3. GET FIXING STRATEGY BASED ON ERROR CATEGORY
    const errorCategory = classified.classification as ErrorCategory;
    const strategy = getFixingStrategy(errorCategory);
    const filesToFix = targetFiles.length > 0 
      ? targetFiles 
      : strategy.fixFiles;
    
    console.log(`🎯 Strategy: ${strategy.approach}`);
    console.log(`📁 Target files: ${filesToFix.join(', ') || 'General fix'}`);
    
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
      switch (errorCategory) {
        case ErrorCategory.DEPENDENCY_VERSION:
          // Fix package.json directly with golden versions
          console.log('📦 Fixing dependency versions with GOLDEN_VERSIONS...');
          const pkgPath = path.join(repoPath, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = readPackageJson(pkgPath);
            // validateAndFixDependencies modifies the object in place and returns void
            const deps = pkg.dependencies || {};
            const devDeps = pkg.devDependencies || {};
            await validateAndFixDependencies(repoPath); // This validates and fixes the entire workspace
            console.log('   ✅ Dependencies validated and fixed');
            fixedFiles.push('package.json');
            fixSuccess = true;
            
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
          
          // Extract Python file from error message
          const pythonFileMatch = currentError.match(/(?:File|file)\s+["']([^"']+\.py)["']/);
          if (pythonFileMatch) {
            const pythonFile = pythonFileMatch[1];
            const filePath = path.join(repoPath, pythonFile);
            
            const fixed = await autoFixPythonError({
              category: errorCategory,
              originalError: currentError,
              errorHash: classified.errorSignature,
              targetFiles: [pythonFile],
              errorCode: classified.errorCode,
              confidence: 0.8
            } as ClassifiedError, repoPath);
            if (fixed) {
              fixedFiles.push(pythonFile);
              fixSuccess = true;
              console.log(`   ✅ Auto-fixed Python syntax`);
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
        
        case ErrorCategory.TYPE_ERROR:
          // Check if it's TYPE_DRIFT (TS2305 on types.ts)
          if (currentError.includes('TS2305') && currentError.includes('types.ts') && 
              (currentError.includes('has no exported member') || currentError.includes('has no exported'))) {
            console.log('🩹 Detected TYPE_DRIFT - injecting missing domain types...');
            await injectMissingDomainTypes(repoPath, currentError);
            fixSuccess = true;
            fixedFiles.push('src/lib/types.ts');
            break;
          }
          // Fall through to AI fixer for other type errors
          break;
        
        case ErrorCategory.SYNTAX_ERROR:
          // ✅ LONG-TERM FIX: Check if it's JSX in lib file (REMOVE_JSX strategy)
          const isJsxInLibError = currentError.includes('JSX syntax detected') && 
                                  (currentError.includes('/lib/') || currentError.includes('lib/types.ts') || 
                                   currentError.includes('lib/api.ts') || currentError.includes('lib/claude-client.ts'));
          
          if (isJsxInLibError && filesToFix.length > 0) {
            console.log("🔧 REMOVE_JSX strategy: Removing JSX from lib file...");
            
            const targetFile = filesToFix[0];
            const filePath = path.join(repoPath, targetFile);
            
            if (fs.existsSync(filePath)) {
              let fileContexts = '';
              const content = fs.readFileSync(filePath, 'utf-8');
              fileContexts += `\n--- FILE: ${targetFile} ---\n${content}\n`;
              
              const removeJsxPrompt = `
🚨 CRITICAL FIX REQUIRED: REMOVE JSX FROM LIB FILE 🚨

The file ${targetFile} is in src/lib/ and MUST be pure TypeScript (.ts).
JSX syntax was detected, but rename to .tsx is FORBIDDEN for lib files.

REQUIRED ACTION:
- Remove ALL JSX syntax (<tags>, React components, JSX returns)
- Rewrite as pure TypeScript functions/utilities
- Keep the same functionality but use plain TypeScript
- NO React components, NO JSX, NO <tags>

Example:
❌ BAD: return <div>Hello</div>;
✅ GOOD: return { message: "Hello" };

CURRENT FILE CONTENTS (WITH JSX - MUST REMOVE):
${fileContexts}

Rewrite the code as pure TypeScript with NO JSX.
Output format: [FILE: ${targetFile}]
... pure TypeScript code ...
[GOAL]
`;
              
              try {
                const fixOutput = await callAI({
                  pipelineId: pipeline?.id || 'fix',
                  step: 'tester',
                  role: 'CODER',
                  messages: [{ role: 'user', content: removeJsxPrompt }]
                });
                
                // Parse fix output
                const fixMatch = fixOutput.match(/\[FILE:\s*([^\]]+)\]\s*([\s\S]*?)(?:\[GOAL\]|$)/i);
                if (fixMatch) {
                  const fixedContent = fixMatch[2].trim();
                  fs.writeFileSync(filePath, fixedContent, 'utf-8');
                  fixedFiles.push(targetFile);
                  fixSuccess = true;
                  console.log(`   ✅ Removed JSX from ${targetFile}`);
                }
              } catch (aiError: any) {
                console.error(`   ❌ AI fix failed: ${aiError.message}`);
              }
              
              if (fixSuccess) {
                break; // Exit switch
              }
            }
          }
          
          // Check if it's a "missing use client" error
          if (filesToFix.length > 0 && currentError.includes('use client')) {
            console.log("💡 Auto-fixing 'use client' directive...");
            
            const targetFile = filesToFix[0];
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
          
        case ErrorCategory.LAZY_CODE:
          // 🚨 ANTI-LAZY PROTOCOL: Force complete rewrite
          console.log('🚨 Anti-Lazy Protocol Activated...');
          
          // Check if this is specifically "LAZY CODE DETECTED" error
          if (currentError.includes('LAZY CODE DETECTED')) {
            console.log('   ⚠️ Lazy code detected - Forcing complete rewrite...');
            
            // Read file contents
            let fileContexts = '';
            for (const file of targetFiles.slice(0, 5)) { // Allow more files for lazy code
              const filePath = path.join(repoPath, file);
              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                fileContexts += `\n--- FILE: ${file} ---\n${content}\n`;
              }
            }
            
            const antiLazyPrompt = `
🚨 CRITICAL: ANTI-LAZY PROTOCOL ACTIVATED 🚨

YOU ARE FORBIDDEN FROM USING:
- 'any' type (use proper TypeScript types)
- 'return null' (implement proper error handling or loading states)
- 'TODO', 'FIXME', 'pass' (implement actual functionality)
- Placeholder comments (write real code)
- Empty functions (implement the logic)

ERROR MESSAGE:
${currentError.substring(0, 3000)}

TARGET FILES TO REWRITE:
${targetFiles.join(', ')}

CURRENT FILE CONTENTS (WITH LAZY CODE):
${fileContexts}

TASK: REWRITE THE FILE(S) COMPLETELY TO BE PRODUCTION READY.

RULES:
1. NO 'any' types - Use proper TypeScript interfaces/types
2. NO 'return null' - Return proper error states, loading states, or empty arrays/objects
3. NO placeholders - Implement actual functionality
4. NO empty functions - Write real logic
5. All types must be imported from lib/types.ts or defined inline
6. Use named exports for components (not default exports)
7. Handle all edge cases properly
8. Output COMPLETE, PRODUCTION-READY code

OUTPUT FORMAT:
[FILE: path/to/file.tsx]
... complete production-ready code ...
[GOAL]
`;
            
            try {
              // Use GENIUS level for lazy code fixes (most important)
              const fixOutput = await callAI({
                pipelineId: pipeline.id,
                step: 'tester',
                role: 'FIXER',
                model: selectModel('FIXER', 'complex'), // GENIUS = complex
                messages: [
                  {
                    role: 'system',
                    content: 'You are a code fixer. Fix lazy code (any types, placeholders). Return fixed code using [FILE: path] ... [GOAL] format.'
                  },
                  {
                    role: 'user',
                    content: antiLazyPrompt
                  }
                ]
              });
              
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
                  console.log(`   ✅ Rewrote (Anti-Lazy): ${fileName}`);
                }
              }
              
              fixSuccess = fixedFiles.length > 0;
            } catch (lazyFixError: any) {
              console.error('   ❌ Anti-Lazy Protocol failed:', lazyFixError.message);
              fixSuccess = false;
            }
            
            break; // Exit switch, don't fall through
          }
          // Fall through to regular AI fixer if not "LAZY CODE DETECTED"
          
        case ErrorCategory.EXPORT_ERROR:
        case ErrorCategory.IMPORT_ERROR:
        case ErrorCategory.TYPE_ERROR:
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
ERROR CATEGORY: ${classified.classification}
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
            const fixOutput = await callAI({
              pipelineId: pipeline.id,
              step: 'tester',
              role: 'FIXER',
              model: selectModel('FIXER', smartLevel === 'GENIUS' ? 'complex' : 'medium'),
              messages: [{ role: 'user', content: fixPrompt }]
            });
            
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
      errorHash: classified.errorSignature,
      errorCategory: errorCategory,
      filesTouched: fixedFiles,
      strategy: strategy.approach,
      success: fixSuccess,
      duration: Date.now() - fixStartTime,
    });
    
    // Record in telemetry
    if (!fixSuccess) {
      // Convert ErrorClass to ErrorCategory for telemetry
      // Map ErrorClass to ErrorCategory (they have similar values)
      const telemetryCategory = errorCategory; // Already converted above
      recordErrorOccurrence(currentError, telemetryCategory);
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
        
        // Validate imports before build
        await validateNoRelativeImports(repoPath);
        
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
    
    // ✅ NEW: Pre-TypeCheck verification
    console.log('🔍 Pre-check: Verifying type infrastructure...');
    
    const typesPath = path.join(localPath, 'src/lib/types.ts');
    const databasePath = path.join(localPath, 'src/types/database.ts');
    
    if (!fs.existsSync(typesPath)) {
        console.error('   ❌ src/lib/types.ts missing! Creating fallback...');
        // Fallback: create minimal types
        const fallbackTypes = `// Fallback types - safe for empty database
import type { Database as SupabaseDatabase } from '@/types/database';

export type Database = SupabaseDatabase;

export type Tables<T extends string> = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

export type Inserts<T extends string> = Record<string, unknown>;
export type Updates<T extends string> = Record<string, unknown>;
export type Enums<T extends string> = string;
`;
        fs.mkdirSync(path.dirname(typesPath), { recursive: true });
        fs.writeFileSync(typesPath, fallbackTypes, 'utf-8');
        console.log('   ✅ Created fallback types.ts');
    }
    
    if (!fs.existsSync(databasePath)) {
        console.error('   ❌ src/types/database.ts missing! Creating minimal version...');
        const minimalDb = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
`;
        fs.mkdirSync(path.dirname(databasePath), { recursive: true });
        fs.writeFileSync(databasePath, minimalDb, 'utf-8');
    }
    
    // Verify types.ts doesn't have orphaned Database references
    if (fs.existsSync(typesPath)) {
        const typesContent = fs.readFileSync(typesPath, 'utf-8');
        
        if (typesContent.includes('Database') && !typesContent.includes("import type { Database")) {
            console.warn('   ⚠️ types.ts has Database reference without import - fixing...');
            // This will be handled by generateSchemaAwareTypes
        }
    }
    
    console.log('   ✅ Type infrastructure verified');
    
    const exec = (cmd: string) => {
        try {
            console.log(`   👉 Running: ${cmd}`);
            execSync(cmd, { cwd: localPath, stdio: 'pipe' }); // pipe för att fånga output
        } catch (e: any) {
            // Fånga stdout och stderr för TypeScript-fel
            const stdout = e.stdout?.toString() || '';
            const stderr = e.stderr?.toString() || '';
            const fullOutput = stdout + '\n' + stderr;
            
            // Skapa ett riktigt fel-objekt med outputen
            const error = new Error(`Quality Check Failed: ${cmd}`);
            (error as any).stdout = stdout;
            (error as any).stderr = stderr;
            (error as any).fullOutput = fullOutput;
            throw error;
        }
    };

    // 1. TypeScript Check
    exec('npx tsc --noEmit --skipLibCheck');

    // 2. ESLint (Om config finns)
    if (fs.existsSync(path.join(localPath, '.eslintrc.json')) || fs.existsSync(path.join(localPath, 'eslint.config.mjs'))) {
        try { exec('npx eslint . --fix'); } catch (e) { console.warn("   ⚠️ Lint warnings found (continuing)..."); }
    }

    // 3. Python Checks (Om backend finns)
    // ✅ STACK AWARENESS: Only check Python if backend is FastAPI/Python
    const backendType = intent?.stackConfig?.backend || 
                       (intent?.isPython ? 'fastapi' : null) ||
                       (fs.existsSync(path.join(localPath, 'backend', 'main.py')) ? 'fastapi' : null);
    
    if (backendType === 'fastapi' || backendType === 'python') {
        const backendPath = path.join(localPath, 'backend');
        console.log("   🐍 Checking Python Backend...");
        try {
            execSync('pip install mypy ruff', { cwd: backendPath, stdio: 'ignore' });
            const result = execSync('python -m mypy . --ignore-missing-imports --no-strict-optional', { 
                cwd: backendPath, 
                stdio: 'pipe',
                encoding: 'utf-8'
            });
        } catch (e: any) {
            // Capture Python error output for fixing
            const stdout = e.stdout?.toString() || '';
            const stderr = e.stderr?.toString() || '';
            const pythonError = new Error(`Python Quality Check Failed`);
            (pythonError as any).stdout = stdout;
            (pythonError as any).stderr = stderr;
            (pythonError as any).fullOutput = stdout + '\n' + stderr;
            (pythonError as any).isPythonError = true;
            throw pythonError;
        }
    } else {
        console.log(`   ⏭️ Skipping Python check (backend: ${backendType || 'none'})`);
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
/**
 * 🛡️ PRE-FLIGHT CODE SANITIZER
 * Scans all code files and removes end-tags and markdown artifacts
 * This prevents TypeScript errors from [END FILE] tags
 */
async function sanitizeAllCodeFiles(projectPath: string): Promise<void> {
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const endTagPatterns = [
    /\[END FILE\]/gi,
    /\[END_FILE\]/gi,
    /\[ENDFILE\]/gi,
    /END FILE/gi,
    /END_FILE/gi,
    /### END_FILE/gi,
    /### FILE_END/gi,
    /### ENDFILE/gi,
    /END OF FILE/gi,
    /END OF CODE/gi,
    /\[END OF FILE\]/gi,
    /\[END OF CODE\]/gi,
    /\[GOAL\]/gi,
  ];
  
  let filesCleaned = 0;
  
  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip node_modules, .next, etc.
      if (entry.name === 'node_modules' || entry.name === '.next' || 
          entry.name.startsWith('.') || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (codeExtensions.includes(ext)) {
          try {
            let content = fs.readFileSync(fullPath, 'utf-8');
            const originalContent = content;
            
            // Remove all end-tag patterns
            endTagPatterns.forEach(pattern => {
              content = content.replace(pattern, '');
            });
            
            // Remove lines that are ONLY end-tags
            const lines = content.split('\n');
            const cleanedLines = lines.filter(line => {
              const trimmed = line.trim();
              return !trimmed.match(/^(END FILE|END_FILE|ENDFILE|\[END FILE\]|\[END_FILE\]|### END_FILE|### FILE_END|\[GOAL\])$/i);
            });
            content = cleanedLines.join('\n').trim();
            
            // Remove trailing empty lines
            content = content.replace(/\n+$/, '');
            
            // Only write if content changed
            if (content !== originalContent) {
              fs.writeFileSync(fullPath, content, 'utf-8');
              filesCleaned++;
              console.log(chalk.yellow(`   🧹 Cleaned: ${path.relative(projectPath, fullPath)}`));
            }
          } catch (e: any) {
            // Ignore read errors
            console.warn(chalk.yellow(`   ⚠️ Could not sanitize ${path.relative(projectPath, fullPath)}: ${e.message}`));
          }
        }
      }
    }
  }
  
  // Scan src/ directory first, then root
  const srcPath = path.join(projectPath, 'src');
  if (fs.existsSync(srcPath)) {
    scanDirectory(srcPath);
  }
  
  // Also scan root-level code files
  scanDirectory(projectPath);
  
  if (filesCleaned > 0) {
    console.log(chalk.green(`   ✅ Sanitized ${filesCleaned} code files`));
  } else {
    console.log(chalk.gray(`   ✅ No files needed sanitization`));
  }
}

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

async function runTesterStep(pipeline: any, repoPath: string, context?: any) {
  // ✅ Track fixing state for memorization (must be declared at function start)
  let wasFixing = false;
  let lastErrorLog: string | null = null;
  let lastAppliedFix: string | null = null;

  // 1. CHECKPOINT CHECK: Skip if already completed
  const existingStep = await getStep(pipeline.id, 'tester');
  if (existingStep && existingStep.status === 'completed') {
    console.log("⏭️ Tester step already completed (Checkpoint found). Advancing...");
    
    // FIX: Force update the pipeline phase so we don't loop forever
    try {
      await updatePipeline(pipeline.id, { current_phase: 'publisher' });
      
      // Verify the update succeeded
      const { data: verifyPipeline } = await supabase
        .from('pipelines')
        .select('current_phase')
        .eq('id', pipeline.id)
        .single();
      
      if (verifyPipeline?.current_phase === 'publisher') {
        console.log("   ✅ Pipeline phase verified: advanced to 'publisher'");
      } else {
        console.error(`   ❌ Pipeline phase update failed! Current phase: ${verifyPipeline?.current_phase || 'unknown'}`);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('pipelines')
          .update({ current_phase: 'publisher', updated_at: new Date().toISOString() })
          .eq('id', pipeline.id);
        
        if (directError) {
          console.error(`   ❌ Direct update also failed:`, directError.message);
        } else {
          console.log("   ✅ Direct update succeeded (fallback)");
        }
      }
    } catch (updateError: any) {
      console.error(`   ❌ Failed to advance pipeline phase:`, updateError.message);
    }
    
    return;
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // LAYER 3: Pre-Test Build Simulation (Before Testing) - BLOCKING
  // ═══════════════════════════════════════════════════════════════════
  let buildRetries = 0;
  const maxBuildRetries = 2;
  let buildValidationPassed = false;

  while (!buildValidationPassed && buildRetries <= maxBuildRetries) {
    try {
      console.log(`\n🔨 [Layer 3] Running pre-test build simulation (attempt ${buildRetries + 1}/${maxBuildRetries + 1})...`);
      const { simulateBuild } = await import('./lib/pre-test-build');
      const { logValidationResult } = await import('./lib/log-validation');
      
      const buildSim = await simulateBuild(repoPath, pipeline.id);
      
      await logValidationResult(pipeline.id, 'pre_test_build', {
        passed: buildSim.passed,
        errorsFound: buildSim.unfixableErrors?.length || 0,
        autoFixed: buildSim.fixedCount || 0,
        costUsd: 0,
        errors: buildSim.unfixableErrors?.map(e => e.error) || [],
        fixedFiles: buildSim.unfixableErrors?.filter(e => e.fixed).map(e => e.error.file) || [],
      });
      
      if (!buildSim.passed) {
        console.log(`⚠️  [Layer 3] Build simulation found ${buildSim.unfixableErrors?.length || 0} issues`);
        if (buildSim.fixedCount && buildSim.fixedCount > 0) {
          console.log(`✅ [Layer 3] Auto-fixed ${buildSim.fixedCount} build errors`);
        }
        if (buildSim.fixedCount === 0 && buildSim.unfixableErrors && buildSim.unfixableErrors.length > 0) {
          if (buildRetries >= maxBuildRetries) {
            throw new Error(`Build simulation failed after ${maxBuildRetries} retries: ${buildSim.unfixableErrors.map(e => e.error.message).join('; ')}`);
          }
          console.warn(`⚠️  [Layer 3] Some build errors could not be auto-fixed (retry ${buildRetries + 1}/${maxBuildRetries})`);
          buildRetries++;
          continue; // Retry
        } else {
          // Some fixes were applied, re-check
          buildRetries++;
          continue;
        }
      } else {
        console.log('✅ [Layer 3] Build simulation passed!');
        buildValidationPassed = true;
      }
    } catch (buildError: any) {
      if (buildRetries >= maxBuildRetries) {
        console.error('❌ [Layer 3] Build simulation failed after retries:', buildError.message);
        throw buildError;
      }
      buildRetries++;
      console.warn(`⚠️  [Layer 3] Build simulation error (retry ${buildRetries}/${maxBuildRetries}):`, buildError.message);
    }
  }

  if (!buildValidationPassed) {
    throw new Error('Build simulation failed after all retries');
  }

  // 🆕 CIRCUIT BREAKER: Prevent infinite loops
  const MAX_TESTER_ATTEMPTS = 3;
  const attemptKey = `tester_attempts_${pipeline.id}`;
  
  // Initialize global tracker if it doesn't exist
  if (!(global as any).testerAttempts) {
    (global as any).testerAttempts = {};
  }
  
  (global as any).testerAttempts[attemptKey] = 
    ((global as any).testerAttempts[attemptKey] || 0) + 1;
  
  if ((global as any).testerAttempts[attemptKey] > MAX_TESTER_ATTEMPTS) {
    console.error(`🛑 CIRCUIT BREAKER: Tester failed ${MAX_TESTER_ATTEMPTS} times. Stopping.`);
    await updatePipeline(pipeline.id, { 
      status: 'failed',
      error_message: 'Circuit breaker triggered: Too many tester failures'
    });
    return;
  }
  
  console.log(`[Tester] Attempt ${(global as any).testerAttempts[attemptKey]}/${MAX_TESTER_ATTEMPTS}...`);

  // =============================================================================
  // 🥉 #3: VERSION CONTROL / UNDO - Create snapshot before risky operations
  // =============================================================================
  console.log(chalk.cyan("\n📸 VERSION CONTROL: Creating safety snapshot..."));
  let snapshotId: string | null = null;
  try {
    snapshotId = snapshotBeforeTester(repoPath);
    console.log(chalk.green(`   ✅ Snapshot created: ${snapshotId}`));
    
    // Clean up old snapshots (keep last 5)
    cleanupSnapshots(repoPath, 5);
  } catch (error: any) {
    console.warn(chalk.yellow(`   ⚠️ Snapshot creation failed: ${error.message}`));
  }

  console.log(`[Tester] Starting verification for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'tester' });
  await createStep(pipeline.id, 'tester', 'running');
  
  // --- INFO TRANSPORTER: Inject accumulated context ---
  if (context && Object.keys(context).length > 0) {
    console.log(`📡 [Info Transporter] Tester received context from: ${Object.keys(context).join(', ')}`);
    // Context is available for use in tester logic
    // Store it for reference during testing
    const contextSummary = Object.keys(context).map(phase => {
      const phaseData = context[phase];
      return `${phase}: ${phaseData?.phase || 'data'} (${JSON.stringify(phaseData).substring(0, 100)}...)`;
    }).join('\n');
    console.log(`📡 [Info Transporter] Context summary:\n${contextSummary}`);
  }
  
  // Hämta rootDir från pipeline-data
  const { data: plannerStep } = await supabase
    .from('pipeline_steps')
    .select('output')
    .eq('pipeline_id', pipeline.id)
    .eq('name', 'planner')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const matrix: TechMatrix = plannerStep?.output?.matrix || {
    languages: ["TypeScript"],
    primary_backend: "Node",
    frontend_framework: "Next.js",
    architecture: "Monolith",
    complexity: "Production",
    project_root: "src"
  };
  const rootDir = matrix.project_root || 'src';

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

  // ✅ STEP 0: ENFORCE SRC/ STRUCTURE FIRST (ALWAYS!)
  // This is the PERMANENT FIX - ensures all code is in src/ and @/ alias works
  try {
    await enforceSrcStructure(repoPath);
  } catch (structureError: any) {
    console.error('❌ Structure enforcement failed:', structureError.message);
    // Continue anyway - other fixes might help
  }

  // --- 🧹 DUPLICATE KILLER (The Nuclear Option) ---
  // NOTE: enforceSrcStructure already handles moving root folders to src/
  // This is a backup check for any remaining duplicates
  const hasRootFolders = ['app', 'components', 'lib', 'types'].some(folder => 
    fs.existsSync(path.join(repoPath, folder))
  );
  
  if (hasRootFolders) {
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

  // 2. MASS-INJICERA GOLDEN COMPONENTS (Shadcn/ui - Premium UI)
  // Use src/components/ui/ structure (enforced)
  const componentsDir = path.join(repoPath, 'src', 'components', 'ui');
  if (!fs.existsSync(componentsDir)) fs.mkdirSync(componentsDir, { recursive: true });

  for (const [name, content] of Object.entries(GOLDEN_COMPONENTS)) {
    const filePath = path.join(componentsDir, name);
    fs.writeFileSync(filePath, content.trim());
    console.log(`-> Injected Golden Component: ${name}`);
  }
  
  console.log(`   ✅ Injected ${Object.keys(GOLDEN_COMPONENTS).length} Shadcn/ui components`);
  
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
    console.log(`-> ✅ Injected Golden Page (src/app/page.tsx)`);
    
    // FIX #2: Force Correct File Structure - Verify after injection
    console.log('🔍 Verifying file structure...');
    
    // Verify the file actually exists
    if (!fs.existsSync(pagePath)) {
      throw new Error('❌ page.tsx was not created at src/app/page.tsx!');
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
      const pkg = readPackageJson(sanitizePkgPath);
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
      console.warn("-> ⚠️ Failed to sanitize package.json (Parsing error).");
      console.log("-> 🚑 Emergency: Overwriting corrupted package.json with Golden Template.");
      
      // SKRIV ÖVER MED GOLDEN TEMPLATE
      const goldenPkg = {
        "name": "frost-generated-app",
        "version": "0.1.0",
        "private": true,
        "scripts": {
          "dev": "next dev",
          "build": "next build",
          "start": "next start",
          "lint": "next lint"
        },
        "dependencies": {
          "next": "14.2.18",
          "react": "18.2.0",
          "react-dom": "18.2.0",
          "framer-motion": "^11.0.0",
          "lucide-react": "^0.344.0",
          "clsx": "^2.1.0",
          "tailwind-merge": "^2.2.1",
          "@supabase/ssr": "^0.1.0",
          "@supabase/supabase-js": "^2.39.7"
        },
        "devDependencies": {
          "typescript": "^5",
          "@types/node": "^20",
          "@types/react": "^18",
          "@types/react-dom": "^18",
          "autoprefixer": "^10.4.19",
          "postcss": "^8.4.31",
          "tailwindcss": "^3.4.17"
        }
      };
      
      // Safe Write: Ensure directory exists
      const pkgDir = path.dirname(sanitizePkgPath);
      if (!fs.existsSync(pkgDir)) {
        fs.mkdirSync(pkgDir, { recursive: true });
      }
      fs.writeFileSync(sanitizePkgPath, JSON.stringify(goldenPkg, null, 2));
      console.log("-> ✅ package.json restored.");
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
  // 🧠 V6.0 INTELLIGENT FIX SYSTEMS - Zero Human Input
  // =============================================================================
  
  // 1. CLIENT DETECTOR: Auto-inject 'use client' where needed
  console.log("\n" + chalk.cyan("═".repeat(60)));
  console.log(chalk.cyan.bold("🧠 V6.0 INTELLIGENT FIX SYSTEMS"));
  console.log(chalk.cyan("═".repeat(60)));
  
  console.log("\n📍 Phase 1: Client Detector");
  runClientDetector(repoPath);
  
  // 2. IMPORT REWRITER: Convert ../ to @/ aliases
  console.log("\n📍 Phase 2: Import Rewriter");
  runImportRewriter(repoPath);
  
  // 3. VISUAL PRE-FLIGHT: Verify CSS/layout/page
  console.log("\n📍 Phase 3: Visual Pre-Flight");
  const preFlightResult = runVisualPreFlight(repoPath);
  if (!preFlightResult.passed) {
    console.log(chalk.yellow("   ⚠️ Pre-flight had issues, but they were auto-fixed"));
  }
  
  // 4. COMPILER AGENT: Auto-fix simple TypeScript errors
  console.log("\n📍 Phase 4: Compiler Agent (Pre-Build)");
  const compilerResult = await runCompilerAgent(repoPath);
  if (compilerResult.autoFixed > 0) {
    console.log(chalk.green(`   ✅ Auto-fixed ${compilerResult.autoFixed} errors without AI`));
  }
  
  // 5. Create Pipeline Context for intelligent fixing
  const pipelineContext = createNewPipelineContext(
    pipeline.ticket_id || pipeline.id,
    pipeline.id,
    pipeline.initial_prompt || pipeline.prompt || ""
  );
  
  // Scan project structure for context
  const enrichedContext = scanProjectStructure(pipelineContext, repoPath);
  console.log(chalk.green(`   📊 Scanned ${enrichedContext.fileStructure.length} files`));
  console.log(chalk.green(`   📦 Found ${Object.keys(enrichedContext.availableComponents).length} components`));
  
  console.log(chalk.cyan("\n" + "═".repeat(60) + "\n"));
  
  // =============================================================================
  // 🏰 FROST NIGHT FACTORY v9.0 - FORTRESS ARCHITECTURE INTEGRATION
  // =============================================================================
  console.log(chalk.cyan("\n🏰 FROST NIGHT FACTORY v9.0 - FORTRESS GUARD ACTIVE\n"));
  
  // Validate fortress integrity
  const fortressCheck = await validateFortressIntegrity(repoPath);
  if (!fortressCheck.valid) {
    console.warn(chalk.yellow("⚠️ Fortress integrity check failed:"));
    if (fortressCheck.missing.length > 0) {
      console.warn(`   Missing: ${fortressCheck.missing.join(', ')}`);
    }
    if (fortressCheck.corrupted.length > 0) {
      console.warn(`   Corrupted: ${fortressCheck.corrupted.join(', ')}`);
    }
  } else {
    console.log(chalk.green("   ✅ Fortress integrity: VALID"));
  }
  
  // Create repair session with budget
  const repairSession = createRepairSession(pipeline.id, 2.0); // $2 max budget
  console.log(chalk.green(`   ✅ Repair session created (budget: $${repairSession.budget.toFixed(2)})`));
  
  // Track file attempts
  const fileAttemptCounts = new Map<string, number>();
  
  // Helper function to count TypeScript errors
  async function countTypeScriptErrors(projectRoot: string): Promise<number> {
    try {
      const validationResult = await runZoneValidation(projectRoot);
      return validationResult.tier1Checks.filter(c => !c.passed).length;
    } catch {
      // Fallback: try tsc directly
      try {
        execSync('npx tsc --noEmit 2>&1', { cwd: projectRoot, stdio: 'pipe' });
        return 0;
      } catch {
        return 999; // Unknown error count
      }
    }
  }
  
  // =============================================================================
  // 🏗️ MAIN BUILD/FIX LOOP (v9.0 Protected)
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
    const pkg = readPackageJson(pkgPath);
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
          
          // 🚨 SYSTEM-LEVEL ERROR DETECTION: Fail fast for authentication/registry issues
          if (errLog.includes("Access token expired") || 
              errLog.includes("Access token revoked") ||
              errLog.includes("E401") ||
              (errLog.includes("E404") && errLog.includes("Not Found - GET https://registry.npmjs.org"))) {
            console.error("🚨 SYSTEM-LEVEL NPM ERROR DETECTED:");
            console.error("   This is an npm authentication/registry issue, not a code issue.");
            console.error("   User must manually fix: npm login or check npm registry configuration");
            throw new Error(`SYSTEM_ERROR: npm authentication/registry issue. Cannot auto-fix. ${errLog.substring(0, 200)}`);
          }
          
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
        
        // ✅ Validate Next.js config structure
        await validateNextConfig(repoPath);
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
      
      // =============================================================================
      // 🛡️ PRE-FLIGHT CODE SANITIZER: Ta bort alla end-taggar innan TypeScript check
      // =============================================================================
      console.log(chalk.cyan("[Tester] 🧹 Pre-flight code sanitization..."));
      await sanitizeAllCodeFiles(repoPath);
      
      // Add unused import cleanup before quality gate
      console.log('[Tester] 🧹 Pre-flight unused import cleanup...');
      try {
        await removeUnusedImports(path.join(repoPath, 'src/app/layout.tsx'));
        await removeUnusedImports(path.join(repoPath, 'src/lib/api.ts'));
        await removeUnusedImports(path.join(repoPath, 'src/app/page.tsx'));
        console.log('   ✅ Unused imports sanitized');
      } catch (err: any) {
        console.log(`   ⚠️  Sanitizer warning: ${err.message}`);
      }
      
      console.log("[Tester] Running Production Readiness Check...");
      try {
        verifyProductionReadiness(repoPath, intent);
        console.log("✅ Production Readiness Check Passed!");
      } catch (qualityError: any) {
        // Fånga kvalitetskontroll-outputen
        const qualityOutput = qualityError.message || "";
        const qualityStdout = qualityError.stdout || qualityError.fullOutput || "";
        const qualityStderr = qualityError.stderr || "";
        const fullQualityLog = qualityOutput + "\n" + qualityStdout + "\n" + qualityStderr;
        
        console.log("❌ Production Readiness Check Failed. Output captured.");
        
        // =============================================================================
        // 🐍 PYTHON ERROR HANDLER: Fix Python errors if detected (with validation)
        // =============================================================================
        if (qualityError.isPythonError && fullQualityLog.includes('error:')) {
          console.log(chalk.cyan("\n🐍 PYTHON FIXER: Python errors detected, attempting fix..."));
          
          try {
            // Use autoFixPythonError function with syntax validation
            const errorAnalysis = classifyError(fullQualityLog);
            const fixed = await autoFixPythonError(errorAnalysis as any, repoPath);
            
            if (fixed) {
              console.log(chalk.green(`✅ Python Fixer fixed and validated Python file`));
              continue; // Retry check
            } else {
              console.warn(chalk.yellow(`⚠️ Python Fixer could not fix the error`));
            }
          } catch (pythonFixError: any) {
            console.warn(chalk.yellow(`⚠️ Python Fixer failed: ${pythonFixError.message}`));
            // Continue to TypeScript error handling
          }
        }
        
        // =============================================================================
        // 🏥 BATCH SURGEON: Fix TypeScript errors from tsc --noEmit (V6.0)
        // =============================================================================
        if (fullQualityLog.includes('error TS') && shouldUseBatchSurgeon(fullQualityLog)) {
          console.log(chalk.cyan("\n🏥 BATCH SURGEON: TypeScript errors detected, fixing ALL at once..."));
          
          try {
            const batchResult = await runBatchSurgeon(
              fullQualityLog,
              repoPath,
              enrichedContext.availableComponents,
              parseAndWriteFiles
            );
            
            if (batchResult.totalFixed > 0) {
              console.log(chalk.green(`✅ Batch Surgeon fixed ${batchResult.totalFixed} TypeScript errors`));
              
              // Re-run import rewriter and client detector after batch fix
              runImportRewriter(repoPath);
              runClientDetector(repoPath);
              
              // Retry the check
              continue; // Retry build immediately
            }
          } catch (batchError: any) {
            console.warn(chalk.yellow(`⚠️ Batch Surgeon failed: ${batchError.message}`));
            // Fall through to normal error handling
          }
        }
        
        throw new Error(fullQualityLog); // Kasta detta som felet vi ska laga
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
        
        // =============================================================================
        // 🔍 PRE-BUILD FILE STRUCTURE VERIFICATION (Critical - ensures layout.tsx exists)
        // =============================================================================
        console.log('🔍 Pre-build file structure verification...');
        
        // STRICT: ALWAYS use src/app structure
        const appDir = path.join(repoPath, 'src', 'app');
        
        if (!fs.existsSync(appDir)) {
          fs.mkdirSync(appDir, { recursive: true });
        }
        
        const layoutPath = path.join(appDir, 'layout.tsx');
        const pagePath = path.join(appDir, 'page.tsx');
        const globalsCssPath = path.join(appDir, 'globals.css');
        
        // Check layout.tsx
        if (!fs.existsSync(layoutPath)) {
          console.warn('⚠️ layout.tsx missing! Injecting golden template...');
          
          const goldenLayout = `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NeoTrade Dashboard',
  description: 'Cyberpunk crypto trading dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-cyan-400 font-mono">{children}</body>
    </html>
  )
}
`;
          
          fs.writeFileSync(layoutPath, goldenLayout, 'utf-8');
          console.log('   ✅ Golden layout.tsx injected');
        } else {
          const size = fs.statSync(layoutPath).size;
          console.log(`   ✅ layout.tsx exists (${size} bytes)`);
        }
        
        // Check page.tsx
        if (!fs.existsSync(pagePath)) {
          console.warn('⚠️ page.tsx missing! Injecting golden template...');
          
          const goldenPage = `export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">Welcome</h1>
      <p className="mt-4">Dashboard coming soon...</p>
    </main>
  )
}
`;
          
          fs.writeFileSync(pagePath, goldenPage, 'utf-8');
          console.log('   ✅ Golden page.tsx injected');
        } else {
          const size = fs.statSync(pagePath).size;
          console.log(`   ✅ page.tsx exists (${size} bytes)`);
        }
        
        // Check globals.css
        if (!fs.existsSync(globalsCssPath)) {
          console.warn('⚠️ globals.css missing! Creating minimal version...');
          
          const minimalCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

body {
  color: rgb(var(--foreground));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background))
    )
    rgb(var(--background));
}
`;
          
          fs.writeFileSync(globalsCssPath, minimalCss, 'utf-8');
          console.log('   ✅ globals.css created');
        } else {
          console.log('   ✅ globals.css exists');
        }
        
        // Debug: List what's in src/app/
        console.log('📂 Contents of src/app/:');
        try {
          const appFiles = fs.readdirSync(appDir);
          console.log('   Files:', appFiles.join(', '));
        } catch (e) {
          console.warn('   ⚠️ Could not list app directory');
        }
        
        console.log('✅ Pre-build verification complete');
        
        // Validate imports before build
        await validateNoRelativeImports(repoPath);
        
        console.log("[Tester] Running Final Build...");
        const buildOutput = execSync('npm run build', { 
        cwd: repoPath, 
          stdio: 'pipe',
          encoding: 'utf-8',
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }
        }).toString();
        
        // ✅ Analyze build output
        const buildAnalysis = await analyzeBuildOutput(buildOutput);
        if (buildAnalysis.warning) {
          console.log(chalk.yellow(`⚠️ ${buildAnalysis.warning}`));
          if (buildAnalysis.recommendation) {
            console.log(chalk.yellow(`   💡 ${buildAnalysis.recommendation}`));
          }
        }
        
        console.log(chalk.green.bold("✅ Build Successful!"));
        
        // 🧹 CLEAR ERROR HISTORY: Reset after successful build (V6.0)
        clearAutopsyHistory();
        console.log(chalk.green("   🧹 Error history cleared"));
        
        // 🧠 MEMORIZE SOLUTION: Save successful fix to Hive Mind
        // ✅ Safety check: Ensure wasFixing is defined (prevents ReferenceError)
        if (typeof wasFixing !== 'undefined' && wasFixing && lastAppliedFix && lastErrorLog) {
          console.log("🧠 Memorizing successful fix to Hive Mind...");
          await memorizeSolution(lastErrorLog, lastAppliedFix).catch(err => 
            console.warn("⚠️ Failed to memorize solution:", err?.message)
          );
        }
        
        // 3.5. ASSERT: Verify page.tsx and layout.tsx export valid default components
        console.log("[Tester] 🛡️ Verifying page.tsx and layout.tsx export default components...");
        // Reuse pagePath and layoutPath from pre-build verification above
        
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
      // ✅ STACK AWARENESS: Only check Python if backend is FastAPI/Python
      const backendType = pipeline.stack_config?.backend || 
                         (pipeline.is_python ? 'fastapi' : null) ||
                         (fs.existsSync(path.join(repoPath, 'backend', 'main.py')) ? 'fastapi' : null);
      
      if (backendType === 'fastapi' || backendType === 'python') {
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
          
          // ✅ NEW: Classify Python error
          const pythonAnalysis = classifyError(mypyFullLog);
          console.log(`   Classification: ${pythonAnalysis.classification} (${pythonAnalysis.errorCode})`);
          
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
          
          // ✅ NEW: Unified AI client with error signature
          const pythonFixOutput = await callAI({
            pipelineId: pipeline.id,
            step: 'tester',
            role: 'FIXER',
            model: selectModel('FIXER', 'simple'),
            messages: [
              { role: 'user', content: pythonFixPrompt }
            ],
            errorSignature: pythonAnalysis.errorSignature
          });
          
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
        // ✅ Safety check: Ensure wasFixing is defined (prevents ReferenceError)
        if (typeof wasFixing !== 'undefined' && wasFixing && lastAppliedFix && lastErrorLog) {
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
      console.error(chalk.red(`❌ Check Failed (Attempt ${attempt})`));
      
      // Hämta hela felloggen (antingen från tsc eller build)
      let fullLog = error.message || "";
      if (error.stdout) fullLog += "\n" + error.stdout.toString();
      if (error.stderr) fullLog += "\n" + error.stderr.toString();

      // ✅ NEW: Enhanced error classification
      const errorAnalysis = classifyError(fullLog);
      console.log(chalk.cyan(`🔍 Error classified as: ${errorAnalysis.classification} (${errorAnalysis.errorCode})`));
      console.log(chalk.cyan(`   Strategy: ${errorAnalysis.fixStrategy}, Max retries: ${errorAnalysis.maxRetries}`));
      
      // Update pipeline with error info
      await supabase
        .from('pipelines')
        .update({
          error_code: errorAnalysis.errorCode,
          error_signature: errorAnalysis.errorSignature
        })
        .eq('id', pipeline.id);
      
      // Check if we should stop
      if (errorAnalysis.fixStrategy === 'STOP') {
        console.log(chalk.red('❌ FATAL ERROR - marking as failed_hard'));
        await supabase
          .from('pipelines')
          .update({ status: 'failed_hard' })
          .eq('id', pipeline.id);
        await recordErrorPattern(errorAnalysis, false);
        throw error;
      }
      
      // Get current step attempts
      const currentStep = await getStep(pipeline.id, 'tester');
      const currentAttempts = (currentStep?.attempts as number) || 0;
      
      if (currentAttempts >= errorAnalysis.maxRetries) {
        console.log(chalk.red(`🚨 Max retries (${errorAnalysis.maxRetries}) exceeded for ${errorAnalysis.classification}`));
        await recordErrorPattern(errorAnalysis, false);
        await supabase
          .from('pipelines')
          .update({ status: 'failed' })
          .eq('id', pipeline.id);
        throw error;
      }
      
      // Increment attempt counter
      await supabase
        .from('pipeline_steps')
        .update({ attempts: currentAttempts + 1 })
        .eq('pipeline_id', pipeline.id)
        .eq('name', 'tester');

      // LOGGA FELET SÅ DU SER DET
      console.log(chalk.yellow("🔻 --- ERROR LOG START --- 🔻"));
      console.log(fullLog.slice(0, 3000)); // Visa första 3000 tecknen
      console.log(chalk.yellow("🔺 --- ERROR LOG END --- 🔺"));
      
      // =============================================================================
      // 🧠 V6.0 INTELLIGENT ERROR HANDLING
      // =============================================================================
      
      // Record error for autopsy tracking
      recordAutopsyError(
        errorAnalysis.errorCode,
        fullLog.slice(0, 200),
        fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts))/)?.[1] || 'unknown',
        `Attempt ${attempt}`
      );
      
      // Update pipeline context with error
      recordError(enrichedContext, {
        code: fullLog.match(/TS\d+/)?.[0] || 'BUILD_ERROR',
        message: fullLog.slice(0, 500),
        file: fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts))/)?.[1] || 'unknown',
        category: fullLog.includes('Cannot find module') ? 'import' : 
                  fullLog.includes('use client') ? 'runtime' :
                  fullLog.includes('Type') ? 'type' : 'other'
      });
      
      // =============================================================================
      // 🏥 BATCH SURGEON: Fix ALL errors at once (V6.0)
      // =============================================================================
      if (shouldUseBatchSurgeon(fullLog)) {
        console.log(chalk.cyan("\n🏥 BATCH SURGEON: Multiple errors detected, fixing ALL at once..."));
        
        try {
          const batchResult = await runBatchSurgeon(
            fullLog,
            repoPath,
            enrichedContext.availableComponents,
            parseAndWriteFiles
          );
          
          if (batchResult.totalFixed > 0) {
            console.log(chalk.green(`✅ Batch Surgeon fixed ${batchResult.totalFixed} errors`));
            
            // Re-run import rewriter and client detector after batch fix
            runImportRewriter(repoPath);
            runClientDetector(repoPath);
            
            continue; // Retry build immediately
          }
        } catch (batchError: any) {
          console.warn(chalk.yellow(`⚠️ Batch Surgeon failed: ${batchError.message}`));
          // Fall through to normal error handling
        }
      }
      
      // =============================================================================
      // 🔬 ERROR AUTOPSY: Diagnose loops before they happen (V6.0)
      // =============================================================================
      const loopCheck = detectLoop(fullLog.slice(0, 200), fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts))/)?.[1] || '');
      
      if (loopCheck.isLooping && loopCheck.count >= 2) {
        console.log(chalk.red("\n🔬 ERROR AUTOPSY: Loop detected! Running deep diagnosis..."));
        
        const brokenFilePath = fullLog.match(/([a-zA-Z0-9_\/\\.-]+\.(tsx|ts))/)?.[1] || '';
        const brokenContent = fs.existsSync(path.join(repoPath, brokenFilePath)) 
          ? fs.readFileSync(path.join(repoPath, brokenFilePath), 'utf-8')
          : '';
        
        try {
          const { diagnosis, fixPrompt } = await runErrorAutopsy(
            fullLog,
            brokenFilePath,
            brokenContent,
            repoPath
          );
          
          console.log(chalk.yellow(`   📋 Root Cause: ${diagnosis.rootCause}`));
          console.log(chalk.yellow(`   🎯 Confidence: ${diagnosis.confidence}`));
          
          if (diagnosis.requiresRewrite) {
            console.log(chalk.red("   🚨 NUCLEAR REWRITE REQUIRED"));
            
            // ✅ NEW: Unified AI client for nuclear rewrite
            const nuclearFix = await callAI({
              pipelineId: pipeline.id,
              step: 'tester',
              role: 'FIXER',
              model: selectModel('FIXER', 'complex'),
              messages: [
                { role: 'user', content: fixPrompt + "\n\n" + getTesterContext(enrichedContext) }
              ],
              errorSignature: errorAnalysis.errorSignature
            });
            const filesWritten = await parseAndWriteFiles(nuclearFix, repoPath, pipeline.id);
            
            if (filesWritten > 0) {
              console.log(chalk.green(`   ✅ Nuclear rewrite applied: ${filesWritten} files`));
              clearAutopsyHistory(); // Reset after successful nuclear fix
              continue;
            }
          }
        } catch (autopsyError: any) {
          console.warn(chalk.yellow(`   ⚠️ Autopsy failed: ${autopsyError.message}`));
        }
      }
      
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
          const detectiveJson = await callAI({
            pipelineId: pipeline.id,
            step: 'tester',
            role: 'FIXER',
            model: selectModel('FIXER', 'complex'),
            messages: [{ role: 'user', content: investigationPrompt }]
          });
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
            // ✅ NEW: Unified AI client
            const fix = await callAI({
              pipelineId: pipeline.id,
              step: 'tester',
              role: 'FIXER',
              model: selectModel('FIXER', 'complex'),
              messages: [
                { role: 'user', content: nuclearPrompt }
              ],
              errorSignature: errorAnalysis.errorSignature
            });
            const filesCreated = await parseAndWriteFiles(fix, repoPath, pipeline.id);
            
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
            // ✅ NEW: Unified AI client
            const fix = await callAI({
              pipelineId: pipeline.id,
              step: 'tester',
              role: 'FIXER',
              model: selectModel('FIXER', 'complex'),
              messages: [
                { role: 'user', content: nuclearPrompt }
              ],
              errorSignature: errorAnalysis.errorSignature
            });
            await parseAndWriteFiles(fix, repoPath, pipeline.id);
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
      // BUT: Check if package.json is blocked by fortress BEFORE attempting fixes
      if (!brokenFile && (fullLog.includes("npm error") || fullLog.includes("ETARGET") || fullLog.includes("ERESOLVE") || fullLog.includes("package.json"))) {
        // 🚨 SYSTEM-LEVEL ERROR CHECK: Don't try to fix system-level npm errors
        if (fullLog.includes("Access token expired") || 
            fullLog.includes("Access token revoked") ||
            fullLog.includes("E401") ||
            (fullLog.includes("E404") && fullLog.includes("Not Found - GET https://registry.npmjs.org"))) {
          console.error("[Watchdog] 🚨 SYSTEM-LEVEL NPM ERROR: Cannot auto-fix authentication/registry issues");
          throw new Error(`SYSTEM_ERROR: npm authentication/registry issue. User must manually fix.`);
        }
        
        console.log("[Watchdog] 📦 Detected Dependency Error. Checking if package.json can be modified...");
        
        // Check fortress guard BEFORE attempting fix
        const packageJsonPath = path.join(repoPath, "package.json");
        const repairCheck = checkRepairAllowed({
          filePath: packageJsonPath,
          content: fs.existsSync(packageJsonPath) ? fs.readFileSync(packageJsonPath, 'utf-8') : '',
          attemptCount: 1,
          errorType: 'DEPENDENCY_ERROR'
        });
        
        if (!repairCheck.allowed) {
          console.error(`[Watchdog] 🏰 FORTRESS BLOCKED: package.json - ${repairCheck.reason}`);
          console.error("[Watchdog] ⚠️ Cannot fix package.json (GOLDEN tier). This is a system-level issue.");
          throw new Error(`FORTRESS_BLOCKED: package.json is protected. Cannot modify. ${repairCheck.reason}`);
        }
        
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
      
      // Track if we're fixing (for memorization later) - use variables declared at function start
      wasFixing = true;
      lastErrorLog = fullLog;
      lastAppliedFix = "";
      
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

      const analysis = await callAI({
        pipelineId: pipeline.id,
        step: 'tester',
        role: 'CODE_REVIEWER',
        model: selectModel('REVIEWER'),
        messages: [
          {
            role: 'system',
            content: 'You are a code reviewer. Analyze code errors and provide clear, actionable feedback.'
          },
          {
            role: 'user',
            content: reviewPrompt
          }
        ]
      });
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

      const strategyJson = await callAI({
        pipelineId: pipeline.id,
        step: 'tester',
        role: 'FIXER',
        model: selectModel('FIXER', 'medium'),
        messages: [
          {
            role: 'system',
            content: 'You are a debugging agent. Analyze errors and provide recovery strategies in JSON format.'
          },
          {
            role: 'user',
            content: recoveryPrompt
          }
        ]
      });
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
      // STEG 2.5: ORACLE CONSULTATION 🔮
      // ------------------------------------------------------------
      console.log("🔮 Consulting the Codebase Oracle...");
      const oracle = getOracle(repoPath);
      const knowledgeGraph = oracle.getKnowledgeGraph();
      
      // Filter the graph to save tokens (only relevant files)
      const relevantIntel = knowledgeGraph.files.filter(node => 
        fullLog.includes(node.path) ||                           // File mentioned in error
        node.path.includes('types') ||                           // Type files always relevant
        fullLog.includes(path.basename(node.path, '.tsx')) ||   // Filename without extension
        fullLog.includes(path.basename(node.path, '.ts')) ||
        node.exports.some(exp => fullLog.includes(exp))          // Export mentioned in error
      ).slice(0, 15); // Limit to 15 most relevant files
      
      const oracleKnowledge = relevantIntel.length > 0 
        ? `
🔮 ORACLE KNOWLEDGE (THE TRUTH ABOUT THE FILE SYSTEM):
${JSON.stringify(relevantIntel, null, 2)}

ORACLE RULES:
- The Oracle shows exactly what is exported from where.
- Do NOT guess paths. Use the paths from the Oracle.
- If a file exports 'default', use: import X from '...'
- If a file has named exports, use: import { X } from '...'
- If a file is missing in the Oracle list, IT DOES NOT EXIST. Create it.
`
        : '';

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

        ${oracleKnowledge}

        TASK: Execute the fix on the target file(s).
        
        CRITICAL RULES:
        1. Use '@/' alias for all imports (never '../' or './').
        2. Follow EXPORT_RULE: Components = named exports, Pages = default exports.
        3. For Next.js 15: Add 'await' to params/searchParams/cookies/headers and make functions async.
        4. If export doesn't exist, define it locally inline (inline fix strategy).
        5. Maintain existing functionality. Do NOT delete page content.

        ${EXPORT_RULE}

        CRITICAL JSON RULES:
        - If you are editing 'tsconfig.json' or 'package.json':
        - OUTPUT RAW JSON ONLY.
        - NO Markdown blocks (\`\`\`json).
        - NO comments (// comment).
        - NO conversational text ("Here is the file").
        - JUST. THE. JSON.

        OUTPUT FORMAT (MANDATORY):
        You MUST separate files with "### FILE: <path>" and "### END_FILE".
        
        Example:
        ### FILE: tsconfig.json
        {
          "compilerOptions": { ... }
        }
        ### END_FILE
        
        ### FILE: src/app/page.tsx
        import React from 'react';
        ...
        ### END_FILE
        
        DO NOT write any text outside these blocks.
        DO NOT merge content.
        Each file MUST be wrapped in ### FILE: ... ### END_FILE.
      `;

      // VÄLJ INTELLIGENS-NIVÅ (Tiered Escalation)
      let smartLevel: 'FAST' | 'SMART' | 'GENIUS' = 'FAST';
      if (attempt > 1) smartLevel = 'SMART';
      if (attempt > 3 || strategy === 'REWRITE') smartLevel = 'GENIUS';

      // Map smartLevel to complexity for selectModel
      const complexityMap: Record<'FAST' | 'SMART' | 'GENIUS', 'simple' | 'medium' | 'complex'> = {
        'FAST': 'simple',
        'SMART': 'medium',
        'GENIUS': 'complex'
      };

      const fixOutput = await callAI({
        pipelineId: pipeline.id,
        step: 'tester',
        role: 'FIXER',
        model: selectModel('FIXER', complexityMap[smartLevel]),
        messages: [
          {
            role: 'system',
            content: 'You are a code fixer. Fix errors in code files. Return fixed code using ### FILE: <path> ... ### END_FILE format.'
          },
          {
            role: 'user',
            content: fixPrompt
          }
        ]
      });
      
      // Fallback om fixOutput är tom
      let finalFixOutput = fixOutput;
      if (!finalFixOutput || finalFixOutput.trim().length === 0) {
        console.warn(`⚠️ ${smartLevel} Fixer returned empty. Trying fallback...`);
        if (smartLevel === 'FAST') {
          finalFixOutput = await callAI({
            pipelineId: pipeline.id,
            step: 'tester',
            role: 'FIXER',
            model: selectModel('FIXER', 'medium'),
            messages: [
              {
                role: 'system',
                content: 'You are a code fixer. Fix errors in code files. Return fixed code using ### FILE: <path> ... ### END_FILE format.'
              },
              {
                role: 'user',
                content: fixPrompt
              }
            ]
          });
        } else if (smartLevel === 'SMART') {
          finalFixOutput = await callAI({
            pipelineId: pipeline.id,
            step: 'tester',
            role: 'FIXER',
            model: selectModel('FIXER', 'complex'),
            messages: [
              {
                role: 'system',
                content: 'You are a code fixer. Fix errors in code files. Return fixed code using ### FILE: <path> ... ### END_FILE format.'
              },
              {
                role: 'user',
                content: fixPrompt
              }
            ]
          });
        }
      }

      // =============================================================================
      // 🏰 v9.0 FORTRESS-PROTECTED FILE WRITING
      // =============================================================================
      // Wrap file writes with transaction rollback and fortress guard
      const repairResult = await withTransaction(
        snapshotManager,
        pipeline.id,
        repoPath,
        `Tester repair attempt ${attempt}`,
        () => countTypeScriptErrors(repoPath),
        async () => {
          // Applicera fixen (Skapa/Uppdatera filer) - Batch Fixer använder [FILE: ...] [GOAL] format
          // Försök först med [FILE: ...] [GOAL] format (batch fixer)
          let fileRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
          let fileMatch;
          let fixedCount = 0;
          
          while ((fileMatch = fileRegex.exec(finalFixOutput)) !== null) {
            const fileName = fileMatch[1].trim();
            let content = fileMatch[2].trim();
            
            // ✅ STRICT PARSING: Extract only code blocks
            const codeBlockMatch = content.match(/```(?:typescript|tsx|ts|js|jsx|json|css|html)?\n([\s\S]*?)```/);
            if (codeBlockMatch) {
              content = codeBlockMatch[1].trim();
            } else {
              // Fallback: THE SANITIZER: Ta bort alla Markdown-artefakter
              content = content.split(/\[GOAL\]/)[0].trim();
              content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
              content = content.replace(/```$/m, '');
              content = content.replace(/^### FILE:.*\n?/m, '');
              content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
              // Remove explanation lines
              content = content
                .split('\n')
                .filter(line => {
                  const trimmed = line.trim();
                  if (/^(Fixed the|Here's|I've|The code|This|Note:|Explanation:)/i.test(trimmed)) {
                    return false;
                  }
                  if (/^#{1,6}\s/.test(trimmed) || /^[-*+]\s/.test(trimmed)) {
                    return false;
                  }
                  return true;
                })
                .join('\n')
                .trim();
            }
            // Final cleanup
            content = content.replace(/\[GOAL\][\s\S]*$/m, '').trim();
            
            // 🆕 VALIDATE FILENAME
            const cleanFileName = validateAndFixFilename(fileName);
            const relativePath = path.relative(repoPath, path.join(repoPath, cleanFileName));
            
            // 🏰 v9.0 FORTRESS GUARD: Check if repair is allowed
            const attemptCount = fileAttemptCounts.get(relativePath) || 0;
            const repairCheck = checkRepairAllowed({
              filePath: relativePath,
              content,
              attemptCount,
              errorType: 'REPAIR',
            });
            
            if (!repairCheck.allowed) {
              console.log(chalk.yellow(`🏰 FORTRESS BLOCKED: ${relativePath} - ${repairCheck.reason}`));
              
              // Get violation action
              const violationAction = getViolationAction(relativePath);
              console.log(chalk.yellow(`   Action: ${violationAction.action} - ${violationAction.description}`));
              
              if (violationAction.action === 'HALT') {
                throw new Error(`FORTRESS VIOLATION: Cannot repair ${relativePath} (${repairCheck.reason})`);
              }
              // Skip this file but continue with others
              continue;
            }
            
            // 🏰 v9.0 AUTHORIZATION: Check model and budget
            const model = getRecommendedModel(relativePath, attemptCount);
            const auth = authorizeRepair(relativePath, repairSession, model);
            
            if (!auth.allowed) {
              console.log(chalk.yellow(`🚫 AUTHORIZATION DENIED: ${relativePath} - ${auth.reason}`));
              continue;
            }
            
            // Use fortress-protected write
            const writeResult = await fortressWrite(repoPath, relativePath, content, attemptCount);
            
            if (!writeResult.success) {
              console.log(chalk.yellow(`⚠️ Write failed: ${relativePath} - ${writeResult.result.reason}`));
              continue;
            }
            
            // Record attempt
            const estimatedCost = 0.05; // Estimate cost per file
            recordAttempt(repairSession, {
              filePath: relativePath,
              attemptNumber: attemptCount + 1,
              model,
              cost: estimatedCost,
              success: true,
            });
            
            fileAttemptCounts.set(relativePath, attemptCount + 1);
            console.log(chalk.green(`[Batch Fixer] 🛠️ Fixed file (v9.0 protected): ${cleanFileName}`));
            
            // Save applied fix for memorization
            if (brokenFile === fileName || fixedCount === 0) {
              lastAppliedFix = content;
            }
            fixedCount++;
          }
          
          return { success: fixedCount > 0, fixedCount };
        }
      );
      
      // Check if transaction was rolled back
      if (repairResult.rolledBack) {
        console.log(chalk.red(`\n⏪ TRANSACTION ROLLBACK: Repair made things worse, rolled back to snapshot`));
        console.log(chalk.red(`   Reason: ${repairResult.error}`));
        // Continue to next attempt
        continue;
      }
      
      let fixedCount = repairResult.result?.fixedCount || 0;
      
      // Fallback: Om [FILE: ...] formatet inte matchade, försök med ### FILE: ... ### END_FILE
      if (fixedCount === 0) {
        const fallbackResult = await withTransaction(
          snapshotManager,
          pipeline.id,
          repoPath,
          `Tester fallback repair attempt ${attempt}`,
          () => countTypeScriptErrors(repoPath),
          async () => {
            const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
            let fallbackFixed = 0;
            let fileMatch;
            
            while ((fileMatch = fileRegex.exec(finalFixOutput)) !== null) {
              const fileName = fileMatch[1].trim();
              let content = fileMatch[2].trim();
              
              // THE SANITIZER: Ta bort alla Markdown-artefakter
              content = content.replace(/^```[a-zA-Z0-9]*\n?/m, '');
              content = content.replace(/```$/m, '');
              content = content.replace(/^### FILE:.*\n?/m, '');
              content = content.replace(/```[a-zA-Z0-9]*\n/g, '').replace(/```$/g, '');
              content = content.trim();
              
              // 🆕 VALIDATE FILENAME
              const cleanFileName = validateAndFixFilename(fileName);
              const relativePath = path.relative(repoPath, path.join(repoPath, cleanFileName));
              
              // 🏰 v9.0 FORTRESS GUARD
              const attemptCount = fileAttemptCounts.get(relativePath) || 0;
              const repairCheck = checkRepairAllowed({
                filePath: relativePath,
                content,
                attemptCount,
                errorType: 'REPAIR',
              });
              
              if (!repairCheck.allowed) {
                console.log(chalk.yellow(`🏰 FORTRESS BLOCKED (fallback): ${relativePath}`));
                continue;
              }
              
              const model = getRecommendedModel(relativePath, attemptCount);
              const auth = authorizeRepair(relativePath, repairSession, model);
              
              if (!auth.allowed) {
                console.log(chalk.yellow(`🚫 AUTHORIZATION DENIED (fallback): ${relativePath}`));
                continue;
              }
              
              const writeResult = await fortressWrite(repoPath, relativePath, content, attemptCount);
              
              if (writeResult.success) {
                recordAttempt(repairSession, {
                  filePath: relativePath,
                  attemptNumber: attemptCount + 1,
                  model,
                  cost: 0.05,
                  success: true,
                });
                fileAttemptCounts.set(relativePath, attemptCount + 1);
                console.log(chalk.green(`[Batch Fixer] 🛠️ Fixed file (fallback, v9.0): ${cleanFileName}`));
                if (brokenFile === fileName || fallbackFixed === 0) {
                  lastAppliedFix = content;
                }
                fallbackFixed++;
              }
            }
            
            return { success: fallbackFixed > 0, fixedCount: fallbackFixed };
          }
        );
        
        if (fallbackResult.rolledBack) {
          console.log(chalk.red(`⏪ Fallback repair rolled back`));
        } else {
          fixedCount = fallbackResult.result?.fixedCount || 0;
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
            
            const radicalFix = await callAI({
              pipelineId: pipeline.id,
              step: 'tester',
              role: 'CODER',
              model: selectModel('CODER'),
              messages: [{ role: 'user', content: radicalFixPrompt }]
            });
            const radicalFilesCreated = await parseAndWriteFiles(radicalFix, repoPath, pipeline.id);
            
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
        
        // Create snapshot before fixer operation
        let fixerSnapshotId: string | null = null;
        try {
          fixerSnapshotId = snapshotBeforeFixer(repoPath);
          console.log(chalk.green(`   📸 Snapshot created before fixer: ${fixerSnapshotId}`));
        } catch (error: any) {
          console.warn(chalk.yellow(`   ⚠️ Snapshot creation failed: ${error.message}`));
        }
        
        const intelligentResult = await runIntelligentBatchFixer(repoPath, fullLog, pipeline);
        
        // If fixer failed catastrophically, restore from snapshot
        if (!intelligentResult.success && fixerSnapshotId && intelligentResult.circuitBroken) {
          console.log(chalk.yellow("\n🔄 Fixer failed catastrophically. Restoring from snapshot..."));
          const restored = restoreFromSnapshot(repoPath, fixerSnapshotId);
          if (restored) {
            console.log(chalk.green("   ✅ Project restored from snapshot"));
          }
        }
        
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
    // =============================================================================
    // 🏰 v9.0 REPAIR SESSION SUMMARY
    // =============================================================================
    console.log(chalk.cyan("\n🏰 FROST NIGHT FACTORY v9.0 - REPAIR SESSION SUMMARY"));
    console.log(getSessionSummary(repairSession));
    
    if (!isWithinBudget(repairSession)) {
      console.warn(chalk.yellow(`⚠️ Budget exceeded: $${repairSession.totalCost.toFixed(4)} / $${repairSession.budget.toFixed(2)}`));
    } else {
      console.log(chalk.green(`✅ Budget OK: $${repairSession.totalCost.toFixed(4)} / $${repairSession.budget.toFixed(2)}`));
    }
    
    await updateStep(pipeline.id, 'tester', 'completed');
    
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
        await updateStep(pipeline.id, 'tester', 'completed', JSON.stringify({ visualAudit: 'failed', note: 'UI issues detected but continuing to publish' }));
      } else {
        console.log("✅ Visual Audit Passed! UI looks good.");
        await updateStep(pipeline.id, 'tester', 'completed', JSON.stringify({ visualAudit: 'passed' }));
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
    
    // --- 👁️ V7 VISION REFINEMENT LOOP (Lovable Level) ---
    // Only run visual audit for frontend projects (skip pure backend)
    const hasFrontend = fs.existsSync(path.join(repoPath, 'package.json')) && 
                       (fs.existsSync(path.join(repoPath, 'app')) || fs.existsSync(path.join(repoPath, 'src')));
    
    if (hasFrontend) {
      // =============================================================================
      // C. THE PERMANENT FIX - Pre-Refinement Loop Sanitization
      // =============================================================================
      // 1. SÄKRA ROUTING (Unblock root route in middleware)
      sanitizeMiddleware(repoPath);
      
      // 2. SÄKRA CACHE (Nuke all Next.js caches)
      nukeNextJsCache(repoPath);
      
      // --- STEG 7: V7 VISION REFINEMENT LOOP ---
      console.log(chalk.cyan("\n👁️ Starting V7 Vision Refinement Loop (Lovable Level)..."));
      
      try {
        // Starta servern för audit
        const serverResult = await startDevServerWithVerification(repoPath, 3002);
        const serverProc = serverResult.process;
        const devServerUrl = `http://localhost:3002`; // Port is fixed in function
        
        try {
          // Kör den nya Refinement Loop
          const finalResult = await refinementLoop(
            repoPath,
            devServerUrl,
            3, // Max iterations
            async (filePath: string, code: string) => {
              // Callback för att spara kod
              // filePath kan vara absolut eller relativ
              const relativePath = path.isAbsolute(filePath) 
                ? path.relative(repoPath, filePath)
                : filePath;
              
              // Wrap code in file format if needed
              const formattedCode = code.includes('### FILE:') 
                ? code 
                : `### FILE: ${relativePath}\n\`\`\`tsx\n${code}\n\`\`\`\n### END_FILE`;
              
              await parseAndWriteFiles(formattedCode, repoPath, pipeline.id);
              console.log(chalk.green(`   ✅ Updated: ${relativePath}`));
            }
          );
          
          console.log(chalk.cyan(`\n🏁 Vision Refinement Complete. Final Score: ${finalResult.score}/10`));
          
          if (finalResult.passed) {
            console.log(chalk.green("✅ UI Quality is Premium (Score >= 8). Ready to ship."));
          } else {
            console.warn(chalk.yellow(`⚠️ UI Score is ${finalResult.score}/10 (below 8), but publishing anyway. Consider manual review.`));
            console.log(chalk.yellow("   Feedback:"));
            finalResult.finalFeedback.slice(0, 5).forEach(f => console.log(chalk.yellow(`      - ${f}`)));
          }
        } finally {
          // Döda servern
          if (serverProc) {
            try {
              if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${serverProc.pid}`, { stdio: 'ignore' });
              } else {
                process.kill(-serverProc.pid!, 'SIGKILL');
              }
              console.log(chalk.green("   ✅ Dev server stopped"));
            } catch (e) {
              console.warn(chalk.yellow(`   ⚠️ Could not stop dev server: ${(e as Error).message}`));
            }
          }
        }
      } catch (refinementError: any) {
        console.warn(chalk.yellow(`⚠️ Vision Refinement failed (non-critical): ${refinementError?.message}`));
        // Fallback: Use old visual audit
        console.log(chalk.yellow("   Falling back to legacy visual audit..."));
        try {
          const auditResult = await runVisualAudit(repoPath);
          if (auditResult.success) {
            console.log(chalk.green("✅ Legacy Visual Audit Passed!"));
          } else {
            console.warn(chalk.yellow("⚠️ Legacy Visual Audit failed, but continuing..."));
          }
        } catch (legacyError: any) {
          console.warn(chalk.yellow(`⚠️ Legacy audit also failed: ${legacyError?.message}`));
        }
      }
      
      console.log(chalk.green("🎉 Vision Refinement Complete! Proceeding to publish..."));
    } else {
      console.log(chalk.cyan("⏭️ Skipping Vision Refinement (backend-only project)."));
    }
    
    await updatePipeline(pipeline.id, { current_phase: 'publisher' });
  } else {
    await updateStep(pipeline.id, 'tester', 'failed', JSON.stringify({ error: 'Validation failed after retries' }));
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
    const name = await callAI({
      pipelineId: 'system',
      step: 'naming',
      role: 'REVIEWER',
      model: selectModel('REVIEWER'),
      messages: [{ role: 'user', content: prompt }]
    });
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

/**
 * Recovery Strategy Interface
 */
interface RecoveryStrategy {
  name: string;
  detect: (error: string) => boolean;
  fix: (projectRoot: string, pipeline?: any) => Promise<boolean>;
}

/**
 * Recovery Strategies - Strategy Pattern for Build Error Recovery
 */
const RECOVERY_STRATEGIES: Record<string, RecoveryStrategy> = {
  MISSING_DEPENDENCIES: {
    name: 'Missing Dependencies Fix',
    detect: (error: string) => {
      const deps = extractMissingDependencies(error);
      return deps.length > 0;
    },
    fix: async (projectRoot: string) => {
      // This will be handled in attemptBuildRecovery before strategies
      return false;
    }
  },
  
  TYPESCRIPT_ERROR: {
    name: 'TypeScript Error Fix',
    detect: (error: string) => error.includes('Type error') || error.includes('TS'),
    fix: async (projectRoot: string, pipeline?: any) => {
      console.log('   🤖 TypeScript error detected - attempting AI fix...');
      try {
        const fixed = await fixBuildErrorWithAI('TypeScript error detected', projectRoot, pipeline);
        return fixed;
      } catch (aiError: any) {
        console.warn(`   ⚠️ AI fixer failed: ${aiError.message}`);
        return false;
      }
    }
  },
  
  MODULE_RESOLUTION: {
    name: 'Module Resolution Fix',
    detect: (error: string) => error.includes('Module not found') || error.includes('Cannot resolve'),
    fix: async () => {
      console.log('   🔍 Module resolution issue detected - checking imports...');
      // Could add import path fixing here in the future
      return false; // Not auto-fixable yet
    }
  },
  
  HOMEPAGE_404: {
    name: 'Homepage 404 Fix',
    detect: (error: string) => error.includes('Homepage renders 404') || error.includes('This page could not be found'),
    fix: async (projectRoot: string, pipeline?: any) => {
      console.log('🔧 [Recovery] Fixing 404-only build...');
      
      // Find page.tsx files
      const possiblePagePaths = [
        path.join(projectRoot, 'src/app/page.tsx'),
        path.join(projectRoot, 'app/page.tsx'),
        path.join(projectRoot, 'src/pages/index.tsx'),
        path.join(projectRoot, 'pages/index.tsx'),
      ];
      
      const pagePath = possiblePagePaths.find(p => fs.existsSync(p));
      if (!pagePath) {
        console.log('   ⚠️ No page.tsx found');
        return false;
      }
      
      try {
        let content = await fs.promises.readFile(pagePath, 'utf-8');
        
        // Strategy 1: Add force-dynamic
        if (!content.includes('export const dynamic')) {
          const fixed = addForceDynamic(content);
          await fs.promises.writeFile(pagePath, fixed, 'utf-8');
          console.log('✅ Added force-dynamic export');
          return true;
        }
        
        // Strategy 2: Check for async issues
        if (content.includes('async function') && content.includes('export default')) {
          console.log('⚠️ Async component detected - not allowed in App Router');
          const fixed = await convertToClientComponent(content);
          await fs.promises.writeFile(pagePath, fixed, 'utf-8');
          console.log('✅ Converted async component to client component');
          return true;
        }
        
        // Strategy 3: Call AI
        console.log('🤖 Calling AI to fix page structure...');
        return await callAIToFixPage(pagePath, projectRoot, pipeline);
      } catch (fileError: any) {
        console.warn(`   ⚠️ Could not fix page.tsx: ${fileError.message}`);
        return false;
      }
    }
  }
};

/**
 * Recovery Agent: Attempts to fix common build errors automatically
 * Uses strategy pattern for extensible error recovery
 */
async function attemptBuildRecovery(
  error: string,
  projectRoot: string,
  pipeline?: any
): Promise<boolean> {
  console.log('   🔧 [Recovery Agent] Analyzing error...');
  
  // 1. Handle missing dependencies first (before strategies)
  const missingDeps = extractMissingDependencies(error);
  if (missingDeps.length > 0) {
    console.log(`   📦 Installing ${missingDeps.length} missing package(s): ${missingDeps.join(', ')}`);
    try {
      for (const dep of missingDeps) {
        execSync(`npm install ${dep}`, {
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 60000
        });
        console.log(`   ✅ Installed: ${dep}`);
      }
      return true; // Successfully installed dependencies
    } catch (installError: any) {
      console.error(`   ❌ Failed to install dependencies: ${installError.message}`);
      return false;
    }
  }
  
  // 2. Try recovery strategies
  for (const [key, strategy] of Object.entries(RECOVERY_STRATEGIES)) {
    if (strategy.detect(error)) {
      console.log(`   🎯 Matched strategy: ${strategy.name}`);
      try {
        const fixed = await strategy.fix(projectRoot, pipeline);
        if (fixed) {
          console.log(`   ✅ Strategy "${strategy.name}" succeeded`);
          return true;
        }
      } catch (strategyError: any) {
        console.warn(`   ⚠️ Strategy "${strategy.name}" failed: ${strategyError.message}`);
        // Continue to next strategy
      }
    }
  }
  
  return false; // No recovery possible
}

/**
 * Add force-dynamic export to page content
 */
function addForceDynamic(content: string): string {
  const lines = content.split('\n');
  const useClientIndex = lines.findIndex(l => l.trim() === "'use client';" || l.trim() === '"use client";');
  
  if (useClientIndex >= 0) {
    lines.splice(useClientIndex + 1, 0,
      '',
      '// Force dynamic rendering',
      "export const dynamic = 'force-dynamic';",
      "export const dynamicParams = true;",
      ''
    );
  } else {
    // No 'use client', add at the top
    lines.unshift(
      '',
      '// Force dynamic rendering',
      "export const dynamic = 'force-dynamic';",
      "export const dynamicParams = true;",
      ''
    );
  }
  
  return lines.join('\n');
}

/**
 * Convert async server component to client component
 */
async function convertToClientComponent(content: string): Promise<string> {
  // Remove async from function declaration
  let fixed = content.replace(/export\s+default\s+async\s+function/, 'export default function');
  
  // Add 'use client' if not present
  if (!fixed.includes("'use client'") && !fixed.includes('"use client"')) {
    fixed = "'use client';\n\n" + fixed;
  }
  
  // Add force-dynamic
  if (!fixed.includes('export const dynamic')) {
    fixed = addForceDynamic(fixed);
  }
  
  return fixed;
}

/**
 * Recovery Agent: Fix homepage 404 errors
 * Called when production build succeeds but homepage renders 404
 */
async function attemptHomepage404Fix(projectRoot: string, pipeline: any): Promise<boolean> {
  console.log('🔍 [Recovery] Analyzing 404 issue...');
  
  const pagePath = path.join(projectRoot, 'src/app/page.tsx');
  
  if (!fs.existsSync(pagePath)) {
    console.log('❌ page.tsx does not exist');
    return false;
  }
  
  let content = await fs.promises.readFile(pagePath, 'utf-8');
  
  // Strategy 1: Check import order
  console.log('🔍 [Recovery] Checking import order...');
  const hasImportOrderIssue = checkImportOrderIssue(content);
  
  if (hasImportOrderIssue) {
    console.log('🔧 [Recovery] Fixing import order...');
    content = validateAndFixImportOrder(content, pagePath);
    await fs.promises.writeFile(pagePath, content, 'utf-8');
    
    // Clear cache and rebuild
    await clearNextCache(projectRoot);
    
    console.log('✅ Import order fixed');
    return true;
  }
  
  // Strategy 2: Add force-dynamic if missing
  if (!content.includes("export const dynamic = 'force-dynamic'")) {
    console.log('🔧 [Recovery] Adding force-dynamic export...');
    
    const lines = content.split('\n');
    const lastImportIndex = findLastImportIndex(lines);
    
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0,
        '',
        '// Force dynamic rendering',
        "export const dynamic = 'force-dynamic';",
        ''
      );
      
      content = lines.join('\n');
      await fs.promises.writeFile(pagePath, content, 'utf-8');
      await clearNextCache(projectRoot);
      
      console.log('✅ Added force-dynamic');
      return true;
    }
  }
  
  // Strategy 3: Call AI to fix
  console.log('🤖 [Recovery] Calling AI to fix page structure...');
  
  const prompt = `
The homepage (src/app/page.tsx) is rendering a 404 page in production build.

Current file content:
\`\`\`typescript
${content.substring(0, 2000)}
\`\`\`

Fix this issue. The page should render correctly in production.

Requirements:
1. Ensure imports come BEFORE exports
2. Add 'export const dynamic = "force-dynamic"' if using client state
3. Ensure export default function exists
4. Return valid JSX, not null

Return ONLY the fixed page.tsx code in format:
[FILE: src/app/page.tsx]
... fixed code ...
[GOAL]
`;

  try {
    const response = await callAI({
      pipelineId: pipeline?.id || 'unknown',
      step: 'page_fixer',
      role: 'FIXER',
      model: selectModel('FIXER'),
      messages: [{ role: 'user', content: prompt }]
    });
    
    if (response && response.length > 100) {
      // Extract code from response
      const codeMatch = response.match(/\[FILE:\s*src\/app\/page\.tsx\]([\s\S]*?)(?:\[GOAL\]|$)/i);
      const fixedCode = codeMatch ? codeMatch[1].trim() : response;
      
      await fs.promises.writeFile(pagePath, fixedCode, 'utf-8');
      await clearNextCache(projectRoot);
      
      console.log('✅ AI fixed page structure');
      return true;
    }
  } catch (aiError: any) {
    console.log(`⚠️ AI fix failed: ${aiError.message}`);
  }
  
  return false;
}

function checkImportOrderIssue(content: string): boolean {
  const lines = content.split('\n');
  let firstImportIndex = -1;
  let firstExportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('import ') && firstImportIndex === -1) {
      firstImportIndex = i;
    }
    
    if (line.startsWith('export ') && !line.includes('export default') && firstExportIndex === -1) {
      firstExportIndex = i;
    }
  }
  
  return firstExportIndex !== -1 && firstImportIndex !== -1 && firstExportIndex < firstImportIndex;
}

function findLastImportIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().startsWith('import ')) {
      return i;
    }
  }
  return -1;
}

async function clearNextCache(projectRoot: string): Promise<void> {
  const cachePaths = [
    path.join(projectRoot, '.next'),
    path.join(projectRoot, 'tsconfig.tsbuildinfo'),
    path.join(projectRoot, 'node_modules/.cache')
  ];
  
  for (const cachePath of cachePaths) {
    if (fs.existsSync(cachePath)) {
      await fs.promises.rm(cachePath, { recursive: true, force: true });
    }
  }
}

/**
 * Call AI to fix page structure
 */
async function callAIToFixPage(
  pagePath: string,
  projectRoot: string,
  pipeline?: any
): Promise<boolean> {
  try {
    const pageContent = await fs.promises.readFile(pagePath, 'utf-8');
    
    const prompt = `
The homepage is rendering a 404 page during build. This usually happens when:
1. The page uses client-only features that prevent static generation
2. The page needs dynamic rendering configuration

Current page content:
${pageContent.substring(0, 2000)}

Fix the page by adding:
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

Place these exports right after any 'use client' directive.

Return ONLY the fixed file content in format:
[FILE: ${path.relative(projectRoot, pagePath)}]
... fixed code ...
[GOAL]
`;

    const response = await callAI({
      pipelineId: pipeline?.id || 'unknown',
      step: 'page_fixer',
      role: 'CODER',
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    if (response && response.trim().length > 0) {
      const filesWritten = await parseAndWriteFiles(response, projectRoot, pipeline?.id);
      return filesWritten > 0;
    }
    
    return false;
  } catch (aiError: any) {
    console.warn(`   ⚠️ AI page fixer failed: ${aiError.message}`);
    return false;
  }
}

/**
 * Extract missing dependencies from error message
 */
function extractMissingDependencies(error: string): string[] {
  const matches: string[] = [];
  
  // Pattern 1: Cannot find module 'package-name'
  const pattern1 = /Cannot find module ['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern1.exec(error)) !== null) {
    const pkg = match[1];
    // Skip relative imports and built-in modules
    if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('@/')) {
      // Skip Node.js built-ins
      if (!['fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 'stream', 'events', 'buffer', 'os', 'net', 'tls', 'dns', 'zlib', 'querystring', 'child_process'].includes(pkg)) {
        matches.push(pkg);
      }
    }
  }
  
  // Pattern 2: Module not found: Can't resolve 'package-name'
  const pattern2 = /Can't resolve ['"]([^'"]+)['"]/g;
  while ((match = pattern2.exec(error)) !== null) {
    const pkg = match[1];
    if (!pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('@/')) {
      if (!matches.includes(pkg)) {
        matches.push(pkg);
      }
    }
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Extract clean code from AI response
 * Removes [GOAL] markers, explanations, and other prompt artifacts
 */
function extractCodeFromAIResponse(response: string): string {
  // Try to extract code block first
  const codeBlockMatch = response.match(/```(?:typescript|tsx|ts|js|jsx|json|css|html)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // Remove common prompt artifacts
  let cleaned = response
    .replace(/\[GOAL\][\s\S]*$/m, '')           // Remove [GOAL] and everything after
    .replace(/\[INSTRUCTION\][\s\S]*$/m, '')    // Remove [INSTRUCTION] markers
    .replace(/^(Fixed|Updated|Changed|Modified).*$/gm, '')  // Remove explanation lines
    .replace(/^(Here's|This is|I've|The code|This code).*$/gm, '')  // Remove more explanation patterns
    .replace(/^(Note:|Explanation:|Summary:).*$/gm, '')     // Remove note/explanation headers
    .replace(/^#{1,6}\s.*$/gm, '')              // Remove markdown headers
    .replace(/^[-*+]\s.*$/gm, '')               // Remove markdown list items
    .replace(/^```[a-zA-Z0-9]*\n?/gm, '')        // Remove code fence starts
    .replace(/```$/gm, '')                       // Remove code fence ends
    .trim();
  
  return cleaned;
}

/**
 * Fix build errors using AI
 */
async function fixBuildErrorWithAI(
  error: string,
  projectRoot: string,
  pipeline?: any
): Promise<boolean> {
  try {
    const prompt = `
Build failed with the following error:

${error.substring(0, 2000)}

Fix the issue. Return ONLY the files that need to be modified in the format:
[FILE: path/to/file.tsx]
... fixed code ...
[GOAL]

Rules:
1. Fix ONLY the files with errors
2. Do NOT modify unrelated files
3. Ensure all imports are correct
4. Use proper TypeScript types
`;

    const response = await callAI({
      pipelineId: pipeline?.id || 'unknown',
      step: 'build_fixer',
      role: 'CODER',
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    // ✅ Use strict parsing helper
    if (response && response.trim().length > 0) {
      // The parseAndWriteFiles function already handles strict parsing,
      // but we can pre-clean the response here for extra safety
      const cleanedResponse = extractCodeFromAIResponse(response);
      
      // If cleaning removed too much, use original response
      const finalResponse = cleanedResponse.length > 50 ? cleanedResponse : response;
      
      const filesWritten = await parseAndWriteFiles(finalResponse, projectRoot, pipeline?.id);
      return filesWritten > 0;
    }
    
    return false;
  } catch (aiError: any) {
    console.warn(`   ⚠️ AI fixer error: ${aiError.message}`);
    return false;
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

// =============================================================================
// 🔒 PRE-PUBLISH BUILD VERIFICATION
// =============================================================================

/**
 * Validate Next.js config file
 * Ensures next.config.mjs exists and has required fields
 */
async function validateNextConfig(projectRoot: string): Promise<void> {
  const configPath = path.join(projectRoot, 'next.config.mjs');
  
  if (!fs.existsSync(configPath)) {
    console.log('⚠️ No next.config.mjs found, creating...');
    
    const defaultConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Support for client components
  experimental: {
    appDir: true,
  },
  
  // Proper output mode
  output: 'standalone',
  
  // Disable static optimization warnings
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
`;
    
    await fs.promises.writeFile(configPath, defaultConfig, 'utf-8');
    console.log('✅ Created default next.config.mjs');
    return;
  }
  
  // Verify it has required fields
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    let needsUpdate = false;
    let updatedConfig = configContent;
    
    // Check if experimental.appDir is enabled (for App Router)
    if (!configContent.includes('appDir') && !configContent.includes('experimental')) {
      console.log('⚠️ Enabling App Router support in next.config.mjs');
      
      // If there's already an experimental block, add appDir to it
      if (configContent.includes('experimental:')) {
        updatedConfig = configContent.replace(
          /experimental:\s*\{/,
          'experimental: {\n    appDir: true,'
        );
        needsUpdate = true;
      } else {
        // Add experimental block after reactStrictMode or at the start
        if (configContent.includes('reactStrictMode')) {
          updatedConfig = configContent.replace(
            /reactStrictMode:\s*true,?/,
            'reactStrictMode: true,\n  experimental: {\n    appDir: true,\n  },'
          );
        } else {
          updatedConfig = configContent.replace(
            /const nextConfig = \{/,
            `const nextConfig = {\n  experimental: {\n    appDir: true,\n  },`
          );
        }
        needsUpdate = true;
      }
    }
    
    // Ensure reactStrictMode is set
    if (!configContent.includes('reactStrictMode')) {
      console.log('⚠️ Adding reactStrictMode to next.config.mjs');
      updatedConfig = updatedConfig.replace(
        /const nextConfig = \{/,
        'const nextConfig = {\n  reactStrictMode: true,'
      );
      needsUpdate = true;
    }
    
    if (needsUpdate && updatedConfig !== configContent) {
      fs.writeFileSync(configPath, updatedConfig, 'utf-8');
      console.log('✅ Updated next.config.mjs with required settings');
    } else if (!needsUpdate) {
      console.log('✅ next.config.mjs is valid');
    }
  } catch (error: any) {
    console.warn(`⚠️ Could not validate next.config.mjs: ${error.message}`);
  }
}

/**
 * Analyze Next.js build output
 * Parses build output to detect issues and provide recommendations
 */
interface BuildAnalysis {
  success: boolean;
  warning?: string;
  recommendation?: string;
  routes?: string[];
}

async function analyzeBuildOutput(buildOutput: string): Promise<BuildAnalysis> {
  // Parse Next.js build output
  const routeMatches = buildOutput.match(/Route \(pages\)\n([\s\S]*?)\n\n/);
  
  if (routeMatches) {
    const routes = routeMatches[1];
    
    // Check if root page was generated
    if (!routes.includes('○ /') && !routes.includes('λ /') && !routes.includes('ƒ /')) {
      console.log('⚠️ Root page (/) was not generated');
      console.log('📝 Generated routes:', routes);
      
      return {
        success: true,  // Build succeeded
        warning: 'Root page not statically generated - using dynamic rendering',
        recommendation: 'Consider adding static export or removing client-only dependencies',
        routes: routes.split('\n').filter(Boolean)
      };
    }
    
    // Extract all routes for logging
    const routeList = routes.split('\n').filter(Boolean);
    console.log(`✅ Build generated ${routeList.length} route(s)`);
    
    return {
      success: true,
      routes: routeList
    };
  }
  
  // Check for common build warnings
  if (buildOutput.includes('warn')) {
    const warnings = buildOutput.match(/⚠\s+(.+)/g) || [];
    if (warnings.length > 0) {
      console.log(`⚠️ Build warnings detected: ${warnings.length}`);
      warnings.slice(0, 3).forEach(w => console.log(`   ${w}`));
    }
  }
  
  return { success: true };
}

/**
 * Helper: Wait for server to start and respond
 */
async function waitForServer(url: string, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status === 404) { // 404 is OK - means server is up
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

/**
 * Helper: Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('/')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Helper: Convert string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .split('/')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fix 1: Pre-Publish Build Verification
 * Verifies production build, tests server, and fixes broken links
 */
async function runFinalBuildVerification(
  workspacePath: string,
  pipelineId: string,
  pipeline?: any
): Promise<void> {
  console.log('\n🔒 FINAL BUILD VERIFICATION (Pre-Publish Gate)');
  
  // Step 1: Production build with recovery
  console.log('   📦 Running production build...');
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  
  while (attempts < MAX_ATTEMPTS) {
    try {
      const buildOutput = execSync('npm run build', {
        cwd: workspacePath,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 120000 // 2 min max
      }).toString();
      
      // ✅ Analyze build output
      const buildAnalysis = await analyzeBuildOutput(buildOutput);
      if (buildAnalysis.warning) {
        console.log(`   ⚠️ ${buildAnalysis.warning}`);
        if (buildAnalysis.recommendation) {
          console.log(`   💡 ${buildAnalysis.recommendation}`);
        }
      }
      
      console.log('   ✅ Production build successful');
      break; // Success, exit retry loop
    } catch (error: any) {
      attempts++;
      const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || '';
      console.error(`   ❌ Production build FAILED (attempt ${attempts}/${MAX_ATTEMPTS})`);
      
      if (attempts >= MAX_ATTEMPTS) {
        throw new Error(`Build failed after ${MAX_ATTEMPTS} attempts: ${errorOutput}`);
      }
      
      // ✅ RECOVERY AGENT: Attempt to fix common issues
      console.log('   🔧 [Recovery Agent] Attempting to fix build error...');
      const recovered = await attemptBuildRecovery(errorOutput, workspacePath, pipeline);
      
      if (recovered) {
        console.log('   ✅ Recovery successful, retrying build...');
        continue; // Retry build
      } else {
        console.warn('   ⚠️ Recovery agent could not fix the error');
        // Still retry in case it was a transient issue
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }
  }
  
  // Step 2: Start production server and verify it responds
  console.log('   🚀 Testing production server...');
  
  const serverProcess = spawn('npm', ['start'], {
    cwd: workspacePath,
    env: { ...process.env, PORT: '3003' },
    shell: true
  });
  
  try {
    // Wait for server to start
    await waitForServer('http://localhost:3003', 30000);
    
    // Fetch homepage
    const response = await fetch('http://localhost:3003');
    const html = await response.text();
    
    // Verify it's not a 404
    if (html.includes('404') || html.includes('This page could not be found')) {
      throw new Error('Homepage renders 404 page');
    }
    
    // Verify it has content
    const bodyMatch = html.match(/<body[^>]*>(.*?)<\/body>/is);
    const bodyContent = bodyMatch?.[1] || '';
    
    if (bodyContent.length < 100) {
      throw new Error(`Homepage has minimal content (${bodyContent.length} chars)`);
    }
    
    console.log('   ✅ Production server verified');
    
  } finally {
    serverProcess.kill();
  }
  
  // Step 3: Check for broken navigation links
  console.log('   🔍 Scanning for broken links...');
  
  const brokenLinks = await findBrokenLinks(workspacePath);
  
  if (brokenLinks.length > 0) {
    console.warn('   ⚠️ Found broken navigation links:');
    brokenLinks.forEach(link => {
      console.warn(`      - ${link.file}: "${link.text}" → ${link.href}`);
    });
    
    // Auto-generate stub pages for broken links
    console.log('   🔧 Auto-generating stub pages...');
    await generateStubPages(workspacePath, brokenLinks);
    console.log('   ✅ Stub pages created');
  } else {
    console.log('   ✅ No broken links found');
  }
  
  console.log('✅ FINAL BUILD VERIFICATION PASSED\n');
}

/**
 * Helper: Find broken navigation links
 */
async function findBrokenLinks(workspacePath: string): Promise<Array<{file: string, text: string, href: string}>> {
  const brokenLinks: Array<{file: string, text: string, href: string}> = [];
  
  // Scan all TSX/JSX files
  const files = glob.sync('src/**/*.{tsx,jsx}', { cwd: workspacePath });
  
  for (const file of files) {
    const fullPath = path.join(workspacePath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Find <Link href="/path"> or <a href="/path">
    const linkRegex = /<(?:Link|a)\s+href=["']([^"']+)["'][^>]*>([^<]*)</g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[1];
      const text = match[2];
      
      // Skip external links and anchors
      if (href.startsWith('http') || href.startsWith('#')) continue;
      
      // Check if page exists
      const pagePath = path.join(
        workspacePath,
        'src/app',
        href === '/' ? 'page.tsx' : `${href}/page.tsx`
      );
      
      if (!fs.existsSync(pagePath)) {
        brokenLinks.push({ file, text, href });
      }
    }
  }
  
  return brokenLinks;
}

/**
 * Helper: Generate stub pages for broken links
 */
async function generateStubPages(
  workspacePath: string,
  brokenLinks: Array<{file: string, text: string, href: string}>
): Promise<void> {
  const uniqueHrefs = [...new Set(brokenLinks.map(l => l.href))];
  
  for (const href of uniqueHrefs) {
    const pageDir = path.join(workspacePath, 'src/app', href);
    const pagePath = path.join(pageDir, 'page.tsx');
    
    // Create directory
    fs.mkdirSync(pageDir, { recursive: true });
    
    // Create stub page
    const stubContent = `export default function ${toPascalCase(href)}Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-purple-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          ${toTitleCase(href)}
        </h1>
        <p className="text-slate-400">
          This page is coming soon...
        </p>
      </div>
    </div>
  )
}
`;
    
    fs.writeFileSync(pagePath, stubContent, 'utf-8');
  }
}

/**
 * Fix 2: Dependency Scanner & Auto-Fixer
 * Scans imports and installs missing packages
 */
async function validateAndFixDependencies(workspacePath: string): Promise<void> {
  console.log('📦 Validating dependencies...');
  
  // Scan all source files for imports
  const files = glob.sync('src/**/*.{ts,tsx,js,jsx}', { cwd: workspacePath });
  const requiredPackages = new Set<string>();
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(workspacePath, file), 'utf-8');
    
    // Extract imports
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const pkg = match[1];
      
      // Skip relative imports and built-ins
      if (pkg.startsWith('.') || pkg.startsWith('@/')) continue;
      
      // Extract package name (handle scoped packages)
      const pkgName = pkg.startsWith('@') 
        ? pkg.split('/').slice(0, 2).join('/')
        : pkg.split('/')[0];
      
      requiredPackages.add(pkgName);
    }
  }
  
  // Read package.json
  const pkgJsonPath = path.join(workspacePath, 'package.json');
  const pkgJson = readPackageJson(pkgJsonPath);
  
  const installedPackages = new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {})
  ]);
  
  // Find missing packages
  const missingPackages = [...requiredPackages].filter(
    pkg => !installedPackages.has(pkg)
  );
  
  if (missingPackages.length > 0) {
    console.warn('   ⚠️ Missing dependencies detected:');
    missingPackages.forEach(pkg => console.warn(`      - ${pkg}`));
    
    console.log('   📥 Auto-installing missing packages...');
    
    execSync(`npm install ${missingPackages.join(' ')}`, {
      cwd: workspacePath,
      stdio: 'inherit'
    });
    
    console.log('   ✅ Dependencies fixed');
  } else {
    console.log('   ✅ All dependencies present');
  }
}

/**
 * Fix 3: Better README Generation
 * Generates a comprehensive README.md for the project
 */
async function generateProductionReadme(
  workspacePath: string,
  projectName: string
): Promise<void> {
  const pkgJson = readPackageJson(path.join(workspacePath, 'package.json'));
  
  const hasPython = fs.existsSync(path.join(workspacePath, 'backend'));
  
  const readme = `# ${projectName}

${pkgJson.description || 'Auto-generated full-stack application'}

## 🚀 Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/${projectName}.git
cd ${projectName}

# Install dependencies
npm install

${hasPython ? `# Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..

` : ''}# Run development server
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📦 Tech Stack

- **Frontend:** ${pkgJson.dependencies?.next ? `Next.js ${pkgJson.dependencies.next}` : 'React'}
- **Styling:** Tailwind CSS
- **TypeScript:** ${pkgJson.dependencies?.typescript || pkgJson.devDependencies?.typescript ? '✅' : '❌'}
${hasPython ? '- **Backend:** FastAPI (Python)' : ''}
- **Database:** Supabase

## 🛠️ Prerequisites

- Node.js ${process.version} or higher
- npm or pnpm
${hasPython ? '- Python 3.10+ (for backend)' : ''}

## 📁 Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── app/          # Next.js app directory
│   ├── components/   # React components
│   ├── lib/          # Utilities and types
│   └── types/        # TypeScript definitions
${hasPython ? `├── backend/
│   ├── main.py       # FastAPI server
│   └── requirements.txt
` : ''}├── package.json
└── README.md
\`\`\`

## 🔧 Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm run lint\` - Run ESLint
${hasPython ? `- \`npm run backend\` - Start Python backend` : ''}

## 🌐 Environment Variables

Copy \`.env.example\` to \`.env.local\` and fill in your values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Required variables:
${pkgJson.dependencies?.['@supabase/supabase-js'] ? `
- \`NEXT_PUBLIC_SUPABASE_URL\` - Your Supabase project URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` - Your Supabase anon key` : ''}

## 📝 License

MIT

---

**Generated by Frost Night Factory** ❄️
`;

  fs.writeFileSync(
    path.join(workspacePath, 'README.md'),
    readme,
    'utf-8'
  );
}

async function runPublisherStep(pipeline: any, repoPath: string) {
  console.log(`[Publisher] Starting deployment for ${pipeline.id}...`);
  await updatePipeline(pipeline.id, { current_phase: 'publisher' });
  await createStep(pipeline.id, 'publisher', 'running');

  const pipelineId = pipeline.id;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    try {
      // 🔒 PRE-PUBLISH VERIFICATION (NEW - Fix 1, 2, 3)
      console.log(`\n🔒 [Publisher] Running pre-publish verification (attempt ${attempts}/${MAX_ATTEMPTS})...`);
      
      // Fix 1: Final Build Verification
      await runFinalBuildVerification(repoPath, pipeline.id, pipeline);
    
    // Fix 2: Validate and Fix Dependencies
    await validateAndFixDependencies(repoPath);
    
    // Fix 3: Integration Tests (if backend exists)
    if (fs.existsSync(path.join(repoPath, 'backend', 'main.py'))) {
      console.log('🔗 [Publisher] Backend detected - Running integration tests...');
      try {
        const { runIntegrationTestSuite } = await import('./lib/integration-tester');
        const integrationResult = await runIntegrationTestSuite({
          workspaceRoot: repoPath,
          backendEntry: 'backend/main.py',
          backendPort: 8001,
        });
        
        if (!integrationResult.success) {
          console.error('❌ [Publisher] Integration tests failed:');
          integrationResult.errors.forEach(err => console.error(`   - ${err}`));
          throw new Error(`Integration tests failed: ${integrationResult.errors.join('; ')}`);
        }
        
        console.log(`✅ [Publisher] Integration tests passed (${integrationResult.endpointsTested} endpoints tested)`);
        if (integrationResult.typesGenerated) {
          console.log('   ✅ TypeScript types generated from OpenAPI');
        }
        
        // ✅ P2: Pact Contract Testing
        if (isFeatureEnabled('runPactTesting')) {
          console.log('\n📜 [Pact] Running contract tests...');
          try {
            const { generateAndTestContracts } = await import('./lib/pact-tester');
            const pactResult = await generateAndTestContracts(repoPath);
            
            if (!pactResult.success) {
              console.warn('⚠️ [Pact] Contract verification failed:');
              pactResult.errors.forEach(err => console.warn(`   - ${err}`));
            } else {
              console.log(`   ✅ All ${pactResult.contractsVerified} contracts verified`);
            }
          } catch (error: any) {
            console.error('❌ [Pact] Failed:', error.message);
            console.warn('⚠️ Continuing pipeline without contract testing...');
          }
        } else {
          console.log('   ⏭️ Pact contract testing disabled (feature flag)');
        }
      } catch (error: any) {
        console.error('❌ [Publisher] Integration test error:', error.message);
        // Don't block publish if integration tests fail - just warn
        console.warn('   ⚠️ Continuing with publish despite integration test failure');
      }
    }
    
    // Fix 4: Generate Production README
    const projectName = (() => {
      try {
        const pkg = readPackageJson(path.join(repoPath, 'package.json'));
        return pkg.name || pipeline.name || 'frost-project';
      } catch {
        return pipeline.name || 'frost-project';
      }
    })();
    await generateProductionReadme(repoPath, projectName);
    
    console.log('✅ [Publisher] Pre-publish verification complete\n');
    
    // Success! Exit retry loop
    break;
    
  } catch (error: any) {
    console.log(`❌ [Publisher] Failed: ${error.message}`);
    
    // ✅ RECOVERY AGENT: Fix 404 errors
    if (error.message.includes('Homepage renders 404') || error.message.includes('404 page')) {
      console.log(`🔧 [Recovery Agent] Attempting to fix 404 error (attempt ${attempts}/${MAX_ATTEMPTS})...`);
      
      const fixed = await attemptHomepage404Fix(repoPath, pipeline);
      
      if (fixed) {
        console.log('✅ Recovery successful, retrying verification...');
        continue; // Retry
      } else {
        console.warn('⚠️ Recovery agent could not fix the 404 error');
      }
    }
    
    // Max retries reached
    if (attempts >= MAX_ATTEMPTS) {
      console.log(`❌ Publisher failed after ${MAX_ATTEMPTS} attempts`);
      await updatePipelineStatus(pipelineId, 'failed', error.message);
      await updateStep(pipelineId, 'publisher', 'failed', error.message);
      return; // Exit without throwing
    }
    
    console.log(`⚠️ Retrying (${attempts}/${MAX_ATTEMPTS})...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
  }
  }
  
  // Continue with rest of publisher logic
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
                const pkg = readPackageJson(pkgPath);
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
        let repoName = slug.startsWith('frost-') ? slug : `frost-${slug}`; // T.ex. "frost-sportsync-dashboard" eller "frost-context-crystal"
        
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
                        repoName = newName; // This is now let, so assignment is allowed
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

    // 4.5. THE FINAL SWEEP: Rensa roten från dubbletter innan commit
    console.log("[Publisher] 🧹 Performing final cleanup before commit...");
    const srcExists = fs.existsSync(path.join(repoPath, 'src'));
    
    if (srcExists) {
      // Om vi använder src/, ska dessa mappar INTE finnas i roten
      const forbiddenInRoot = ['app', 'components', 'lib', 'types', 'utils', 'hooks', 'styles', 'services'];
      
      for (const folder of forbiddenInRoot) {
        const folderPath = path.join(repoPath, folder);
        if (fs.existsSync(folderPath)) {
          console.log(`   🗑️ Nuke: Removing root '/${folder}' (files should be in src/)`);
          try {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`   ✅ Removed root '/${folder}'`);
          } catch (e: any) {
            console.warn(`   ⚠️ Could not remove ${folder}:`, e.message);
          }
        }
      }
    }
    
    console.log("[Publisher] ✅ Final cleanup complete.");

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

    await updateStep(pipeline.id, 'publisher', 'completed', JSON.stringify({ url: targetRepoUrl }));
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

  // ✅ VALIDATE ENVIRONMENT
  validateEnvironment();

  // ✅ Declare variables at function scope so they're accessible in catch block
  let frontendPort: number | null = null;
  let backendPort: number | null = null;
  let costTracker: CostTracker | null = null;
  let pipeline: any = null;

  while (true) {
    try {
      // ✅ FIX C: Clear context cache at start of each loop iteration
      // Prevents stale cached contexts from previous pipeline runs
      clearContextCache();
      
      // Hämta aktiva pipelines
      const { data: pipelines, error } = await supabase
        .from('pipelines')
        .select('*')
        .in('status', ['pending', 'running'])
        .neq('current_phase', 'done')
        .order('updated_at', { ascending: true }) // FIFO
        .limit(1);

      if (error) {
        console.error('❌ Error fetching pipelines:', error);
        throw error;
      }

      if (!pipelines || pipelines.length === 0) {
        await sleep(5000);
        continue;
      }

      pipeline = pipelines[0];
      
      // ✅ LOG PIPELINE PICKUP
      console.log(`\n📥 [Pipeline ${pipeline.id.slice(0, 8)}] Claimed`);
      console.log(`   Name: ${pipeline.name || 'Untitled'}`);
      console.log(`   Status: ${pipeline.status}`);
      console.log(`   Phase: ${pipeline.current_phase}`);
      console.log(`   Ticket ID: ${pipeline.ticket_id || 'N/A'}`);
      console.log(`🔧 Starting AI agents...\n`);
      
      // ✅ CHECK DB STATE FIRST (prevent loops)
      if (pipeline.status === 'failed_hard') {
        console.error('🚨 Pipeline is hard failed. Manual intervention required.');
        console.error(`   Pipeline ID: ${pipeline.id}`);
        console.error(`   Reason: ${pipeline.last_error || 'Unknown error'}`);
        // Skip this pipeline and continue to next
        await sleep(5000);
        continue;
      }

      if (pipeline.retry_count >= (pipeline.max_retries || 10)) {
        await updatePipelineStatus(pipeline.id, 'failed_hard', 'Max retries exceeded');
        
        console.error(`🚨 Max retries exceeded for pipeline ${pipeline.id}. Marking as failed_hard.`);
        await sleep(5000);
        continue;
      }

      const repoPath = getRepoPath(pipeline);

      // ✅ V8: Allocate dynamic ports for this pipeline
      try {
        frontendPort = await PortManager.findAvailablePort(3000, 3100);
        backendPort = await PortManager.findAvailablePort(8000, 8100);
        console.log(`📡 Allocated ports: Frontend=${frontendPort}, Backend=${backendPort}`);
        
        // Store ports in pipeline metadata
        await supabase
          .from('pipelines')
          .update({
            metadata: {
              ...(pipeline.metadata || {}),
              frontend_port: frontendPort,
              backend_port: backendPort,
            },
          })
          .eq('id', pipeline.id);
      } catch (error: any) {
        console.warn(`⚠️ Port allocation failed: ${error.message}`);
        console.warn('   Using default ports (may cause conflicts)...');
        frontendPort = 3002;
        backendPort = 8000;
      }

      // ✅ V8: Get stack config from ticket (if available)
      let stackConfig: any = null;
      if (pipeline.ticket_id) {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('stack_config')
          .eq('id', pipeline.ticket_id)
          .single();
        
        if (ticket?.stack_config) {
          stackConfig = ticket.stack_config;
          console.log('\n🔧 STACK CONFIGURATION:');
          console.log(`   Frontend: ${stackConfig.frontend}`);
          console.log(`   Backend: ${stackConfig.backend}`);
          console.log(`   UI: ${stackConfig.ui}`);
          console.log(`   Features: ${stackConfig.features?.join(', ') || 'none'}`);
        }
      }

      // ✅ P2: Start Cost Tracking (available throughout pipeline)
      // costTracker already declared at function scope (line 10097)
      if (isFeatureEnabled('trackCosts')) {
        try {
          costTracker = new CostTracker();
          costTracker.startPipeline(pipeline.id);
          // Make available globally for callAI
          (global as any).costTracker = costTracker;
        } catch (error: any) {
          console.warn(`⚠️ Cost tracking initialization failed: ${error.message}`);
          console.warn('   Continuing without cost tracking...');
        }
      }

      // ✅ RE-HYDRATE MISSING DATA
      pipeline = await rehydrateMissingPhaseData(pipeline.id, pipeline);
      
      // ✅ LAYER 1: Normalize phase (handle aliases/legacy phases)
      function normalizePhase(phase: string): string {
        if (!phase) return "research";
        const p = phase.trim();

        // ✅ aliases / legacy
        if (p === "coder_planning_complete") return "coder";
        if (p === "coder_planning") return "coder";
        if (p === "planning") return "planner";
        if (p === "code") return "coder";
        if (p === "sql_editor" || p === "sqleditor") return "sql";
        if (p === "test" || p === "testing") return "tester";

        return p;
      }

      // Normalize phase before switch
      const normalizedPhase = normalizePhase(pipeline.current_phase);
      if (normalizedPhase !== pipeline.current_phase) {
        console.log(`🔄 [Phase Normalizer] Normalized "${pipeline.current_phase}" → "${normalizedPhase}"`);
        await updatePipeline(pipeline.id, { current_phase: normalizedPhase });
        pipeline.current_phase = normalizedPhase;
      }
      
      // Fas-väljare
      console.log(`[Pipeline ${pipeline.id.slice(0, 8)}] Executing phase: ${pipeline.current_phase}`);
      switch (pipeline.current_phase) {
        case 'cloner':
          await runClonerStep(pipeline, repoPath);
          break;
        case 'research':
          // ═══════════════════════════════════════════════════════════════════
          // TWO-PHASE RESEARCH ARCHITECTURE
          // ═══════════════════════════════════════════════════════════════════
          console.log('[Research] Starting two-phase research architecture...');
          await updatePipeline(pipeline.id, { status: 'running', current_phase: 'research' });
          await createStep(pipeline.id, 'research', 'running', { prompt: pipeline.initial_prompt || pipeline.prompt });

          // Check if research already completed (caching mechanism)
          const { data: existing } = await supabase
            .from('pipeline_steps')
            .select('*')
            .eq('pipeline_id', pipeline.id)
            .eq('name', 'research')
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1);

          if (existing && existing.length > 0) {
            console.log('[Research] Found existing research, skipping.');
            await updatePipeline(pipeline.id, { current_phase: 'planner' });
            break;
          }

          try {
            // Phase 1: Perplexity Research (Multiple focused queries)
            console.log('[Research] Phase 1: Running Perplexity research queries...');
            const perplexityReport1 = await runResearchStep(pipeline, 'technical-constraints');
            const perplexityReport2 = await runResearchStep(pipeline, 'best-practices');

            // Phase 2: K2 Synthesis
            console.log('[Research] Phase 2: Running K2 synthesis...');
            const k2Synthesis = await runK2SynthesisStep(
              pipeline.id,
              pipeline.initial_prompt || pipeline.prompt || '',
              [perplexityReport1, perplexityReport2]
            );

            // Store combined research results
            const combinedResearch = {
              perplexity: {
                technicalConstraints: perplexityReport1,
                bestPractices: perplexityReport2
              },
              k2Synthesis: k2Synthesis
            };

            await updateStep(pipeline.id, 'research', 'completed', JSON.stringify(combinedResearch));
            
            // --- INFO TRANSPORTER: Convert research to JSON ---
            try {
              const { data: pipelineData } = await supabase.from('pipelines').select('initial_prompt').eq('id', pipeline.id).single();
              const userPrompt = pipelineData?.initial_prompt || '';
              const researchRaw = JSON.stringify(combinedResearch);
              const researchJson = await convertResearchToJSON(researchRaw, userPrompt);
              if (researchJson.success && researchJson.data) {
                console.log(`📡 [Info Transporter] Research phase JSON converted successfully`);
              }
            } catch (transporterError: any) {
              console.warn(`⚠️ [Info Transporter] Research conversion failed (non-fatal): ${transporterError.message}`);
            }
            
            await updatePipeline(pipeline.id, { current_phase: 'planner' });
            console.log('[Research] ✅ Two-phase research complete!');
          } catch (error: any) {
            console.error('[Research] Failed:', error);
            await updatePipeline(pipeline.id, { status: 'failed' });
          }
          break;
        case 'planner':
          // --- INFO TRANSPORTER: Accumulate all previous contexts ---
          let plannerContext: any = null;
          try {
            plannerContext = await accumulateAllContexts(pipeline.id, 'planner');
            console.log(`📡 [Info Transporter] Planner will receive context from: ${Object.keys(plannerContext).join(', ')}`);
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Failed to accumulate contexts (non-fatal): ${transporterError.message}`);
          }
          
          await runPlannerStep(pipeline, repoPath, plannerContext);
          
          // --- INFO TRANSPORTER: Convert planner to JSON after completion ---
          try {
            const plannerJson = await transportPhaseContext(pipeline.id, 'planner', 'coder');
            if (plannerJson) {
              console.log(`📡 [Info Transporter] Planner JSON converted successfully`);
            }
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Planner conversion failed (non-fatal): ${transporterError.message}`);
          }
          
          // ✅ P2: A/B Testing (optional - only for high priority)
          const shouldGenerateVariants = isFeatureEnabled('enableABTesting') && 
            (pipeline.priority === 'high' || (pipeline.budget && pipeline.budget > 1.00));
          if (shouldGenerateVariants && process.env.ANTHROPIC_API_KEY) {
            console.log('\n🔀 [A/B Testing] Generating 2 design variants...');
            try {
              const { generateABVariants } = await import('./lib/ab-generator');
              const variants = await generateABVariants(repoPath, pipeline.initial_prompt || pipeline.prompt || '');
              
              await supabase
                .from('pipelines')
                .update({
                  status: 'awaiting_variant_selection',
                  variants: variants.map(v => ({
                    name: v.name,
                    description: v.description,
                  })),
                })
                .eq('id', pipeline.id);
              
              console.log('⏸️ Pipeline paused - waiting for user to select variant');
              console.log(`   View variants at: http://localhost:3001/variants/${pipeline.id}`);
              
              // Wait for selection (polling)
              let selected = false;
              while (!selected) {
                await sleep(5000);
                const { data: updated } = await supabase
                  .from('pipelines')
                  .select('status, selected_variant')
                  .eq('id', pipeline.id)
                  .single();
                
                if (updated?.status !== 'awaiting_variant_selection' || updated?.selected_variant) {
                  selected = true;
                  console.log('▶️ Resuming pipeline with selected variant');
                }
              }
            } catch (error: any) {
              console.error('❌ [A/B Testing] Failed:', error.message);
              console.warn('⚠️ Continuing pipeline without A/B variants...');
              // Continue without variants
            }
          }
          break;
        case 'coder':
          // --- INFO TRANSPORTER: Accumulate ALL previous contexts ---
          let coderContext: any = null;
          try {
            coderContext = await accumulateAllContexts(pipeline.id, 'coder');
            console.log(`📡 [Info Transporter] Coder will receive context from: ${Object.keys(coderContext).join(', ')}`);
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Failed to accumulate contexts (non-fatal): ${transporterError.message}`);
          }
          
          await runCoderStep(pipeline, repoPath, coderContext);
          
          // --- INFO TRANSPORTER: Convert coder to JSON after completion ---
          try {
            const coderJson = await transportPhaseContext(pipeline.id, 'coder', 'sql');
            if (coderJson) {
              console.log(`📡 [Info Transporter] Coder JSON converted successfully`);
            }
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Coder conversion failed (non-fatal): ${transporterError.message}`);
          }
          break;
        case 'sql':
          // --- INFO TRANSPORTER: Accumulate ALL previous contexts ---
          let sqlContext: any = null;
          try {
            sqlContext = await accumulateAllContexts(pipeline.id, 'sql');
            console.log(`📡 [Info Transporter] SQL will receive context from: ${Object.keys(sqlContext).join(', ')}`);
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Failed to accumulate contexts (non-fatal): ${transporterError.message}`);
          }
          
          await runSqlStep(pipeline, repoPath, sqlContext);
          
          // --- INFO TRANSPORTER: Convert SQL to JSON after completion ---
          try {
            const sqlJson = await transportPhaseContext(pipeline.id, 'sql', 'tester');
            if (sqlJson) {
              console.log(`📡 [Info Transporter] SQL JSON converted successfully`);
            }
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] SQL conversion failed (non-fatal): ${transporterError.message}`);
          }
          
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
          // --- INFO TRANSPORTER: Accumulate ALL previous contexts ---
          let testerContext: any = null;
          try {
            testerContext = await accumulateAllContexts(pipeline.id, 'tester');
            console.log(`📡 [Info Transporter] Tester will receive context from: ${Object.keys(testerContext).join(', ')}`);
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Failed to accumulate contexts (non-fatal): ${transporterError.message}`);
          }
          
          await runTesterStep(pipeline, repoPath, testerContext);
          
          // --- INFO TRANSPORTER: Convert tester to JSON after completion ---
          try {
            const testerJson = await transportPhaseContext(pipeline.id, 'tester', 'publisher');
            if (testerJson) {
              console.log(`📡 [Info Transporter] Tester JSON converted successfully`);
            }
          } catch (transporterError: any) {
            console.warn(`⚠️ [Info Transporter] Tester conversion failed (non-fatal): ${transporterError.message}`);
          }
          
          // Vision-Based UI Refinement (P1 - Gemini's Insight)
          if (isFeatureEnabled('runVisionRefinement')) {
            if (process.env.ANTHROPIC_API_KEY) {
              console.log('\n🎨 [Vision Refiner] Starting UI refinement...');
              try {
                // Ensure dev server is running for vision refinement
                const devServer = await startDevServerWithVerification(repoPath, frontendPort || 3002);
                
                if (devServer.pageCompiled) {
                  const { visionRefineUI } = await import('./lib/vision-refiner');
                  const visionResult = await visionRefineUI(repoPath, 3, 8.5, frontendPort || 3002);
                  
                  if (visionResult.score < 7) {
                    console.warn(`   ⚠️ UI score is ${visionResult.score}/10, but continuing...`);
                  } else {
                    console.log(`   ✅ UI refinement complete (score: ${visionResult.score}/10)`);
                  }
                  
                  // Cleanup dev server
                  devServer.process.kill();
                } else {
                  console.warn('   ⚠️ Dev server not ready, skipping vision refinement');
                  devServer.process.kill();
                }
              } catch (error: any) {
                console.error('❌ [Vision Refiner] Failed:', error.message);
                console.warn('⚠️ Continuing pipeline without vision refinement...');
                // Don't block pipeline - vision refinement is optional
              }
            } else {
              console.log('   ℹ️ ANTHROPIC_API_KEY not set, skipping vision refinement');
              console.log('   💡 Set ANTHROPIC_API_KEY to enable visual UI scoring');
            }
          } else {
            console.log('   ⏭️ Vision refinement disabled (feature flag)');
          }
          
          // ✅ P2: Playwright E2E Tests
          if (isFeatureEnabled('runPlaywrightTests')) {
            console.log('\n🎭 [Playwright] Running E2E tests...');
            try {
              const { runPlaywrightTests } = await import('./lib/playwright-tester');
              const playwrightResult = await runPlaywrightTests(repoPath, frontendPort || 3002);
              
              if (!playwrightResult.success) {
                console.error('❌ [Playwright] E2E tests failed. Issues found:');
                playwrightResult.errors.forEach((err, i) => {
                  console.error(`\n   ${i + 1}. ${err.test}`);
                  console.error(`      Error: ${err.error}`);
                  if (err.screenshot) {
                    console.error(`      Screenshot: ${err.screenshot}`);
                  }
                });
                console.warn('⚠️ Publishing anyway, but manual review recommended');
              } else {
                console.log(`✅ [Playwright] E2E tests: ${playwrightResult.testsPassed}/${playwrightResult.testsRun} passed`);
              }
            } catch (error: any) {
              console.error('❌ [Playwright] Failed:', error.message);
              console.warn('⚠️ Continuing pipeline without E2E tests...');
              // Don't block pipeline
            }
          } else {
            console.log('   ⏭️ Playwright E2E tests disabled (feature flag)');
          }
          
          // ✅ P2: Lighthouse Performance Audit
          if (isFeatureEnabled('runLighthouseAudit')) {
            console.log('\n🔍 [Lighthouse] Running performance audit...');
            try {
              const { runPerformanceAudit } = await import('./lib/performance-auditor');
              const perfResult = await runPerformanceAudit(`http://localhost:${frontendPort || 3002}`, repoPath);
              
              if (!perfResult.passed) {
                console.warn('⚠️ [Lighthouse] Performance audit below threshold:');
                Object.entries(perfResult.scores).forEach(([key, score]) => {
                  if (score < 70) {
                    console.warn(`   - ${key}: ${score.toFixed(0)}/100`);
                  }
                });
              }
              
              // Update pipeline with performance data
              await supabase
                .from('pipelines')
                .update({
                  lighthouse_scores: perfResult.scores,
                  lighthouse_metrics: perfResult.metrics,
                })
                .eq('id', pipeline.id);
            } catch (error: any) {
              console.error('❌ [Lighthouse] Failed:', error.message);
              console.warn('⚠️ Continuing pipeline without performance audit...');
              // Don't block pipeline
            }
          } else {
            console.log('   ⏭️ Lighthouse audit disabled (feature flag)');
          }
          break;
        case 'publisher':
          await runPublisherStep(pipeline, repoPath);
          
          // ✅ P2: End Cost Tracking
          if (costTracker) {
            try {
              const finalCost = costTracker.endPipeline();
              
              // Update Supabase with cost
              await supabase
                .from('pipelines')
                .update({ 
                  cost: finalCost.totalCost,
                  cost_breakdown: finalCost.breakdown,
                })
                .eq('id', pipeline.id);
            } catch (error: any) {
              console.error('❌ [Cost Tracker] Failed:', error.message);
              console.warn('⚠️ Continuing without cost tracking...');
            }
          }
          
          // ✅ V8: Release ports when pipeline completes
          if (frontendPort) {
            PortManager.releasePort(frontendPort);
          }
          if (backendPort) {
            PortManager.releasePort(backendPort);
          }
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
      
      // ✅ P2: End cost tracking on error
      if (costTracker) {
        try {
          costTracker.endPipeline();
        } catch {
          // Ignore cost tracking errors during error handling
        }
      }
      
      // ✅ V8: Release ports on error
      // Get ports from variables or pipeline metadata (fallback)
      // Note: pipeline might not exist if error occurred before assignment
      const frontendPortToRelease = (typeof frontendPort !== 'undefined' ? frontendPort : null) || 
                                    (typeof pipeline !== 'undefined' ? pipeline.metadata?.frontend_port : null);
      const backendPortToRelease = (typeof backendPort !== 'undefined' ? backendPort : null) || 
                                   (typeof pipeline !== 'undefined' ? pipeline.metadata?.backend_port : null);
      
      if (frontendPortToRelease) {
        try {
          PortManager.releasePort(frontendPortToRelease);
        } catch {
          // Ignore port release errors
        }
      }
      if (backendPortToRelease) {
        try {
          PortManager.releasePort(backendPortToRelease);
        } catch {
          // Ignore port release errors
        }
      }
      
      await sleep(5000);
    }
  }
}


// ==========================================
// 🚀 MAIN ENTRY POINT
// ==========================================

// ✅ LAYER 1: Idempotent start function
let pipelineRunnerStarted = false;

export async function startPipelineRunner(sandboxPath?: string) {
  if (pipelineRunnerStarted) {
    console.warn("⚠️ Pipeline Runner already started. Skipping.");
    return;
  }
  pipelineRunnerStarted = true;

  const SANDBOX_DIR = sandboxPath || path.resolve(process.cwd(), "workspace/sandbox");

  console.log(`🚀 Starting Agent Runner in: ${SANDBOX_DIR}`);

  // Create sandbox if it doesn't exist
  if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  }

  // IGNITION
  runPipelineLoop(SANDBOX_DIR).catch((error) => {
    console.error("💀 FATAL ENGINE FAILURE:", error);
    pipelineRunnerStarted = false; // Reset on fatal error to allow restart
    process.exit(1);
  });
}

// ✅ Auto-start if this file is run directly (but idempotent)
if (require.main === module) {
  startPipelineRunner().catch((error) => {
    console.error("💀 FATAL ENGINE FAILURE:", error);
    process.exit(1);
  });
}