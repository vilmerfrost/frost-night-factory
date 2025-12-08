# 🏗️ FROST NIGHT FACTORY - Architecture Improvements

## Overview

This document describes 5 major architectural improvements implemented to prevent:
- Pipeline folder pollution
- Layout component props mismatches (IntrinsicAttributes errors)
- Infinite fix loops
- Batch fixer crashes

---

## 1. 🔒 Isolated Pipeline Testing

### Problem
The tester was treating the whole `workspace/sandbox` as one Next.js project, so old pipeline files could break new runs.

### Solution
Each pipeline now runs in an isolated temp folder:

```
workspace/temp-projects/<pipeline-id>/
├── src/
├── tsconfig.json
├── package.json
└── ... (isolated project)
```

### Files
- `lib/nightFactory/v85-isolated-tester.ts`

### Usage
```typescript
import { runIsolatedPipelineTest, createDefaultIsolatedTesterConfig } from './lib/nightFactory/v85-isolated-tester';

const config = createDefaultIsolatedTesterConfig(pipelineId);
const result = await runIsolatedPipelineTest(generatedFiles, config);

if (result.success) {
  console.log('Pipeline passed validation!');
} else {
  console.log('Violations:', result.violations);
}

// Cleanup when done
await result.cleanupFn();
```

### Benefits
- Each pipeline has its own isolated "mini repo"
- Old broken files in other pipelines cannot affect new runs
- Clean temp folder for each run

---

## 2. 📋 Layout Component Contracts

### Problem
The system had no source of truth for layout component props, so every run could reinvent them and hit IntrinsicAttributes errors.

### Solution
Created a frozen layout contract system with:
- Canonical component definitions
- Exact props for each component
- Auto-generation from contracts

### Files
- `lib/nightFactory/layout-contract.ts` - Contract definitions
- `lib/nightFactory/v85-layout-validator.ts` - Validator
- `scripts/generate-layout-templates.ts` - Template generator
- `scripts/validate-layout-contracts.ts` - Contract validator

### Contracted Components
| Component | Required Props |
|-----------|---------------|
| AppShell | children |
| DashboardShell | children |
| FormPage | children, title |
| DataTablePage | children, title |
| HeroSection | title |
| StatsGrid | stats |
| FeatureGrid | features |
| ToolShowcase | tools |
| CTASection | title |
| PageRenderer | sections |
| Sidebar | items |
| Navbar | (all optional) |
| Footer | (all optional) |

### Usage
```typescript
import { getLayoutContract, isLayoutComponent } from './lib/nightFactory/layout-contract';

// Check if a component is contracted
if (isLayoutComponent('FormPage')) {
  const contract = getLayoutContract('FormPage');
  console.log('Props:', contract.props);
}
```

### Commands
```bash
# Generate templates from contracts
npm run generate-layout-templates

# Validate contracts
npm run validate-layout-contracts
```

---

## 3. 🧱 Framework Fixture Files (Frozen Templates)

### Problem
Layout components were treated as user-generated every run, causing repeated errors.

### Solution
Core layout templates are now:
- Frozen in `templates/core-layout/`
- Version-controlled
- Copied unchanged into each pipeline

### Files
- `templates/core-layout/*.tsx` - All 13 frozen templates
- `templates/core-layout/README.md` - Documentation

### Flow
1. Pipeline creates temp folder
2. Frozen templates are copied as-is (not regenerated)
3. Only feature-specific components are AI-generated
4. Layout components are "library code" that AI uses but doesn't modify

---

## 4. 🎯 IntrinsicAttributes Error Handling

### Problem
IntrinsicAttributes errors were classified as generic "MISSING_MODULE" / "implicit-any" and handled with generic fixes.

### Solution
Dedicated error category and strategy for IntrinsicAttributes:

### New Patterns
```typescript
// Patterns now detected:
/Type .* is not assignable to type 'IntrinsicAttributes[\s\S]*Property '(.+?)' does not exist/
/Property '(.+?)' does not exist on type 'IntrinsicAttributes'/
/TS2322[\s\S]*IntrinsicAttributes/
```

### Category
- `FILE_STRUCTURE_VIOLATION`
- Subcategory: `missing_component_props`, `intrinsic_attributes_error`, `ts2322_intrinsic_attributes`

### Strategy
When IntrinsicAttributes error is detected:
1. Check if it's a layout component
2. If yes → Regenerate from layout contract (no AI needed!)
3. If no → Apply targeted AI fix with contract-aware prompt

### Files
- `lib/nightFactory/v85-error-classifier.ts` - Updated patterns
- `lib/nightFactory/v85-error-mapping.ts` - Helper functions

---

## 5. 🛡️ Guarded Repair System

### Problem
`ReferenceError: mapErrorClassToErrorCategory is not defined` crashed the batch fixer.

### Solution
All mapping helpers are now in a single, self-contained module:

### Files
- `lib/nightFactory/v85-error-mapping.ts` - All mapping functions
- `lib/nightFactory/v85-batch-fixer.ts` - Self-contained batch fixer

### Functions
```typescript
// Error mapping
mapErrorClassToErrorCategory(errorClass: string): ErrorCategory
getFixStrategyForCategory(category: ErrorCategory): FixStrategy
isIntrinsicAttributesError(message: string): boolean
shouldRegenerateFromContract(message: string, filePath: string): boolean
sortErrorsByPriority(errors: T[]): T[]
isRetryableError(category: ErrorCategory): boolean
getMaxRetriesForCategory(category: ErrorCategory): number
```

### Health Check
```typescript
import { batchFixerHealthCheck } from './lib/nightFactory/v85-batch-fixer';

const result = batchFixerHealthCheck();
if (!result.healthy) {
  console.error('Batch fixer is broken:', result.errors);
}
```

---

## 📊 Test Results

All 25 tests pass:

```
✅ Passed: 25
❌ Failed: 0

Tests include:
- Error classifier (6 tests)
- Blueprint validation (4 tests)
- Coder prompts (4 tests)
- AST validators (2 tests)
- Feature flags (1 test)
- Layout contracts (3 tests)
- Batch fixer (3 tests)
- IntrinsicAttributes errors (2 tests)
```

---

## 🚀 Quick Commands

```bash
# Run all v8.5 tests
npm run v85:test

# Validate project
npm run v85:validate

# Generate layout templates
npm run generate-layout-templates

# Validate layout contracts
npm run validate-layout-contracts
```

---

## 📁 New Files Summary

| File | Purpose |
|------|---------|
| `lib/nightFactory/layout-contract.ts` | Layout component contracts |
| `lib/nightFactory/v85-error-mapping.ts` | Error mapping functions |
| `lib/nightFactory/v85-layout-validator.ts` | Layout validation |
| `lib/nightFactory/v85-isolated-tester.ts` | Isolated pipeline testing |
| `lib/nightFactory/v85-batch-fixer.ts` | Self-contained batch fixer |
| `templates/core-layout/*.tsx` | 13 frozen layout templates |
| `scripts/generate-layout-templates.ts` | Template generator |
| `scripts/validate-layout-contracts.ts` | Contract validator |

---

## ✅ Benefits

1. **No more pipeline pollution** - Each pipeline runs in isolation
2. **No more IntrinsicAttributes loops** - Contract-based regeneration
3. **No more batch fixer crashes** - Self-contained module
4. **Faster fixes** - Layout errors fixed from contract (no AI needed)
5. **Consistent components** - Frozen templates ensure stability

