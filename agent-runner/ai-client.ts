// agent-runner/ai-client.ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════════════════════════════════════════════════════════════
// COST ESTIMATES (as of Dec 2024)
// ═══════════════════════════════════════════════════════════════════
const COST_PER_1M_TOKENS = {
  // Claude
  'claude-3-5-sonnet-20241022': { input: 300, output: 1500 }, // $3/$15 per 1M
  'claude-3-5-haiku-20241022': { input: 80, output: 400 },    // $0.80/$4 per 1M
  
  // OpenAI
  'gpt-4o': { input: 250, output: 1000 },
  'gpt-4o-mini': { input: 15, output: 60 },
  
  // DeepSeek
  'deepseek-chat': { input: 14, output: 28 },
  'deepseek-reasoner': { input: 55, output: 219 },
  
  // Groq (practically free)
  'llama-3.3-70b-versatile': { input: 0, output: 0 }
}

function estimateCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const rates = COST_PER_1M_TOKENS[model as keyof typeof COST_PER_1M_TOKENS] || { input: 100, output: 300 } // default
  const inputCost = (tokensIn / 1_000_000) * rates.input
  const outputCost = (tokensOut / 1_000_000) * rates.output
  return Math.round((inputCost + outputCost) * 100) // convert to cents
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
  role: 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER'
  model: string
  messages: Array<{ role: string; content: string }>
  errorSignature?: string
  temperature?: number
}

export async function callAI(opts: AICallOptions): Promise<string> {
  const { pipelineId, step, role, model, messages, errorSignature, temperature = 0.7 } = opts
  
  const promptSig = generatePromptSignature(pipelineId, step, model, errorSignature)
  
  console.log(`🤖 [AI] ${role} using ${model} (pipeline: ${pipelineId.slice(0, 8)})`)
  
  // Check cache for this exact error pattern
  if (errorSignature && role === 'FIXER') {
    const { data: cached } = await supabase
      .from('error_patterns')
      .select('golden_patch')
      .eq('error_signature', errorSignature)
      .maybeSingle()
    
    if (cached?.golden_patch) {
      console.log(`💾 [CACHE HIT] Using cached fix for ${errorSignature.slice(0, 8)}`)
      return typeof cached.golden_patch === 'string' 
        ? cached.golden_patch 
        : JSON.stringify(cached.golden_patch)
    }
  }
  
  const startTime = Date.now()
  let response: string
  let tokensIn = 0
  let tokensOut = 0
  
  try {
    // Route to correct API
    if (model.startsWith('claude')) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const result = await anthropic.messages.create({
        model,
        max_tokens: 8000,
        temperature,
        messages: messages as any
      })
      
      response = result.content[0].type === 'text' ? result.content[0].text : ''
      tokensIn = result.usage.input_tokens
      tokensOut = result.usage.output_tokens
      
    } else if (model.startsWith('gpt')) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      // Apply logit bias for OpenAI models (Gemini's brilliant idea)
      const result = await openai.chat.completions.create({
        model,
        temperature,
        messages: messages as any,
        logit_bias: FORBIDDEN_TOKENS // ← Model physically can't write these
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else {
      throw new Error(`Unknown model: ${model}`)
    }
    
    const duration = Date.now() - startTime
    const costCents = estimateCostCents(model, tokensIn, tokensOut)
    
    // Log to database
    await Promise.all([
      // Detailed log
      supabase.from('ai_calls').insert({
        pipeline_id: pipelineId,
        step_name: step,
        model,
        role,
        prompt_signature: promptSig,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_cents: costCents
      }),
      
      // Update pipeline totals
      supabase.rpc('increment_pipeline_cost', {
        p_pipeline_id: pipelineId,
        p_cost_cents: costCents,
        p_tokens_in: tokensIn,
        p_tokens_out: tokensOut
      })
    ])
    
    console.log(`✅ [AI] ${role} complete in ${duration}ms | $${(costCents / 100).toFixed(3)} | ${tokensOut} tokens`)
    
    return response
    
  } catch (error: any) {
    console.error(`❌ [AI] ${role} failed:`, error.message)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODEL ROUTING STRATEGY (Gemini's + Perplexity's ideas combined)
// ═══════════════════════════════════════════════════════════════════
export type ModelTier = 'cheap' | 'mid' | 'expensive'

export function selectModel(
  role: 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER',
  complexity: 'simple' | 'medium' | 'complex' = 'medium'
): string {
  // PLANNER: Always use reasoner
  if (role === 'PLANNER') {
    return 'deepseek-reasoner' // Best bang for buck
  }
  
  // CODER: Use expensive for main generation
  if (role === 'CODER') {
    return 'claude-3-5-sonnet-20241022'
  }
  
  // REVIEWER: Cheap model is fine
  if (role === 'REVIEWER') {
    return 'claude-3-5-haiku-20241022'
  }
  
  // FIXER: Escalate based on complexity
  if (role === 'FIXER') {
    switch (complexity) {
      case 'simple': return 'claude-3-5-haiku-20241022'  // $0.001
      case 'medium': return 'gpt-4o-mini'                // $0.005
      case 'complex': return 'claude-3-5-sonnet-20241022' // $0.015
    }
  }
  
  return 'claude-3-5-haiku-20241022' // default cheap
}

