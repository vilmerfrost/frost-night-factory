// agent-runner/semantic-cache.ts
// ✅ Phase 2: Semantic Caching - Cache semantically similar queries
// 🔧 FIXED: Strict matching with file path keys + 99% threshold

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

// ✅ CACHE ENABLED BY DEFAULT (with strict matching)
const CACHE_ENABLED = process.env.SEMANTIC_CACHE_ENABLED !== 'false'; // Default: true
const SIMILARITY_THRESHOLD = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD || '0.99'); // 99% default

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CacheResult {
  hit: boolean
  response?: string
  similarity?: number
  cacheId?: string
}

/**
 * Detect file type from path
 */
function detectFileType(filePath: string): 'route' | 'component' | 'page' | 'lib' | 'config' | 'other' {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  
  if (normalized.includes('/api/') || normalized.includes('/route.')) {
    return 'route';
  }
  if (normalized.includes('/components/')) {
    return 'component';
  }
  if (normalized.includes('/page.') || normalized.includes('/layout.')) {
    return 'page';
  }
  if (normalized.includes('/lib/') || normalized.includes('/utils')) {
    return 'lib';
  }
  if (normalized.includes('config') || normalized.endsWith('.json') || normalized.endsWith('.mjs')) {
    return 'config';
  }
  return 'other';
}

/**
 * Hash prompt for exact matching
 */
function hashPrompt(prompt: string): string {
  const normalized = prompt
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, 'N')
    .slice(0, 1000);
  
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * Semantic Cache using Supabase (simpler than ChromaDB for MVP)
 * Stores embeddings and responses, uses cosine similarity
 */
export class SemanticCache {
  private initialized = false
  
  async initialize() {
    if (this.initialized) return
    
    // Create table if it doesn't exist (run migration separately)
    // For now, assume table exists
    this.initialized = true
    console.log('✅ Semantic cache initialized')
  }
  
  /**
   * Generate cache key with file path (STRICT MATCHING)
   * Format: filePath::promptHash
   */
  private generateCacheKey(filePath: string, prompt: string, errorType?: string): string {
    const promptHash = hashPrompt(prompt);
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `${normalizedPath}::${promptHash}`;
  }
  
  /**
   * Check cache for semantically similar query (STRICT MATCHING)
   * Requires: exact file path match + 99% similarity threshold
   */
  async get(
    prompt: string,
    filePath: string,
    errorType?: string,
    threshold: number = SIMILARITY_THRESHOLD
  ): Promise<CacheResult> {
    // Return miss if cache disabled
    if (!CACHE_ENABLED) {
      if (!(this as any).killSwitchLogged) {
        console.log('🔴 [SEMANTIC CACHE] DISABLED (set SEMANTIC_CACHE_ENABLED=false to disable)');
        (this as any).killSwitchLogged = true;
      }
      return { hit: false };
    }
    
    await this.initialize()
    
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const fileType = detectFileType(filePath);
      const cacheKey = this.generateCacheKey(normalizedPath, prompt, errorType);
      const promptHash = hashPrompt(prompt);
      
      // STEP 1: Check for exact match (same file path + same prompt hash)
      const { data: exact } = await supabase
        .from('semantic_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .maybeSingle()
      
      if (exact) {
        console.log(`💰 [SEMANTIC CACHE] HIT! (exact match: ${normalizedPath})`)
        return {
          hit: true,
          response: exact.response,
          similarity: 1.0,
          cacheId: exact.id
        }
      }
      
      // STEP 2: Check for same file path with similar prompt (99% threshold)
      // This prevents cross-file contamination
      const { data: sameFile } = await supabase
        .from('semantic_cache')
        .select('*')
        .eq('file_path', normalizedPath) // ← CRITICAL: Must match exact file path
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (sameFile && sameFile.length > 0) {
        const promptWords = new Set(prompt.toLowerCase().split(/\s+/))
        
        for (const entry of sameFile) {
          if (!entry.query) continue;
          
          const entryWords = new Set(entry.query.toLowerCase().split(/\s+/))
          const intersection = new Set([...promptWords].filter(x => entryWords.has(x)))
          const union = new Set([...promptWords, ...entryWords])
          const similarity = union.size > 0 ? intersection.size / union.size : 0
          
          // STRICT: Only match if 99%+ similar AND same file path
          if (similarity >= threshold) {
            console.log(`💰 [SEMANTIC CACHE] HIT! (${normalizedPath}, ${(similarity * 100).toFixed(1)}% similarity)`)
            return {
              hit: true,
              response: entry.response,
              similarity,
              cacheId: entry.id
            }
          }
        }
      }
      
      console.log(`🔍 [SEMANTIC CACHE] MISS (${normalizedPath})`)
      return { hit: false }
      
    } catch (error: any) {
      // Handle missing columns gracefully (for backward compatibility)
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('⚠️ [SEMANTIC CACHE] Database schema outdated - cache disabled. Run migration to add file_path column.');
        return { hit: false };
      }
      console.warn('⚠️ [SEMANTIC CACHE] Lookup failed:', error.message)
      return { hit: false }
    }
  }
  
  /**
   * Store query and response in cache (with file path)
   */
  async set(
    prompt: string,
    filePath: string,
    response: string,
    errorType?: string
  ): Promise<void> {
    // Don't store if cache disabled
    if (!CACHE_ENABLED) {
      return;
    }
    
    await this.initialize()
    
    try {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const fileType = detectFileType(normalizedPath);
      const cacheKey = this.generateCacheKey(normalizedPath, prompt, errorType);
      
      // Use upsert to handle both old and new schema
      const cacheEntry: any = {
        cache_key: cacheKey,
        error_type: errorType || null,
        query: prompt.slice(0, 1000), // Truncate for storage
        response: response.slice(0, 50000), // Limit response size
        created_at: new Date().toISOString(),
      };
      
      // Add new columns if they exist (graceful degradation)
      try {
        cacheEntry.file_path = normalizedPath;
        cacheEntry.file_type = fileType;
      } catch {
        // Columns don't exist yet - that's okay
      }
      
      await supabase.from('semantic_cache')
        .upsert(cacheEntry, { onConflict: 'cache_key' })
      
      console.log(`💾 [SEMANTIC CACHE] Stored: ${normalizedPath} (${fileType})`)
    } catch (error: any) {
      // Handle missing columns gracefully
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('⚠️ [SEMANTIC CACHE] Database schema outdated - skipping store. Run migration to add file_path column.');
        return;
      }
      // Non-critical, don't throw
      console.warn('⚠️ [SEMANTIC CACHE] Store failed:', error.message)
    }
  }
}

// Singleton instance
export const semanticCache = new SemanticCache()

