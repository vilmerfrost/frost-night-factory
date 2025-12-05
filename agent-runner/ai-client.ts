// agent-runner/ai-client.ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Groq from 'groq-sdk'  // ✅ Phase 3: Groq client
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ✅ Phase 3: Initialize API clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!
})

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com'
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// ✅ Kimi K2 (Moonshot) client for research synthesis
let kimiClient: OpenAI | null = null
if (process.env.MOONSHOT_API_KEY) {
  kimiClient = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY,
    baseURL: 'https://api.moonshot.cn/v1'
  })
}

// ═══════════════════════════════════════════════════════════════════
// COST ESTIMATES (as of Dec 2024)
// ═══════════════════════════════════════════════════════════════════
const COST_PER_1M_TOKENS = {
  // Claude
  'claude-sonnet-4-5': { input: 300, output: 1500, cacheWrite: 375, cacheRead: 30 }, // $3/$15/$3.75/$0.30 per 1M
  'claude-3-5-haiku-20241022': { input: 80, output: 400, cacheWrite: 100, cacheRead: 8 },    // $0.80/$4/$1/$0.08 per 1M
  
  // OpenAI
  'gpt-4o': { input: 250, output: 1000, cacheWrite: 250, cacheRead: 25 },
  'gpt-4o-mini': { input: 15, output: 60, cacheWrite: 15, cacheRead: 1.5 },
  
  // DeepSeek
  'deepseek-chat': { input: 14, output: 28, cacheWrite: 14, cacheRead: 1.4 },
  'deepseek-reasoner': { input: 55, output: 219, cacheWrite: 55, cacheRead: 5.5 },
  
  // Groq (practically free)
  'llama-3.3-70b-versatile': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  
  // Kimi K2 (Moonshot) - for research synthesis
  'moonshot-v1-256k': { input: 500, output: 600, cacheWrite: 0, cacheRead: 0 }, // $0.50/$0.60 per 1M
  'moonshot-v1-8k': { input: 500, output: 600, cacheWrite: 0, cacheRead: 0 }
}

function estimateCostCents(
  model: string, 
  tokensIn: number, 
  tokensOut: number,
  cacheWriteTokens: number = 0,
  cacheReadTokens: number = 0
): number {
  const rates = COST_PER_1M_TOKENS[model as keyof typeof COST_PER_1M_TOKENS] || { 
    input: 100, 
    output: 300, 
    cacheWrite: 100, 
    cacheRead: 10 
  }
  
  const regularInputTokens = tokensIn - cacheReadTokens
  const inputCost = (regularInputTokens / 1_000_000) * rates.input
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * (rates.cacheWrite || rates.input * 1.25)
  const cacheReadCost = (cacheReadTokens / 1_000_000) * (rates.cacheRead || rates.input * 0.1)
  const outputCost = (tokensOut / 1_000_000) * rates.output
  
  return Math.round((inputCost + cacheWriteCost + cacheReadCost + outputCost) * 100) // convert to cents
}

function calculateCacheSavings(cacheReadTokens: number, model: string): number {
  const rates = COST_PER_1M_TOKENS[model as keyof typeof COST_PER_1M_TOKENS] || { input: 100, cacheRead: 10 }
  const fullPriceCost = (cacheReadTokens / 1_000_000) * rates.input
  const cachedCost = (cacheReadTokens / 1_000_000) * (rates.cacheRead || rates.input * 0.1)
  return fullPriceCost - cachedCost
}

function generatePromptSignature(
  pipelineId: string,
  step: string,
  model: string,
  errorSignature?: string
): string {
  const data = `${pipelineId}:${step}:${model}:${errorSignature || 'initial'}`
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)
}

