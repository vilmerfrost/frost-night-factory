# ❄️ Frost Night Factory - Complete Application Summary

**Version:** v9.0 (Fortress Guard + Pre-Testing Validation Gates)  
**Last Updated:** December 2024  
**Purpose:** Autonomous AI agent system that generates production-ready Next.js applications from natural language descriptions

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Pipeline Flow](#pipeline-flow)
4. [AI Models & Roles](#ai-models--roles)
5. [Database Schema](#database-schema)
6. [Key Systems & Features](#key-systems--features)
7. [Error Handling & Validation](#error-handling--validation)
8. [Cost Optimization](#cost-optimization)
9. [File Structure](#file-structure)
10. [Key Modules](#key-modules)
11. [Configuration](#configuration)
12. [Deployment](#deployment)

---

## 🎯 Overview

Frost Night Factory is an autonomous AI-powered system that transforms natural language prompts into fully functional Next.js web applications. It orchestrates multiple AI models through a structured pipeline: **Research → Planning → Coding → SQL → Testing → Deployment**.

### Core Capabilities

- **Natural Language to Code:** Converts user descriptions into production-ready applications
- **Multi-Model Orchestration:** Uses specialized AI models for different tasks (Claude, Gemini, DeepSeek, Groq, Kimi, Perplexity)
- **Full-Stack Generation:** Creates frontend (React/Next.js), backend (API routes), and database schemas
- **Autonomous Error Recovery:** Self-healing system with intelligent error classification and fixing
- **Cost Tracking:** Per-pipeline, per-step AI cost monitoring and optimization
- **Quality Assurance:** TypeScript validation, ESLint checks, build verification, E2E testing

### Success Metrics

- **Success Rate:** >80% pipelines complete successfully
- **Cost per Pipeline:** <$1.00 average (with semantic caching)
- **Time to MVP:** <10 minutes per pipeline
- **Code Quality:** Passes TypeScript + ESLint validation

---

## 🏗️ Architecture

### Tech Stack

#### Frontend
- **Framework:** Next.js 15 (App Router)
- **UI Library:** React 19, TypeScript
- **Styling:** Tailwind CSS, PostCSS
- **Components:** Radix UI, Shadcn/ui (Golden Templates)
- **Animations:** Framer Motion
- **State Management:** React hooks, Context API

#### Backend
- **Database:** Supabase (PostgreSQL)
- **API:** Next.js API Routes (`app/api/`)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime subscriptions

#### Infrastructure
- **Hosting:** Vercel (for generated apps)
- **Database:** Supabase Cloud
- **CI/CD:** Git-based deployment
- **Monitoring:** Prometheus metrics, custom event logging

#### AI Infrastructure
- **Models:** Claude Sonnet 4.5, Gemini 2.5 Flash, DeepSeek V3.2, Groq Llama 3.3, Kimi K2, Perplexity Sonar Pro
- **Caching:** Semantic cache (99% similarity threshold, file-path keys)
- **Cost Tracking:** Per-pipeline, per-step token/cost tracking
- **Circuit Breakers:** Rate limit protection, overload prevention

### Architecture Patterns

1. **Pipeline-Based Processing:** Sequential phases with state management
2. **Isolated Execution:** Each pipeline runs in isolated temp directories
3. **Golden Templates:** Pre-injected, frozen UI components (Shadcn)
4. **Fortress Guard:** Protection for critical files (tsconfig.json, package.json)
5. **Semantic Caching:** 99% similarity threshold prevents cache poisoning
6. **Error Classification:** Intelligent error categorization and targeted fixes
7. **Multi-Pass Generation:** Iterative refinement with validation gates

---

## 🔄 Pipeline Flow

The pipeline consists of 6 main phases executed sequentially:

### Phase 1: Research
**Purpose:** Gather technical constraints and best practices  
**Model:** Perplexity Sonar Pro (deep research) + Kimi K2 (synthesis)  
**Output:** Research report with technical recommendations

**Process:**
1. Perplexity performs deep technical research
2. Kimi K2 synthesizes findings into actionable insights
3. Research stored in `pipeline_steps` table

### Phase 2: Planning
**Purpose:** Create implementation blueprint  
**Model:** DeepSeek V3.2 (Reasoner)  
**Output:** File structure plan, component registry, tech stack decisions

**Process:**
1. Analyze user prompt + research findings
2. Generate file structure plan (`FileStructurePlan`)
3. Create component registry
4. Detect tech stack preferences (Next.js version, React version, UI library)
5. Plan stored as JSON in database

### Phase 3: Scaffolding
**Purpose:** Create project structure and inject Golden Components  
**Model:** None (deterministic)  
**Output:** Empty files + Golden Templates injected

**Process:**
1. Create isolated temp directory for pipeline
2. Generate stub files from plan
3. Inject Golden Components (Shadcn/ui components)
4. Inject Golden Layout Components (AppShell, DashboardShell, etc.)
5. Create base configuration files (tsconfig.json, tailwind.config.ts, etc.)

### Phase 4: Coding
**Purpose:** Generate application code  
**Model:** Claude Sonnet 4.5 (primary), DeepSeek V3.2 (fallback)  
**Output:** Complete application codebase

**Process:**
1. Multi-pass generation with validation
2. One file at a time (prevents context overflow)
3. Semantic cache lookup (99% threshold)
4. AST validation after each file
5. Import/export validation
6. Auto-fix file extensions (.ts → .tsx for JSX)
7. Retry with error-specific prompts on failure

**Key Features:**
- **Semantic Caching:** Reuses code for similar prompts (70% cost savings)
- **Multi-Pass Generation:** Up to 10 attempts with iterative refinement
- **Pre-Scaffolding:** Creates stub files before generation to prevent import errors
- **Context Optimization:** Compresses context to fit within token limits

### Phase 5: SQL
**Purpose:** Generate database migrations  
**Model:** Gemini 2.5 Flash  
**Output:** SQL migration files

**Process:**
1. Analyze application requirements
2. Generate Supabase-compatible SQL migrations
3. Create tables, indexes, RLS policies
4. Generate seed data if needed

### Phase 6: Testing
**Purpose:** Validate generated code  
**Model:** TypeScript Compiler, ESLint, Build System  
**Output:** Validation results, fixes applied

**Process:**
1. **Pre-Testing Validation Gates (4 layers):**
   - AST validation (syntax check)
   - Type validation (TypeScript types)
   - Build validation (production build)
   - RLS validation (Supabase policies)

2. **TypeScript Compilation:**
   - Full type checking
   - Error classification
   - Targeted fixes

3. **ESLint Validation:**
   - Code quality checks
   - Auto-fix where possible

4. **Build Verification:**
   - Production build test
   - Dev server startup verification

5. **Error Recovery:**
   - Batch fixer for multiple errors
   - Error-specific fix strategies
   - Circuit breaker prevents infinite loops

---

## 🤖 AI Models & Roles

### Model Council

| Model | Role | Use Case | Cost (per 1M tokens) |
|-------|------|----------|----------------------|
| **Claude Sonnet 4.5** | CODER | Primary code generation | $3/$15 (in/out) |
| **Gemini 2.5 Flash** | PROMPT_ENGINEER, SQL | Fast prompt optimization, SQL generation | Free tier / Low cost |
| **DeepSeek V3.2** | PLANNER, FIXER | Planning & error fixing | $0.14/$0.28 (in/out) |
| **Groq Llama 3.3** | REVIEWER | Fast code review | $0.05/$0.08 (in/out) |
| **Kimi K2 (Moonshot)** | RESEARCHER | Research synthesis | $0.50/$0.60 (in/out) |
| **Perplexity Sonar Pro** | RESEARCHER | Deep technical research | Per-query pricing |

### Model Selection Logic

- **Complexity-Based Routing:**
  - Easy errors → Groq (fast, cheap)
  - Medium errors → DeepSeek (balanced)
  - Hard errors → Claude (high quality)

- **Circuit Breakers:**
  - Rate limit protection
  - Overload prevention
  - Automatic fallback to alternative models

- **Cost Optimization:**
  - Semantic caching (99% threshold)
  - Model escalation only when needed
  - Batch processing for multiple fixes

---

## 🗄️ Database Schema

### Core Tables

#### `pipelines`
Main pipeline tracking table.

```sql
pipelines (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  initial_prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  current_phase TEXT,                       -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  repo_url TEXT,
  branch TEXT DEFAULT 'main',
  total_ai_cost_cents INT DEFAULT 0,
  total_tokens_in INT DEFAULT 0,
  total_tokens_out INT DEFAULT 0,
  error_code TEXT,
  error_signature TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### `pipeline_steps`
Individual phase tracking.

```sql
pipeline_steps (
  id UUID PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  logs TEXT,
  attempts INT DEFAULT 0,
  ai_cost_cents INT DEFAULT 0,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### `ai_calls`
Granular AI call tracking.

```sql
ai_calls (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  step_name TEXT,
  model TEXT,
  role TEXT,                      -- 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER'
  prompt_signature TEXT,          -- hash for cache lookup
  tokens_in INT,
  tokens_out INT,
  cost_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### `semantic_cache`
AI response caching.

```sql
semantic_cache (
  cache_key TEXT PRIMARY KEY,
  file_path TEXT,                 -- Prevents cross-file contamination
  file_type TEXT,                 -- 'route' | 'component' | 'page' | 'lib'
  prompt TEXT,
  response TEXT,
  similarity FLOAT,               -- 99% threshold for strict matching
  model TEXT,
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### `error_patterns`
Cached error solutions.

```sql
error_patterns (
  id BIGSERIAL PRIMARY KEY,
  error_signature TEXT UNIQUE,
  error_type TEXT,
  solution TEXT,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  success_rate FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### `agent_memory` (Hive Mind)
Long-term learning system.

```sql
agent_memory (
  id BIGSERIAL PRIMARY KEY,
  error_signature TEXT,
  error_type TEXT,
  target_file TEXT,
  error_message TEXT,
  successful_fix TEXT,
  ai_model_used TEXT,
  success_rate FLOAT,
  times_reused INT DEFAULT 0,
  times_succeeded INT DEFAULT 0,
  times_failed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Additional Tables

- **`tickets`:** Bug/feature tracking system
- **`code_snapshots`:** Version control for pipeline states
- **`error_state`:** State machine for error recovery
- **`dead_letter_queue`:** Failed pipeline recovery
- **`system_prompts`:** Versioned system prompts
- **`kill_switches`:** Feature flags and emergency controls

---

## 🔧 Key Systems & Features

### 1. Golden Templates System

**Purpose:** Pre-injected, frozen UI components to ensure consistency and prevent errors.

**Components:**
- **UI Components:** Button, Card, Input, Table, Tabs, Badge (Shadcn/ui)
- **Layout Components:** AppShell, DashboardShell, FormPage, DataTablePage, HeroSection, StatsGrid, FeatureGrid, ToolShowcase, CTASection, PageRenderer, Sidebar, Navbar, Footer

**Location:** `agent-runner/lib/golden-components.ts`, `templates/core-layout/`

**Benefits:**
- Prevents IntrinsicAttributes errors
- Consistent UI across all generated apps
- No AI generation needed (saves cost)
- Version-controlled and tested

### 2. Fortress Guard (v9.0)

**Purpose:** Protects critical files from AI modification.

**Protected Files:**
- `tsconfig.json`
- `package.json`
- `next.config.js`
- `tailwind.config.ts`
- `postcss.config.js`

**Mechanism:**
- Write protection for critical files
- Validation before allowing modifications
- Snapshot system for rollback
- Zone-based validation

### 3. Semantic Caching

**Purpose:** Reuse AI responses for similar prompts (70% cost savings).

**Features:**
- 99% similarity threshold (strict matching)
- File-path keys (prevents cross-file contamination)
- File-type classification (route, component, page, lib)
- Automatic cache invalidation on errors

**Implementation:** `lib/nightFactory/semanticCache.ts`

### 4. Error Classification System

**Purpose:** Intelligent error categorization for targeted fixes.

**Error Categories:**
- `DEPENDENCY_VERSION`: npm version conflicts
- `TYPE_ERROR`: TypeScript type mismatches
- `LAZY_CODE`: pass, any, null, TODO
- `IMPORT_ERROR`: Missing exports, module not found
- `EXPORT_ERROR`: Default export issues
- `RUNTIME_ERROR`: Crashes, missing env, undefined
- `CONFIG_ERROR`: next.config, tsconfig, tailwind errors
- `SYNTAX_ERROR`: JavaScript/TypeScript syntax errors
- `FILE_STRUCTURE_VIOLATION`: IntrinsicAttributes, missing props

**Implementation:** `agent-runner/lib/error-classifier.ts`, `lib/nightFactory/errorClassifier.ts`

### 5. Multi-Pass Generation

**Purpose:** Iterative code generation with validation.

**Process:**
1. Generate code with AI
2. Validate with AST parser
3. Check imports/exports
4. Retry with error-specific prompts if needed
5. Max 10 attempts per file

**Implementation:** `agent-runner/multi-pass-generator.ts`

### 6. Hive Mind Learning System

**Purpose:** Self-learning system that caches fixes and optimizes model selection.

**Features:**
- Error signature generation
- Solution caching
- Success rate tracking
- Model performance analytics
- Semantic search for similar errors

**Implementation:** `agent-runner/lib/hive-mind.ts`, `lib/nightFactory/hiveMind.ts`

### 7. Pre-Testing Validation Gates

**Purpose:** Catch errors early before expensive testing phase.

**4 Layers:**
1. **AST Validation:** Syntax check with TypeScript compiler
2. **Type Validation:** Type checking without full compilation
3. **Build Validation:** Production build test
4. **RLS Validation:** Supabase Row Level Security policies

**Implementation:** `agent-runner/lib/pre-testing-validator.ts`

### 8. Batch Fixer

**Purpose:** Fix multiple errors simultaneously.

**Features:**
- Groups errors by category
- Prioritizes critical errors
- Batch AI calls for efficiency
- Retry logic with circuit breaker

**Implementation:** `lib/nightFactory/v85-batch-fixer.ts`, `lib/nightFactory/batchSurgeon.ts`

### 9. Isolated Pipeline Testing

**Purpose:** Each pipeline runs in isolated temp directory.

**Structure:**
```
workspace/temp-projects/<pipeline-id>/
├── src/
├── tsconfig.json
├── package.json
└── ... (isolated project)
```

**Benefits:**
- No cross-pipeline contamination
- Clean environment for each run
- Easy cleanup

**Implementation:** `lib/nightFactory/v85-isolated-tester.ts`

### 10. Layout Component Contracts

**Purpose:** Source of truth for layout component props.

**Contracted Components:**
- AppShell: `{ children }`
- DashboardShell: `{ children }`
- FormPage: `{ children, title }`
- DataTablePage: `{ children, title }`
- HeroSection: `{ title }`
- StatsGrid: `{ stats }`
- FeatureGrid: `{ features }`
- ToolShowcase: `{ tools }`
- CTASection: `{ title }`
- PageRenderer: `{ sections }`
- Sidebar: `{ items }`
- Navbar: `{ }` (all optional)
- Footer: `{ }` (all optional)

**Implementation:** `lib/nightFactory/layout-contract.ts`, `lib/nightFactory/v85-layout-validator.ts`

---

## 🛡️ Error Handling & Validation

### Error Classification

Errors are classified into categories for targeted fixes:

1. **Dependency Errors:** Auto-install missing packages, version resolution
2. **Type Errors:** Type fixes, interface generation, type assertions
3. **Import Errors:** Import path fixes, export generation, module resolution
4. **Export Errors:** Default export fixes, named export corrections
5. **Syntax Errors:** AST-based fixes, Python syntax fixes
6. **Config Errors:** Configuration file regeneration
7. **Structure Violations:** Layout contract regeneration, prop fixes

### Error Recovery Strategies

1. **Circuit Breaker:** Prevents infinite retry loops
2. **Error Autopsy:** Analyzes error patterns, detects loops
3. **Batch Surgeon:** Fixes multiple errors simultaneously
4. **Snapshot System:** Rollback to previous valid state
5. **Hive Mind:** Cached solutions for known errors

### Validation Systems

1. **AST Validation:** TypeScript compiler API
2. **Import Graph Validation:** Dependency resolution
3. **Export Contract Validation:** Required exports check
4. **Type Validation:** Type checking without compilation
5. **Build Validation:** Production build test
6. **RLS Validation:** Supabase policy checks

---

## 💰 Cost Optimization

### Strategies

1. **Semantic Caching:** 70% cost savings (99% similarity threshold)
2. **Model Routing:** Use cheaper models when possible
3. **Batch Processing:** Multiple fixes in single AI call
4. **Pre-Scaffolding:** Reduces generation attempts
5. **Golden Templates:** No AI generation needed
6. **Context Compression:** Optimize prompts to fit token limits

### Cost Tracking

- Per-pipeline cost tracking
- Per-step cost breakdown
- Per-model cost analytics
- Token usage monitoring
- Cost alerts and budgets

**Implementation:** `agent-runner/lib/cost-tracker.ts`

### Average Costs

- **Per Pipeline:** $0.40-$0.60 (with caching)
- **Without Caching:** $0.80-$1.20
- **Most Expensive Phase:** Coding (60-70% of total)
- **Cheapest Phase:** Planning (5-10% of total)

---

## 📁 File Structure

```
frost-night-factory/
├── agent-runner/              # Main pipeline runner
│   ├── lib/                   # Feature modules
│   │   ├── ai/                # AI client & resilience
│   │   ├── fortress/          # Fortress guard system
│   │   ├── nightFactory/      # Core factory logic
│   │   ├── validation/        # Validation systems
│   │   ├── workspace/         # Workspace management
│   │   ├── ai-client.ts       # Unified AI client
│   │   ├── cost-tracker.ts    # Cost tracking
│   │   ├── error-classifier.ts # Error classification
│   │   ├── golden-components.ts # Golden templates
│   │   ├── hive-mind.ts       # Learning system
│   │   └── version-manager.ts  # Feature flags
│   ├── pipeline-runner.ts     # Main pipeline orchestrator (14K+ lines)
│   └── package.json
├── app/                       # Next.js frontend dashboard
│   ├── api/                   # API routes
│   │   ├── pipeline/          # Pipeline management
│   │   └── tickets/           # Ticket system
│   ├── dashboard/             # Dashboard pages
│   ├── create/                # Pipeline creation UI
│   └── monitor/               # Pipeline monitoring
├── lib/                       # Shared libraries
│   ├── nightFactory/          # Core factory modules
│   │   ├── invariants/        # Invariant systems
│   │   ├── templates/         # Golden templates
│   │   ├── v85-*.ts           # V8.5 features
│   │   ├── v90-*.ts           # V9.0 features
│   │   ├── modelClient.ts     # AI model clients
│   │   ├── semanticCache.ts   # Caching system
│   │   └── ...
│   ├── pipeline/              # Pipeline utilities
│   └── utils/                 # Utility functions
├── templates/                 # Template files
│   ├── core-layout/           # Frozen layout templates
│   └── fortress/              # Fortress templates
├── supabase/                  # Database migrations
│   └── migrations/            # SQL migration files
├── sql/                       # SQL schema files
├── components/                # Shared React components
├── public/                    # Static assets
└── package.json               # Root dependencies
```

---

## 🔑 Key Modules

### Pipeline Runner (`agent-runner/pipeline-runner.ts`)

**Purpose:** Main orchestrator for pipeline execution.

**Key Functions:**
- `runResearchStep()`: Performs research phase
- `runPlannerStep()`: Creates implementation plan
- `runCoderStep()`: Generates application code
- `runSqlStep()`: Creates database migrations
- `runTesterStep()`: Validates generated code
- `runPublisherStep()`: Deploys to GitHub/Vercel

**Size:** 14,330+ lines (largest file)

### Model Client (`lib/nightFactory/modelClient.ts`)

**Purpose:** Unified interface for all AI models.

**Key Functions:**
- `callAI()`: Unified AI call interface
- `generateClaudeCoder()`: Claude code generation
- `generateDeepSeekPlanner()`: DeepSeek planning
- `performDeepResearch()`: Perplexity research
- `runKimiQA()`: Kimi synthesis

### Semantic Cache (`lib/nightFactory/semanticCache.ts`)

**Purpose:** AI response caching system.

**Key Functions:**
- `get()`: Retrieve cached response
- `set()`: Store response in cache
- `calculateSimilarity()`: 99% threshold matching

### Error Classifier (`agent-runner/lib/error-classifier.ts`)

**Purpose:** Intelligent error categorization.

**Key Functions:**
- `classifyError()`: Categorize error
- `recordErrorPattern()`: Store error pattern
- `getFixStrategy()`: Get fix strategy for category

### Multi-Pass Generator (`agent-runner/multi-pass-generator.ts`)

**Purpose:** Iterative code generation with validation.

**Key Functions:**
- `generateWithValidation()`: Generate with retry logic
- `validateCodeStrict()`: Strict code validation
- `preScaffoldImports()`: Create stub files

### Hive Mind (`agent-runner/lib/hive-mind.ts`)

**Purpose:** Self-learning error fix system.

**Key Functions:**
- `querySolution()`: Find cached solution
- `memorizeSolution()`: Store successful fix
- `getModelPerformance()`: Analytics

### Fortress Guard (`lib/nightFactory/v90-fortress-guard.ts`)

**Purpose:** Protect critical files.

**Key Functions:**
- `checkRepairAllowed()`: Check if file can be modified
- `fortressWrite()`: Protected write operation
- `validateFortressIntegrity()`: Verify critical files

### Batch Fixer (`lib/nightFactory/v85-batch-fixer.ts`)

**Purpose:** Fix multiple errors simultaneously.

**Key Functions:**
- `batchFix()`: Fix multiple errors
- `groupErrorsByCategory()`: Organize errors
- `applyFixes()`: Apply fixes in batch

---

## ⚙️ Configuration

### Environment Variables

**Required:**
- `ANTHROPIC_API_KEY`: Claude (Coder, Vision Refinement)
- `GOOGLE_API_KEY`: Gemini (Prompt Engineer, SQL)
- `DEEPSEEK_API_KEY`: DeepSeek (Planner, Fixer)
- `GROQ_API_KEY`: Groq (Code Reviewer)
- `MOONSHOT_API_KEY`: Kimi K2 (Research Synthesis)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (bypasses RLS)

**Optional:**
- `OPENAI_API_KEY`: GPT models
- `PERPLEXITY_API_KEY`: Perplexity research
- `GITHUB_TOKEN`: Auto-publishing to GitHub
- `QWEN_API_KEY`: Qwen models

### Feature Flags

**Location:** `agent-runner/lib/version-manager.ts`

**Available Flags:**
- `useNextJs16`: Use Next.js 16
- `useShadcnComponents`: Inject Shadcn components
- `runIntegrationTests`: Run integration tests
- `runVisionRefinement`: Vision-based UI refinement
- `runPlaywrightTests`: E2E testing
- `runLighthouseAudit`: Performance audit
- `runPactTesting`: Contract testing
- `trackCosts`: Cost tracking
- `enableABTesting`: A/B testing

**Override via Environment:**
```bash
FEATURE_RUNVISIONREFINEMENT=true
FEATURE_ENABLEABTESTING=false
```

---

## 🚀 Deployment

### Prerequisites

- Node.js 20.9.0+
- npm or pnpm
- Supabase project
- API keys for AI providers

### Setup Steps

1. **Clone Repository**
   ```bash
   git clone <repo-url>
   cd frost-night-factory
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd agent-runner && npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run Database Migrations**
   ```bash
   # In Supabase SQL Editor, run:
   # supabase/migrations/*.sql files
   ```

5. **Start Pipeline Runner**
   ```bash
   cd agent-runner
   npm start
   ```

6. **Start Frontend Dashboard** (optional)
   ```bash
   npm run dev
   ```

### Monitoring

- **Pipeline Status:** `/dashboard` or `/monitor`
- **Cost Analytics:** `/dashboard/costs`
- **Error Logs:** Database `pipeline_steps.logs`
- **Metrics:** Prometheus endpoints (if enabled)

---

## 📊 Performance Metrics

### Build Performance

- **Build Time:** 14s (Next.js 16 with Turbopack)
- **Previous:** 57s (Next.js 14)
- **Improvement:** 4x faster

### Success Rates

- **Overall Success:** 80-96%
- **With Caching:** 96%
- **Without Caching:** 85%

### Cost Metrics

- **Average Cost per Pipeline:** $0.40-$0.60
- **Cost Savings with Caching:** 70%
- **Most Expensive Phase:** Coding (60-70%)
- **Cheapest Phase:** Planning (5-10%)

### Quality Metrics

- **UI Score:** 8.5/10 (target)
- **Lighthouse Score:** 70+/100 (target)
- **TypeScript Errors:** <5 per pipeline (target)
- **E2E Test Coverage:** 100%

---

## 🔒 Security & Best Practices

### Security Features

1. **Sandbox Execution:** All pipelines run in isolated directories
2. **Fortress Guard:** Critical files protected from AI modification
3. **Input Validation:** Prompt injection detection
4. **RLS Policies:** Row-level security for database
5. **API Key Management:** Environment variables, never hardcoded

### Best Practices

1. **Atomic Writes:** File writes are atomic (prevents corruption)
2. **Snapshot System:** Rollback capability for failed pipelines
3. **Circuit Breakers:** Prevents infinite retry loops
4. **Cost Controls:** Per-pipeline budgets, model routing
5. **Error Recovery:** Graceful degradation, fallback strategies

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Large Projects:** May hit token limits for very large codebases
2. **Complex Backends:** Limited support for complex backend architectures
3. **Real-time Features:** Basic support, may need manual refinement
4. **Third-party Integrations:** Limited automatic integration support

### Known Issues

1. **Windows Path Casing:** Some path issues on Windows (mitigated with `windows-casing-fix.ts`)
2. **Semantic Cache False Positives:** Rare cases where 99% threshold matches incorrectly
3. **Golden Component Updates:** Manual updates required for template changes

---

## 🔮 Future Roadmap

### Planned Features

1. **Enhanced Backend Support:** Better FastAPI, Express.js generation
2. **Real-time Features:** WebSocket, Server-Sent Events support
3. **Third-party Integrations:** Automatic API integration
4. **Multi-language Support:** Python, Go backend generation
5. **Advanced Testing:** Unit tests, integration tests generation
6. **Deployment Automation:** One-click deployment to multiple platforms

---

## 📚 Additional Resources

### Documentation Files

- `README.md`: Quick start guide
- `ARCHITECTURE_IMPROVEMENTS.md`: Architecture decisions
- `.context.md`: AI context for development
- `docs/V85_DEPLOYMENT.md`: Deployment guide
- `docs/COST_OPTIMIZATION_COMPLETE.md`: Cost optimization details

### Key Scripts

- `npm run runner`: Start pipeline runner
- `npm run v85:validate`: Validate V8.5 features
- `npm run v85:test`: Run V8.5 tests
- `npm run generate-layout-templates`: Generate layout templates
- `npm run validate-layout-contracts`: Validate contracts

---

## 🤝 Contributing

This is an autonomous AI system. Contributions should focus on:
- Improving error classification
- Adding new Golden Templates
- Optimizing cost strategies
- Enhancing validation systems
- Expanding AI model support

---

**Last Updated:** December 2024  
**Maintainer:** Vilmer  
**Version:** v9.0 (Fortress Guard + Pre-Testing Validation Gates)

---

*This document is designed to help AI models understand the complete Frost Night Factory application architecture, systems, and workflows. For human developers, see `README.md` for quick start instructions.*
