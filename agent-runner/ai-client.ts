// agent-runner/ai-client.ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Groq from 'groq-sdk'  // ✅ Phase 3: Groq client
import { GoogleGenerativeAI } from '@google/generative-ai'  // ✅ Google Gemini support
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { callClaudeFrontendStrict } from './lib/claude/claude-gateway'  // ✅ Claude gateway (central resilience)

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

// ✅ Google Gemini client for repair/debug tasks
const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null

// ✅ Kimi K2 (Moonshot) client for research synthesis
let kimiClient: OpenAI | null = null

function initKimiClient(): void {
  const apiKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  [Kimi] MOONSHOT_API_KEY not set - Kimi features disabled');
    return;
  }
  
  // Debug logging
  console.log('🔍 [Kimi] Initializing client...');
  console.log(`   API Key exists: ${!!apiKey}`);
  console.log(`   API Key length: ${apiKey.length}`);
  console.log(`   API Key prefix: ${apiKey.substring(0, 10)}***`);
  
  try {
    kimiClient = new OpenAI({
      apiKey: apiKey.trim(), // Remove any whitespace
      baseURL: 'https://api.moonshot.ai/v1', // ✅ FIXED: Use .ai (not .cn)
      defaultHeaders: {
        'User-Agent': 'Frost-Agent/1.0',
      },
    });
    
    console.log(`✅ [Kimi] Client initialized successfully`);
  } catch (error: any) {
    console.error(`❌ [Kimi] Failed to initialize client: ${error.message}`);
    kimiClient = null;
  }
}

// Initialize on module load
initKimiClient();

// ═══════════════════════════════════════════════════════════════════
// COST ESTIMATES (as of Dec 2024)
// ═══════════════════════════════════════════════════════════════════
const COST_PER_1M_TOKENS = {
  // Claude
  'claude-sonnet-4-5': { input: 300, output: 1500, cacheWrite: 375, cacheRead: 30 }, // $3/$15/$3.75/$0.30 per 1M - May 2025 - Fast + Smart
  'claude-haiku-4-5-20251001': { input: 80, output: 400, cacheWrite: 100, cacheRead: 8 },    // $0.80/$4/$1/$0.08 per 1M
  
  // OpenAI
  'gpt-4o': { input: 250, output: 1000, cacheWrite: 250, cacheRead: 25 },
  'gpt-4o-mini': { input: 15, output: 60, cacheWrite: 15, cacheRead: 1.5 },
  
  // DeepSeek
  'deepseek-chat': { input: 14, output: 28, cacheWrite: 14, cacheRead: 1.4 },
  'deepseek-reasoner': { input: 55, output: 219, cacheWrite: 55, cacheRead: 5.5 },
  
  // Groq (practically free)
  'llama-3.3-70b-versatile': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  
  // Google Gemini (for repair/debug)
  'gemini-2.5-flash': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, // Free tier
  'gemini-2.5-flash-preview-09-2025': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  
  // Kimi K2 (Moonshot) - for research synthesis
  'kimi-k2-thinking': { input: 500, output: 600, cacheWrite: 0, cacheRead: 0 }, // $0.50/$0.60 per 1M
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
  role: 'PLANNER' | 'CODER' | 'FIXER' | 'REVIEWER' | 'RESEARCHER' | 'PROMPT_ENGINEER' | 'CODE_REVIEWER' | 'SQL_AGENT' | 'PYTHON_FIXER' | 'DEBUGGER' | 'UX_REVIEWER'
  model: string
  messages: Array<{ role: string; content: string }>
  errorSignature?: string
  temperature?: number
  maxTokens?: number  // For K2 and other models that support long outputs
  // ✅ Phase 1: Prompt caching
  cacheableBlocks?: Array<{ type: 'text'; text: string }>  // Static content to cache
}

