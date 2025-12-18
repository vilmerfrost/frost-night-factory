// lib/nightFactory/modelClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// ============================================================
// Helper functions for safe unknown data handling
// ============================================================

const asObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

const getResponseString = (data: unknown): string => {
  if (!asObj(data)) return "";
  const r = data["response"];
  return typeof r === "string" ? r : "";
};

const getChoicesContent = (response: unknown): string => {
  if (!asObj(response)) return "";
  const choices = response["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const firstChoice = choices[0];
  if (!asObj(firstChoice)) return "";
  const message = firstChoice["message"];
  if (!asObj(message)) return "";
  const content = message["content"];
  return typeof content === "string" ? content : "";
};

// ============================================================
// 1. Google Gemini (Befintlig - för snabba tasks & SQL)
// ============================================================
const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!googleApiKey) {
  console.error("❌ CRITICAL: GOOGLE_API_KEY is missing in .env.local");
} else {
  console.log("✅ Google API Key found (starts with):", googleApiKey.substring(0, 4) + "...");
}

const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;
// ✅ CORRECT MODEL NAMES (Dec 2024/Jan 2025)
// gemini-2.5-pro-exp-03-25 (BEST - Free tier experimental, 2M token context)
// gemini-2.0-flash-exp (FASTEST - 2x faster than 1.5 Pro)
// gemini-2.0-flash-lite (LIGHTEST - Ultra-fast, minimal latency)
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiModel = genAI ? genAI.getGenerativeModel({ model: modelName }) : null;

// ============================================================
// 2. Anthropic Claude 3.5 Sonnet (NY - För Coding)
// ============================================================
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

if (anthropicApiKey) {
  console.log("✅ Anthropic API Key found (starts with):", anthropicApiKey.substring(0, 4) + "...");
}

// ============================================================
// 3. DeepSeek V3.2 (För Planning, Backend & Fixes)
// ============================================================
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
const deepSeek = deepSeekApiKey ? new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',  // 🆕 ADD /v1
  apiKey: deepSeekApiKey,
}) : null;

if (deepSeekApiKey) {
  console.log("✅ DeepSeek API Key found (starts with):", deepSeekApiKey.substring(0, 4) + "...");
}

// ============================================================
// 4. Kimi (Moonshot AI) - "The Budget Genius"
// ============================================================
const moonshotApiKey = process.env.MOONSHOT_API_KEY;
const moonshot = moonshotApiKey ? new OpenAI({
  apiKey: moonshotApiKey,
  baseURL: "https://api.moonshot.ai/v1", // ✅ CORRECT: Use .ai domain for international keys
}) : null;

if (moonshotApiKey) {
  console.log("✅ Moonshot (Kimi) API Key found (starts with):", moonshotApiKey.substring(0, 4) + "...");
}

// ============================================================
// 5. GROQ (The Speed Demon) - Ersätter LocalAI
// ============================================================
const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new OpenAI({
  apiKey: groqApiKey, 
  baseURL: "https://api.groq.com/openai/v1",
}) : null;

if (groqApiKey) {
  console.log("✅ Groq API Key found (starts with):", groqApiKey.substring(0, 4) + "...");
}

// ============================================================
// 6. QWEN (Alibaba Cloud) - Backend Specialist
// ============================================================
const qwenApiKey = process.env.QWEN_API_KEY;
const qwen = qwenApiKey ? new OpenAI({
  apiKey: qwenApiKey,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", // Alibaba Cloud endpoint
}) : null;

if (qwenApiKey) {
  console.log("✅ Qwen API Key found (starts with):", qwenApiKey.substring(0, 4) + "...");
}

// ============================================================
// CIRCUIT BREAKER: Claude Overload Protection
// ============================================================
let claudeCircuitOpen = false;
let claudeRetryTime = 0;

// ============================================================
// RETRY LOGIC: Exponential Backoff for Rate Limits
// ============================================================
/**
 * Timeout wrapper for API calls
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      
      // Check if it's a rate limit error
      if (error.status === 429 || error.message?.includes('rate limit')) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Non-retryable error
      }
    }
  }
  throw new Error('Unreachable');
}

// ============================================================
// CLAUDE 4.5 HAIKU: Fast JSON Transformer (Pipeline Context)
// ============================================================

/**
 * CLAUDE 4.5 HAIKU: Ultra-fast JSON transformer for pipeline context.
 * Used for converting raw AI outputs to structured JSON.
 * 
 * Key features:
 * - Cheap ($0.25/1M input, $1.25/1M output)
 * - Fast (< 2s response time)
 * - Excellent at structured output
 * - Fail-fast on invalid JSON
 */
// ============================================================
// ✅ HELPER FUNCTIONS: Safe JSON extraction and prompt building
// ============================================================

/**
 * Extract first JSON object from text (handles markdown fences, extra text)
 */
function extractFirstJsonObject(text: string): string {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`No JSON object found. First 220 chars: ${cleaned.slice(0, 220)}`);
  }
  return cleaned.slice(first, last + 1);
}

/**
 * Build JSON envelope prompt using JSON.stringify (safe escaping)
 */
function buildJsonEnvelopePrompt(args: {
  phase: string;
  jsonSchema: string;
  rawText: string;
}): string {
  // ✅ ENDA stället JSON skapas: JSON.stringify
  const envelope = {
    phase: args.phase,
    timestamp: new Date().toISOString(),
    schema_template: args.jsonSchema, // keep as string (schema är inte valid JSON pga 0.0-1.0 osv)
    raw_input_text: args.rawText,
  };

  return [
    "You are a strict JSON transformer.",
    "Return ONLY valid JSON. No markdown. No explanations. No text before/after.",
    "Output must be a single JSON object that matches schema_template as closely as possible.",
    "Rules:",
    "- Start with { and end with }",
    "- No trailing commas",
    "- If something is missing: null / []",
    "",
    "INPUT_ENVELOPE_JSON:",
    JSON.stringify(envelope),
  ].join("\n");
}

/**
 * Build JSON repair prompt using JSON.stringify (safe escaping)
 */
function buildJsonRepairPrompt(args: { invalidJson: string }): string {
  return [
    "You are a strict JSON repair tool.",
    "Task: Fix the JSON so it becomes valid JSON.",
    "Return ONLY the fixed JSON object. No markdown. No explanations.",
    "Rules:",
    "- Start with { and end with }",
    "- No trailing commas",
    "",
    "INVALID_JSON_INPUT:",
    JSON.stringify({ invalid_json: args.invalidJson }), // ✅ safe embed
  ].join("\n");
}

// ============================================================
// MAIN CONVERTER FUNCTION
// ============================================================

