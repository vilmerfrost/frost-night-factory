# 🔧 Cost Optimization Setup Guide

## Prerequisites

1. **API Keys Required:**
   - Anthropic API Key (you already have this)
   - OpenAI API Key (you already have this)
   - **Groq API Key** (NEW - FREE tier available!)
   - **DeepSeek API Key** (NEW)

2. **Get API Keys:**
   - **Groq**: https://console.groq.com/keys (FREE tier available!)
   - **DeepSeek**: https://platform.deepseek.com/api_keys

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd agent-runner
npm install groq-sdk
```

### 2. Add Environment Variables

Add to `agent-runner/.env`:

```bash
# Existing (you should already have these)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# NEW - Required for cost optimization
GROQ_API_KEY=gsk_...           # Get from https://console.groq.com
DEEPSEEK_API_KEY=sk-...        # Get from https://platform.deepseek.com/api_keys
```

**Note:** Groq has a generous FREE tier, perfect for testing!

### 3. Run Database Migration

In Supabase SQL Editor:

```sql
\i supabase/migrations/20251206000000_cost_optimization.sql
```

Or copy-paste the migration file contents directly.

### 4. Verify Setup

Run the integration test:

```bash
cd agent-runner
npx tsx test-cost-optimization.ts
```

Expected output:
```
🧪 Testing Cost Optimization...

1️⃣ Testing semantic cache...
✅ Semantic cache works! Similarity: 85.7%

2️⃣ Testing model routing...
Error: TS6133: 'foo' is declared but never used
Complexity: easy
Selected: llama-3.3-70b-versatile (groq)
Cost: Input $0.05/M | Output $0.08/M
✅ Routing simple errors to Groq

3️⃣ Testing prompt caching...
(Skipping - requires API credits)

4️⃣ Checking database tables...
Semantic cache entries: 1
✅ Cache metrics column exists
✅ semantic_cache table exists

5️⃣ Checking environment variables...
✅ All required environment variables set

🎉 Cost optimization test complete!
```

### 5. Quick Database Verification

Run these queries in Supabase SQL Editor:

```sql
-- Check semantic cache table exists
SELECT COUNT(*) FROM semantic_cache;
-- Should return 0 initially

-- Check cache columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_calls'
  AND column_name IN ('cache_read_tokens', 'cache_write_tokens', 'cache_savings_cents');
-- Should return 3 rows

-- Check recent calls (if any)
SELECT 
  COUNT(*) as total_calls,
  SUM(CASE WHEN cache_read_tokens > 0 THEN 1 ELSE 0 END) as calls_with_cache
FROM ai_calls
WHERE created_at > NOW() - INTERVAL '1 day';
```

## Troubleshooting

### Issue: "Cannot find module 'groq-sdk'"
**Solution:** Run `npm install groq-sdk` in `agent-runner/` directory

### Issue: "GROQ_API_KEY is not defined"
**Solution:** Add `GROQ_API_KEY=gsk_...` to `agent-runner/.env`

### Issue: "semantic_cache table does not exist"
**Solution:** Run the migration: `\i supabase/migrations/20251206000000_cost_optimization.sql`

### Issue: "cache_read_tokens column does not exist"
**Solution:** Run the migration (it adds these columns to `ai_calls` table)

## Testing with Real Pipeline

1. Start a pipeline:
   ```bash
   cd agent-runner
   npm start
   ```

2. Watch for these logs:
   - `💰 [CACHE] Saved $X.XXXX` - Prompt caching working
   - `💰 Semantic cache HIT!` - Semantic caching working
   - `🤖 [ROUTING] Using groq-fast` - Model routing working

3. Check database:
   ```sql
   SELECT * FROM ai_calls 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
   
   Look for:
   - `cache_read_tokens > 0` (prompt caching)
   - `model` column showing `llama-3.3-70b-versatile` or `deepseek-chat` (routing)

## Cost Dashboard

See `docs/COST_OPTIMIZATION_COMPLETE.md` for full dashboard queries.

Quick check:
```sql
-- Daily cost efficiency
SELECT 
  DATE(created_at) as date,
  COUNT(*) as calls,
  SUM(cost_cents)::float / 100 as total_cost,
  ROUND(100.0 * SUM(CASE WHEN cache_read_tokens > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as cache_hit_rate
FROM ai_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Next Steps

1. ✅ Run migration
2. ✅ Add API keys
3. ✅ Install dependencies
4. ✅ Run integration test
5. ✅ Test with real pipeline
6. Monitor cost dashboard
7. Fine-tune routing rules based on your error patterns

---

**Status: Ready to test!** 🚀

