# 🏰 FROST NIGHT FACTORY v9.0 - Emergency Architecture Reset

## 🎯 Executive Summary

**The Problem:**
```
SHARED FRAMEWORK FILES ←→ GENERIC REPAIR LOOP = OSCILLATION HELL
```

- Repair loop has blanket write access to `types.ts`, `layout.tsx`, `mock-data.ts` → treats framework as disposable generated code
- No phase contracts → Planner/Coder/Tester don't verify "did upstream deliver what downstream expects?"
- Zero rollback safety → Repair #1 corrupts `types.ts` → Repair #2 starts broken → Repair #3 inherits the mess

**The Fix (v9.0 = 3 Pillars):**
1. **FORTRESS ARCHITECTURE** - Immutable zones the repair loop CANNOT touch
2. **UNIDIRECTIONAL TYPE FLOW** - One-way flow prevents oscillation
3. **STATE MACHINE + BUDGETS** - 5-tier authority with rollback support

---

## 🛡️ PILLAR 1: FORTRESS PATTERN

### File Tiers

| Tier | Authority | Max Attempts | On Fail | Files |
|------|-----------|--------------|---------|-------|
| **TIER 0: GOLDEN** | NONE | 0 | HALT | tsconfig.json, package.json, next.config, tailwind.config |
| **TIER 1: REGENERATE** | Regenerate only | 1 | HALT | src/types/database.ts, src/lib/types.ts, layout.tsx |
| **TIER 2: RESTRICTED** | AI fix (limited) | 2 | ROLLBACK | src/lib/api.ts, src/lib/utils.ts |
| **TIER 3: NORMAL** | AI fix + regen | 3 | RESTART | src/app/**/page.tsx, components |
| **TIER 4: DISPOSABLE** | Unlimited | ∞ | CONTINUE | mock-data.ts, test files |

### Usage

```typescript
import { 
  getFileTier, 
  isInFortress, 
  canRepair,
  checkRepairAllowed 
} from './lib/nightFactory/v90-index';

// Check file security level
const tier = getFileTier('tsconfig.json'); // FortressTier.GOLDEN

// Check if repair is allowed
const result = checkRepairAllowed({
  filePath: 'src/lib/api.ts',
  content: '',
  attemptCount: 1,
  errorType: 'ERROR',
});

if (!result.allowed) {
  console.log(`BLOCKED: ${result.reason}`);
}
```

### Golden Templates

Located in `templates/fortress/`:
- tsconfig.json
- next.config.mjs
- tailwind.config.ts
- postcss.config.mjs
- layout.tsx
- types.ts

---

## 📋 PILLAR 2: UNIDIRECTIONAL TYPE HIERARCHY

### Flow

```
SUPABASE CLI → src/types/database.ts (IMMUTABLE)
                    ↓
           src/lib/types.ts (DOMAIN ADAPTERS)
                    ↓  
       src/lib/mock-data.ts (DERIVED)
                    ↓
src/components/layout/* (CONSUMES TYPES)
```

### Domain Adapters

Pre-defined adapters in `lib/nightFactory/domain-type-adapter.ts`:

```typescript
const DOMAIN_ADAPTERS = [
  {
    name: 'InvoiceData',
    sourceTable: 'invoices',
    pickedFields: ['id', 'amount', 'status', 'created_at', 'due_date'],
    additionalFields: { customerName: 'string', customerEmail: 'string' },
  },
  // ... more adapters
];
```

### Locked Enums

```typescript
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type UserRole = 'admin' | 'member' | 'viewer';
```

---

## ⚙️ PILLAR 3: REPAIR LOOP GOVERNANCE

### 5-Tier Authority Matrix

| Tier | Authority | Models Allowed | Budget | On Fail |
|------|-----------|----------------|--------|---------|
| TIER 0 | NONE | [] | $0 | HALT |
| TIER 1 | REGENERATE | [] | $0 | HALT |
| TIER 2 | AI_FIX | groq, deepseek_v3 | $0.10 | ROLLBACK |
| TIER 3 | AI_FIX_REGEN | groq, deepseek_v3, deepseek_r1 | $0.50 | RESTART |
| TIER 4 | UNLIMITED | all | ∞ | SKIP |

### Usage

