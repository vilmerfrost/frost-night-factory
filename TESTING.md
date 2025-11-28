# 🧪 Testing Guide - Frost Night Factory Escalation Layer

## Prerequisites

1. **Supabase Setup**
   - Run migrations in Supabase SQL Editor:
     - `sql/pipelines.sql`
     - `sql/tickets.sql`
     - `supabase/migrations/0001_night_factory.sql`

2. **Environment Variables**
   ```bash
   # .env.local or .env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   REPO_LOCAL_PATH=/path/to/your/repo
   GOOGLE_API_KEY=your_gemini_key
   ```

3. **Start Next.js Dev Server**
   ```bash
   npm run dev
   ```

## Test Scenarios

### 1. Test Basic Pipeline Creation

**Via API:**
```bash
curl -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test MVP",
    "ideaPrompt": "Build a simple todo app with Next.js"
  }'
```

**Expected:** Returns pipeline with `status: "pending"` and `current_phase: "research"`

**Check Supabase:**
- `pipelines` table should have new row
- `pipeline_steps` should have research step with `status: "pending"`

### 2. Test Pipeline Runner

**Start Runner:**
```bash
cd agent-runner
npm install
npm start
```

**Expected Output:**
- Runner polls Supabase every 5 seconds
- When pipeline found, processes research → planner → coder phases
- Logs each step progress

**Check:**
- Pipeline status updates in Supabase
- Steps complete sequentially
- Files written to `REPO_LOCAL_PATH` (if coder succeeds)

### 3. Test Escalation Flow

**Create a pipeline that will escalate:**

```bash
curl -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complex Bug Fix",
    "ideaPrompt": "Fix a critical bug in payroll calculation that requires deep understanding of RLS policies, complex SQL joins, and integration with 15+ files across the codebase"
  }'
```

**Expected Flow:**
1. Research phase completes
2. Planner phase completes
3. Coder phase attempts → returns `status: "need_external_help"`
4. Prompt Architect phase creates Cursor task
5. External Tool Wait phase waits for commits
6. (Manual step: You commit changes)
7. Reviewer phase analyzes changes

**Check Files Created:**
- `cursor_tasks/*.md` - Cursor prompt file
- Git branch created: `auto/bug-...` or `auto/feature-...`
- `reports/pipeline-*.md` - Review report (after reviewer)

### 4. Test Ticket System (Bug vs Feature)

**Create Bug Ticket (Auto-handled):**
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bug",
    "title": "Payroll export crashes",
    "description": "When exporting payroll, app crashes with error: ...",
    "autoHandle": true
  }'
```

**Expected:**
- Ticket created with `status: "new"` and `auto_handle: true`
- Dispatcher picks it up automatically
- Pipeline created automatically
- Ticket status → `pipeline_running`

**Create Feature Ticket (Needs Review):**
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "feature",
    "title": "Add dark mode toggle",
    "description": "Users want a dark mode option",
    "autoHandle": false
  }'
```

**Expected:**
- Ticket created with `status: "needs_human_review"`
- Shows up in FeatureRequestPanel UI
- No automatic pipeline creation

**Start Pipeline Manually:**
```bash
curl -X POST http://localhost:3000/api/tickets/{ticket_id}/start-pipeline \
  -H "Content-Type: application/json"
```

### 5. Test UI Components

**Open Browser:**
```
http://localhost:3000
```

**Check:**
- FeatureRequestPanel shows pending features
- Can click "Start AI Pipeline" button
- Can click "Reject" button
- AgentTaskList shows agent tasks
- LogViewer shows real-time logs

### 6. Test External Tool Wait

**Simulate Cursor Completion:**

1. Pipeline escalates to `prompt_architect`
2. Branch created: `auto/bug-...`
3. Make some changes manually:
   ```bash
   git checkout auto/bug-...
   # Make changes
   git add .
   git commit -m "Fix: Manual changes"
   git push
   ```
4. Runner detects commits → proceeds to reviewer

**Check:**
- `external_tool_wait` step completes
- `reviewer` step created
- Review report generated in `reports/`

## Debugging Tips

### Check Pipeline Status
```sql
SELECT id, name, status, current_phase, created_at 
FROM pipelines 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Step Logs
```sql
SELECT phase, status, logs, output 
FROM pipeline_steps 
WHERE pipeline_id = 'your-pipeline-id'
ORDER BY created_at;
```

### Check Tickets
```sql
SELECT id, type, title, status, auto_handle, pipeline_id 
FROM tickets 
ORDER BY created_at DESC;
```

### Runner Logs
Check terminal where runner is running - should show:
- `🎯 Processing pipeline: ...`
- `🔍 Running research phase...`
- `📋 Running planner phase...`
- `💻 Running coder phase...`
- etc.

## Common Issues

**Issue: Runner not picking up pipelines**
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
- Verify pipelines table has rows with `status: "pending"`
- Check runner logs for errors

**Issue: Coder always escalates**
- Check LLM API key (GOOGLE_API_KEY)
- Verify modelClient.ts is using correct model
- Check if prompt is too complex (try simpler idea)

**Issue: Files not written**
- Check REPO_LOCAL_PATH is correct
- Verify write permissions on directory
- Check runner logs for file write errors

**Issue: Git operations fail**
- Ensure repo is initialized (`git init`)
- Check git credentials configured
- Verify branch doesn't already exist

## Quick Test Script

Save as `test-pipeline.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Frost Night Factory Pipeline"

# 1. Create pipeline
echo "1. Creating pipeline..."
PIPELINE=$(curl -s -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pipeline",
    "ideaPrompt": "Build a simple counter app"
  }')

PIPELINE_ID=$(echo $PIPELINE | jq -r '.pipeline.id')
echo "✅ Pipeline created: $PIPELINE_ID"

# 2. Check status
echo "2. Checking pipeline status..."
sleep 2
curl -s http://localhost:3000/api/pipelines | jq '.pipelines[] | select(.id=="'$PIPELINE_ID'")'

echo ""
echo "✅ Test complete! Check runner logs for progress."
```

Make executable: `chmod +x test-pipeline.sh`

