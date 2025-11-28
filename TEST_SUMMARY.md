# 🧪 Quick Test Summary

## 🚀 Start Everything

**Terminal 1 - Next.js Server:**
```bash
npm run dev
```

**Terminal 2 - Agent Runner:**
```bash
npm run runner
```

## ✅ Test Commands

### 1. Test Pipeline Creation
```bash
npm run test:pipeline
```

### 2. Test Tickets System  
```bash
npm run test:tickets
```

### 3. Manual API Test
```bash
# Create pipeline
curl -X POST http://localhost:3000/api/pipelines/from-idea \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "ideaPrompt": "Build a counter app"}'

# Create bug ticket (auto-handled)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"type": "bug", "title": "Test Bug", "description": "Something broken", "autoHandle": true}'

# Create feature ticket (needs review)
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"type": "feature", "title": "Test Feature", "description": "Add dark mode", "autoHandle": false}'
```

## 📊 What to Check

1. **Supabase Tables:**
   - `pipelines` - Should have new rows
   - `pipeline_steps` - Should show research/planner/coder steps
   - `tickets` - Should show bug/feature tickets

2. **Runner Logs:**
   - Should show "Processing pipeline..."
   - Should show phase transitions
   - Should show file writes (if coder succeeds)

3. **UI Dashboard:**
   - `http://localhost:3000`
   - FeatureRequestPanel shows pending features
   - Can start pipelines manually

4. **Files Created:**
   - `cursor_tasks/*.md` - When escalation happens
   - `reports/pipeline-*.md` - After reviewer phase
   - Generated code files in repo (if coder succeeds)

## 🔍 Debug Queries

```sql
-- Check pipelines
SELECT id, name, status, current_phase FROM pipelines ORDER BY created_at DESC LIMIT 5;

-- Check steps
SELECT phase, status, logs FROM pipeline_steps WHERE pipeline_id = 'your-id' ORDER BY created_at;

-- Check tickets
SELECT id, type, title, status, auto_handle, pipeline_id FROM tickets ORDER BY created_at DESC;
```

## ⚠️ Common Issues

- **Runner not starting:** Check env vars, Supabase connection
- **No pipelines processed:** Check pipelines exist with `status: "pending"`
- **Coder always escalates:** Check LLM API key, try simpler prompt
- **Files not written:** Check REPO_LOCAL_PATH, permissions

## 📚 Full Documentation

- `TESTING.md` - Detailed testing guide
- `QUICK_START.md` - Setup instructions
- `TEST_CHECKLIST.md` - Step-by-step checklist