// ═══════════════════════════════════════════════════════════════════
// CODE GENERATION RULES - Critical structure requirements
// ═══════════════════════════════════════════════════════════════════
const CODE_GENERATION_RULES = `
CRITICAL CODE STRUCTURE RULES:

1. **Import Order (MANDATORY)**:
   - ALL import statements MUST come before ANY other code
   - Correct: import → export → code
   - Wrong: export → import (causes module errors)

   Example (CORRECT):
   \`\`\`typescript
   'use client';

   import { useState } from 'react';
   import { motion } from 'framer-motion';

   export const dynamic = 'force-dynamic';

   export default function Component() {
     // ...
   }
   \`\`\`

   Example (WRONG - NEVER DO THIS):
   \`\`\`typescript
   'use client';

   export const dynamic = 'force-dynamic';  // ❌ Export before import

   import { useState } from 'react';  // ❌ Import after export
   \`\`\`

2. **ES Module Rules**:
   - Imports must be at the top of the file
   - No code between imports and exports
   - No conditional imports

3. **Next.js Route Segment Config**:
   - Route configs (dynamic, revalidate, etc.) go AFTER imports
   - But BEFORE the component export

4. **CRITICAL: NO STUBS OR PLACEHOLDERS**:
   - You MUST write the FULL implementation
   - NO // TODO comments
   - NO empty function bodies
   - NO return null without conditional logic
   - NO placeholder strings or mocked data
   - If you write a stub, you FAIL
   - Every function must have real, working code
   - Every component must render actual UI, not placeholders
`;

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
      let systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const nonSystemMessages = messages.filter(m => m.role !== 'system')
      
      // ✅ Add CODE_GENERATION_RULES for CODER role
      if (role === 'CODER' || role === 'FIXER') {
        systemMessages = [CODE_GENERATION_RULES, ...systemMessages]
      }
      
      // Convert system messages to Anthropic format (string or array of text blocks)
      const systemParam = systemMessages.length > 0 
        ? systemMessages.length === 1 
          ? systemMessages[0] // Single string
          : systemMessages.map(text => ({ type: 'text' as const, text })) // Array of text blocks
        : undefined
      
      // ✅ Phase 1: Use prompt caching if cacheable blocks provided
      // ✅ Wrap Claude calls with resilience (retry on overload/rate-limit/timeout)
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
        
        const payload = {
          model: safeModel,
          max_tokens: 8000,
          temperature,
          system: systemBlocks, // Use cacheable blocks if available
          messages: userMessage ? [{ role: 'user' as const, content: userMessage.content }] : []
        }
        
        result = await callClaudeFrontendStrict(
          `${role}:${step}:${safeModel}`,
          () => anthropic.messages.create(payload)
        )
      } else {
        // Regular call: use extracted system messages
        const payload = {
          model: safeModel,
          max_tokens: 8000,
          temperature,
          ...(systemParam && { system: systemParam }), // Only include if system messages exist
          messages: nonSystemMessages as any // Only non-system messages (no 'system' role!)
        }
        
        result = await callClaudeFrontendStrict(
          `${role}:${step}:${safeModel}`,
          () => anthropic.messages.create(payload)
        )
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
      // ✅ Add CODE_GENERATION_RULES for CODER role
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const nonSystemMessages = messages.filter(m => m.role !== 'system')
      const finalSystemMessages = (role === 'CODER' || role === 'FIXER')
        ? [CODE_GENERATION_RULES, ...systemMessages]
        : systemMessages
      
      // Apply logit bias for OpenAI models (Gemini's brilliant idea)
      const result = await openai.chat.completions.create({
        model: safeModel,
        temperature,
        messages: [
          ...(finalSystemMessages.length > 0 ? finalSystemMessages.map(content => ({ role: 'system' as const, content })) : []),
          ...nonSystemMessages.map(m => ({ role: m.role as any, content: m.content }))
        ],
        logit_bias: FORBIDDEN_TOKENS // ← Model physically can't write these
      })
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else if (safeModel.startsWith('llama') || safeModel.includes('groq') || safeModel.includes('llama-3')) {
      // ✅ Phase 3: Groq API
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const userMessages = messages.filter(m => m.role !== 'system')
      
      // ✅ Add CODE_GENERATION_RULES for CODER role
      const finalSystemMessages = (role === 'CODER' || role === 'FIXER')
        ? [CODE_GENERATION_RULES, ...systemMessages]
        : systemMessages
      
      // Map model name to Groq's format
      const groqModel = safeModel.includes('llama-3.3') 
        ? 'llama-3.3-70b-versatile'
        : 'llama-3.3-70b-versatile' // Default
      
      const result = await groq.chat.completions.create({
        model: groqModel,
        messages: [
          ...(finalSystemMessages.length > 0 ? finalSystemMessages.map(content => ({ role: 'system' as const, content })) : []),
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
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const userMessages = messages.filter(m => m.role !== 'system')
      
      // ✅ Add CODE_GENERATION_RULES for CODER role
      const finalSystemMessages = (role === 'CODER' || role === 'FIXER')
        ? [CODE_GENERATION_RULES, ...systemMessages]
        : systemMessages
      
      const result = await deepseek.chat.completions.create({
        model: safeModel.includes('reasoner') ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: [
          ...(finalSystemMessages.length > 0 ? finalSystemMessages.map(content => ({ role: 'system' as const, content })) : []),
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
        // Try to reinitialize
        initKimiClient();
        if (!kimiClient) {
          throw new Error('Kimi/Moonshot API key not configured. Set MOONSHOT_API_KEY or KIMI_API_KEY');
        }
      }
      
      // Determine correct model name (check more specific first)
      // 🔧 FIXED: Use stable preview models instead of thinking (avoids timeouts)
      let modelName: string;
      if (safeModel.includes('k2-instruct')) {
        modelName = 'moonshot-v1-128k'; // ✅ Stable fast model
      } else if (safeModel.includes('k2-thinking') || safeModel.includes('k2')) {
        // Use stable preview instead of thinking (avoids tool-calling bugs)
        modelName = 'moonshot-v1-128k'; // ✅ Stable preview (was kimi-k2-thinking)
        console.log(`   ℹ️  Using stable moonshot-v1-128k instead of k2-thinking (avoids timeouts)`);
      } else {
        // Fallback to stable moonshot model
        console.warn(`⚠️  [Kimi] Unknown model "${safeModel}", using moonshot-v1-128k as fallback`);
        modelName = 'moonshot-v1-128k';
      }
      
      console.log(`🤖 [Kimi] Using model: ${modelName} for ${safeRole}`);
      
      // Extract system messages (Kimi uses standard OpenAI format)
      let systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const nonSystemMessages = messages.filter(m => m.role !== 'system')
      
      // ✅ Add CODE_GENERATION_RULES for CODER role
      if (role === 'CODER' || role === 'FIXER') {
        systemMessages = [CODE_GENERATION_RULES, ...systemMessages]
      }
      
      // ✅ Stable models use standard timeout (no extended timeout needed)
      const timeoutMs = 120000; // 2 minutes (stable models don't need extended timeout)
      
      // Create AbortController for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => {
        abortController.abort()
      }, timeoutMs)
      
      let result: any
      try {
        result = await kimiClient.chat.completions.create({
          model: modelName,
          messages: [
            ...(systemMessages.length > 0 ? [{ role: 'system', content: systemMessages.join('\n\n') }] : []),
            ...nonSystemMessages.map(m => ({ role: m.role as any, content: m.content }))
          ],
          temperature,
          max_tokens: opts.maxTokens || 150000 // Leverage K2's long output capacity
        }, {
          signal: abortController.signal, // ✅ Extended timeout for K2 thinking (10 min)
          timeout: timeoutMs // Also set timeout option
        })
        
        clearTimeout(timeoutId)
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError' || abortController.signal.aborted) {
          throw new Error(`Kimi K2 thinking request timed out after ${timeoutMs / 1000 / 60} minutes`)
        }
        throw error
      }
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
      response = result.choices[0]?.message?.content || ''
      tokensIn = result.usage?.prompt_tokens || 0
      tokensOut = result.usage?.completion_tokens || 0
      
    } else if (safeModel.includes('gemini') || safeModel.startsWith('gemini-')) {
      // ✅ Google Gemini API for repair/debug tasks
      if (!genAI) {
        throw new Error('Google Gemini API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY');
      }
      
      // Extract system messages and user messages
      const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content)
      const userMessages = messages.filter(m => m.role !== 'system')
      
      // ✅ Add CODE_GENERATION_RULES for CODER role
      const finalSystemMessages = (role === 'CODER' || role === 'FIXER')
        ? [CODE_GENERATION_RULES, ...systemMessages]
        : systemMessages
      
      // Normalize model name (accept both gemini-2.5-flash and gemini-2.5-flash-preview-09-2025)
      let modelName = safeModel
      if (!modelName.startsWith('gemini-')) {
        // Fallback: if model doesn't start with gemini-, use default
        modelName = 'gemini-2.5-flash'
      }
      
      const geminiModel = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: opts.maxTokens || 8000,
        }
      })
      
      // Combine system and user messages for Gemini (Gemini uses simple string prompt)
      const systemPrompt = finalSystemMessages.length > 0 
        ? finalSystemMessages.join('\n\n') + '\n\n'
        : ''
      const userPrompt = userMessages.map(m => m.content).join('\n\n')
      const fullPrompt = systemPrompt + userPrompt
      
      console.log(`🤖 [Gemini] Using model: ${modelName} for ${safeRole}`)
      
      const result = await geminiModel.generateContent(fullPrompt)
      
      response = result.response.text()
      // Gemini doesn't provide token usage in the same way, estimate based on response length
      tokensIn = Math.ceil(fullPrompt.length / 4) // Rough estimate: 4 chars per token
      tokensOut = Math.ceil(response.length / 4)
      
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
    // Enhanced error logging for Kimi/Moonshot
    if (safeModel.includes('moonshot') || safeModel.includes('kimi')) {
      console.error(`❌ [AI] ${safeRole} failed (Kimi/Moonshot):`, {
        message: error.message,
        status: error.status,
        type: error.type,
        code: error.code,
        headers: error.headers ? Object.fromEntries(error.headers.entries()) : undefined,
        requestID: error.requestID,
      });
      
      // Check for specific error types
      if (error.status === 401) {
        console.error('   🔑 Authentication Error - Check:');
        console.error('      1. MOONSHOT_API_KEY is set correctly');
        console.error('      2. API key is valid (not expired)');
        console.error('      3. API key has correct format (no extra spaces)');
        console.error('      4. Using correct endpoint: https://api.moonshot.ai/v1');
      } else if (error.status === 429) {
        console.error('   ⏱️  Rate Limit Error - Wait before retrying');
      }
    } else {
      console.error(`❌ [AI] ${safeRole} failed:`, error.message);
    }
    
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
      return 'claude-sonnet-4-5' // May 2025 - Fast + Smart
    }
  
  // REVIEWER: Cheap model is fine
  if (role === 'REVIEWER') {
    return 'claude-haiku-4-5-20251001'
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
  
  return 'claude-haiku-4-5-20251001' // default cheap
}