// ═══════════════════════════════════════════════════════════════════
// LOGIT BIAS - Prevent placeholders (Gemini's brilliant idea)
// ═══════════════════════════════════════════════════════════════════
const FORBIDDEN_TOKENS: Record<string, number> = {
  'TODO': -100,
  'FIXME': -100,
  'implement': -50,
  'placeholder': -100,
  '...': -30,
  'mocked_': -80,
  'mock_data': -100
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED AI CLIENT
// ═══════════════════════════════════════════════════════════════════
export interface AICallOptions {
  pipelineId: string
  step: string
  role: 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER' | 'RESEARCHER' | 'PROMPT_ENGINEER' | 'CODE_REVIEWER' | 'SQL_AGENT' | 'PYTHON_FIXER'
  model: string
  messages: Array<{ role: string; content: string }>
  errorSignature?: string
  temperature?: number
  maxTokens?: number  // For K2 and other models that support long outputs
  // ✅ Phase 1: Prompt caching
  cacheableBlocks?: Array<{ type: 'text'; text: string }>  // Static content to cache
}

export async function callAI(opts: AICallOptions): Promise<string> {
  const { pipelineId, step, role, model, messages, errorSignature, temperature = 0.7 } = opts
  
  // ✅ CRITICAL: Guard against undefined model/role
  if (!model) {
    throw new Error(`callAI: model is required but was undefined. Role: ${role}, Step: ${step}, PipelineId: ${pipelineId}`)
  }
  
  if (!role) {
    throw new Error(`callAI: role is required but was undefined. Model: ${model}, Step: ${step}, PipelineId: ${pipelineId}`)
  }
  
  const promptSig = generatePromptSignature(pipelineId, step, model, errorSignature)
  
  // Safe string helper to prevent undefined.slice() errors
  const safe = (value?: string) => value ?? ''
  
  // Safe model/role for logging
  const safeModel = model ?? 'unknown'
  const safeRole = role ?? 'UNKNOWN'
  const pipelineShort = safe(pipelineId).slice(0, 8)
  
  console.log(`🤖 [AI] ${safeRole} using ${safeModel} (pipeline: ${pipelineShort})`)
  
  // Check cache for this exact error pattern
  if (errorSignature && role === 'FIXER') {
    const { data: cached } = await supabase
      .from('error_patterns')
      .select('golden_patch')
      .eq('error_signature', errorSignature)
      .maybeSingle()
    
    if (cached?.golden_patch) {
      console.log(`💾 [CACHE HIT] Using cached fix for ${safe(errorSignature).slice(0, 8)}`)
      return typeof cached.golden_patch === 'string' 
        ? cached.golden_patch 
        : JSON.stringify(cached.golden_patch)
    }
  }
  
  const startTime = Date.now()
  let response: string
  let tokensIn = 0
  let tokensOut = 0
  let cacheWriteTokens = 0
  let cacheReadTokens = 0
  
  try {
    // Route to correct API - use safeModel to prevent undefined.startsWith()
    if (safeModel.startsWith('claude')) {
      
      // ═══════════════════════════════════════════════════════════════════
      // 🔴 CRITICAL: Anthropic API Format Difference
      // ═══════════════════════════════════════════════════════════════════
      // Anthropic's Messages API does NOT accept 'system' role in messages array.
      // Instead, system messages MUST be passed as a top-level `system` parameter.
      // 
      // ❌ WRONG: messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
      // ✅ CORRECT: system: '...', messages: [{ role: 'user', content: '...' }]
      //
      // This prevents: "messages: Unexpected role 'system'" error
      // ═══════════════════════════════════════════════════════════════════
      
      // Extract system messages and filter them out from messages array
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const nonSystemMessages = messages.filter(m => m.role !== 'system')
      
      // Convert system messages to Anthropic format (string or array of text blocks)
      const systemParam = systemMessages.length > 0 
        ? systemMessages.length === 1 
          ? systemMessages[0] // Single string
          : systemMessages.map(text => ({ type: 'text' as const, text })) // Array of text blocks
        : undefined
      
      // ✅ Phase 1: Use prompt caching if cacheable blocks provided
      let result: any
      if (opts.cacheableBlocks && opts.cacheableBlocks.length > 0) {
        // Structure for caching: system blocks get cached
        const systemBlocks = opts.cacheableBlocks.map(block => ({
          type: 'text' as const,
          text: block.text,
          cache_control: { type: 'ephemeral' as const }
        }))
        
        // Extract user message (dynamic part)
        const userMessage = nonSystemMessages.find(m => m.role === 'user')
        
        result = await anthropic.messages.create({
          model: safeModel,
          max_tokens: 8000,
          temperature,
          system: systemBlocks, // Use cacheable blocks if available
          messages: userMessage ? [{ role: 'user', content: userMessage.content }] : []
        })
      } else {
        // Regular call: use extracted system messages
        result = await anthropic.messages.create({
          model: safeModel,
          max_tokens: 8000,
          temperature,
          ...(systemParam && { system: systemParam }), // Only include if system messages exist
          messages: nonSystemMessages as any // Only non-system messages (no 'system' role!)
        })
      }
      
      response = result.content[0].type === 'text' ? result.content[0].text : ''
      tokensIn = result.usage.input_tokens
      tokensOut = result.usage.output_tokens
      
      // ✅ Phase 1: Extract cache metrics
      cacheWriteTokens = (result.usage as any).cache_creation_input_tokens || 0
      cacheReadTokens = (result.usage as any).cache_read_input_tokens || 0
      
      if (cacheReadTokens > 0) {
        const savings = calculateCacheSavings(cacheReadTokens, safeModel)
        console.log(`💰 [CACHE] Saved $${(savings / 100).toFixed(4)} (${cacheReadTokens} tokens cached)`)
      }
      
    } else if (safeModel.startsWith('gpt')) {
      // Apply logit bias for OpenAI models (Gemini's brilliant idea)
      const result = await openai.chat.completions.create({
        model: safeModel,
        temperature,
        messages: messages as any,
        logit_bias: FORBIDDEN_TOKENS // ← Model physically can't write these
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else if (safeModel.startsWith('llama') || safeModel.includes('groq') || safeModel.includes('llama-3')) {
      // ✅ Phase 3: Groq API
      const systemMessage = messages.find(m => m.role === 'system')
      const userMessages = messages.filter(m => m.role !== 'system')
      
      // Map model name to Groq's format
      const groqModel = safeModel.includes('llama-3.3') 
        ? 'llama-3.3-70b-versatile'
        : 'llama-3.3-70b-versatile' // Default
      
      const result = await groq.chat.completions.create({
        model: groqModel,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage.content }] : []),
          ...userMessages.map(m => ({ role: m.role as any, content: m.content }))
        ],
        max_tokens: 8000,
        temperature
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else if (safeModel.startsWith('deepseek')) {
      // ✅ Phase 3: DeepSeek API
      const systemMessage = messages.find(m => m.role === 'system')
      const userMessages = messages.filter(m => m.role !== 'system')
      
      const result = await deepseek.chat.completions.create({
        model: safeModel.includes('reasoner') ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage.content }] : []),
          ...userMessages.map(m => ({ role: m.role as any, content: m.content }))
        ],
        max_tokens: 8000,
        temperature
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else if (safeModel.includes('moonshot') || safeModel.includes('kimi')) {
      // ✅ Kimi K2 (Moonshot) API for research synthesis
      if (!kimiClient) {
        throw new Error('Kimi/Moonshot API key not configured')
      }
      
      // Extract system messages (Kimi uses standard OpenAI format)
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const nonSystemMessages = messages.filter(m => m.role !== 'system')
      
      const result = await kimiClient.chat.completions.create({
        model: safeModel.includes('256k') ? 'moonshot-v1-256k' : 'moonshot-v1-8k',
        messages: [
          ...(systemMessages.length > 0 ? [{ role: 'system', content: systemMessages.join('\n\n') }] : []),
          ...nonSystemMessages.map(m => ({ role: m.role as any, content: m.content }))
        ],
        temperature,
        max_tokens: opts.maxTokens || 150000 // Leverage K2's long output capacity
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else {
      throw new Error(`Unknown model: ${safeModel}`)
    }
    
    const duration = Date.now() - startTime
    const costCents = estimateCostCents(safeModel, tokensIn, tokensOut, cacheWriteTokens, cacheReadTokens)
    
    // Log to database
    await Promise.all([
      // Detailed log
      supabase.from('ai_calls').insert({
        pipeline_id: pipelineId,
        step_name: step,
        model: safeModel,
        role: safeRole,
        prompt_signature: promptSig,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_cents: costCents,
        // ✅ Phase 1: Cache metrics (store in details JSONB if column doesn't exist)
        details: {
          cache_write_tokens: cacheWriteTokens,
          cache_read_tokens: cacheReadTokens,
          cache_savings_cents: cacheReadTokens > 0 ? Math.round(calculateCacheSavings(cacheReadTokens, safeModel) * 100) : 0
        }
      }),
      
      // Update pipeline totals
      supabase.rpc('increment_pipeline_cost', {
        p_pipeline_id: pipelineId,
        p_cost_cents: costCents,
        p_tokens_in: tokensIn,
        p_tokens_out: tokensOut
      })
    ])
    
    console.log(`✅ [AI] ${safeRole} complete in ${duration}ms | $${(costCents / 100).toFixed(3)} | ${tokensOut} tokens`)
    
    // ✅ P2: Track cost in CostTracker (if available)
    try {
      const { CostTracker } = await import('./lib/cost-tracker');
      // Use a global instance if available, or create a temporary one
      const globalTracker = (global as any).costTracker;
      if (globalTracker && pipelineId) {
        globalTracker.trackModelCall(
          step || role || 'unknown',
          safeModel,
          tokensIn,
          tokensOut
        );
      }
    } catch {
      // CostTracker not available, skip
    }
    
    return response
    
  } catch (error: any) {
    console.error(`❌ [AI] ${safeRole} failed:`, error.message)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODEL ROUTING STRATEGY (Gemini's + Perplexity's ideas combined)
// ═══════════════════════════════════════════════════════════════════
export type ModelTier = 'cheap' | 'mid' | 'expensive'

export function selectModel(
  role: 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER' | 'PYTHON_FIXER',
  complexity: 'simple' | 'medium' | 'complex' = 'medium'
): string {
  // PLANNER: Always use reasoner
  if (role === 'PLANNER') {
    return 'deepseek-reasoner' // Best bang for buck
  }
  
  // CODER: Use expensive for main generation
  if (role === 'CODER') {
    return 'claude-sonnet-4-5'
  }
  
  // REVIEWER: Cheap model is fine
  if (role === 'REVIEWER') {
    return 'claude-3-5-haiku-20241022'
  }
  
  // PYTHON_FIXER: Use DeepSeek for Python error fixing
  if (role === 'PYTHON_FIXER') {
    return 'deepseek-chat' // $0.14/$0.28 per 1M - reliable for Python fixes
  }
  
  // FIXER: Use DeepSeek (we have API key, no OpenAI quota issues)
  if (role === 'FIXER') {
    switch (complexity) {
      case 'simple': return 'deepseek-chat'              // $0.14/$0.28 per 1M - reliable
      case 'medium': return 'deepseek-chat'             // $0.14/$0.28 per 1M - reliable
      case 'complex': return 'deepseek-reasoner'        // $0.55/$2.19 per 1M - best reasoning
    }
  }
  
  return 'claude-3-5-haiku-20241022' // default cheap
}