export async function generateClaudeHaikuJSON<T>(
  rawText: string,
  jsonSchema: string,
  phase: string,
  maxRetries: number = 2
): Promise<{ success: boolean; data?: T; error?: string; raw_text_audit: string }> {
  const auditTrail = rawText;

  if (!anthropic) {
    console.warn("⚠️ Claude Haiku: No Anthropic key. Falling back to Gemini for JSON conversion.");
    return fallbackToGeminiJSON<T>(rawText, jsonSchema, phase, auditTrail);
  }

  // ✅ LONG-TERM: no manual escaping of rawText. JSON.stringify(envelope) handles it safely.
  const prompt = buildJsonEnvelopePrompt({ phase, jsonSchema, rawText });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔧 Claude Haiku (Attempt ${attempt}/${maxRetries}): Converting ${phase} to JSON...`);

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5", // keep your configured name
        max_tokens: 4096,
        temperature: 0,
        system: "You output strict JSON only.",
        messages: [{ role: "user", content: prompt }],
      });

      const block = msg.content[0];
      if (!block || block.type !== "text" || !('text' in block)) throw new Error("Unexpected response type from Claude");

      // 1) Extract JSON object (robust to fences/extra text)
      const candidate = extractFirstJsonObject(block.text);

      // 2) Parse without "repair regexes"
      try {
        const parsed = JSON.parse(candidate) as T;
        console.log(`✅ Claude Haiku: ${phase} JSON conversion successful!`);
        return { success: true, data: parsed, raw_text_audit: auditTrail };
      } catch (parseErr: any) {
        // ✅ Long-term repair strategy: ask model to FIX invalid JSON
        console.warn(`⚠️ JSON parse failed (${phase}). Attempting AI repair pass...`);
        const repairPrompt = buildJsonRepairPrompt({ invalidJson: candidate });

        const repairMsg = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 4096,
          temperature: 0,
          system: "Return ONLY fixed JSON.",
          messages: [{ role: "user", content: repairPrompt }],
        });

        const repairBlock = repairMsg.content[0];
        if (!repairBlock || repairBlock.type !== "text" || !('text' in repairBlock)) throw new Error("Unexpected repair response type");

        const repairedCandidate = extractFirstJsonObject(repairBlock.text);
        const repairedParsed = JSON.parse(repairedCandidate) as T;

        console.log(`✅ Claude Haiku: ${phase} JSON repair successful!`);
        return { success: true, data: repairedParsed, raw_text_audit: auditTrail };
      }
    } catch (error: any) {
      console.error(`❌ Claude Haiku (Attempt ${attempt}): ${error?.message || String(error)}`);

      if (attempt === maxRetries) {
        console.warn("⚠️ Claude Haiku failed. Falling back to Gemini...");
        return fallbackToGeminiJSON<T>(rawText, jsonSchema, phase, auditTrail);
      }

      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  return { success: false, error: "Unexpected failure", raw_text_audit: auditTrail };
}

/**
 * Fallback to Gemini for JSON conversion if Claude Haiku is unavailable
 */
async function fallbackToGeminiJSON<T>(
  rawText: string,
  jsonSchema: string,
  phase: string,
  auditTrail: string
): Promise<{ success: boolean; data?: T; error?: string; raw_text_audit: string }> {
  if (!geminiModel) {
    return { 
      success: false, 
      error: "No AI model available for JSON conversion",
      raw_text_audit: auditTrail 
    };
  }

  try {
    console.log(`🔄 Gemini Flash: Converting ${phase} to JSON (fallback)...`);
    
    const prompt = `Convert this ${phase} output to valid JSON matching this schema.

ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
1. Output ONLY valid JSON - NOTHING ELSE
2. NO markdown, NO code fences, NO explanations, NO "I understand", NO "Here is", NO end notes, NO acknowledgments
3. NO comments, NO conversational text
4. Start with { and end with } - ABSOLUTELY NOTHING before or after
5. Follow the schema EXACTLY
6. If the input contains JSON code, ESCAPE it properly in string values

SCHEMA:
${jsonSchema}

RAW INPUT:
${rawText}

OUTPUT FORMAT: Start immediately with { and end with }. No other text.`;

    const result = await geminiModel.generateContent(prompt);
    let jsonStr = result.response.text().trim();
    
    // Clean markdown if present
    if (jsonStr.includes("```json")) {
      const parts = jsonStr.split("```json");
      if (parts[1]) {
        const codeParts = parts[1].split("```");
        if (codeParts[0]) {
          jsonStr = codeParts[0].trim();
        }
      }
    } else if (jsonStr.includes("```")) {
      const parts = jsonStr.split("```");
      if (parts[1]) {
        const codeParts = parts[1].split("```");
        if (codeParts[0]) {
          jsonStr = codeParts[0].trim();
        }
      }
    }

    const parsed = JSON.parse(jsonStr) as T;
    
    console.log(`✅ Gemini Flash: ${phase} JSON conversion successful (fallback)`);
    return {
      success: true,
      data: parsed,
      raw_text_audit: auditTrail
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Gemini JSON fallback failed: ${errorMessage}`);
    return {
      success: false,
      error: `JSON conversion failed: ${errorMessage}`,
      raw_text_audit: auditTrail
    };
  }
}

// ============================================================
// GENERIC GENERATORS (Bakåtkompatibilitet)
// ============================================================

export async function summarizeText(content: string): Promise<string> {
  if (!geminiModel) return "⚠️ MOCK SUMMARY (No Google Key)";

  try {
    const result = await geminiModel.generateContent(`Summarize this briefly:\n${content}`);
    return result.response.text();
  } catch (error: any) {
    console.error(`❌ Gemini Summary Error (${modelName}):`, error?.message);
    return `AI Error: ${error?.message}`;
  }
}

export async function generateContent(prompt: string, systemPrompt: string = "") {
  if (!geminiModel) return `⚠️ MOCK CONTENT (No Google Key) for: ${prompt}`;

  console.log(`🤖 Gemini (${modelName}) is thinking...`);
  
  const fullPrompt = `${systemPrompt}\n\nTask:\n${prompt}`;

  try {
    const result = await geminiModel.generateContent(fullPrompt);
    const text = result.response.text();
    console.log("✅ Gemini Success! Output length:", text.length);
    return text;
  } catch (error: any) {
    console.error(`❌ Gemini Generation Error (${modelName}):`, error?.message);
    
    // Fallback: Om modellen inte hittas, testa en äldre stabil modell
    if (error.message.includes("404") || error.message.includes("not found")) {
        console.log("🔄 Retrying with 'gemini-pro'...");
        try {
            const fallbackModel = genAI!.getGenerativeModel({ model: "gemini-pro" });
            const fallbackResult = await fallbackModel.generateContent(fullPrompt);
            return fallbackResult.response.text();
        } catch (fallbackError: any) {
             return `AI Error (Fallback failed): ${fallbackError?.message}`;
        }
    }

    return `AI Error: ${error?.message}`;
  }
}

// ============================================================
// BRAVE SEARCH MCP - Deep Research (Replaces Perplexity)
// ============================================================
export async function performDeepResearch(topic: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.log("⚠️ No Brave Search Key found. Falling back to Gemini.");
    return generateContent(
      `Perform deep technical research on: ${topic}`,
      "You are a Senior Technical Researcher"
    );
  }

  console.log("🔍 Brave Search MCP: Deep Searching for:", topic);

  try {
    // Use Brave Search API directly (MCP-style integration)
    const axios = (await import('axios')).default;
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      params: {
        q: topic,
        count: 10,
        search_lang: 'en',
        country: 'US',
        safesearch: 'moderate'
      }
    });

    const results = response.data.web?.results || [];
    
    if (results.length === 0) {
      console.log("⚠️ No Brave Search results found. Falling back to Gemini.");
      return generateContent(
        `Perform deep technical research on: ${topic}`,
        "You are a Senior Technical Researcher"
      );
    }

    // Format research results
    let researchContent = `# Research: ${topic}\n\n`;
    researchContent += `Found ${results.length} relevant sources:\n\n`;
    
    results.forEach((r: any, i: number) => {
      researchContent += `## ${i + 1}. ${r.title || 'Untitled'}\n`;
      researchContent += `**Source:** ${r.url || 'N/A'}\n`;
      researchContent += `${r.description || 'No description available'}\n\n`;
    });

    // Use Gemini to synthesize the research into a coherent report
    const synthesisPrompt = `Based on the following search results, create a comprehensive technical research report:\n\n${researchContent}\n\nFocus on:\n1. Technical constraints and compatibility issues\n2. Latest versions and breaking changes\n3. Best practices and architecture patterns\n4. Common pitfalls and gotchas\n\nBe extremely technical and specific about implementation details, libraries, and versions.`;
    
    const synthesized = await generateContent(
      synthesisPrompt,
      "You are a Senior Technical Researcher. Synthesize search results into actionable technical insights."
    );

    console.log("✅ Brave Search Research Complete! Length:", synthesized.length);
    return synthesized;
  } catch (error: any) {
    console.error("❌ Brave Search Error:", error?.message);
    console.log("🔄 Falling back to Gemini...");
    return generateContent(
      `Perform deep technical research on: ${topic}`,
      "You are a Senior Technical Researcher"
    );
  }
}

