# ✅ Testing Checklist

## Pre-Flight Checks

- [ ] Supabase migrations run (`pipelines`, `pipeline_steps`, `tickets` tables exist)
- [ ] Environment variables set (`.env.local` or `.env`)
- [ ] Next.js dev server running (`npm run dev`)
- [ ] Agent runner dependencies installed (`cd agent-runner && npm install`)

## Test 1: Basic Pipeline Creation ✅

```bash
npm run test:pipeline
```

**Expected:**
- ✅ Pipeline created in Supabase
- ✅ Research step created with `status: "pending"`
- ✅ Pipeline visible in UI at `http://localhost:3000`

**Verify:**
```sql
SELECT * FROM pipelines ORDER BY created_at DESC LIMIT 1;
SELECT * FROM pipeline_steps WHERE pipeline_id = '...';
```

## Test 2: Pipeline Runner Processing ✅

**Start runner:**
```bash
npm run runner
```

**Expected:**
- ✅ Runner starts without errors
- ✅ Logs show "Polling Supabase..."
- ✅ When pipeline found, processes research → planner → coder
- ✅ Steps update in Supabase (`status: "completed"`)

**Check logs for:**
- `🔍 Running research phase...`
- `📋 Running planner phase...`
- `💻 Running coder phase...`

## Test 3: Ticket System ✅

```bash
npm run test:tickets
```

**Expected:**
- ✅ Bug ticket created with `auto_handle: true`
- ✅ Feature ticket created with `status: "needs_human_review"`
- ✅ Bug ticket automatically gets pipeline (via dispatcher)
- ✅ Feature ticket shows in UI FeatureRequestPanel

**Verify in UI:**
- Open `http://localhost:3000`
- See FeatureRequestPanel with pending features
- Can click "Start AI Pipeline" button

## Test 4: Escalation Flow ✅

**Create complex pipeline:**
```bash
curl -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complex Bug",
    "ideaPrompt": "Fix critical bug requiring RLS changes and 20+ file modifications"
  }'
```

**Expected Flow:**
1. ✅ Research completes
2. ✅ Planner completes  
3. ✅ Coder attempts → returns `status: "need_external_help"`
4. ✅ Prompt Architect creates Cursor task file
5. ✅ Git branch created (`auto/bug-...`)
6. ✅ External Tool Wait waits for commits

**Check files:**
```bash
ls cursor_tasks/  # Should have .md file
git branch        # Should see auto/bug-... branch
```

## Test 5: Manual Escalation Completion ✅

**Simulate Cursor completion:**

1. Checkout branch:
   ```bash
   git checkout auto/bug-...
   ```

2. Make a change:
   ```bash
   echo "// Fixed!" >> app/page.tsx
   git add .
   git commit -m "Fix: Manual changes"
   git push
   ```

3. Runner detects commits → Reviewer phase runs

**Expected:**
- ✅ External Tool Wait detects commits
- ✅ Reviewer phase creates review report
- ✅ Report saved in `reports/pipeline-*.md`
- ✅ Pipeline status → `completed`

**Check:**
```bash
ls reports/  # Should have review report
```

## Test 6: UI Components ✅

**Open:** `http://localhost:3000`

**Check:**
- [ ] FeatureRequestPanel shows pending features
- [ ] Can click "Start AI Pipeline" → creates pipeline
- [ ] Can click "Reject" → updates ticket status
- [ ] AgentTaskList shows agent tasks
- [ ] LogViewer shows real-time logs
- [ ] FileBrowser shows workspace files

## Common Issues & Fixes

### ❌ "Runner not picking up pipelines"
- Check: `SUPABASE_SERVICE_ROLE_KEY` is set
- Check: Pipelines exist with `status: "pending"`
- Check: Runner logs for connection errors

### ❌ "Coder always escalates"
- Check: `GOOGLE_API_KEY` is set
- Check: Model is working (`node check-models.js`)
- Try: Simpler prompt first

### ❌ "Files not written"
- Check: `REPO_LOCAL_PATH` is correct absolute path
- Check: Directory has write permissions
- Check: Runner logs for file errors

### ❌ "Git operations fail"
- Check: Repo is initialized (`git init`)
- Check: Git credentials configured
- Check: Branch doesn't already exist

## Success Criteria

✅ Can create pipeline via API  
✅ Runner processes pipelines automatically  
✅ Escalation flow works end-to-end  
✅ UI shows all components correctly  
✅ Files written to repo  
✅ Review reports generated  

## Next Steps After Testing

1. Wire up real LLM (replace placeholder in `runner/llm.ts`)
2. Customize prompts for your use case
3. Add more phases (SQL, Tester)
4. Set up Cursor integration
5. Add monitoring/alerting