```typescript
import { 
  createRepairSession,
  authorizeRepair,
  recordAttempt,
  getSessionSummary 
} from './lib/nightFactory/v90-index';

// Create repair session
const session = createRepairSession('pipeline-123', 2.0); // $2 budget

// Authorize repair
const auth = authorizeRepair('src/lib/api.ts', session, 'groq');

if (auth.allowed) {
  // Attempt repair
  const result = await attemptRepair();
  
  // Record result
  session = recordAttempt(session, {
    filePath: 'src/lib/api.ts',
    attemptNumber: 1,
    model: 'groq',
    cost: 0.05,
    success: result.success,
  });
}

// Get summary
console.log(getSessionSummary(session));
```

### Transaction Rollback

```typescript
import { snapshotManager, withTransaction } from './lib/nightFactory/v90-index';

const result = await withTransaction(
  snapshotManager,
  'pipeline-123',
  projectRoot,
  'Fix types.ts',
  getErrorCount,
  async () => {
    // Your repair operation
  }
);

if (result.rolledBack) {
  console.log('Operation made things worse, rolled back');
}
```

---

## 🧪 VALIDATION STRATEGY

### Graduated Success Tiers

| Tier | Checks | Rule |
|------|--------|------|
| **TIER 1: MUST PASS** | Syntax, imports, build config, types, package.json | All must pass |
| **TIER 2: WARNINGS OK** | Unused code, isolated type errors | ≤ 5 warnings |
| **TIER 3: DOCUMENT** | ESLint, JSDoc | Log only |

**PASS = TIER 1 ✓ + T2 ≤5 + T3 logged**

### Usage

```typescript
import { runZoneValidation, quickValidation } from './lib/nightFactory/v90-index';

// Full validation
const result = await runZoneValidation(projectRoot);
console.log(result.summary);

// Quick check
const passed = await quickValidation(projectRoot);
```

---

## 🚀 Quick Commands

```bash
# Run fortress tests
npm run v90:test-fortress

# Generate fortress templates
npm run generate-fortress

# Generate domain types
npm run generate-domain-types
```

---

## 📁 Files Created

```
lib/nightFactory/
├── fortress-files.ts          # Fortress file definitions
├── v90-fortress-guard.ts      # Repair loop enforcer
├── domain-type-adapter.ts     # Type hierarchy generator
├── v90-repair-authority.ts    # 5-tier authority matrix
├── v90-snapshot-manager.ts    # Transaction rollback
├── v90-zone-validator.ts      # Validation strategy
├── v90-index.ts               # Unified entry point

templates/fortress/
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── layout.tsx
├── types.ts

scripts/
├── v90-test-fortress.ts
├── generate-fortress.ts
├── generate-domain-types.ts
```

---

## 📊 ROI Projection (100 Runs)

| Metric | v8.5 (Current) | v9.0 (Target) | Savings |
|--------|----------------|---------------|---------|
| Repair Cost | $2.00/run | $0.20/run | **90%** |
| Pass Rate | 20% | 85% | **4.25x** |
| Human Escalations | 80% | 10% | **88%** |
| Total Monthly | $200 | $20 | **$180/mo** |

---

## 🧪 Test Results

```
═══════════════════════════════════════════════════════════════
  📊 TEST RESULTS
═══════════════════════════════════════════════════════════════
  ✅ Passed: 26
  ❌ Failed: 0
  📈 Total: 26

✅ All fortress tests passed!
```

---

## 📋 Implementation Checklist

```
✅ [1] Fortress files definition (fortress-files.ts)
✅ [2] Fortress guard (v90-fortress-guard.ts)
✅ [3] Domain type adapters (domain-type-adapter.ts)
✅ [4] Repair authority matrix (v90-repair-authority.ts)
✅ [5] Snapshot manager (v90-snapshot-manager.ts)
✅ [6] Zone validator (v90-zone-validator.ts)
✅ [7] Golden templates (templates/fortress/*)
✅ [8] Unified entry point (v90-index.ts)
✅ [9] Test suite (v90-test-fortress.ts)
✅ [10] Documentation
```

---

## 🎯 Next Steps

1. **Deploy fortress guard** into the pipeline runner
2. **Lock types.ts** to regenerate-only mode
3. **Enable transaction rollback** for all repairs
4. **Test new pipeline** → should FAIL_GRACEFULLY instead of loop

