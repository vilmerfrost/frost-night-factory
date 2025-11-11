# Cursor AI Integration – Night Factory v2.1

This directory contains configuration and memory files for Cursor AI integration with Night Factory's automated workflow.

## Structure

```
.cursor/
├── rules.md                      # AI safety rules & guidelines
├── README.md                     # This file
└── memory-bank/
    └── session/
        └── current-task.md       # Current task from Night Factory
```

## How It Works

### 1. **PLAN Phase** (Automated)
Every night at 23:00 CET, Night Factory:
1. Researches topics via Perplexity
2. Generates task plan via Gemini
3. Writes plan to `plans/today.md`
4. **Writes structured task to `.cursor/memory-bank/session/current-task.md`**

### 2. **REVIEW Phase** (Human)
Next morning, you:
1. Open `.cursor/memory-bank/session/current-task.md`
2. Review the generated plan
3. Decide: implement, modify, or skip

### 3. **ACT Phase** (Cursor + Human)
Using Cursor AI:
1. Ask Cursor to read `current-task.md`
2. Cursor implements per the plan
3. Cursor follows safety rules in `rules.md`
4. Cursor creates PR

### 4. **MERGE Phase** (Human)
You:
1. Review PR
2. Check tests pass
3. Verify budget under limit
4. Merge if approved

## Safety Rules

All rules are defined in `rules.md`. Key highlights:

### ✅ AUTO-APPROVE (GREEN)
- Changes < 100 LOC
- Bug fixes, refactoring, docs
- All tests pass
- No breaking changes

### 🟡 REQUIRES REVIEW (YELLOW)
- Changes 100-300 LOC
- New features
- Config updates

### 🔴 NEVER AUTO-APPROVE (RED)
- Database schema changes
- Auth/security changes
- Breaking API changes
- Secret handling

## Usage Examples

### Morning Workflow
```bash
# 1. Check if there's a new task
cat .cursor/memory-bank/session/current-task.md

# 2. If task looks good, ask Cursor:
"Read current-task.md and implement the plan following rules.md"

# 3. Cursor will:
#    - Read the task
#    - Follow safety rules
#    - Implement changes
#    - Run tests
#    - Create PR

# 4. Review PR and merge if approved
```

### Ask Cursor Directly
```
@current-task.md Implement this plan following @rules.md constraints
```

### Check Budget
```bash
node scripts/budget_report.js
```

### Reset Task (After Completion)
The task file is automatically overwritten the next night.
No manual reset needed.

## File Format

### current-task.md Structure
```markdown
# Night Factory Task – YYYY-MM-DD

## Objective
[One-line goal]

## Context
[Background]

## Generated Plan
[Full plan from Gemini/Perplexity]

## Files to Touch
[List of files]

## Tests Required
- [ ] Test 1
- [ ] Test 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Constraints
- Budget: 150 SEK max
- No schema changes
- Must be reversible

## Human Gates
- ✅ PLAN written
- ⏳ ACT execution
- ⏳ MERGE approval
```

## Integration with Cursor AI

Cursor AI can:
1. **Read** `current-task.md` to understand the task
2. **Follow** `rules.md` for safety constraints
3. **Execute** the plan with human oversight
4. **Create** PRs automatically

Cursor AI cannot:
- Auto-merge PRs (human approval required)
- Change database schemas
- Modify auth/security
- Exceed budget limits

## Troubleshooting

### Task file empty or outdated?
```bash
# Check last nightly run
gh workflow view nightly.yml

# Trigger manual run
gh workflow run nightly.yml
```

### Cursor not following rules?
1. Verify `rules.md` exists
2. Explicitly reference: `following @rules.md`
3. Review Cursor's context window

### Budget exceeded?
```bash
# Check current budget
node scripts/budget_report.js

# Reset if needed (careful!)
node scripts/budget_report.js --reset --confirm
```

## Best Practices

1. **Always review plans** before executing
2. **Start small** – implement one PR at a time
3. **Test locally** before pushing
4. **Check budget** regularly
5. **Never bypass** RED safety rules

## Workflow Diagram

```
Night Factory (23:00 CET)
    ↓
Research → Plan → Write current-task.md
    ↓
Human Review (morning)
    ↓
Cursor AI Execution
    ↓
Tests & Validation
    ↓
PR Creation
    ↓
Human Approval & Merge
```

## Updates

This integration is updated automatically by `scripts/plan_tasks.js` every night.

To manually update Cursor task:
```bash
node scripts/plan_tasks.js
```

---

**Version:** 2.1.0  
**Last Updated:** 2025-11-11  
**Status:** Active
