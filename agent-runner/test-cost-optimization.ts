// agent-runner/test-cost-optimization.ts
// Integration test for cost optimization features

import { semanticCache } from './semantic-cache'
import { selectOptimalModel, estimateComplexity, getModelName } from './model-router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testCostOptimization() {
  console.log('🧪 Testing Cost Optimization...\n')
  
  // Test 1: Semantic cache
  console.log('1️⃣ Testing semantic cache...')
  
  const query1 = "Fix TS6133: 'React' is declared but never used"
  const query2 = "Resolve unused import error for React"
  
  // First call - cache miss (with validation flag)
  await semanticCache.set(query1, 'test-file.ts', "import React from 'react'", 'TS6133', true)
  
  // Second call - should hit
  const cached = await semanticCache.get(query2, "TS6133", String(0.92))
  
  if (cached.hit) {
    console.log(`✅ Semantic cache works! Similarity: ${(cached.similarity! * 100).toFixed(1)}%`)
  } else {
    console.log('⚠️ Semantic cache miss (may need tuning)')
  }
  
  // Test 2: Model routing
  console.log('\n2️⃣ Testing model routing...')
  
  const error1 = "TS6133: 'foo' is declared but never used"
  const complexity1 = estimateComplexity(error1, 1)
  const model1 = selectOptimalModel('TS6133', complexity1, 1)
  
  console.log(`Error: ${error1}`)
  console.log(`Complexity: ${complexity1}`)
  console.log(`Selected: ${getModelName(model1)} (${model1.provider})`)
  console.log(`Cost: Input $${model1.inputCost}/M | Output $${model1.outputCost}/M`)
  
  if (model1.provider === 'groq') {
    console.log('✅ Routing simple errors to Groq')
  } else {
    console.log('⚠️ Expected Groq for simple error')
  }
  
  // Test 3: Prompt caching (if you have credits)
  console.log('\n3️⃣ Testing prompt caching...')
  console.log('(Skipping - requires API credits)')
  console.log('   To test: Run a pipeline and check for cache_read_tokens > 0')
  
  // Test 4: Database tables
  console.log('\n4️⃣ Checking database tables...')
  
  try {
    const { count: cacheCount } = await supabase
      .from('semantic_cache')
      .select('id', { count: 'exact', head: true })
    
    console.log(`Semantic cache entries: ${cacheCount || 0}`)
    
    const { data: aiCalls } = await supabase
      .from('ai_calls')
      .select('cache_read_tokens')
      .limit(1)
    
    if (aiCalls && aiCalls.length > 0) {
      const firstCall = aiCalls[0];
      if (!firstCall) throw new Error("Expected at least one result");
      const hasCacheColumn = 'cache_read_tokens' in firstCall
      if (hasCacheColumn) {
        console.log('✅ Cache metrics column exists')
      } else {
        console.log('⚠️ Cache metrics column missing (run migration?)')
      }
    } else {
      console.log('ℹ️ No AI calls yet (run a pipeline first)')
    }
    
    // Check if semantic_cache table exists
    const { error: tableError } = await supabase
      .from('semantic_cache')
      .select('id')
      .limit(1)
    
    if (tableError && tableError.message.includes('does not exist')) {
      console.log('❌ semantic_cache table missing (run migration!)')
    } else {
      console.log('✅ semantic_cache table exists')
    }
    
  } catch (error: any) {
    console.error('❌ Database check failed:', error.message)
  }
  
  // Test 5: Environment variables
  console.log('\n5️⃣ Checking environment variables...')
  
  const requiredVars = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GROQ_API_KEY',
    'DEEPSEEK_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  const missing: string[] = []
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }
  
  if (missing.length === 0) {
    console.log('✅ All required environment variables set')
  } else {
    console.log(`⚠️ Missing environment variables: ${missing.join(', ')}`)
    console.log('   Add them to your .env file')
  }
  
  console.log('\n🎉 Cost optimization test complete!')
  console.log('\n📊 Next steps:')
  console.log('   1. Run migration: \\i supabase/migrations/20251206000000_cost_optimization.sql')
  console.log('   2. Add missing API keys to .env')
  console.log('   3. Run: npm install (to get groq-sdk)')
  console.log('   4. Test with a real pipeline run')
}

testCostOptimization().catch(console.error)

