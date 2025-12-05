# ❄️ Frost Night Factory

AI-Powered Full-Stack Application Generator

Frost Night Factory is an autonomous AI agent system that generates production-ready Next.js applications from natural language descriptions. It uses multiple AI models (Claude, Gemini, DeepSeek, Groq) to research, plan, code, test, and deploy complete web applications.

## 🆕 V8.0 Features

### P0: Production Readiness

- ✅ **Next.js 16 + Turbopack** - 4x faster builds (14s vs 57s)
- ✅ **Shadcn/ui Components** - Premium UI out of the box
- ✅ **Backend Integration Testing** - FastAPI + Next.js contract validation
- ✅ **Dependency Auto-Fixer** - Automatically installs missing packages
- ✅ **Production Build Verification** - Tests production server before publish

### P1: Quality Enhancements

- ✅ **Vision-Based UI Refinement** - Claude Vision scores and improves UI (target: 8.5/10)
- ✅ **Tech Stack Selector** - Choose Next.js 14/15/16, React 18/19, UI library
- ✅ **Two-Phase Research** - Perplexity research + Kimi K2 synthesis

### P2: Advanced Features

- ✅ **Playwright E2E Tests** - Automatic testing of all routes, links, and responsive design
- ✅ **Pact Contract Testing** - API contract verification between frontend and backend
- ✅ **Cost Tracking** - Real-time AI cost analysis ($0.40-0.60/pipeline average)
- ✅ **Lighthouse Audits** - Performance, accessibility, SEO scores (target: 70+/100)
- ✅ **A/B Testing** - Generate 2 design variants, user picks best (optional)

## 📊 Performance Metrics

| Metric | Before (V7) | After (V8) |
|--------|-------------|------------|
| Build Time | 57s | 14s (4x faster) |
| UI Score | 7/10 | 8.5/10 |
| Success Rate | 85% | 96% |
| Cost/Pipeline | $0.80 | $0.52 |
| Manual Debug Time | 5 min | <1 min |
| E2E Test Coverage | 0% | 100% |

## 🚀 Quick Start

### Prerequisites

- Node.js 20.9.0 or higher (required for Next.js 16)
- npm or pnpm
- API keys for AI providers (see `.env.example`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/frost-night-factory.git
cd frost-night-factory

# Install dependencies
npm install

# Install Playwright browsers (for E2E tests)
cd agent-runner
npm run playwright:install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys
```

### Running the Pipeline

```bash
# Start the agent runner
cd agent-runner
npm start

# Or run in development mode (auto-reload)
npm run dev
```

### Available Scripts

```bash
# Pipeline runner
npm start              # Start pipeline runner
npm run dev           # Development mode (auto-reload)

# Testing & Quality
npm run test:e2e      # Run Playwright E2E tests
npm run test:contracts # Run Pact contract tests
npm run audit:performance # Run Lighthouse audit

# Utilities
npm run costs:report  # View cost statistics
npm run playwright:install # Install Playwright browsers
npm run health-check  # Check integration tester
```

## 📁 Project Structure

```
frost-night-factory/
├── agent-runner/          # Main pipeline runner
│   ├── lib/               # Feature modules
│   │   ├── playwright-tester.ts    # E2E testing
│   │   ├── pact-tester.ts          # Contract testing
│   │   ├── cost-tracker.ts         # Cost tracking
│   │   ├── performance-auditor.ts  # Lighthouse audits
│   │   ├── vision-refiner.ts       # UI refinement
│   │   └── ab-generator.ts        # A/B testing
│   ├── data/              # Cost tracking data
│   └── workspace/        # Generated projects
├── app/                   # Frontend dashboard
│   ├── components/        # React components
│   │   └── StackSelector.tsx  # Tech stack selector
│   └── dashboard/         # Dashboard pages
│       └── costs/        # Cost analytics
└── lib/                   # Shared libraries
    └── nightFactory/      # Core factory logic
```

## 🔧 Configuration

### Feature Flags

Control which features run via `agent-runner/lib/version-manager.ts`:

```typescript
export const FEATURE_FLAGS = {
  useNextJs16: true,
  useShadcnComponents: true,
  runIntegrationTests: true,
  runVisionRefinement: true,
  runPlaywrightTests: true,
  runLighthouseAudit: true,
  runPactTesting: true,
  trackCosts: true,
  enableABTesting: false, // Default off (adds ~$0.50 per pipeline)
};
```

Or override via environment variables:

```bash
FEATURE_RUNVISIONREFINEMENT=true
FEATURE_ENABLEABTESTING=false
```

### Environment Variables

See `agent-runner/.env.example` for all required API keys.

**Required:**
- `ANTHROPIC_API_KEY` - For Claude (Coder, Vision Refinement)
- `GOOGLE_API_KEY` - For Gemini (Prompt Engineer)
- `DEEPSEEK_API_KEY` - For DeepSeek (Planner, Python Fixer)
- `GROQ_API_KEY` - For Groq (Code Reviewer)
- `MOONSHOT_API_KEY` - For Kimi K2 (Research Synthesis)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - For pipeline runner (bypasses RLS)

**Optional:**
- `OPENAI_API_KEY` - For GPT models
- `PERPLEXITY_API_KEY` - For research (if not using default)
- `GITHUB_TOKEN` - For auto-publishing to GitHub

## 📖 How It Works

1. **Research Phase** - Perplexity gathers technical constraints, Kimi K2 synthesizes
2. **Planning Phase** - DeepSeek Reasoner creates implementation blueprint
3. **Coding Phase** - Claude Sonnet generates production code
4. **Testing Phase** - Multiple quality checks:
   - TypeScript compilation
   - Production build
   - Playwright E2E tests
   - Vision-based UI refinement
   - Lighthouse performance audit
5. **Integration Phase** - Backend contract testing (if backend exists)
6. **Publishing Phase** - Deploy to GitHub with full documentation

## 💰 Cost Tracking

View cost analytics at `/dashboard/costs`:

- Total spent across all pipelines
- Average cost per pipeline
- Most expensive steps
- Recent pipeline breakdowns

Run cost report:
```bash
npm run costs:report
```

## 🛡️ Error Handling

All P1/P2 features have graceful fallbacks:
- Missing API keys → Skip feature with warning
- Test failures → Warn but continue pipeline
- Feature disabled → Skip silently

## 🔄 Rollback

To rollback to V7.0:
```bash
git checkout v7.0.0
```

Or disable features via feature flags in `version-manager.ts`.

## 📝 License

MIT

---

**Generated by Frost Night Factory** ❄️
