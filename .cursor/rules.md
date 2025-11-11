# Cursor AI Rules – Night Factory v2.1

## 🛡️ SAFE RULES (Auto-approve thresholds)

### ✅ GREEN – Auto-approve if ALL conditions met:
- **Size:** Changes < 100 LOC total
- **Scope:** Single file or tightly related files
- **Type:** Bug fixes, refactoring, documentation, tests
- **Tests:** All existing tests pass
- **No breaking changes:** No public API changes
- **No secrets:** No credentials, API keys, or tokens

### 🟡 YELLOW – Requires human review:
- **Size:** Changes 100-300 LOC
- **Scope:** Multiple files across features
- **Type:** New features, schema changes, config updates
- **Tests:** New tests required
- **Breaking changes:** Documented and justified

### 🔴 RED – NEVER auto-approve:
- **Database:** Schema changes, migrations, RLS policies
- **Auth:** Authentication, authorization, permissions
- **Secrets:** Environment variables, API keys, credentials
- **Infrastructure:** CI/CD, deployment configs, GitHub Actions
- **Dependencies:** Major version upgrades
- **Public APIs:** Breaking changes to external contracts

---

## 🚫 FORBIDDEN ACTIONS (Night Factory must NEVER do these)

### Database & Schema
- ❌ ALTER TABLE, DROP TABLE, CREATE TABLE
- ❌ Add/remove columns without migration
- ❌ Change RLS policies
- ❌ Modify indexes or constraints
- ❌ Direct data manipulation (INSERT/UPDATE/DELETE) on prod tables

### Security & Auth
- ❌ Change authentication flows
- ❌ Modify permission checks
- ❌ Add/remove user roles
- ❌ Change CORS, CSP, or security headers
- ❌ Hardcode secrets or credentials

### Breaking Changes
- ❌ Remove or rename public functions
- ❌ Change function signatures without versioning
- ❌ Remove environment variables
- ❌ Change API contracts

---

## ✅ REQUIRED PRACTICES

### Test-Driven Development (TDD)
- Write tests BEFORE implementation for new features
- Maintain >80% code coverage
- Run tests before committing: `npm test`

### Code Quality
- Follow existing patterns and conventions
- Add JSDoc comments for functions
- Use descriptive variable names
- Keep functions small (<50 LOC)
- Avoid deep nesting (max 3 levels)

### Commit Standards
```
feat: add new feature
fix: bug fix
chore: maintenance
docs: documentation
test: add/update tests
refactor: code restructure
```

### Pull Request Template
```markdown
## Problem
[What issue does this solve?]

## Solution
[How does this fix it?]

## Testing
- [ ] Unit tests pass
- [ ] Manual testing done
- [ ] No breaking changes

## Rollback Plan
[How to undo if needed?]
```

---

## 📋 NIGHT FACTORY WORKFLOW

### 1. Research Phase
- Query Perplexity for research topics
- Store findings in `research/notes.md`
- Upsert to Notion database

### 2. Planning Phase
- Use Gemini (fallback: Perplexity) to generate plan
- Check budget before API calls
- Write plan to `plans/today.md`
- **Write Cursor task to `.cursor/memory-bank/session/current-task.md`**

### 3. Execution Phase
- Read current task from `.cursor/memory-bank/session/current-task.md`
- Scaffold files per plan
- Create PR branch
- Push changes
- Use `gh pr create` or fallback to `peter-evans/create-pull-request`

### 4. Reporting Phase
- Generate morning brief
- Upload to Notion
- Sync artifacts to Drive
- Show budget report

---

## 🎯 CURSOR INTEGRATION

### Task File Format
Location: `.cursor/memory-bank/session/current-task.md`

Template:
```markdown
# Night Factory Task – [YYYY-MM-DD]

## Objective
[One-line goal]

## Context
[Brief background]

## Plan
1. [Step 1]
2. [Step 2]
...

## Files to Touch
- `path/to/file1.js` - [Why]
- `path/to/file2.ts` - [Why]

## Tests Required
- [ ] Unit test for X
- [ ] Integration test for Y

## Acceptance Criteria
- [ ] Feature works as expected
- [ ] Tests pass
- [ ] Budget under limit
- [ ] PR created

## Constraints
- Max budget: 150 SEK
- No schema changes
- Must be reversible
```

### Human Gates
- **PLAN Phase:** Night Factory writes task → Human reviews → Cursor executes
- **ACT Phase:** Cursor implements → Tests run → Human approves PR
- **MERGE:** Always manual (no auto-merge)

---

## 🔍 DEBUGGING GUIDELINES

### When Things Break
1. Check logs in workflow run
2. Verify secrets are set correctly
3. Check budget meter: `node scripts/budget_report.js`
4. Inspect artifacts for intermediate output
5. Check Notion kill-switch flag

### Common Issues
- **403 Drive Error:** Enable Drive API + share folder
- **Budget Cap Hit:** Check `reports/budget_meter.json`
- **No PRs Created:** Check git identity + gh CLI auth
- **Tests Failing:** Run `npm test` locally first

---

## 📝 DOCUMENTATION REQUIREMENTS

### Every New File Must Have
```javascript
/**
 * [File Purpose]
 * 
 * Usage:
 *   [Example]
 * 
 * Environment Variables:
 *   - VAR_NAME: [Description]
 * 
 * Related:
 *   - [Other files]
 */
```

### Every Function Must Have
```javascript
/**
 * [Function purpose]
 * @param {Type} paramName - Description
 * @returns {Type} Description
 * @throws {Error} When/why
 */
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before merging to `main`:
- [ ] All tests pass
- [ ] Budget under threshold
- [ ] No secrets in code
- [ ] Documentation updated
- [ ] Rollback plan exists
- [ ] Human review complete

---

**Last Updated:** 2025-11-11
**Version:** 2.1.0
