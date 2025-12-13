# Agent-Runner File Structure

Complete file structure tree of the `agent-runner` directory (excluding `node_modules`).

```
agent-runner/
├── Core Files
│   ├── ai-client.ts / .js
│   ├── ast-validator.ts / .js
│   ├── code-validator.ts / .js
│   ├── dispatcher.ts / .js
│   ├── error-classifier.ts / .js
│   ├── event-logger.ts / .js
│   ├── index.ts / .js
│   ├── model-router.ts / .js
│   ├── multi-pass-generator.ts / .js
│   ├── pipeline-runner.ts / .js
│   ├── pre-start-check.ts / .js
│   ├── repo-map-generator.ts / .js
│   ├── semantic-cache.ts / .js
│   ├── smart-circuit-breaker.ts / .js
│   ├── supabase-client.ts / .js
│   ├── watcher.ts / .js
│   ├── patch-runner.ts
│   ├── upgrade_runner.ts
│   ├── upgrade_runner_global.ts
│   ├── types.d.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
│
├── src/
│   └── info-transporter.ts          # Phase context transportation
│
├── lib/                              # Utility libraries (94 files: 56 *.ts, 38 *.js)
│   ├── ab-generator.ts / .js
│   ├── adaptive-ux-thresholds.ts / .js
│   ├── ai-code-validator.ts / .js
│   ├── apply-fixes.ts
│   ├── auto-fixer.ts / .js
│   ├── blueprint-library.ts / .js
│   ├── build-artifacts.ts / .js
│   ├── coder-self-debug.ts / .js
│   ├── confidence-scoring.ts / .js
│   ├── contract-check.ts / .js
│   ├── cost-tracker.ts / .js
│   ├── dependency-detective.ts
│   ├── e2e-debugger.ts / .js
│   ├── e2e-tester.ts / .js
│   ├── env-detector.ts / .js
│   ├── error-classifier.ts
│   ├── file-writer.ts
│   ├── golden-components.ts / .js
│   ├── golden-contracts.ts / .js
│   ├── hive-mind.ts / .js
│   ├── integration-tester.ts / .js
│   ├── kill-switches.ts / .js
│   ├── log-validation.ts
│   ├── logger.ts / .js
│   ├── model-escalation.ts / .js
│   ├── model-routing-policies.ts / .js
│   ├── nightFactory/                 # Night Factory utilities
│   │   ├── externalModuleStubs.ts
│   │   ├── foundationFix.ts
│   │   ├── missingImportScaffolder.ts
│   │   ├── next15Tsconfig.ts
│   │   ├── renamePolicy.ts
│   │   ├── structureFix.ts
│   │   └── tsxNormalizer.ts
│   ├── pact-tester.ts / .js
│   ├── performance-auditor.ts / .js
│   ├── pipeline-broadcast.ts / .js
│   ├── playwright-tester.ts / .js
│   ├── playwright-tests/
│   ├── port-manager.ts / .js
│   ├── pre-test-build.ts
│   ├── pre-testing-validator.ts
│   ├── production-alerts.ts / .js
│   ├── prompt-regression.ts / .js
│   ├── protected-files.ts / .js
│   ├── quality-policy.ts / .js
│   ├── rls-validator.ts
│   ├── safe-fs.ts / .js
│   ├── self-diagnostics.ts / .js
│   ├── semantic-distance.ts / .js
│   ├── supabase-client.ts
│   ├── type-matcher.ts
│   ├── ux-reviewer.ts / .js
│   ├── validator.ts
│   ├── version-manager.ts / .js
│   ├── vision-refiner.ts / .js
│   ├── windows-casing-fix.ts / .js
│   └── write-file-safe.ts / .js
│
├── scripts/
│   ├── fix-imports.ts
│   └── type-consistency-enforcer.ts
│
├── templates/
│   └── shadcn/
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx
│       │   │   ├── CTASection.tsx
│       │   │   ├── DashboardShell.tsx
│       │   │   ├── DataTablePage.tsx
│       │   │   ├── FeatureGrid.tsx
│       │   │   ├── FormPage.tsx
│       │   │   ├── HeroSection.tsx
│       │   │   ├── PageRenderer.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── StatsGrid.tsx
│       │   │   └── ToolShowcase.tsx
│       │   └── ui/
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── input.tsx
│       │       ├── table.tsx
│       │       ├── toast.tsx
│       │       ├── toaster.tsx
│       │       ├── use-toast.ts / .js
│       └── lib/
│           ├── blueprints.ts / .js
│           └── utils.ts / .js
│
├── data/
│   ├── costs.json
│   └── golden/
│       └── invoice/
│           └── lib/
│               ├── api.ts / .js
│               ├── mock-data.ts / .js
│               ├── schemas.ts / .js
│               └── types.ts / .js
│
├── knowledge/
│   ├── error-patterns.json
│   ├── golden-components/
│   ├── golden-configs/
│   │   ├── globals.css
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   └── tailwind.config.ts
│   ├── prompts/
│   │   ├── chatgpt-coder.prompt
│   │   ├── gemini-architect.prompt
│   │   ├── kimi-k2-synthesizer.prompt
│   │   └── perplexity-design.prompt
│   ├── javascript_latest.md
│   ├── next_js_latest.md
│   ├── node_latest.md
│   ├── python_latest.md
│   └── typescript_latest.md
│
├── supabase/
│   └── migrations/
│       └── create_pipeline_errors_table.sql
│
├── workspace/
│   └── sandbox/
│       └── pipeline-eb83fbd7-a04e-41db-b214-f9f9bb7348a2/
│           └── k2-synthesis.md
│
├── app/
│   └── pipelines/
│       └── [id]/
│
├── Test Files
│   ├── test-cost-optimization.ts / .js
│   ├── test-error-logging.ts / .js
│   ├── test-insert.ts / .js
│   ├── test-integration.ts / .js
│   ├── test-jsx-removal.ts
│   ├── test-kimi-api.ts / .js
│   ├── test-semantic-distance.ts / .js
│   └── test-strip-fences.ts / .js
│
└── Documentation
    ├── DEBUGGING.md
    ├── GRAND_STRATEGY_STATUS.md
    └── path-operations.log
```

## Key Directories

- **Core Files**: Main pipeline orchestration, AI clients, validators, and generators
- **src/**: Source code for phase context transportation
- **lib/**: Utility libraries for testing, validation, debugging, and infrastructure
- **lib/nightFactory/**: Night Factory-specific utilities (rename policies, structure fixes, etc.)
- **templates/**: ShadCN UI component templates
- **data/**: Golden examples and cost tracking data
- **knowledge/**: Documentation, prompts, and configuration templates
- **scripts/**: Utility scripts for import fixing and type consistency
- **workspace/**: Sandbox workspace for pipeline execution
- **Test Files**: Various test scripts for validation and debugging

## File Count Summary

- **TypeScript files (.ts)**: ~56 in lib/, plus core files
- **JavaScript files (.js)**: ~38 compiled versions in lib/, plus core files
- **Total source files**: ~150+ (excluding node_modules)

