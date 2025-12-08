# 🏭 Frost Night Factory - Complete System Documentation

> **Version:** 0.1.0  
> **Last Updated:** December 2025  
> **Codename:** "The Autonomous App Builder"

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [AI Model Fleet](#ai-model-fleet)
4. [Pipeline System (The Brain)](#pipeline-system)
5. [JSON Context System (NEW)](#json-context-system)
6. [Agent Runner (The Worker)](#agent-runner)
7. [Database Schema](#database-schema)
8. [API Routes](#api-routes)
9. [Frontend Components](#frontend-components)
10. [Night Factory Utilities](#night-factory-utilities)
11. [Error Handling & Recovery](#error-handling--recovery)
12. [Cost Optimization](#cost-optimization)
13. [Security](#security)
14. [Configuration](#configuration)
15. [Development Workflow](#development-workflow)

---

## 🌐 System Overview

**Frost Night Factory** is an autonomous AI-powered application builder that takes a user prompt (like "Build an invoice management app") and generates a complete, production-ready Next.js + Supabase application.

### What It Does

```
User Prompt → Research → Planning → Coding → SQL → Testing → Deployed App
```

### Key Features

- **Multi-Model AI Routing**: Uses 7+ AI models, routing tasks to the optimal model based on complexity and cost
- **Full-Stack Generation**: Creates frontend (React/Next.js), backend (API routes), and database (SQL migrations)
- **Self-Healing**: Automatically detects and fixes build errors
- **Cost Optimization**: Routes 90%+ of tasks to cheap models ($0.05-0.28/1M tokens)
- **Real-Time Dashboard**: Watch the factory work in real-time
- **JSON Context Chain**: Full traceability from research to testing

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Node.js |
| Database | PostgreSQL (Supabase), Real-time subscriptions |
| AI Models | Claude 4.5, DeepSeek R1/V3, Gemini 2.0, Groq, Kimi K2, Qwen |
| Deployment | Vercel (frontend), Supabase (database) |

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FROST NIGHT FACTORY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐       ┌──────────────────────────────┐   │
│  │   NEXT.JS APP    │       │      AGENT RUNNER             │   │
│  │   (Frontend)     │       │      (Backend Worker)         │   │
│  │                  │       │                               │   │
│  │  • Dashboard     │       │  • Dispatcher Loop            │   │
│  │  • Pipeline View │       │  • Pipeline Runner Loop       │   │
│  │  • File Browser  │       │  • Error Handler              │   │
│  │  • Cost Monitor  │       │  • Self-Healing Engine        │   │
│  │  • Task Manager  │       │                               │   │
│  └────────┬─────────┘       └──────────────┬────────────────┘   │
│           │                                 │                    │
│           │         ┌───────────────┐      │                    │
│           └────────►│   SUPABASE    │◄─────┘                    │
│                     │   (Database)  │                           │
│                     │               │                           │
│                     │  • Pipelines  │                           │
│                     │  • Steps      │                           │
│                     │  • Tickets    │                           │
│                     │  • Costs      │                           │
│                     │  • Real-time  │                           │
│                     └───────────────┘                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AI MODEL FLEET                         │   │
│  │                                                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │ Claude  │ │DeepSeek │ │ Gemini  │ │  Groq   │        │   │
│  │  │  4.5    │ │ R1/V3   │ │   2.0   │ │ Llama   │        │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  Kimi   │ │  Qwen   │ │Perplexity│ │ Ollama │        │   │
│  │  │   K2    │ │   Max   │ │  (Pro)  │ │ (Local)│        │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
frost-night-factory/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (50+ endpoints)
│   │   ├── agent/               # Agent execution APIs
│   │   ├── dev/                 # Developer tools APIs
│   │   ├── night-factory/       # Core factory APIs
│   │   ├── pipeline/            # Pipeline management
│   │   ├── pipelines/           # Pipeline CRUD
│   │   ├── stats/               # Cost & stats
│   │   ├── tasks/               # Task management
│   │   └── tickets/             # Bug/feature tickets
│   ├── components/              # React components
│   │   └── pipeline/            # Pipeline-specific components
│   ├── dashboard/               # Dashboard pages
│   ├── dev/                     # Developer tools
│   ├── monitor/                 # Real-time monitor
│   └── page.tsx                 # Main dashboard
├── agent-runner/                 # Backend worker (Node.js)
│   ├── lib/                     # 40+ utility modules
│   ├── dispatcher.ts            # Ticket dispatcher
│   ├── pipeline-runner.ts       # Pipeline execution
│   ├── model-router.ts          # AI model selection
│   └── index.ts                 # Entry point
├── lib/                          # Shared libraries
│   ├── pipeline/                # Pipeline phases (NEW JSON-based)
│   │   ├── research.ts          # Research phase
│   │   ├── planner.ts           # Planning phase
│   │   ├── coder.ts             # Code generation
│   │   ├── sql.ts               # SQL generation
│   │   ├── tester.ts            # Testing phase
│   │   ├── pipeline-json-types.ts # JSON type definitions
│   │   ├── json-converter.ts    # Raw text → JSON
│   │   └── pipeline-orchestrator.ts # Full pipeline runner
│   └── nightFactory/            # 44+ utility modules
│       ├── modelClient.ts       # AI model client
│       ├── errorClassifier.ts   # Error classification
│       ├── pipelineController.ts # Pipeline state
│       └── ...                  # Many more utilities
├── sql/                          # Database schemas
├── supabase/migrations/          # Supabase migrations
└── workspace/sandbox/            # Generated project output
```

---

## 🤖 AI Model Fleet

### Model Overview

| Model | Provider | Role | Cost (per 1M tokens) | Speed | Use Case |
|-------|----------|------|---------------------|-------|----------|
| **Claude 4.5 Sonnet** | Anthropic | FRONTEND, NUCLEAR | $3.00 in / $15.00 out | Medium | Complex React/UI code |
| **Claude 4.5 Haiku** | Anthropic | JSON_CONVERTER | $0.25 in / $1.25 out | Fast | JSON transformation |
| **DeepSeek R1** | DeepSeek | PLANNER | $0.55 in / $2.19 out | Slow | Architecture planning |
| **DeepSeek V3** | DeepSeek | BACKEND, FIXER | $0.14 in / $0.28 out | Fast | API routes, SQL, fixes |
| **Gemini 2.0 Flash** | Google | ROUTER, OPTIMIZER | Free tier | Fast | Context routing, summaries |
| **Groq Llama 3.3** | Groq | REVIEWER, FAST_FIX | $0.05 in / $0.08 out | Ultra-fast | Code review, syntax fixes |
| **Kimi K2** | Moonshot | AUDIT, QA | ~$0.50 | Medium | QA auditing, deep analysis |
| **Qwen Max** | Alibaba | BACKEND_FALLBACK | ~$0.30 | Medium | Backup for DeepSeek |
| **Perplexity Pro** | Perplexity | RESEARCH | Subscription | Medium | Web research |
| **Ollama (Local)** | Local | FALLBACK | Free | Varies | Offline fallback |

### Model Routing Logic

```typescript
// lib/nightFactory/modelClient.ts - callAI() function

switch (role) {
  case "RESEARCH":
    // Perplexity Pro for deep web research
    // Fallback: Gemini 2.0 Flash
    break;

  case "PLANNER":
    // DeepSeek R1 (Reasoner) for architecture
    // 5-minute timeout for complex planning
    // Fallback: Gemini 2.0 Flash
    break;

  case "FRONTEND":
    // Claude 4.5 Sonnet with retry loop (5 attempts)
    // Circuit breaker after 5 failures
    // Fallback: DeepSeek V3 → Gemini
    break;

  case "BACKEND":
    // DeepSeek V3.2 (fast code generation)
    // Fallback: Gemini 2.0 Flash
    break;

  case "REVIEWER":
    // Groq Llama 3.3 70B (ultra-fast)
    // Returns "LGTM" or issues list
    break;

  case "AUDIT":
    // Kimi K2 Thinking for deep code analysis
    // Fallback: DeepSeek R1
    break;

  case "FIXER":
    // Tiered escalation:
    // FAST: Groq (syntax fixes)
    // SMART: DeepSeek V3 (logic fixes)
    // GENIUS: DeepSeek R1 → Kimi → Claude
    break;

  case "NUCLEAR":
    // Claude 4.5 Sonnet (last resort)
    // For critical situations only
    break;
}
```

### Cost Optimization Strategy

```
Task Complexity    → Model Selection
─────────────────────────────────────
Easy (syntax)      → Groq ($0.05/1M)     95% cheaper than Claude
Medium (logic)     → DeepSeek V3 ($0.14)  95% cheaper than Claude
Hard (architecture)→ DeepSeek R1 ($0.55)  80% cheaper than Claude
Critical (nuclear) → Claude 4.5 ($3.00)   Best quality

Result: 90%+ of tokens go to cheap models
Average cost: ~$0.15-0.30 per pipeline instead of $3-5
```

---

## 🔄 Pipeline System

### Pipeline Phases

```
┌──────────────────────────────────────────────────────────────┐
│                    PIPELINE EXECUTION FLOW                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. RESEARCH      2. PLANNER       3. CODER                  │
│  ┌─────────┐     ┌─────────┐      ┌─────────┐               │
│  │Perplexity│     │DeepSeek │      │ Claude  │               │
│  │ + Kimi   │────►│   R1    │─────►│   4.5   │               │
│  │ + Gemini │     │(Reasoner)│     │(Frontend)│               │
│  └─────────┘     └─────────┘      │DeepSeek │               │
│       │               │            │(Backend) │               │
│       │               │            └─────────┘               │
│       ▼               ▼                 │                     │
│   Research        Plan JSON             ▼                     │
│   JSON            + Features        Code Files                │
│                   + Schema          + Types                   │
│                                                               │
│  4. SQL           5. TESTER         6. PUBLISHER             │
│  ┌─────────┐     ┌─────────┐      ┌─────────┐               │
│  │DeepSeek │     │npm test │      │  Vercel │               │
│  │   V3    │────►│TypeCheck│─────►│ Deploy  │               │
│  │(Schema) │     │ESLint   │      │         │               │
│  └─────────┘     │Security │      └─────────┘               │
│       │          └─────────┘           │                     │
│       ▼               │                ▼                     │
│   Migrations          ▼           Production                 │
│   + RLS           Test Report     URL                        │
│   + Indexes                                                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Phase Details

#### 1. Research Phase (`lib/pipeline/research.ts`)

**Purpose:** Gather market research, tech recommendations, and requirements

**AI Models Used:**
- Perplexity Pro (web research)
- Kimi K2 (secondary research)
- Gemini 2.0 Flash (baseline analysis)

**Output:**
```typescript
interface ResearchPhaseJSON {
  phase: "research";
  timestamp: string;
  sources: {
    perplexity?: { query, results, summary };
    kimi_k2?: { query, results, summary };
    gemini?: { query, results, summary };
  };
  extracted_requirements: {
    must_have: ExtractedRequirement[];
    should_have: ExtractedRequirement[];
    nice_to_have: ExtractedRequirement[];
  };
  technology_recommendations: {
    frontend: TechRecommendation;
    backend: TechRecommendation;
    database: TechRecommendation;
  };
  potential_challenges: PotentialChallenge[];
  best_practices_found: string[];
  estimated_scope: {
    total_features: number;
    estimated_dev_hours: number;
    estimated_timeline_weeks: number;
    complexity_score: number; // 0-10
  };
}
```

#### 2. Planner Phase (`lib/pipeline/planner.ts`)

**Purpose:** Create detailed technical specification and feature breakdown

**AI Models Used:**
- DeepSeek R1 (Reasoner) - primary
- Gemini 2.0 Flash - fallback

**Input:** ResearchPhaseJSON (full context)

**Output:**
```typescript
interface PlannerPhaseJSON {
  phase: "planner";
  input_references: {
    research_timestamp: string;
    research_summary: string;
  };
  project_overview: { name, description, objectives };
  tech_stack: { frontend, backend, database, external_services };
  feature_breakdown: {
    phase_1_mvp: FeatureBreakdown[];
    phase_2_optional: FeatureBreakdown[];
  };
  database_schema_outline: { tables: TableDefinition[] };
  component_tree: { app, components, lib };
  api_routes_planned: ApiRouteDefinition[];
  timeline: { total_weeks, phases };
  risks_and_mitigations: RiskMitigation[];
  success_criteria: string[];
}
```

#### 3. Coder Phase (`lib/pipeline/coder.ts`)

**Purpose:** Generate all frontend and backend code

**AI Models Used:**
- Claude 4.5 Sonnet (frontend)
- DeepSeek V3.2 (backend)
- Gemini 2.0 Flash (fallback)

**Input:** ResearchPhaseJSON + PlannerPhaseJSON (full context)

**Generated Files:**
```
Frontend:
- app/layout.tsx
- app/page.tsx
- app/[entity]/page.tsx (CRUD pages)
- components/ui/* (shadcn/ui components)
- lib/types.ts (TypeScript interfaces)
- lib/supabase.ts (client)

Backend:
- app/api/[entity]/route.ts
- app/api/[entity]/[id]/route.ts
- lib/supabase-server.ts
- lib/db-queries.ts
- middleware.ts
```

#### 4. SQL Phase (`lib/pipeline/sql.ts`)

**Purpose:** Generate database schema and migrations

**AI Models Used:**
- DeepSeek V3.2 (primary)
- Gemini 2.0 Flash (fallback)

**Input:** All previous phase JSONs

**Generated:**
```sql
-- Creates tables with proper types
-- Foreign key constraints
-- Indexes on foreign keys
-- RLS (Row Level Security) policies
-- Seed data for testing
```

#### 5. Tester Phase (`lib/pipeline/tester.ts`)

**Purpose:** Validate entire pipeline with full visibility

**Tests Run:**
1. TypeScript Check (`tsc --noEmit`)
2. ESLint (`eslint . --ext .ts,.tsx`)
3. NPM Tests (`npm test`)
4. Security Audit (`npm audit`)
5. AI-Powered Pipeline Validation

**Input:** ALL previous phase JSONs

**Output:**
```typescript
interface TesterPhaseJSON {
  phase: "tester";
  input_references: {
    research_timestamp: string;
    plan_timestamp: string;
    coder_timestamp: string;
    sql_timestamp: string;
  };
  context_received: {
    research: string; // summary
    plan: string;
    code: string;
    sql: string;
  };
  test_suite: TestCase[];
  integration_tests: IntegrationTest[];
  security_checks: SecurityCheck[];
  quality_gates: QualityGate[];
  final_recommendation: 
    | "READY_FOR_DEPLOYMENT" 
    | "NEEDS_FIXES" 
    | "BLOCKED";
  blockers: string[];
  warnings: string[];
}
```

---

## 📜 JSON Context System

### Overview

The JSON Context System ensures **full traceability** from research to testing. Each phase:
1. Receives JSON context from all previous phases
2. Keeps raw text for audit trail
3. Converts output to structured JSON using Claude 4.5 Haiku
4. Fails fast if JSON is invalid

### Context Flow

```
Research JSON
    ↓ (timestamp reference)
Planner JSON (sees: research)
    ↓ (timestamp references)
Coder JSON (sees: research + plan)
    ↓ (timestamp references)
SQL JSON (sees: research + plan + code)
    ↓ (timestamp references)
Tester JSON (sees: ALL PREVIOUS)
```

### Key Files

| File | Purpose |
|------|---------|
| `pipeline-json-types.ts` | TypeScript interfaces for all phase JSONs |
| `json-converter.ts` | Converts raw AI text to structured JSON |
| `pipeline-orchestrator.ts` | Runs full pipeline with context passing |

### Usage Example

```typescript
import { runFullPipeline } from "./lib/pipeline/pipeline-orchestrator";

const result = await runFullPipeline(
  "Build an invoice management app",
  "./workspace/invoice-app",
  {
    usePerplexity: true,
    useDeepSeekR1: true,
    useClaude: true,
    includeRLS: true,
    runTypeCheck: true
  }
);

// Access any phase context
console.log(result.context.research?.extracted_requirements);
console.log(result.context.planner?.feature_breakdown);
console.log(result.context.coder?.code_generated);
console.log(result.context.sql_editor?.database_schema_created);
console.log(result.context.tester?.final_recommendation);

// Raw text preserved for audit
console.log(result.raw_audit_trail.research);

// Traceability report
console.log(result.traceability_report);
```

### Traceability Report Example

```
═══════════════════════════════════════════════════════════════
                   PIPELINE TRACEABILITY REPORT                 
═══════════════════════════════════════════════════════════════

📊 RESEARCH PHASE (2025-12-06T17:26:00Z)
   Requirements: 5 must-have
   Challenges: 3 identified

📋 PLANNER PHASE (2025-12-06T17:30:00Z)
   ↳ References: Research 2025-12-06T17:26:00Z
   Project: Invoice Management App
   Features: 6 planned

💻 CODER PHASE (2025-12-06T17:45:00Z)
   ↳ References: Research 2025-12-06T17:26:00Z
   ↳ References: Plan 2025-12-06T17:30:00Z
   Files: 18 generated
   TS Errors: 0

🗄️ SQL PHASE (2025-12-06T17:55:00Z)
   ↳ References: Research 2025-12-06T17:26:00Z
   ↳ References: Plan 2025-12-06T17:30:00Z
   ↳ References: Code 2025-12-06T17:45:00Z
   Tables: 3 created
   Type Match: perfect_match ✓

🧪 TESTER PHASE (2025-12-06T18:00:00Z)
   ↳ References: ALL PREVIOUS PHASES
   Tests: 5/5 passed
   Recommendation: READY_FOR_DEPLOYMENT

═══════════════════════════════════════════════════════════════
```

---

## 🏃 Agent Runner

### Overview

The Agent Runner is a Node.js background process that:
1. Polls for new tickets/pipelines
2. Executes pipeline phases
3. Handles errors and retries
4. Writes generated files to disk

### Entry Point (`agent-runner/index.ts`)

```typescript
// Runs both loops concurrently
Promise.all([
  dispatcherLoop(),     // Watches for new tickets
  runPipelineLoop(),    // Executes pending pipelines
]);
```

### Dispatcher (`agent-runner/dispatcher.ts`)

Watches the `tickets` table for new tickets with `auto_handle: true`:

```typescript
async function dispatcherLoop() {
  while (true) {
    // 1. Fetch ticket with status='new' and auto_handle=true
    const ticket = await getNewAutoTickets();
    
    if (ticket) {
      // 2. Create pipeline with phases
      const pipeline = await createPipelineForBug(ticket);
      
      // 3. Update ticket status
      await updateTicketStatus(ticket.id, 'pipeline_running');
    }
    
    // 4. Sleep 5 seconds
    await sleep(5000);
  }
}
```

### Pipeline Runner (`agent-runner/pipeline-runner.ts`)

Executes pending pipeline phases:

```typescript
async function runPipelineLoop(sandboxRoot: string) {
  while (true) {
    // 1. Get pipeline with status='pending' or 'running'
    const pipeline = await getPendingPipeline();
    
    if (pipeline) {
      // 2. Get current phase step
      const step = await getNextStep(pipeline.id);
      
      // 3. Execute phase
      switch (step.phase) {
        case 'research':
          await runResearchPhaseJSON(prompt);
          break;
        case 'planner':
          await runPlannerPhaseJSON(prompt, researchJSON);
          break;
        case 'coder':
          await runCoderPhaseJSON(researchJSON, planJSON, repoPath);
          break;
        case 'sql':
          await runSqlPhaseJSON(researchJSON, planJSON, coderJSON, repoPath);
          break;
        case 'tester':
          await runTesterPhaseJSON(all contexts, repoPath);
          break;
      }
      
      // 4. Handle errors, retry if needed
      // 5. Move to next phase
    }
    
    await sleep(3000);
  }
}
```

### Utility Libraries (`agent-runner/lib/`)

| File | Purpose |
|------|---------|
| `cost-tracker.ts` | Logs AI costs to database |
| `model-router.ts` | Selects optimal model for task |
| `golden-components.ts` | Pre-validated shadcn/ui components |
| `error-classifier.ts` | Classifies build errors |
| `auto-fixer.ts` | Auto-fixes common errors |
| `e2e-tester.ts` | Playwright E2E tests |
| `playwright-tester.ts` | Visual regression tests |
| `performance-auditor.ts` | Lighthouse audits |
| `kill-switches.ts` | Emergency stop conditions |
| `protected-files.ts` | Files that can't be modified |
| `write-file-safe.ts` | Safe file writing with validation |
| `semantic-distance.ts` | Measures code similarity |
| `hive-mind.ts` | Cross-pipeline learning |
| `vision-refiner.ts` | UI screenshot analysis |

---

## 🗄️ Database Schema

### Core Tables

#### `pipelines`
```sql
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initial_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'running' | 'completed' | 'failed'
  current_phase text,
    -- 'research' | 'planner' | 'coder' | 'sql' | 'tester'
  repo_url text,
  branch text DEFAULT 'main',
  ticket_id uuid REFERENCES tickets(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `pipeline_steps`
```sql
CREATE TABLE pipeline_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  phase text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb,   -- Phase input context
  output jsonb,  -- Phase output JSON
  logs text,     -- Raw AI output (audit trail)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `tickets`
```sql
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'feature')),
  title text NOT NULL,
  description text NOT NULL,
  source text,  -- 'user_app', 'internal', 'admin_panel'
  status text NOT NULL DEFAULT 'new',
    -- 'new' | 'queued' | 'pipeline_running' | 'resolved' | 'rejected'
  auto_handle boolean NOT NULL DEFAULT false,
  pipeline_id uuid REFERENCES pipelines(id),
  project text DEFAULT 'frost-solutions',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `ai_cost_logs`
```sql
CREATE TABLE ai_cost_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid REFERENCES pipelines(id),
  phase text NOT NULL,
  model text NOT NULL,
  provider text NOT NULL,
  tokens_in integer NOT NULL,
  tokens_out integer NOT NULL,
  cost_usd decimal(10, 6) NOT NULL,
  duration_ms integer NOT NULL,
  fix_attempts integer DEFAULT 0,
  success boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Real-Time Subscriptions

All tables have `REPLICA IDENTITY FULL` enabled for Supabase Realtime:

```sql
ALTER TABLE pipelines REPLICA IDENTITY FULL;
ALTER TABLE pipeline_steps REPLICA IDENTITY FULL;
ALTER TABLE tickets REPLICA IDENTITY FULL;
```

---

## 🌐 API Routes

### Pipeline APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/pipelines` | GET | List all pipelines |
| `/api/pipelines` | POST | Create new pipeline |
| `/api/pipelines/[id]` | GET | Get pipeline details |
| `/api/pipelines/[id]/steps` | GET | Get pipeline steps |
| `/api/pipelines/[id]/retry` | POST | Retry failed pipeline |
| `/api/pipelines/from-idea` | POST | Create pipeline from idea |
| `/api/pipeline/run` | POST | Execute pipeline step |

### Ticket APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tickets` | GET | List all tickets |
| `/api/tickets/create` | POST | Create new ticket |
| `/api/tickets/[id]` | GET | Get ticket details |
| `/api/tickets/[id]/reject` | POST | Reject ticket |
| `/api/tickets/[id]/start-pipeline` | POST | Start pipeline for ticket |

### Night Factory APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/night-factory/run-agent` | POST | Execute agent manually |
| `/api/night-factory/summary` | GET | Get factory summary |
| `/api/night-factory/files/list` | GET | List generated files |
| `/api/night-factory/files/get` | GET | Get file contents |
| `/api/night-factory/files/save` | POST | Save file |
| `/api/night-factory/files/delete` | DELETE | Delete file |
| `/api/night-factory/export/markdown` | GET | Export as markdown |

### Stats APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stats/costs` | GET | Get cost summary |
| `/api/dev/cost-summary` | GET | Detailed cost breakdown |
| `/api/dev/pipeline-stream` | GET | SSE pipeline events |

---

## 🎨 Frontend Components

### Main Pages

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | Main control panel |
| Monitor | `/monitor` | Real-time pipeline monitor |
| Tasks | `/tasks` | Task management |
| Files | `/dashboard/files` | File browser |
| Costs | `/dashboard/costs` | Cost monitoring |
| Settings | `/settings` | User preferences |

### Key Components

#### `CreateTaskModal.tsx`
Modal for creating new pipelines from ideas.

#### `PipelineCreator.tsx`
Form for creating new projects or updating existing repos.

#### `PipelineTimeline.tsx`
Visual timeline of pipeline phases with status.

#### `FileBrowser.tsx`
Browse generated project files.

#### `LogViewer.tsx`
View AI output logs for each phase.

#### `AiSummaryPanel.tsx`
AI-generated summary of pipeline progress.

#### `ExportButtons.tsx`
Export project as ZIP or markdown.

### UI Components (shadcn/ui)

Located in `components/ui/`:
- Button
- Card
- Input
- Tabs
- Dialog
- Badge

---

## 🛠️ Night Factory Utilities

### Core Utilities (`lib/nightFactory/`)

| File | Purpose |
|------|---------|
| **modelClient.ts** | AI model client with 15+ functions |
| **errorClassifier.ts** | Classifies errors (12 categories) |
| **pipelineController.ts** | Pipeline state management |
| **pipelineTypes.ts** | Type definitions |
| **circuitBreaker.ts** | API failure protection |
| **contextCompressor.ts** | Token limit management |
| **importRewriter.ts** | Fix broken imports |
| **goldenTemplates.ts** | Pre-validated templates |
| **goldenVersions.ts** | Locked package versions |
| **preCommitValidation.ts** | Pre-commit hooks |
| **visualAudit.ts** | Screenshot-based QA |
| **pythonSyntaxFixer.ts** | Python error fixes |

### Error Classification Categories

```typescript
enum ErrorCategory {
  DEPENDENCY_VERSION = 'dep_version',   // npm ETARGET, ERESOLVE
  TYPE_ERROR = 'type',                   // TS2305, TS7006
  LAZY_CODE = 'lazy',                    // pass, any, null, TODO
  IMPORT_ERROR = 'import',               // TS2613, missing exports
  EXPORT_ERROR = 'export',               // default export issues
  RUNTIME_ERROR = 'runtime',             // crashes, missing env
  CONFIG_ERROR = 'config',               // next.config, tsconfig
  SYNTAX_ERROR = 'syntax',               // JSX errors
  PYTHON_SYNTAX = 'python_syntax',       // Python syntax
  PYTHON_TYPE = 'python_type',           // MyPy errors
  UNKNOWN = 'unknown'
}
```

---

## 🔧 Error Handling & Recovery

### Windows File Casing Fix

**Problem:** Windows filesystem is case-insensitive, but TypeScript is case-sensitive. This causes `TS1261: Already included file name 'Card.tsx' differs from 'card.tsx' only in casing` errors.

**Solution:** Pre-flight casing enforcer runs before validation:

1. **File Naming:** All UI components use lowercase filenames (`button.tsx`, `card.tsx`)
2. **Import Standardization:** All imports use lowercase paths (`@/components/ui/button`)
3. **Duplicate Removal:** Removes Windows case-insensitive duplicates
4. **Auto-Fix:** Automatically fixes casing issues before TypeScript check

**Implementation:**
- `agent-runner/lib/windows-casing-fix.ts` - Casing enforcer utility
- Runs before pre-commit validation in pipeline
- Integrated into tester phase for validation
- Coder prompt includes Windows casing rules

### Self-Healing Engine

The system automatically detects and fixes build errors:

```
Error Detected
    ↓
Classify Error (12 categories)
    ↓
Select Model (based on complexity)
    ↓
Generate Fix
    ↓
Apply Fix
    ↓
Rebuild
    ↓
Success? → Continue
    ↓ No
Escalate Model (Groq → DeepSeek → Claude)
    ↓
Max Retries? → Human Intervention
```

### Error Escalation

```typescript
// agent-runner/model-router.ts

Attempt 1-2: Groq Llama 3.3 ($0.05/1M)  // Syntax fixes
Attempt 3-5: DeepSeek V3 ($0.14/1M)      // Logic fixes
Attempt 6+:  DeepSeek R1 ($0.55/1M)      // Complex fixes
Nuclear:     Claude 4.5 ($3.00/1M)       // Last resort
```

### Circuit Breaker

Protects against API overload:

```typescript
// If Claude fails 5 times → Open circuit breaker
// Wait 5 minutes before retrying
// Route to DeepSeek V3 during cooldown
```

---

## 💰 Cost Optimization

### Strategies

1. **Smart Model Routing**: Route 90%+ tokens to cheap models
2. **Prompt Caching**: Claude ephemeral caching for repeated contexts
3. **Error Escalation**: Start with cheapest model, escalate only if needed
4. **Token Compression**: Compress context before expensive models

### Cost Logging

All AI calls are logged to `ai_cost_logs` table:

```typescript
await logCost(
  pipelineId,
  phase,
  model: 'deepseek-chat',
  provider: 'deepseek',
  tokensIn: 1500,
  tokensOut: 2000,
  costUsd: 0.00077,
  durationMs: 1234,
  success: true
);
```

### Cost Dashboard

View costs at `/dashboard/costs` or via API:

```typescript
GET /api/stats/costs

Response: {
  total: 0.45,
  byModel: {
    "deepseek-chat": 0.12,
    "groq-llama-3.3": 0.08,
    "claude-sonnet-4-5": 0.25
  },
  byPhase: {
    "research": 0.05,
    "planner": 0.10,
    "coder": 0.20,
    "sql": 0.05,
    "tester": 0.05
  },
  averagePerPipeline: 0.45
}
```

---

## 🔒 Security

### Sandbox Isolation

Generated code runs in isolated sandbox:

```typescript
const SANDBOX_ROOT = path.resolve(__dirname, "../workspace/sandbox");
// All file operations confined to this directory
```

### Protected Files

Certain files cannot be modified:

```typescript
const PROTECTED_FILES = [
  'package.json',      // Validated versions only
  'next.config.js',    // Core config
  '.env.local',        // Secrets
  'tsconfig.json',     // TypeScript config
];
```

### Row Level Security (RLS)

Supabase RLS policies ensure data isolation:

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own pipelines"
ON pipelines FOR SELECT
USING (created_by = auth.uid());
```

### API Key Management

All API keys stored in environment:

```env
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
MOONSHOT_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
```

---

## ⚙️ Configuration

### Environment Variables

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# AI Models
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
MOONSHOT_API_KEY=sk-...
KIMI_API_KEY=sk-...
QWEN_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...

# Optional
OPENAI_API_KEY=sk-...
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",           // Start Next.js dev server
    "build": "next build",       // Build for production
    "start": "next start",       // Start production server
    "lint": "next lint",         // Run ESLint
    "runner": "cd agent-runner && npm start"  // Start agent runner
  }
}
```

---

## 🔄 Development Workflow

### Local Development

```bash
# 1. Install dependencies
npm install
cd agent-runner && npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Start Next.js
npm run dev

# 4. Start Agent Runner (in another terminal)
npm run runner

# 5. Open dashboard
open http://localhost:3000
```

### Creating a Pipeline

1. **Via Dashboard**
   - Click "New Task"
   - Enter description
   - Click "Create"

2. **Via API**
   ```bash
   curl -X POST http://localhost:3000/api/pipelines/from-idea \
     -H "Content-Type: application/json" \
     -d '{"idea": "Build a todo app with authentication"}'
   ```

3. **Via Code**
   ```typescript
   import { runFullPipeline } from "./lib/pipeline/pipeline-orchestrator";
   
   const result = await runFullPipeline(
     "Build a todo app",
     "./workspace/todo-app"
   );
   ```

### Monitoring

- **Dashboard**: http://localhost:3000
- **Monitor**: http://localhost:3000/monitor
- **Costs**: http://localhost:3000/dashboard/costs
- **Files**: http://localhost:3000/dashboard/files

---

## 📚 Additional Resources

### Key Files to Read

1. `lib/nightFactory/modelClient.ts` - AI model orchestration
2. `lib/pipeline/pipeline-orchestrator.ts` - Full pipeline execution
3. `agent-runner/pipeline-runner.ts` - Background worker
4. `lib/nightFactory/errorClassifier.ts` - Error handling

### Debugging

See `agent-runner/DEBUGGING.md` for common issues.

### Cost Analysis

See `docs/COST_OPTIMIZATION_COMPLETE.md` for detailed cost strategies.

---

## 🚀 Quick Reference

### Start Everything
```bash
npm run dev &          # Frontend
npm run runner &       # Agent
open http://localhost:3000
```

### Create Pipeline
```typescript
await runFullPipeline("Build X app", "./workspace/X")
```

### Check Costs
```bash
curl http://localhost:3000/api/stats/costs
```

### View Logs
```bash
tail -f agent-runner/path-operations.log
```

---

**Built with ❄️ by Frost Night Factory**

