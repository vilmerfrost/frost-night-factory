-- Migration: Add file_path and file_type columns to semantic_cache
-- This enables strict cache matching (prevents cross-file contamination)

-- Add file_path column (if not exists)
ALTER TABLE semantic_cache 
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add file_type column (if not exists)
ALTER TABLE semantic_cache 
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Create index for faster lookups by file path
CREATE INDEX IF NOT EXISTS idx_semantic_cache_file_path 
ON semantic_cache(file_path);

-- Create index for file_type lookups
CREATE INDEX IF NOT EXISTS idx_semantic_cache_file_type 
ON semantic_cache(file_type);

-- Update existing entries: try to extract file path from cache_key
-- Format: filePath::promptHash
UPDATE semantic_cache
SET file_path = SPLIT_PART(cache_key, '::', 1)
WHERE file_path IS NULL 
  AND cache_key LIKE '%::%';

-- Set file_type for updated entries
UPDATE semantic_cache
SET file_type = CASE
  WHEN file_path LIKE '%/api/%' OR file_path LIKE '%/route.%' THEN 'route'
  WHEN file_path LIKE '%/components/%' THEN 'component'
  WHEN file_path LIKE '%/page.%' OR file_path LIKE '%/layout.%' THEN 'page'
  WHEN file_path LIKE '%/lib/%' OR file_path LIKE '%/utils%' THEN 'lib'
  WHEN file_path LIKE '%config%' OR file_path LIKE '%.json' OR file_path LIKE '%.mjs' THEN 'config'
  ELSE 'other'
END
WHERE file_type IS NULL 
  AND file_path IS NOT NULL;

-- Clean up old entries with low similarity (likely poisoned)
DELETE FROM semantic_cache
WHERE similarity < 0.99
  AND created_at > '2025-12-06'
  AND file_path IS NULL; -- Only delete entries without file_path (old format)

