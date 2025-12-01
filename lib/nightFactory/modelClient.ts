// lib/nightFactory/modelClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

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
const modelName = "gemini-2.0-flash-exp";
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
// 3. DeepSeek R1/V3 (NY - För Planning)
// ============================================================
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY;
const deepSeek = deepSeekApiKey ? new OpenAI({
  baseURL: 'https://api.deepseek.com',
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
  baseURL: "https://api.moonshot.ai/v1", // <-- ÄNDRA TILL .AI
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
// PERPLEXITY - Deep Research
// ============================================================
export async function performDeepResearch(topic: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.log("⚠️ No Perplexity Key found. Falling back to Gemini.");
    return generateContent(
      `Perform deep technical research on: ${topic}`,
      "You are a Senior Technical Researcher"
    );
  }

  const perplexity = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  console.log("💎 Perplexity Pro: Deep Searching for:", topic);

  try {
    const response = await perplexity.chat.completions.create({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content:
            "You are a Senior Technical Researcher. Search for the latest documentation. Be extremely technical and specific about implementation details, libraries, and versions.",
        },
        { role: "user", content: topic },
      ],
      max_tokens: 4000,
    });

    const researchContent = response.choices[0].message.content || "No research found.";
    console.log("✅ Perplexity Research Complete! Length:", researchContent.length);
    return researchContent;
  } catch (error: any) {
    console.error("❌ Perplexity Error:", error?.message);
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
        model: "claude-sonnet-4-5", // Claude 4.5 Sonnet (2025)
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
    if (textBlock.type === 'text') {
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
    const completion = await deepSeek.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-reasoner", // Eller "deepseek-chat" för V3
      temperature: 0.6, // Lite kreativitet för planering
    });

    const content = completion.choices[0].message.content || "";
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
    const completion = await deepSeek.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "deepseek-chat",
      temperature: 0.2, // Låg temperatur för SQL-syntax
    });

    const content = completion.choices[0].message.content || "";
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

    const content = completion.choices[0].message.content || "";
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
  // Fallback om ingen Moonshot-nyckel
  if (!moonshot) {
    console.log("⚠️ No Moonshot (Kimi) Key found. Skipping QA audit.");
    return "PASS"; // Släpp igenom vid saknad API-nyckel
  }

  try {
    console.log("👮 Kimi k2 is auditing the code for mocks...");
    const completion = await moonshot.chat.completions.create({
      model: "moonshot-v1-8k", // Eller specifik k2-preview om tillgänglig
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
    });

    const result = completion.choices[0].message.content || "PASS";
    console.log("✅ Kimi QA Audit Complete:", result);
    return result;
  } catch (error: any) {
    console.error("❌ Kimi QA Error:", error?.message);
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
    return data.response || "";
    
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
        if (data.response) {
          console.log("[LocalAI] Review received!");
          return data.response.trim();
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
    const result = completion.choices[0].message.content || "LGTM";
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

    const content = response.choices[0].message.content || "";
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
      if (data.response) {
        console.log("[LocalAI] Fix received!");
        return data.response;
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
    const result = completion.choices[0].message.content || "";
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
    const result = completion.choices[0].message.content || "";
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
export type AgentRole = "PLANNER" | "FRONTEND" | "BACKEND" | "RESEARCH" | "AUDIT" | "ROUTER" | "REVIEWER" | "FIXER";

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
        model: "claude-sonnet-4-5",
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
      if (textBlock.type === 'text') {
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
      // DeepSeek R1 (Reasoning) eller V3 som fallback
      console.log("🧠 DeepSeek R1 planning...");
      try {
        if (deepSeek) {
          const r1 = await deepSeek.chat.completions.create({
            model: "deepseek-reasoner", // Om tillgänglig, annars fallback till deepseek-chat
            messages: [{ role: "user", content: fullPrompt }],
            temperature: 0.3,
          });
          responseText = r1.choices[0].message.content || "";
        } else {
          responseText = await generateDeepSeekPlanner(fullPrompt);
        }
      } catch (e) {
        console.warn("⚠️ DeepSeek R1 failed, using V3...");
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
            responseText = deepSeekBackup.choices[0].message.content || "";
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
            responseText = deepSeekBackup.choices[0].message.content || "";
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
              model: "claude-sonnet-4-5",
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
          responseText = block.type === 'text' ? block.text : "";
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
          const deepSeekBackup = await deepSeek.chat.completions.create({
            model: "deepseek-chat", // V3 identifieras ofta så här i deras API
            messages: [
              { role: "system", content: systemInstruction || "You are an expert Frontend Architect replacing Claude." },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.1 // Låg temp för att undvika flum när den är backup
          });
          
          console.log("✅ DeepSeek V3 successfully saved the build!");
          responseText = deepSeekBackup.choices[0].message.content || "";

        } catch (dsError: any) {
          console.error("❌ CRITICAL: DeepSeek Backup also failed!", dsError?.message);
          // Sista utväg: Gemini
          responseText = await generateContent(fullPrompt, systemInstruction);
        }
      }
      break;

    case "BACKEND":
      // Qwen 2.5 Coder 32B eller DeepSeek V3 som fallback
      console.log("⚙️ Qwen handling Backend...");
      if (qwen) {
        try {
          const qwenResponse = await qwen.chat.completions.create({
            model: "qwen2.5-coder-32b-instruct", // Eller qwen-plus om 32b inte finns
            messages: [
              { role: "system", content: "You are a backend specialist." },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.2,
          });
          responseText = qwenResponse.choices[0].message.content || "";
        } catch (e) {
          console.warn("⚠️ Qwen failed, falling back to DeepSeek V3...");
          responseText = await generateDeepSeekCoder(fullPrompt);
        }
      } else {
        responseText = await generateDeepSeekCoder(fullPrompt);
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
          responseText = review.choices[0].message.content || "";
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
      // Kimi k2 (Moonshot) - QA Auditor
      console.log("🕵️ Kimi K2 auditing...");
      if (moonshot) {
        try {
          const kimi = await moonshot.chat.completions.create({
            model: "moonshot-v1-128k", // Eller k2 om tillgänglig via API
            messages: [
              { role: "system", content: "You are the QA Auditor. Find inconsistencies, mock data, and logical errors." },
              { role: "user", content: fullPrompt }
            ],
            temperature: 0.1,
          });
          responseText = kimi.choices[0].message.content || "";
        } catch (e) {
          console.warn("⚠️ Kimi failed, falling back to runKimiQA...");
          responseText = await runKimiQA(fullPrompt);
        }
      } else {
        responseText = await runKimiQA(fullPrompt);
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
            responseText = response.choices[0].message.content || "";
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
        // Försök 3-5: DeepSeek V3 (Smart, för logiska fel)
        console.log("🧠 FIXER: Escalating to DeepSeek V3 for intelligent fixes...");
        if (deepSeek) {
          try {
            const response = await deepSeek.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                { 
                  role: "system", 
                  content: context || "You are a Senior Architect fixing build errors. CRITICAL: If the error says 'Cannot find module', imports are broken. REMOVE the broken imports and replace the usage with a simple HTML placeholder (e.g. <div>Placeholder</div>). DO NOT try to import files that don't exist." 
                },
                { role: "user", content: fullPrompt }
              ],
              temperature: 0.1,
            });
            responseText = response.choices[0].message.content || "";
          } catch (e: any) {
            console.warn("⚠️ DeepSeek Fixer failed:", e?.message);
            smartLevel = 'GENIUS'; // Fallback till Kimi om DeepSeek failar
          }
        } else {
          smartLevel = 'GENIUS'; // Fallback om DeepSeek inte finns
        }
      }
      
      if (smartLevel === 'GENIUS') {
        // Försök 6+: Kimi k2 (Genius, för komplexa sammanhang)
        console.log("🌙 FIXER: Escalating to Kimi k2 (Moonshot) for complex fixes...");
        if (moonshot) {
          try {
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
            responseText = response.choices[0].message.content || "";
          } catch (e: any) {
            console.error("❌ Kimi Fixer failed:", e?.message);
            // Sista utväg: Returnera tom sträng eller fallback
            responseText = "";
          }
        } else {
          console.warn("⚠️ Kimi not available, Fixer failed.");
          responseText = "";
        }
      }
      break;
  }

  return responseText;
}