// ============================================================
// SPECIALIZED AGENTS
// ============================================================

/**
 * CODER AGENT: Claude 3.5 Sonnet
 * Best in class for React/Next.js and UI logic.
 */
export async function generateClaudeCoder(prompt: string, systemPrompt?: string): Promise<string> {
  // Fallback till Gemini om ingen Anthropic-nyckel
  if (!anthropic) {
    console.log("⚠️ No Anthropic Key found. Falling back to Gemini for coding.");
    return generateContent(prompt, systemPrompt || "You are a senior full-stack developer.");
  }

  console.log("🧠 Claude Sonnet 4.5 is coding...");

  try {
    const msg = await anthropic.messages.create(
      {
        // --- 1. BODY (Själva datan) ---
        model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
        max_tokens: 8192,
        temperature: 0.2, // Låg temp för exakt kod
        system: [
          {
            type: "text",
            text: systemPrompt || "You are a senior full-stack developer.",
            cache_control: { type: "ephemeral" } // Detta berättar VAD som ska cachas
          }
        ],
        messages: [
          { role: "user", content: prompt }
        ],
      },
      {
        // --- 2. OPTIONS (Här ska headers bo!) ---
        headers: {
          "anthropic-beta": "prompt-caching-2024-07-31" // Detta aktiverar funktionen
        }
      }
    );

    // Hantera textblock-retur från Claude
    const textBlock = msg.content[0];
    if (textBlock && textBlock.type === 'text' && 'text' in textBlock) {
        console.log("✅ Claude Success! Output length:", textBlock.text.length);
        return textBlock.text;
    }
    return "";
  } catch (error: any) {
    console.error("❌ Claude Error:", error?.message);
    // Fallback till Gemini
    console.log("🔄 Falling back to Gemini...");
    return generateContent(prompt, systemPrompt || "You are a senior full-stack developer.");
  }
}

/**
 * PLANNER AGENT: DeepSeek R1 (Reasoner)
 * Thinks before it speaks. Great for architecture.
 */
export async function generateDeepSeekPlanner(prompt: string): Promise<string> {
  // Fallback till Gemini om ingen DeepSeek-nyckel
  if (!deepSeek) {
    console.log("⚠️ No DeepSeek Key found. Falling back to Gemini for planning.");
    return generateContent(prompt, "You are a Senior Software Architect.");
  }

  console.log("🧠 DeepSeek Reasoner is thinking...");

  try {
    const completion = await callWithRetry(() =>
      deepSeek.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-reasoner", // Eller "deepseek-chat" för V3
        temperature: 0.6, // Lite kreativitet för planering
      })
    );

    const content = getChoicesContent(completion) || "";
    console.log("✅ DeepSeek Success! Output length:", content.length);
    return content;
  } catch (error: any) {
    console.error("❌ DeepSeek Error:", error?.message);
    // Fallback till Gemini
    console.log("🔄 Falling back to Gemini...");
    return generateContent(prompt, "You are a Senior Software Architect.");
  }
}

/**
 * WORKER AGENT: DeepSeek V3 (Chat)
 * För SQL, Buggfixar och enklare kodning.
 */
export async function generateDeepSeekCoder(prompt: string): Promise<string> {
  // Fallback till Gemini om ingen DeepSeek-nyckel
  if (!deepSeek) {
    console.log("⚠️ No DeepSeek Key found. Falling back to Gemini for coding.");
    return generateContent(prompt, "You are a Senior Developer.");
  }

  console.log("🔧 DeepSeek V3 (Chat) is working...");

  try {
    // DeepSeek V3 använder "deepseek-chat"
    const completion = await callWithRetry(() =>
      deepSeek.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-chat",
        temperature: 0.2, // Låg temperatur för SQL-syntax
      })
    );

    const content = getChoicesContent(completion) || "";
    console.log("✅ DeepSeek V3 Success! Output length:", content.length);
    return content;
  } catch (error: any) {
    console.error("❌ DeepSeek V3 Error:", error?.message);
    // Fallback till Gemini
    console.log("🔄 Falling back to Gemini...");
    return generateContent(prompt, "You are a Senior Developer.");
  }
}

/**
 * ALTERNATIVE PLANNER: Kimi k2-thinking
 * Använd denna om DeepSeek R1 är dyr/långsam eller slut på credits.
 * "The Bench" - backup planner för kostnadseffektiv planering.
 */
