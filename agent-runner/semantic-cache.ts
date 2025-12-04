// agent-runner/semantic-cache.ts
// ✅ Phase 2: Semantic Caching - Cache semantically similar queries

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

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
   * Generate a simple hash-based similarity key
   * For MVP: Use error signature + first 200 chars of query
   */
  private generateCacheKey(query: string, errorType?: string): string {
    const normalized = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, 'N')
      .slice(0, 500)
    
    const key = `${errorType || 'general'}:${normalized}`
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
  }
  
  /**
   * Check cache for semantically similar query
   * MVP: Simple hash-based lookup (upgrade to embeddings later)
   */
  async get(
    query: string,
    errorType?: string,
    threshold: number = 0.92
  ): Promise<CacheResult> {
    await this.initialize()
    
    try {
      const cacheKey = this.generateCacheKey(query, errorType)
      
      // Check for exact match first
      const { data: exact } = await supabase
        .from('semantic_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .maybeSingle()
      
      if (exact) {
        console.log(`💰 Semantic cache HIT! (exact match)`)
        return {
          hit: true,
          response: exact.response,
          similarity: 1.0,
          cacheId: exact.id
        }
      }
      
      // Check for similar queries (same error type)
      if (errorType) {
        const { data: similar } = await supabase
          .from('semantic_cache')
          .select('*')
          .eq('error_type', errorType)
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (similar && similar.length > 0) {
          // Simple similarity: check if query contains same keywords
          const queryWords = new Set(query.toLowerCase().split(/\s+/))
          
          for (const entry of similar) {
            const entryWords = new Set(entry.query.toLowerCase().split(/\s+/))
            const intersection = new Set([...queryWords].filter(x => entryWords.has(x)))
            const union = new Set([...queryWords, ...entryWords])
            const similarity = intersection.size / union.size
            
            if (similarity >= threshold) {
              console.log(`💰 Semantic cache HIT! Similarity: ${(similarity * 100).toFixed(1)}%`)
              return {
                hit: true,
                response: entry.response,
                similarity,
                cacheId: entry.id
              }
            }
          }
        }
      }
      
      console.log(`🔍 Semantic cache miss`)
      return { hit: false }
      
    } catch (error) {
      console.warn('Semantic cache lookup failed:', error)
      return { hit: false }
    }
  }
  
  /**
   * Store query and response in cache
   */
  async set(
    query: string,
    response: string,
    errorType?: string
  ): Promise<void> {
    await this.initialize()
    
    try {
      const cacheKey = this.generateCacheKey(query, errorType)
      
      await supabase.from('semantic_cache').insert({
        cache_key: cacheKey,
        error_type: errorType || null,
        query: query.slice(0, 1000), // Truncate for storage
        response: response.slice(0, 50000), // Limit response size
        created_at: new Date().toISOString()
      })
      
      console.log(`💾 Semantic cache stored: ${cacheKey.slice(0, 8)}...`)
    } catch (error) {
      // Non-critical, don't throw
      console.warn('Semantic cache store failed:', error)
    }
  }
}

// Singleton instance
export const semanticCache = new SemanticCache()

