-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 20251206_cost_optimization.sql
-- Phase 1-3: Cost optimization tables (caching, semantic cache)
-- ═══════════════════════════════════════════════════════════════════

-- Add cache metrics to ai_calls (if not exists via details JSONB)
-- The details column already exists, but we'll add explicit columns for easier querying

ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS cache_write_tokens INT DEFAULT 0;
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS cache_read_tokens INT DEFAULT 0;
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS cache_savings_cents INT DEFAULT 0;

-- Create semantic_cache table for Phase 2
CREATE TABLE IF NOT EXISTS semantic_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  error_type TEXT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_key ON semantic_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_error_type ON semantic_cache(error_type);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_created ON semantic_cache(created_at DESC);

-- Function to update cache hit count
CREATE OR REPLACE FUNCTION increment_cache_hit(cache_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE semantic_cache
  SET 
    hit_count = hit_count + 1,
    last_used_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- View for cache efficiency stats
CREATE OR REPLACE VIEW cache_efficiency_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_calls,
  SUM(cache_read_tokens) as total_cache_read_tokens,
  SUM(cache_write_tokens) as total_cache_write_tokens,
  SUM(cache_savings_cents) as total_savings_cents,
  ROUND(AVG(CASE WHEN cache_read_tokens > 0 THEN 1.0 ELSE 0.0 END) * 100, 2) as cache_hit_rate_pct
FROM ai_calls
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