export async function generateKimiPlanner(prompt: string): Promise<string> {
  // Fallback till DeepSeek om ingen Moonshot-nyckel
  if (!moonshot) {
    console.log("⚠️ No Moonshot (Kimi) Key found. Falling back to DeepSeek for planning.");
    return generateDeepSeekPlanner(prompt);
  }

  console.log("🧠 Kimi k2 is thinking deeply...");

  try {
    const completion = await moonshot.chat.completions.create({
      // Kimi k2-thinking modell för djup planering
      model: "kimi-k2-thinking",
      messages: [
        { 
          role: "system", 
          content: "You are a Senior System Architect. Think step-by-step using Chain of Thought." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    const content = getChoicesContent(completion) || "";
    console.log("✅ Kimi Success! Output length:", content.length);
    return content;
  } catch (error: any) {
    console.error("❌ Kimi Error:", error?.message);
    // Fallback till DeepSeek om Kimi failar
    console.log("🔄 Falling back to DeepSeek...");
    return generateDeepSeekPlanner(prompt);
  }
}

/**
 * QA AGENT: Kimi k2 (Thinking)
 * Granskar koden för att hitta "Fusk" (Mock data) och logiska luckor.
 */
export async function runKimiQA(codeSnippets: string): Promise<string> {
  // ✅ Check for both KIMI_API_KEY and MOONSHOT_API_KEY
  const kimiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
  
  // Fallback om ingen Moonshot-nyckel
  if (!moonshot && !kimiKey) {
    console.log("⚠️ No Moonshot (Kimi) Key found. Skipping QA audit.");
    return "PASS"; // Släpp igenom vid saknad API-nyckel
  }

  // ✅ Initialize moonshot client if not already initialized
  let kimiClient = moonshot;
  if (!kimiClient && kimiKey) {
    try {
      kimiClient = new OpenAI({
        apiKey: kimiKey,
        baseURL: "https://api.moonshot.ai/v1", // ✅ Use .ai endpoint
        timeout: 300000, // ✅ 5 minutes for thinking model
      });
      console.log("✅ Kimi client initialized for QA audit");
    } catch (initError: any) {
      console.error("❌ Failed to initialize Kimi client:", initError?.message);
      return "PASS"; // Fallback to pass
    }
  }

  if (!kimiClient) {
    console.log("⚠️ Kimi client not available. Skipping QA audit.");
    return "PASS";
  }

  try {
    console.log("🕵️ Kimi K2 Thinking is auditing the code for mocks...");
    const completion = await kimiClient.chat.completions.create({
      model: "kimi-k2-thinking", // ✅ Use Kimi K2 Thinking model for better analysis
      messages: [
        { 
          role: "system", 
          content: `You are a Strict Code Auditor. 
          YOUR GOAL: Detect "Mock Data" cheating.
          
          RULES:
          1. Look for hardcoded arrays like "const users = [{id: 1, name: 'John'}]".
          2. IGNORE config files, types, or shadcn default components.
          3. REAL implementation must use: supabase.from('...'), fetch(), or database calls.
          
          OUTPUT:
          - If strict mocks are found: "FAIL: Mock data detected in [Filename]."
          - If code fetches real data (or handles empty states correctly): "PASS".` 
        },
        { role: "user", content: `AUDIT THIS CODE:\n${codeSnippets}` }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const result = getChoicesContent(completion) || "PASS";
    console.log("✅ Kimi QA Audit Complete:", result.substring(0, 200));
    return result;
  } catch (error: any) {
    console.error("❌ Kimi QA Error:", error instanceof Error ? error.message : String(error));
    const errorDetails = (error && typeof error === "object" && "response" in error && error.response && typeof error.response === "object" && "data" in error.response)
      ? error.response.data
      : (error && typeof error === "object" && "status" in error ? error.status : 'Unknown');
    console.error("   Error details:", errorDetails);
    return "PASS"; // Släpp igenom vid API-fel för att inte blockera
  }
}

/**
 * LOCAL CODER: Ollama för små ändringar/fixes (gratis)
 */
export async function generateLocalCoder(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout för kodgenerering

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "qwen2.5-coder:32b", // Eller "qwen2.5-coder:72b" för bättre kvalitet
        prompt: `${systemPrompt || 'You are a senior full-stack developer.'}\n\nTask:\n${prompt}`,
        stream: false
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    const resp = getResponseString(data);
    return resp.trim();
    
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log("⚠️ Localhost timeout. Falling back to Claude.");
    } else {
      console.log("⚠️ Localhost offline or busy. Falling back to Claude.");
    }
    throw err; // Låt callern hantera fallback
  }
}

/**
 * LOCAL REVIEWER: Körs på din Intel Arc via Ollama.
 * Gratis "Second Pair of Eyes".
 */
/**
 * HYBRID REVIEWER: Local -> Kimi Fallback
 */
export async function generateLocalReview(codeSnippet: string, instructions: string): Promise<string> {
  // 1. FÖRSÖK MED LOCALHOST (Gratis)
  try {
    console.log(`[LocalAI] Connecting to qwen2.5-coder:14b...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout för local

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "qwen2.5-coder:14b",
        prompt: `[ROLE: Senior Code Reviewer]
        REVIEW INSTRUCTIONS: ${instructions}
        
        CODE TO REVIEW:
        ${codeSnippet}
        
        OUTPUT INSTRUCTIONS:
        - Analyze the code for critical bugs, security issues, or logical errors.
        - Ignore minor style nitpicks.
        - If the code is correct, ONLY reply with the exact string: "LGTM".
        - If there are issues, list them concisely.`,
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
        const data = await response.json();
        const resp = getResponseString(data);
        if (resp) {
          console.log("[LocalAI] Review received!");
          return resp.trim();
        }
    }
    console.warn("[LocalAI] Failed or empty response. Switching to Kimi...");

  } catch (err: any) {
    console.warn(`[LocalAI] Offline/Timeout (${err.message}). Switching to Kimi...`);
  }

  // 2. FALLBACK TILL KIMI K2 (Billig & Smart)
  if (!moonshot) {
    console.warn("[Kimi] No Moonshot API key. Skipping review.");
    return "LGTM";
  }

  try {
    console.log("[Kimi] 🌙 Kimi k2 is stepping in to review...");
    const completion = await moonshot.chat.completions.create({
      model: "moonshot-v1-8k", // Kontrollera modellnamn
      messages: [
        { role: "system", content: "You are a Senior Code Reviewer. Be strict but concise. If code is good, say 'LGTM'." },
        { role: "user", content: `INSTRUCTIONS: ${instructions}\n\nCODE:\n${codeSnippet}` }
      ],
      temperature: 0.1,
    });
    const result = getChoicesContent(completion) || "LGTM";
    console.log("[Kimi] Review received!");
    return result;
  } catch (kimiErr: any) {
    console.error("[Kimi] Failed too. Skipping review.", kimiErr?.message);
    return "LGTM"; // Sista utväg: Släpp igenom koden
  }
}

/**
 * WATCHDOG AGENT: DeepSeek V3
 * Fixar build errors billigt och snabbt.
 */
export async function generateBuildFix(errorLog: string, fileContext: string): Promise<string> {
  // Vi använder DeepSeek V3 (chat) för detta, inte R1, för vi vill ha snabb kod, inte långa tankar.
  // Fallback till Gemini om ingen DeepSeek-nyckel
  if (!deepSeek) {
    console.log("⚠️ No DeepSeek Key found. Falling back to Gemini for build fixes.");
    return generateContent(
      `BUILD ERROR:\n${errorLog}\n\nBROKEN FILE CONTEXT:\n${fileContext}\n\nFix the code based on the build error. Return ONLY the full fixed file content wrapped in:\n### FILE: <filename>\n... code ...\n### END_FILE`,
      "You are a Senior Debugger for Next.js 15."
    );
  }

  console.log("🐕 Watchdog (DeepSeek V3) analyzing build error...");

  try {
    const response = await deepSeek.chat.completions.create({
      model: "deepseek-chat", // V3
      messages: [
        { 
          role: "system", 
          content: `You are a Senior Debugger for Next.js 15. 
          Fix the code based on the build error. 
          Return ONLY the full fixed file content wrapped in:
          ### FILE: <filename>
          ... code ...
          ### END_FILE` 
        },
        { 
          role: "user", 
          content: `BUILD ERROR:\n${errorLog}\n\nBROKEN FILE CONTEXT (might be partial):\n${fileContext}` 
        }
      ],
      temperature: 0.1 // Låg temp för exakthet
    });

    const content = getChoicesContent(response) || "";
    console.log("✅ Watchdog fix generated!");
    return content;
  } catch (err: any) {
    console.error("❌ Watchdog brain freeze:", err?.message);
    // Fallback till Gemini
    console.log("🔄 Falling back to Gemini...");
    return generateContent(
      `BUILD ERROR:\n${errorLog}\n\nBROKEN FILE CONTEXT:\n${fileContext}\n\nFix the code based on the build error. Return ONLY the full fixed file content wrapped in:\n### FILE: <filename>\n... code ...\n### END_FILE`,
      "You are a Senior Debugger for Next.js 15."
    );
  }
}

/**
 * LOCAL WATCHDOG: Qwen 2.5 Coder (Localhost)
 * Gratis kodfixare när DeepSeek går bet eller blir för dyr.
 */
/**
 * HYBRID FIXER: Local -> Kimi Fallback
 */
export async function generateLocalFix(errorLog: string, brokenFileContent: string): Promise<string> {
  // 1. FÖRSÖK MED LOCALHOST (Gratis)
  try {
    console.log(`[LocalAI] Attempting fix with qwen2.5-coder:14b...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "qwen2.5-coder:14b",
        prompt: `[ROLE: Senior Code Fixer]
        The build failed. Fix the code based on the error log.
        
        ERROR LOG:
        ${errorLog}
        
        BROKEN FILE CONTENT:
        ${brokenFileContent}
        
        INSTRUCTIONS:
        - Return ONLY the fixed file content.
        - Wrap the code strictly in: ### FILE: <filename> ... ### END_FILE
        - Do not explain anything.`,
        stream: false,
        options: { temperature: 0.1 } // Strikt och exakt
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const resp = getResponseString(data);
      if (resp) {
        console.log("[LocalAI] Fix received!");
        return resp;
      }
    }
    console.warn("[LocalAI] Failed or empty response. Switching to Kimi...");

  } catch (err: any) {
    console.warn(`[LocalAI] Offline/Timeout (${err.message}). Switching to Kimi...`);
  }

  // 2. FALLBACK TILL KIMI K2 (Billig & Smart)
  if (!moonshot) {
    console.warn("[Kimi] No Moonshot API key. Returning empty (will fallback to DeepSeek).");
    return "";
  }

  try {
    console.log("[Kimi] 🌙 Kimi k2 is stepping in to fix...");
    const completion = await moonshot.chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [
        { 
          role: "system", 
          content: "You are a Senior Code Fixer. Fix the code based on the error log. Return ONLY the fixed file content wrapped in: ### FILE: <filename> ... ### END_FILE" 
        },
        { 
          role: "user", 
          content: `ERROR LOG:\n${errorLog}\n\nBROKEN FILE:\n${brokenFileContent}` 
        }
      ],
      temperature: 0.1,
    });
    const result = getChoicesContent(completion) || "";
    console.log("[Kimi] Fix received!");
    return result;
  } catch (kimiErr: any) {
    console.error("[Kimi] Failed too. Returning empty (will fallback to DeepSeek).", kimiErr?.message);
    return ""; // Returnera tom så Watchdog kan fallback till DeepSeek
  }
}

/**
 * SPEED WATCHDOG: Groq (Llama 3.3 70B)
 * Blixtsnabb kodfixare och reviewer.
 */
export async function generateGroqFix(errorLog: string, brokenFileContent: string): Promise<string> {
  if (!groq) {
    console.warn("[Groq] No API key found. Falling back to DeepSeek.");
    return "";
  }

  try {
    console.log("⚡ Groq (Llama 3.3) is analyzing the error at lightspeed...");
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Mycket kraftfull modell
      messages: [
        { 
          role: "system", 
          content: `You are a Senior CI/CD Fixer. 
          Fix the code based on the error log. 
          If packages are missing, simply output comments telling the user to install them, otherwise fix the imports.
          Return ONLY the fixed code wrapped in ### FILE: <filename> ... ### END_FILE.` 
        },
        { 
          role: "user", 
          content: `ERROR:\n${errorLog}\n\nCODE:\n${brokenFileContent}` 
        }
      ],
      temperature: 0.1, 
    });
    const result = getChoicesContent(completion) || "";
    console.log("[Groq] ⚡ Fix received!");
    return result;
  } catch (error: any) {
    console.error("Groq Error:", error?.message);
    return ""; // Fallback till DeepSeek om Groq failar
  }
}

/**
 * THE MODEL BRAIN: Centraliserad modellväljare
 * Väljer rätt modell för rätt uppgift baserat på roll
 */
export type AgentRole = "PLANNER" | "FRONTEND" | "BACKEND" | "RESEARCH" | "AUDIT" | "ROUTER" | "REVIEWER" | "FIXER" | "CODE_REVIEWER" | "DEBUGGER" | "OPTIMIZER" | "NUCLEAR" | "LOOP_DETECTIVE" | "PROMPT_ENGINEER" | "ORACLE" | "FLOW_WATCHER";

export async function callAI(
  role: AgentRole,
  prompt: string,
  context?: string,
  imageBase64?: string,
  smartLevel: 'FAST' | 'SMART' | 'GENIUS' = 'FAST'
): Promise<string> {
  const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
  let responseText = "";
  
  // Vision support: Om bild finns och roll är FRONTEND, använd Claude Vision
  if (imageBase64 && role === "FRONTEND" && anthropic) {
    try {
      console.log("👁️ Claude Vision analyzing screenshot...");
      const visionResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: imageBase64
              }
            },
            {
              type: "text",
              text: fullPrompt
            }
          ]
        }]
      });
      
      const textBlock = visionResponse.content[0];
      if (textBlock && textBlock.type === 'text' && 'text' in textBlock) {
        return textBlock.text;
      }
      return "";
    } catch (error: any) {
      console.error("❌ Claude Vision Error:", error?.message);
      // Fallback till vanlig text-baserad analys
    }
  }

  switch (role) {
    case "RESEARCH":
      // Perplexity Pro för deep research
      console.log("🔍 Perplexity researching...");
      try {
        responseText = await performDeepResearch(prompt);
      } catch (e) {
        console.warn("⚠️ Perplexity failed, falling back to Gemini...");
        responseText = await generateContent(prompt, "You are a Senior Technical Researcher.");
      }
      break;

    case "ROUTER":
      // Gemini 2.0 Flash: Den perfekta mellanhanden
      console.log("⚡ Gemini Flash optimizing context flow...");
      responseText = await generateContent(fullPrompt, "You are a Technical Specification Writer. Be concise and precise.");
      break;

    case "PLANNER":
      // DeepSeek R1 (Reasoning) - For complex architecture planning
      console.log("🧠 [PLANNER] Starting DeepSeek R1...");
      if (deepSeek) {
        try {
          const startTime = Date.now();
          
          const planner = await withTimeout(
            deepSeek.chat.completions.create({
              model: "deepseek-reasoner",
              messages: [
                { 
                  role: "user", 
                  content: fullPrompt  // No system prompt for R1!
                }
              ],
              temperature: 1.0,  // R1 works best at 1.0
              max_tokens: 8000
            }),
            300000, // 5 minutes (R1 is SLOW for complex planning)
            'DeepSeek R1 Planner'
          );
          
          const elapsed = Date.now() - startTime;
          console.log(`✅ [PLANNER] DeepSeek R1 succeeded in ${elapsed}ms`);
          responseText = getChoicesContent(planner) || "";
        } catch (e: any) {
          if (e.message?.includes('terminated') || e.message?.includes('timeout')) {
            console.warn('⚠️ DeepSeek R1 timed out (expected for complex planning)');
          } else {
            console.error('❌ [PLANNER] DeepSeek R1 failed:', e?.message);
          }
          
          console.log('🔄 Falling back to Gemini 2.0 Flash...');
          responseText = await generateContent(fullPrompt, "You are an expert technical architect.");
        }
      } else {
        responseText = await generateDeepSeekPlanner(fullPrompt);
      }
      break;

    case "FRONTEND":
      // 1. SÄKERHETS-LOOP FÖR CLAUDE (The Stubborn Retry)
      const systemInstruction = context || "You are a Senior Frontend Developer specializing in React/Next.js UI.";
      
      // Circuit Breaker check
      if (claudeCircuitOpen && Date.now() < claudeRetryTime) {
        console.log("⚠️ Claude circuit open. Deploying DeepSeek V3 as Elite Backup...");
        if (deepSeek) {
          try {
            const deepSeekBackup = await deepSeek.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1
            });
            console.log("✅ DeepSeek V3 successfully saved the build!");
            responseText = getChoicesContent(deepSeekBackup) || "";
            break;
          } catch (dsError: any) {
            console.error("❌ DeepSeek Backup also failed!", dsError?.message);
            responseText = await generateContent(fullPrompt, systemInstruction);
            break;
          }
        } else {
          responseText = await generateContent(fullPrompt, systemInstruction);
          break;
        }
      }

      if (!anthropic) {
        console.warn("⚠️ Claude not available, deploying DeepSeek V3 as Elite Backup...");
        if (deepSeek) {
          try {
            const deepSeekBackup = await deepSeek.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1
            });
            console.log("✅ DeepSeek V3 successfully saved the build!");
            responseText = getChoicesContent(deepSeekBackup) || "";
            break;
          } catch (dsError: any) {
            console.error("❌ DeepSeek Backup failed!", dsError?.message);
            responseText = await generateContent(fullPrompt, systemInstruction);
            break;
          }
        } else {
          responseText = await generateContent(fullPrompt, systemInstruction);
          break;
        }
      }

      const MAX_RETRIES = 5;
      let attempts = 0;
      let claudeSuccess = false;

      while (attempts < MAX_RETRIES) {
        try {
          console.log(`🎨 Calling Claude 3.5 Sonnet (Attempt ${attempts + 1}/${MAX_RETRIES})...`);
          
          const claude = await anthropic.messages.create(
            {
              model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
              max_tokens: 8192,
              system: [
                {
                  type: "text",
                  text: systemInstruction,
                  cache_control: { type: "ephemeral" }
                }
              ],
              messages: [{ role: "user", content: fullPrompt }],
            },
            {
              headers: {
                "anthropic-beta": "prompt-caching-2024-07-31"
              }
            }
          );

          // Om vi kommer hit så lyckades det!
          const block = claude.content[0];
          responseText = (block && block.type === 'text' && 'text' in block) ? block.text : "";
          claudeSuccess = true;
          console.log(`✅ Claude Success after ${attempts + 1} attempt(s)!`);
          break;

        } catch (error: any) {
          attempts++;
          
          // Fånga specifikt "Overloaded" (529) eller "Rate Limit" (429)
          if (error.type === 'overloaded_error' || error.status === 529 || error.status === 429 || error.message?.includes('529') || error.message?.includes('429')) {
            const waitTime = 15000 * attempts; // Öka väntetiden: 15s, 30s, 45s...
            console.warn(`⚠️ Claude is overloaded/busy. Waiting ${waitTime/1000}s before retry...`);
            
            if (attempts === MAX_RETRIES) {
              console.error("❌ Claude is dead after 5 attempts. Opening circuit breaker.");
              claudeCircuitOpen = true;
              claudeRetryTime = Date.now() + (5 * 60 * 1000); // 5 minuter
              break;
            }
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // Om det är ett annat fel (t.ex. Bad Request), logga och bryt loopen för att gå till backup
            console.error("❌ Claude Error (Non-retryable):", error?.message);
            break; 
          }
        }
      }

      // 2. PRIMARY BACKUP: DEEPSEEK V3 (The Architecture Savior)
      // Om loopen är klar och vi fortfarande inte har svar -> DeepSeek tar över.
      if (!claudeSuccess) {
        console.log("🚨 Claude is unresponsive. Deploying DEEPSEEK V3 as Elite Backup...");
        
        if (!deepSeek) {
          console.error("❌ CRITICAL: DeepSeek not available. Falling back to Gemini...");
          responseText = await generateContent(fullPrompt, systemInstruction);
          break;
        }

        try {
          const deepSeekBackup = await callWithRetry(() =>
            deepSeek.chat.completions.create({
              model: "deepseek-chat", // V3 identifieras ofta så här i deras API
              messages: [
                { role: "system", content: systemInstruction || "You are an expert Frontend Architect replacing Claude." },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1 // Låg temp för att undvika flum när den är backup
            })
          );
          
          console.log("✅ DeepSeek V3 successfully saved the build!");
          responseText = getChoicesContent(deepSeekBackup) || "";

        } catch (dsError: any) {
          console.error("❌ CRITICAL: DeepSeek Backup also failed!", dsError?.message);
          // Sista utväg: Gemini
          responseText = await generateContent(fullPrompt, systemInstruction);
        }
      }
      break;

    case "BACKEND":
      // PRIMARY: DeepSeek V3.2 (Fast code generation, not reasoning)
      const isSQL = fullPrompt.toLowerCase().includes('database') || 
                    fullPrompt.toLowerCase().includes('sql');
      
      const systemPrompt = isSQL 
        ? "You are a senior backend engineer specializing in PostgreSQL and Supabase."
        : (context || "You are a senior backend engineer. Write clean, type-safe code.");
      
      if (deepSeek) {
        try {
          console.log('⚡ [BACKEND] Starting DeepSeek V3.2 (Fast Mode)...');
          const startTime = Date.now();
          
          const backendResult = await callWithRetry(() =>
            withTimeout(
              deepSeek.chat.completions.create({
                model: "deepseek-chat",  // Use V3.2 NOT R1 for code generation
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: fullPrompt }
                ],
                temperature: 0.3,
                max_tokens: 8000
              }),
              180000, // ✅ Increased to 180 seconds (3 minutes) for backend generation
              'DeepSeek V3.2 Backend'
            ),
            3,
            3000
          );
          
          const elapsed = Date.now() - startTime;
          console.log(`✅ [BACKEND] DeepSeek V3.2 succeeded in ${elapsed}ms`);
          responseText = getChoicesContent(backendResult) || "";
        } catch (primaryError: any) {
          console.error('❌ [BACKEND] DeepSeek V3.2 failed:', primaryError?.message);
          console.warn('⚠️ Falling back to Gemini 2.0 Flash...');
          
          // FALLBACK: Gemini (fast and free)
          responseText = await generateContent(fullPrompt, systemPrompt);
        }
      } else {
        // No DeepSeek, use Gemini directly
        console.log("⚠️ No DeepSeek API key found, using Gemini for backend...");
        responseText = await generateContent(fullPrompt, systemPrompt);
      }
      break;

    case "REVIEWER":
      // Groq (Llama 3.3 70B) - Snabb kodgranskning
      console.log("⚡ Groq (Llama 3.3) running instant code review...");
      if (groq) {
        try {
          const review = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              { 
                role: "system", 
                content: "You are a Senior Code Reviewer. Review code for critical bugs only (ignore style). If code looks good, reply with 'LGTM'. If there are critical issues, list them concisely." 
              },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.1,
          });
          responseText = getChoicesContent(review) || "";
        } catch (e: any) {
          console.warn("⚠️ Groq Review failed, skipping review to save time.", e?.message);
          responseText = "LGTM"; // Fallback till "looks good" om Groq failar
        }
      } else {
        console.warn("⚠️ Groq not available, skipping review...");
        responseText = "LGTM";
      }
      break;

    case "AUDIT":
      // ✅ Kimi K2 Thinking (Moonshot) - QA Auditor with DeepSeek Reasoner fallback
      console.log("🕵️ Kimi K2 Thinking auditing...");
      
      // ✅ Check for Kimi API key and initialize client if needed
      const auditKimiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
      let auditKimiClient = moonshot;
      
      if (!auditKimiClient && auditKimiKey) {
        try {
          auditKimiClient = new OpenAI({
            apiKey: auditKimiKey,
            baseURL: "https://api.moonshot.ai/v1", // ✅ Use .ai endpoint
            timeout: 300000, // ✅ 5 minutes for thinking model
          });
          console.log("✅ Kimi client initialized for AUDIT");
        } catch (initError: any) {
          console.warn("⚠️ Failed to initialize Kimi client:", initError?.message);
        }
      }
      
      if (auditKimiClient) {
        try {
          const kimi = await auditKimiClient.chat.completions.create({
            model: "kimi-k2-thinking", // ✅ Use Kimi K2 Thinking model
            messages: [
              { role: "system", content: "You are the QA Auditor. Find inconsistencies, mock data, and logical errors." },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.1,
            max_tokens: 2000,
          });
          responseText = getChoicesContent(kimi) || "";
          console.log("✅ Kimi K2 Thinking audit complete");
        } catch (e: any) {
          console.warn("⚠️ Kimi K2 Thinking failed:", e?.message);
          console.warn("   Falling back to DeepSeek Reasoner (R1)...");
          
          // Fallback till DeepSeek Reasoner
          if (deepSeek) {
            try {
              const r1 = await deepSeek.chat.completions.create({
                model: "deepseek-reasoner",
                messages: [
                  { role: "system", content: "You are the QA Auditor. Find inconsistencies, mock data, and logical errors." },
                  { role: "user", content: fullPrompt }
                ],
                temperature: 0.1,
              });
              responseText = getChoicesContent(r1) || "";
              console.log("✅ DeepSeek Reasoner fallback succeeded");
            } catch (r1Error: any) {
              console.error("❌ DeepSeek Reasoner fallback also failed:", r1Error?.message);
              // Last resort: runKimiQA (which has its own fallback)
              responseText = await runKimiQA(fullPrompt);
            }
          } else {
            // No DeepSeek either, try runKimiQA
            responseText = await runKimiQA(fullPrompt);
          }
        }
      } else {
        // No Kimi client available, try DeepSeek Reasoner directly
        if (deepSeek) {
          try {
            console.log("🔄 No Kimi key, using DeepSeek Reasoner for audit...");
            const r1 = await deepSeek.chat.completions.create({
              model: "deepseek-reasoner",
              messages: [
                { role: "system", content: "You are the QA Auditor. Find inconsistencies, mock data, and logical errors." },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1,
            });
            responseText = getChoicesContent(r1) || "";
          } catch (e: any) {
            console.error("❌ DeepSeek Reasoner failed:", e?.message);
            responseText = await runKimiQA(fullPrompt); // ✅ Try runKimiQA which has better initialization
          }
        } else {
          responseText = await runKimiQA(fullPrompt);
        }
      }
      break;

    case "CODE_REVIEWER":
    case "DEBUGGER":
      // PRIMARY: DeepSeek V3.2 (Fast reviews/debugging, not reasoning)
      const reviewTimeout = role === "CODE_REVIEWER" ? 45000 : 60000;
      const reviewSystemPrompt = role === "CODE_REVIEWER"
        ? "You are an expert code reviewer. Find bugs, syntax errors, and architectural issues."
        : "You are a Debugging Strategist. Analyze the Reviewer's findings and create a step-by-step fix plan.";
      
      console.log(`⚡ ${role}: Using DeepSeek V3.2 (Fast Mode)...`);
      if (deepSeek) {
        try {
          const startTime = Date.now();
          const reviewResult = await callWithRetry(() =>
            withTimeout(
              deepSeek.chat.completions.create({
                model: "deepseek-chat",  // Fast reviews
                messages: [
                  {
                    role: "system",
                    content: reviewSystemPrompt
                  },
                  { role: "user", content: fullPrompt }
                ],
                temperature: 0.3,
                max_tokens: 8000
              }),
              reviewTimeout,
              `DeepSeek V3.2 ${role}`
            ),
            3,
            2000
          );
          
          const elapsed = Date.now() - startTime;
          console.log(`✅ [${role}] DeepSeek V3.2 succeeded in ${elapsed}ms`);
          responseText = getChoicesContent(reviewResult) || "";
        } catch (e: any) {
          console.warn(`⚠️ DeepSeek V3.2 (${role}) failed:`, e?.message);
          // FALLBACK: Gemini
          console.warn("⚠️ Falling back to Gemini...");
          responseText = await generateContent(fullPrompt, reviewSystemPrompt);
        }
      } else {
        // No DeepSeek key, use Gemini directly
        console.log(`⚠️ No DeepSeek API key found, using Gemini for ${role}...`);
        responseText = await generateContent(fullPrompt, reviewSystemPrompt);
      }
      break;

    case "OPTIMIZER":
      // ✨ Gemini 2.0 Flash - Fast and great at text reformulation
      console.log("⚡ OPTIMIZER: Enhancing prompt with Gemini 2.0 Flash...");
      if (geminiModel) {
        try {
          const result = await geminiModel.generateContent(`
            USER PROMPT: "${fullPrompt}"
            
            TASK: Rewrite this prompt to be crystal clear for an AI Software Architect.
            - Expand ambiguous terms ("make it pop" -> "use high contrast animations").
            - Add technical constraints if missing (e.g. "Next.js 15").
            - Keep the original intent.
            
            OUTPUT: Return ONLY the optimized prompt, no explanations.
          `);
          responseText = result.response.text();
        } catch (e: any) {
          console.warn("⚠️ Gemini Optimizer failed:", e?.message);
          responseText = fullPrompt; // Return original if optimization fails
        }
      } else {
        responseText = fullPrompt; // Return original if Gemini not available
      }
      break;

    case "LOOP_DETECTIVE":
      // 🕵️ LOOP DETECTIVE: Kimi k2 (Deep Context)
      console.log("🕵️ LOOP DETECTIVE: Kimi k2 is analyzing the entire history...");
      if (moonshot) {
        try {
          const kimiResponse = await moonshot.chat.completions.create({
            model: "moonshot-v1-128k", // Eller 'kimi-k2' beroende på din provider
            messages: [
              { 
                role: "system", 
                content: context || "You are a Senior Debugging Detective. Analyze repetitive errors and find the ROOT CAUSE." 
              },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.1 // Analytisk och exakt
          });
          responseText = getChoicesContent(kimiResponse) || "";
        } catch (e: any) {
          console.warn("⚠️ Kimi unavailable, falling back to DeepSeek R1...");
          // Fallback till DeepSeek Reasoner om Kimi är nere
          if (deepSeek) {
            try {
              const r1 = await deepSeek.chat.completions.create({
                model: "deepseek-reasoner",
                messages: [{ role: "user", content: fullPrompt }]
              });
              responseText = getChoicesContent(r1) || "";
            } catch (r1Error: any) {
              console.error("❌ DeepSeek Reasoner fallback also failed:", r1Error?.message);
              responseText = "";
            }
          } else {
            responseText = "";
          }
        }
      } else {
        // Fallback till DeepSeek Reasoner om Kimi inte finns
        if (deepSeek) {
          try {
            const r1 = await deepSeek.chat.completions.create({
              model: "deepseek-reasoner",
              messages: [{ role: "user", content: fullPrompt }]
            });
            responseText = getChoicesContent(r1) || "";
          } catch (r1Error: any) {
            console.error("❌ DeepSeek Reasoner fallback failed:", r1Error?.message);
            responseText = "";
          }
        } else {
          responseText = "";
        }
      }
      break;

    case "PROMPT_ENGINEER":
      // ✨ PROMPT ENGINEER: Gemini 2.0 Flash (Fast & Smart)
      console.log("✨ PROMPT ENGINEER: Gemini 2.0 Flash optimizing...");
      if (geminiModel) {
        try {
          const systemPrompt = context || "You are a Senior Technical Product Manager.";
          const result = await geminiModel.generateContent(
            `${systemPrompt}\n\nUSER REQUEST: ${fullPrompt}`
          );
          responseText = result.response.text();
        } catch (e: any) {
          console.error("❌ Gemini Prompt Engineer failed:", e?.message);
          responseText = fullPrompt; // Return original if optimization fails
        }
      } else {
        console.warn("⚠️ Gemini not available, using original prompt.");
        responseText = fullPrompt; // Return original if Gemini not available
      }
      break;

    case "NUCLEAR":
      // ☢️ Claude 3.5 Sonnet - The smartest coder for critical situations
      console.log("☢️ NUCLEAR: Claude 3.5 Sonnet taking over...");
      if (anthropic) {
        try {
          const claude = await anthropic.messages.create({
            model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
            max_tokens: 8192,
            messages: [{
              role: "user",
              content: fullPrompt
            }]
          });
          const block = claude.content[0];
          responseText = (block && block.type === 'text' && 'text' in block) ? block.text : "";
        } catch (e: any) {
          console.error("❌ Claude Nuclear failed:", e?.message);
          // Fallback to DeepSeek Reasoner
          if (deepSeek) {
            try {
              const fallback = await deepSeek.chat.completions.create({
                model: "deepseek-reasoner",
                messages: [{ role: "user", content: fullPrompt }],
              });
              responseText = getChoicesContent(fallback) || "";
            } catch (fallbackErr: any) {
              console.error("❌ Nuclear fallback failed:", fallbackErr?.message);
              responseText = "";
            }
          } else {
            responseText = "";
          }
        }
      } else {
        // Fallback to DeepSeek Reasoner if Claude not available
        if (deepSeek) {
          try {
            const fallback = await deepSeek.chat.completions.create({
              model: "deepseek-reasoner",
              messages: [{ role: "user", content: fullPrompt }],
            });
            responseText = getChoicesContent(fallback) || "";
          } catch (fallbackErr: any) {
            console.error("❌ Nuclear fallback failed:", fallbackErr?.message);
            responseText = "";
          }
        } else {
          responseText = "";
        }
      }
      break;

    case "FIXER":
      // Tiered Watchdog: Eskalerar baserat på smartLevel
      if (smartLevel === 'FAST') {
        // Försök 1-2: Groq (Snabb, för syntaxfel)
        console.log("⚡ FIXER: Using Groq (Llama 3.3) for fast syntax fixes...");
        if (groq) {
          try {
            const response = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: context || "You are a syntax fixer. Fix syntax errors, casing issues, and typos quickly." },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1,
            });
            responseText = getChoicesContent(response) || "";
          } catch (e: any) {
            console.warn("⚠️ Groq Fixer failed:", e?.message);
            // Fallback till DeepSeek om Groq failar
            smartLevel = 'SMART';
          }
        } else {
          smartLevel = 'SMART'; // Fallback om Groq inte finns
        }
      }
      
      if (smartLevel === 'SMART') {
        // Försök 3-5: DeepSeek V3.2 (Smart, för logiska fel)
        console.log("🧠 FIXER: Escalating to DeepSeek V3.2...");
        if (deepSeek) {
          try {
            const fix = await deepSeek.chat.completions.create({
              model: "deepseek-chat", // V3.2
              messages: [
                { 
                  role: "system", 
                  content: context || "Fix the code." 
                },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1,
            });
            responseText = getChoicesContent(fix) || "";
          } catch (e: any) {
            console.warn("⚠️ DeepSeek Fixer failed:", e?.message);
            smartLevel = 'GENIUS'; // Fallback till DeepSeek Reasoner om Chat failar
          }
        } else {
          smartLevel = 'GENIUS'; // Fallback om DeepSeek inte finns
        }
      }
      
      if (smartLevel === 'GENIUS') {
        // Försök 6+: DeepSeek V3.2 (Reasoning Core) - Vi behåller DeepSeek för de svåraste felen
        console.log("🌙 FIXER: Escalating to DeepSeek V3.2 (Reasoning Core)...");
        if (deepSeek) {
          try {
            const deepThink = await deepSeek.chat.completions.create({
              model: "deepseek-reasoner",
              messages: [{ role: "user", content: "Fix this critical bug:\n" + fullPrompt }],
              temperature: 0.1,
            });
            responseText = getChoicesContent(deepThink) || "";
          } catch (e: any) {
            console.error("❌ DeepSeek Reasoner Fixer failed:", e?.message);
            // Fallback till Kimi om DeepSeek Reasoner failar
            if (moonshot) {
              try {
                console.log("🌙 Falling back to Kimi k2 for GENIUS fix...");
                const response = await moonshot.chat.completions.create({
                  model: "moonshot-v1-128k",
                  messages: [
                    { 
                      role: "system", 
                      content: context || "You are the Lead Engineer. Solve this complex dependency issue. Analyze the full context and provide a comprehensive fix." 
                    },
                    { role: "user", content: fullPrompt }
                  ],
                  temperature: 0.1,
                });
                responseText = getChoicesContent(response) || "";
                console.log("✅ Kimi fallback succeeded");
              } catch (kimiErr: any) {
                console.error("❌ Kimi Fixer also failed:", kimiErr?.message);
                console.warn("⚠️ All GENIUS-level fixers failed. Trying Claude as last resort...");
                
                // Last resort: Claude 3.5 Sonnet
                if (anthropic) {
                  try {
                    const claudeFix = await anthropic.messages.create({
                      model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
                      max_tokens: 4000,
                      messages: [{
                        role: "user",
                        content: `${context || "You are the Lead Engineer. Solve this complex issue."}\n\n${fullPrompt}`
                      }]
                    });
                    const block = claudeFix.content[0];
                    responseText = (block && block.type === 'text' && 'text' in block) ? block.text : "";
                    console.log("✅ Claude fallback succeeded");
                  } catch (claudeErr: any) {
                    console.error("❌ Claude fallback also failed:", claudeErr?.message);
                    responseText = "";
                  }
                } else {
                  responseText = "";
                }
              }
            } else {
              // No Kimi, try Claude directly
              if (anthropic) {
                try {
                  console.log("🔄 No Kimi, using Claude as GENIUS fallback...");
                  const claudeFix = await anthropic.messages.create({
                    model: "claude-sonnet-4-5", // May 2025 - Fast + Smart
                    max_tokens: 4000,
                    messages: [{
                      role: "user",
                      content: `${context || "You are the Lead Engineer. Solve this complex issue."}\n\n${fullPrompt}`
                    }]
                  });
                  const block = claudeFix.content[0];
                  responseText = (block && block.type === 'text' && 'text' in block) ? block.text : "";
                } catch (claudeErr: any) {
                  console.error("❌ Claude fallback failed:", claudeErr?.message);
                  responseText = "";
                }
              } else {
                responseText = "";
              }
            }
          }
        } else {
          // Fallback till Kimi om DeepSeek inte finns
          if (moonshot) {
            try {
              const response = await moonshot.chat.completions.create({
                model: "moonshot-v1-128k",
                messages: [
                  { 
                    role: "system", 
                    content: context || "You are the Lead Engineer. Solve this complex dependency issue." 
                  },
                  { role: "user", content: fullPrompt }
                ],
                temperature: 0.1,
              });
              responseText = getChoicesContent(response) || "";
            } catch (e: any) {
              console.error("❌ Kimi Fixer failed:", e?.message);
              responseText = "";
            }
          } else {
            console.warn("⚠️ No fixer available, Fixer failed.");
            responseText = "";
          }
        }
      }
      break;

    // =============================================================================
    // 🔮 THE ORACLE: DeepSeek R1 (Reasoning + Caching)
    // =============================================================================
    case "ORACLE":
      console.log("🔮 ORACLE: DeepSeek R1 analyzing codebase structure...");
      if (deepSeek) {
        try {
          const r1 = await deepSeek.chat.completions.create({
            model: "deepseek-reasoner",
            messages: [
              { 
                role: "system", 
                content: context || "You are the Codebase Oracle. You understand the entire file structure and can trace imports/exports perfectly." 
              },
              { role: "user", content: fullPrompt }
            ],
            // DeepSeek caches context automatically if it's identical at the start!
          });
          responseText = getChoicesContent(r1) || "";
        } catch (e: any) {
          console.warn("⚠️ DeepSeek R1 Oracle failed:", e?.message);
          // Fallback to Gemini
          if (geminiModel) {
            try {
              const result = await geminiModel.generateContent(fullPrompt);
              responseText = result.response.text();
            } catch (geminiErr: any) {
              console.error("❌ Gemini Oracle fallback failed:", geminiErr?.message);
              responseText = "";
            }
          } else {
            responseText = "";
          }
        }
      } else {
        // Fallback to Gemini if DeepSeek not available
        if (geminiModel) {
          try {
            const result = await geminiModel.generateContent(fullPrompt);
            responseText = result.response.text();
          } catch (geminiErr: any) {
            console.error("❌ Gemini Oracle fallback failed:", geminiErr?.message);
            responseText = "";
          }
        } else {
          responseText = "";
        }
      }
      break;

    // =============================================================================
    // 🌊 FLOW WATCHER: Gemini 1.5 Flash (Enorm Context + Speed)
    // =============================================================================
    case "FLOW_WATCHER":
      console.log("🌊 FLOW WATCHER: Gemini checking data integrity...");
      if (genAI) {
        try {
          // Use Gemini 1.5 Flash for massive context (1M tokens)
          const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          // Combine context data with prompt
          const fullContent = imageBase64 
            ? `${context || "Check if data flowed correctly."}\n\nCONTEXT DATA:\n${imageBase64}\n\nQUESTION: ${fullPrompt}`
            : `${context || "Check if data flowed correctly."}\n\nQUESTION: ${fullPrompt}`;
          
          const result = await flashModel.generateContent(fullContent);
          responseText = result.response.text();
        } catch (e: any) {
          console.warn("⚠️ Gemini Flow Watcher failed:", e?.message);
          // Simple fallback - just return PASS if we can't check
          responseText = "PASS (Flow check unavailable)";
        }
      } else {
        console.warn("⚠️ Gemini not available for Flow Watcher.");
        responseText = "PASS (Flow check unavailable)";
      }
      break;
  }

  return responseText;
}
