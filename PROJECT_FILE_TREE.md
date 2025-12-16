# Frost Night Factory - Complete Project File Tree

```
frost-night-factory/
│
├── 📁 Root Configuration Files
│   ├── package.json
│   ├── package-lock.json
│   ├── pnpm-workspace.yaml
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── next.config.mjs
│   ├── next.config.ts
│   ├── postcss.config.js
│   ├── eslint.config.mjs
│   ├── .eslintrc.cjs
│   ├── .gitignore
│   ├── middleware.ts
│   ├── frost.js
│   ├── worker.js
│   ├── worker_v2.mjs
│   └── settings.json
│
├── 📁 Documentation Files
│   ├── README.md
│   ├── APP_SUMMARY.md
│   ├── ARCHITECTURE_IMPROVEMENTS.md
│   ├── PERMANENT_FIXES_IMPLEMENTED.md
│   ├── CRITICAL_FIXES_APPLIED.md
│   ├── EMERGENCY_FIXES_APPLIED.md
│   ├── PERMANENT_SOLUTION_COMPLETE.md
│   ├── PRODUCTION_IMPLEMENTATION.md
│   ├── TEST_CHECKLIST.md
│   ├── TEST_SUMMARY.md
│   ├── TESTING.md
│   ├── V85_COMPLETE_IMPLEMENTATION.md
│   ├── V85_FINAL_IMPLEMENTATION.md
│   ├── V85_IMPLEMENTATION_COMPLETE.md
│   ├── V90_EMERGENCY_ARCHITECTURE_RESET.md
│   ├── V90_INTEGRATION_COMPLETE.md
│   ├── WINDOWS_CASING_FIX.md
│   ├── FROST_NIGHT_FACTORY_COMPLETE_GUIDE.md
│   ├── POWERSHELL_TEST_COMMANDS.md
│   ├── QUICK_TEST_KIMI.md
│   ├── review.md
│   └── .context.md
│
├── 📁 agent-runner/                    # Main pipeline runner (975 files)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.core.json
│   ├── tsconfig.preflight.json
│   ├── tsconfig.tools.json
│   ├── tsconfig.typecheck.json
│   ├── next.config.js
│   ├── next.config.ts
│   ├── postcss.config.js
│   ├── types.d.ts
│   │
│   ├── 📁 Core Runner Files
│   │   ├── pipeline-runner.ts          # Main orchestrator (14K+ lines)
│   │   ├── pipeline-runner.js
│   │   ├── dispatcher.ts
│   │   ├── dispatcher.js
│   │   ├── index.ts
│   │   ├── index.js
│   │   ├── watcher.ts
│   │   ├── watcher.js
│   │   ├── upgrade_runner.ts
│   │   ├── upgrade_runner_global.ts
│   │   └── patch-runner.ts
│   │
│   ├── 📁 AI & Model Clients
│   │   ├── ai-client.ts
│   │   ├── ai-client.js
│   │   ├── model-router.ts
│   │   ├── model-router.js
│   │   ├── semantic-cache.ts
│   │   ├── semantic-cache.js
│   │   └── smart-circuit-breaker.ts
│   │   └── smart-circuit-breaker.js
│   │
│   ├── 📁 Code Generation & Validation
│   │   ├── multi-pass-generator.ts
│   │   ├── multi-pass-generator.js
│   │   ├── code-validator.ts
│   │   ├── code-validator.js
│   │   ├── ast-validator.ts
│   │   ├── ast-validator.js
│   │   ├── repo-map-generator.ts
│   │   └── repo-map-generator.js
│   │
│   ├── 📁 Error Handling & Classification
│   │   ├── error-classifier.ts
│   │   ├── error-classifier.js
│   │   └── event-logger.ts
│   │   └── event-logger.js
│   │
│   ├── 📁 lib/                         # Feature modules
│   │   ├── 📁 ai/
│   │   │   └── resilience/
│   │   │       ├── circuitBreaker.ts
│   │   │       ├── claudeResilience.ts
│   │   │       └── semaphore.ts
│   │   │
│   │   ├── 📁 claude/
│   │   │   └── claude-gateway.ts
│   │   │
│   │   ├── 📁 fortress/
│   │   │   └── ensureGoldenMaterialized.ts
│   │   │
│   │   ├── 📁 nightFactory/
│   │   │   ├── 📁 invariants/
│   │   │   │   ├── atomicWrite.ts
│   │   │   │   ├── exportRegistry.ts
│   │   │   │   ├── goldenContracts.ts
│   │   │   │   ├── importHealer.ts
│   │   │   │   ├── invariantOrchestrator.ts
│   │   │   │   ├── libNoJsx.ts
│   │   │   │   ├── packageJsonBuilder.ts
│   │   │   │   ├── plannerManifest.ts
│   │   │   │   └── safeJson.ts
│   │   │   │
│   │   │   ├── next15Tsconfig.ts
│   │   │   ├── externalModuleStubs.ts
│   │   │   ├── foundationFix.ts
│   │   │   ├── jsxAst.ts
│   │   │   ├── missingImportScaffolder.ts
│   │   │   ├── renamePolicy.ts
│   │   │   ├── structureFix.ts
│   │   │   └── tsxNormalizer.ts
│   │   │
│   │   ├── 📁 validation/
│   │   │   └── tsSyntaxGuard.ts
│   │   │
│   │   ├── 📁 workspace/
│   │   │   ├── config.ts
│   │   │   └── critical-files.ts
│   │   │
│   │   ├── ai-code-validator.ts
│   │   ├── ai-code-validator.js
│   │   ├── apply-fixes.ts
│   │   ├── auto-fixer.ts
│   │   ├── auto-fixer.js
│   │   ├── auto-stub-generator.ts
│   │   ├── blueprint-library.ts
│   │   ├── blueprint-library.js
│   │   ├── build-artifacts.ts
│   │   ├── build-artifacts.js
│   │   ├── coder-self-debug.ts
│   │   ├── coder-self-debug.js
│   │   ├── confidence-scoring.ts
│   │   ├── confidence-scoring.js
│   │   ├── contract-check.ts
│   │   ├── contract-check.js
│   │   ├── cost-tracker.ts
│   │   ├── cost-tracker.js
│   │   ├── dependency-detective.ts
│   │   ├── e2e-debugger.ts
│   │   ├── e2e-debugger.js
│   │   ├── error-classifier.ts
│   │   ├── export-contracts.ts
│   │   ├── file-writer.ts
│   │   ├── golden-components.ts
│   │   ├── golden-components.js
│   │   ├── golden-contracts.ts
│   │   ├── golden-contracts.js
│   │   ├── hive-mind.ts
│   │   ├── hive-mind.js
│   │   ├── integration-tester.ts
│   │   ├── integration-tester.js
│   │   ├── jsx-detector.ts
│   │   ├── jsx-sanitizer.ts
│   │   ├── kill-switches.ts
│   │   ├── kill-switches.js
│   │   ├── log-validation.ts
│   │   ├── logger.ts
│   │   ├── logger.js
│   │   ├── model-escalation.ts
│   │   ├── model-escalation.js
│   │   ├── model-routing-policies.ts
│   │   ├── model-routing-policies.js
│   │   ├── models.ts
│   ├── pact-tester.ts
│   │   ├── pact-tester.js
│   │   ├── path-rules.ts
│   │   ├── performance-auditor.ts
│   │   ├── performance-auditor.js
│   │   ├── pipeline-broadcast.ts
│   │   ├── pipeline-broadcast.js
│   │   ├── playwright-tester.ts
│   │   ├── playwright-tester.js
│   │   ├── port-manager.ts
│   │   ├── port-manager.js
│   │   ├── pre-test-build.ts
│   │   ├── pre-testing-validator.ts
│   │   ├── production-alerts.ts
│   │   ├── production-alerts.js
│   │   ├── prompt-regression.ts
│   │   ├── prompt-regression.js
│   │   ├── protected-files.ts
│   │   ├── protected-files.js
│   │   ├── quality-policy.ts
│   │   ├── quality-policy.js
│   │   ├── rls-validator.ts
│   │   ├── safe-fs.ts
│   │   ├── safe-fs.js
│   │   ├── self-diagnostics.ts
│   │   ├── self-diagnostics.js
│   │   ├── semantic-distance.ts
│   │   ├── semantic-distance.js
│   │   ├── supabase-client.ts
│   │   ├── supabase.types.ts
│   │   ├── type-matcher.ts
│   │   ├── ux-reviewer.ts
│   │   ├── ux-reviewer.js
│   │   ├── validator.ts
│   │   ├── version-manager.ts
│   │   ├── version-manager.js
│   │   ├── vision-refiner.ts
│   │   ├── vision-refiner.js
│   │   ├── windows-casing-fix.ts
│   │   ├── windows-casing-fix.js
│   │   ├── write-file-safe.ts
│   │   └── write-file-safe.js
│   │
│   ├── 📁 src/                         # Generated UI components (97 files)
│   │   ├── 📁 components/
│   │   ├── 📁 app/
│   │   └── 📁 lib/
│   │
│   ├── 📁 scripts/
│   │   ├── fix-imports.ts
│   │   ├── materialize-corpus.ts
│   │   ├── type-consistency-enforcer.ts
│   │   ├── ultimate-coder-debug.ts
│   │   └── ultimate-coder-debug.selftest.ts
│   │
│   ├── 📁 templates/                   # Golden templates (26 files)
│   │   ├── 📁 shadcn/
│   │   │   ├── 📁 components/
│   │   │   │   └── 📁 ui/
│   │   │   └── 📁 components/
│   │   │       └── 📁 layout/
│   │   └── 📁 other templates
│   │
│   ├── 📁 test-corpus/                 # Test data (621 files)
│   │   └── 📁 corpus/
│   │
│   ├── 📁 tools/
│   │   ├── esm-hygiene-gate.ts
│   │   └── safety-gate.ts
│   │
│   ├── 📁 data/
│   │   ├── costs.json
│   │   └── 📁 golden/
│   │
│   ├── 📁 migrations/
│   │   ├── 20241201000000_create_invoices.sql
│   │   └── 20241201000001_create_storage_bucket.sql
│   │
│   ├── 📁 supabase/
│   │   └── 📁 migrations/
│   │
│   ├── 📁 knowledge/                   # Knowledge base (8 files)
│   │
│   ├── Test Files
│   │   ├── test-cost-optimization.ts
│   │   ├── test-error-logging.ts
│   │   ├── test-golden-materialization.ts
│   │   ├── test-integration.ts
│   │   ├── test-jsx-ast.ts
│   │   ├── test-jsx-removal.ts
│   │   ├── test-kimi-api.ts
│   │   ├── test-semantic-distance.ts
│   │   ├── test-strip-fences.ts
│   │   └── test-workspace-root-consistency.ts
│   │
│   └── Documentation
│       ├── README.md
│       ├── DEBUGGING.md
│       ├── FILE_STRUCTURE.md
│       └── GRAND_STRATEGY_STATUS.md
│
├── 📁 app/                             # Next.js frontend (80 files)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── favicon.ico
│   ├── types.ts
│   ├── theme-provider.tsx
│   │
│   ├── 📁 api/                         # API routes
│   │   ├── 📁 agent/
│   │   │   ├── execute/route.ts
│   │   │   ├── pipeline/create/route.ts
│   │   │   ├── tasks/route.ts
│   │   │   └── tools/
│   │   │
│   │   ├── 📁 dev/
│   │   │   ├── cost-summary/route.ts
│   │   │   ├── pipeline/[id]/logs-stream/route.ts
│   │   │   ├── pipeline-stream/route.ts
│   │   │   └── prompts/[type]/route.ts
│   │   │
│   │   ├── 📁 night-factory/
│   │   │   ├── export/markdown/route.ts
│   │   │   ├── files/
│   │   │   ├── run-agent/route.ts
│   │   │   └── summary/route.ts
│   │   │
│   │   ├── 📁 pipeline/
│   │   │   └── run/route.ts
│   │   │
│   │   ├── 📁 pipelines/
│   │   │   ├── [id]/
│   │   │   ├── from-idea/route.ts
│   │   │   └── route.ts
│   │   │
│   │   ├── 📁 stats/
│   │   │   └── costs/route.ts
│   │   │
│   │   ├── 📁 tasks/
│   │   │   ├── [id]/
│   │   │   ├── new/route.ts
│   │   │   └── route.ts
│   │   │
│   │   ├── 📁 tickets/
│   │   │   ├── [id]/
│   │   │   ├── create/route.ts
│   │   │   └── route.ts
│   │   │
│   │   └── user_preferences/route.ts
│   │
│   ├── 📁 components/                  # React components
│   │   ├── AgentTaskCreator.tsx
│   │   ├── AgentTaskList.tsx
│   │   ├── AiSummaryPanel.tsx
│   │   ├── CreateTaskModal.tsx
│   │   ├── ExportButtons.tsx
│   │   ├── FeatureRequestPanel.tsx
│   │   ├── FileBrowser.tsx
│   │   ├── FileBrowserPanel.tsx
│   │   ├── LogViewer.tsx
│   │   ├── StackSelector.tsx
│   │   ├── SupabaseProvider.tsx
│   │   ├── TaskDetails.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskMessages.tsx
│   │   ├── TaskRuns.tsx
│   │   └── 📁 pipeline/
│   │       ├── PipelineCreator.tsx
│   │       ├── PipelineTimeline.tsx
│   │       ├── PipelineTimelineV2.tsx
│   │       └── PipelineTimelineV3.tsx
│   │
│   ├── 📁 dashboard/
│   │   ├── costs/page.tsx
│   │   └── files/
│   │
│   ├── 📁 dev/
│   │   ├── ai-cost-monitor/page.tsx
│   │   ├── monitor/
│   │   ├── prompts/page.tsx
│   │   └── ui-catalog/page.tsx
│   │
│   ├── 📁 create/
│   │   └── page.tsx
│   │
│   ├── 📁 monitor/
│   │   └── page.tsx
│   │
│   ├── 📁 pipelines/
│   │   ├── [id]/page.tsx
│   │   └── page.tsx
│   │
│   ├── 📁 settings/
│   │   └── page.tsx
│   │
│   └── 📁 tasks/
│       └── page.tsx
│
├── 📁 lib/                             # Shared libraries (170 files)
│   ├── 📁 agent/
│   │   ├── pipeline.ts
│   │   ├── protocol.ts
│   │   ├── runtime.ts
│   │   ├── tools.ts
│   │   └── types.ts
│   │
│   ├── 📁 ai/
│   │   └── cleanOutput.ts
│   │
│   ├── 📁 error-handling/
│   │   ├── circuit-breaker.ts
│   │   ├── error-classifier.ts
│   │   ├── import-validator.ts
│   │   ├── loop-prevention.ts
│   │   └── preflight-validator.ts
│   │
│   ├── 📁 monitoring/
│   │   └── metrics.ts
│   │
│   ├── 📁 nightFactory/                 # Core factory logic (43 files)
│   │   ├── 📁 invariants/
│   │   ├── ai-prompts.ts
│   │   ├── batchSurgeon.ts
│   │   ├── circuitBreaker.ts
│   │   ├── clientDetector.ts
│   │   ├── codebaseOracle.ts
│   │   ├── compilerAgent.ts
│   │   ├── contextBridge.ts
│   │   ├── contextCompressor.ts
│   │   ├── contextTypes.ts
│   │   ├── dependencyDetective.ts
│   │   ├── design-system.ts
│   │   ├── dockerAgent.ts
│   │   ├── documentationAgent.ts
│   │   ├── domain-type-adapter.ts
│   │   ├── errorAutopsy.ts
│   │   ├── errorClassifier.ts
│   │   ├── errorTelemetry.ts
│   │   ├── fileWriter.ts
│   │   ├── flowChecker.ts
│   │   ├── fortress-files.ts
│   │   ├── goldenTemplates.ts
│   │   ├── goldenVersions.ts
│   │   ├── hiveMind.ts
│   │   ├── importGraphValidator.ts
│   │   ├── importRewriter.ts
│   │   ├── integrationAgent.ts
│   │   ├── intentParser.ts
│   │   ├── knowledgeBase.ts
│   │   ├── layout-contract.ts
│   │   ├── markdownExport.ts
│   │   ├── modelClient.ts
│   │   ├── pathCircuitBreaker.ts
│   │   ├── pathLogger.ts
│   │   ├── pathManager.ts
│   │   ├── pipelineContext.ts
│   │   ├── pipelineController.ts
│   │   ├── pipelineTypes.ts
│   │   ├── preCommitValidation.ts
│   │   ├── public-api.ts
│   │   ├── pythonSyntaxFixer.ts
│   │   ├── scaffoldAgent.ts
│   │   ├── scopeAnalyzer.ts
│   │   ├── seederAgent.ts
│   │   ├── selfAwareCoder.ts
│   │   ├── semanticCache.ts
│   │   ├── structurePlanner.ts
│   │   ├── type-registry.ts
│   │   ├── versionControl.ts
│   │   ├── vision-audit-system.ts
│   │   ├── visualAudit.ts
│   │   ├── visualPreFlight.ts
│   │   ├── zero-shot-validation.ts
│   │   ├── 📁 templates/
│   │   ├── 📁 v85-*.ts files
│   │   └── 📁 v90-*.ts files
│   │
│   ├── 📁 pipeline/
│   │   ├── coder.ts
│   │   ├── coder-escalation.ts
│   │   ├── json-converter.ts
│   │   ├── phases.ts
│   │   ├── pipeline-json-types.ts
│   │   ├── pipeline-orchestrator.ts
│   │   ├── planner.ts
│   │   ├── prompt-architect.ts
│   │   ├── research.ts
│   │   ├── reviewer.ts
│   │   ├── sql.ts
│   │   └── tester.ts
│   │
│   ├── 📁 quarantine/
│   │   └── quarantine-zone.ts
│   │
│   ├── 📁 recovery/
│   │   └── adaptive-recovery.ts
│   │
│   ├── 📁 snapshots/
│   │   └── snapshot-manager.ts
│   │
│   ├── 📁 state-machine/
│   │   └── pipeline-state.ts
│   │
│   ├── 📁 supabase/
│   │   ├── realtime.ts
│   │   ├── supabase-browser.ts
│   │   └── supabase-server.ts
│   │
│   ├── 📁 utils/
│   │   ├── argv.ts
│   │   ├── assert.ts
│   │   ├── bytes.ts
│   │   ├── contentBlocks.ts
│   │   ├── maps.ts
│   │   ├── strings.ts
│   │   └── text.ts
│   │
│   ├── 📁 validation/
│   │   └── metamorphic-validator.ts
│   │
│   ├── feature-flags.ts
│   ├── types.ts
│   ├── ui-imports.ts
│   └── utils.ts
│
├── 📁 templates/                       # Golden templates
│   ├── 📁 core-layout/                 # Frozen layout templates
│   │   ├── AppShell.tsx
│   │   ├── CTASection.tsx
│   │   ├── DashboardShell.tsx
│   │   ├── DataTablePage.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── Footer.tsx
│   │   ├── FormPage.tsx
│   │   ├── HeroSection.tsx
│   │   ├── Navbar.tsx
│   │   ├── PageRenderer.tsx
│   │   ├── README.md
│   │   ├── Sidebar.tsx
│   │   ├── StatsGrid.tsx
│   │   └── ToolShowcase.tsx
│   │
│   └── 📁 fortress/                    # Fortress protected templates
│       ├── ai-extractor.ts
│       ├── extraction.ts
│       ├── fallback-extractor.ts
│       ├── layout.tsx
│       ├── next.config.mjs
│       ├── pdf-loader.ts
│       ├── postcss.config.mjs
│       ├── route-extract.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── types.ts
│
├── 📁 components/                       # Shared React components
│   ├── 📁 dev/
│   │   └── TerminalViewer.tsx
│   ├── 📁 layout/
│   │   ├── AppShell.tsx
│   │   ├── CTASection.tsx
│   │   ├── DashboardShell.tsx
│   │   ├── FeatureGrid.tsx
│   │   ├── HeroSection.tsx
│   │   ├── StatsGrid.tsx
│   │   └── ToolShowcase.tsx
│   ├── Sidebar.tsx
│   └── 📁 ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── table.tsx
│       └── tabs.tsx
│
├── 📁 src/                             # Additional source files (45 files)
│   ├── 📁 app/
│   ├── 📁 components/
│   ├── 📁 lib/
│   └── middleware.ts
│
├── 📁 supabase/                        # Database migrations (22 SQL files)
│   └── 📁 migrations/
│       ├── 0001_night_factory.sql
│       ├── 20240101000000_create_invoices.sql
│       ├── 20240427000000_init.sql
│       ├── 20250108000000_add_stack_config.sql
│       ├── 20251128185814_auto_init.sql
│       ├── 20251201000000_create_pipeline_atomic.sql
│       ├── 20251204000000_production_schema.sql
│       ├── 20251205000000_archiving_and_events.sql
│       ├── 20251206_state_machine.sql
│       ├── 20251206000000_cost_optimization.sql
│       ├── 20251206000001_add_file_path_to_cache.sql
│       ├── 20251207000000_add_error_message_column.sql
│       └── 📁 other migration files
│
├── 📁 sql/                             # SQL schema files (7 files)
│   ├── pipelines.sql
│   ├── tickets.sql
│   ├── strict_agent_protocol.sql
│   ├── agent_tasks.sql
│   ├── night_memories.sql
│   ├── schema_v3.sql
│   └── 📁 other SQL files
│
├── 📁 scripts/                         # Utility scripts (18 files)
│   ├── 📁 TypeScript scripts (.ts)
│   ├── validate-package-jsons.cjs
│   └── 📁 PowerShell scripts (.ps1)
│
├── 📁 test/                            # Test files
│   ├── quarantine.test.ts
│   └── state-machine.test.ts
│
├── 📁 docs/                            # Documentation (8 MD files)
│   ├── SETUP_COST_OPTIMIZATION.md
│   ├── INTEGRATION_COMPLETE.md
│   ├── COST_OPTIMIZATION_FIXES.md
│   ├── V85_DEPLOYMENT.md
│   ├── PHASE_0_1_IMPLEMENTATION.md
│   ├── REMOTE_SETUP.md
│   ├── COST_OPTIMIZATION_COMPLETE.md
│   └── V85_ROLLBACK.md
│
├── 📁 knowledge/                       # Knowledge base (5 MD files)
│
├── 📁 utils/                           # Utility modules
│   └── 📁 supabase/
│       ├── client.ts
│       └── server.ts
│
├── 📁 public/                          # Static assets (5 SVG files)
│
├── 📁 migrations/                      # Additional migrations
│   └── 001_create_invoices.sql
│
├── 📁 remote-server/                   # Remote server scripts (4 files)
│   ├── 📁 Python scripts
│   ├── 📁 Batch scripts
│   └── README.md
│
├── 📁 workspace/                      # Generated workspace
│   └── _agent_logs.txt
│
├── 📁 .coder-regression/              # Regression test data (144 files)
│   ├── 📁 replay/
│   └── 📁 report/
│
├── 📁 .coder-ultimate-debug/          # Debug data (70 files)
│   ├── 📁 corpus/
│   ├── 📁 replay/
│   └── 📁 report/
│
├── 📁 .coder-ultimate-debug2/         # Debug data
│
├── 📁 .coder-ultimate-debug3/         # Debug data (2 files)
│
├── 📁 .github/                         # GitHub workflows
│   └── 📁 workflows/
│       ├── coder-regression.yml
│       └── trigger-home-pc.yml
│
├── 📁 .husky/                          # Git hooks
│   └── pre-commit
│
└── 📁 Log Files
    ├── tsc.log
    ├── tsc-root.log
    ├── tsc-final.log
    ├── tsc-final-check.log
    ├── tsc-pipeline-runner.log
    ├── tsc-agent-runner.log
    └── path-operations.log
```

## 📊 Statistics

- **Total Files**: ~2,000+ files
- **TypeScript Files**: ~400+ .ts/.tsx files
- **JavaScript Files**: ~250+ .js files
- **SQL Files**: ~30+ migration files
- **Documentation**: ~50+ .md files
- **Test Files**: ~650+ test corpus files

## 🗂️ Key Directories

### Core Application
- **`agent-runner/`** - Main pipeline runner (975 files)
- **`app/`** - Next.js frontend dashboard (80 files)
- **`lib/`** - Shared libraries (170 files)

### Templates & Golden Files
- **`templates/core-layout/`** - Frozen layout components
- **`templates/fortress/`** - Protected golden templates

### Configuration
- **`supabase/migrations/`** - Database migrations
- **`sql/`** - SQL schema definitions
- **Root config files** - package.json, tsconfig.json, etc.

### Testing & Debugging
- **`test-corpus/`** - Test data corpus (621 files)
- **`.coder-*`** directories - Debug and regression test data

### Documentation
- **`docs/`** - Technical documentation
- **Root `.md` files** - Project documentation
