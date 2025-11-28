import { GoogleGenerativeAI } from "@google/generative-ai";
import { OpenAI } from "openai";

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

// Logga status vid start
if (!apiKey) {
  console.error("❌ CRITICAL: GOOGLE_API_KEY is missing in .env.local");
} else {
  console.log("✅ Google API Key found (starts with):", apiKey.substring(0, 4) + "...");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ÄNDRING: Använder 'gemini-2.0-flash-exp' (verifierad via check-models.js)
// Om denna modell inte fungerar, kör: node check-models.js för att hitta tillgängliga modeller
const modelName = "gemini-2.0-flash-exp"; 

const model = genAI ? genAI.getGenerativeModel({ model: modelName }) : null;

export async function summarizeText(content: string): Promise<string> {
  if (!model) return "⚠️ MOCK SUMMARY (No Google Key)";

  try {
    const result = await model.generateContent(`Summarize this briefly:\n${content}`);
    return result.response.text();
  } catch (error: any) {
    console.error(`❌ Gemini Summary Error (${modelName}):`, error?.message);
    return `AI Error: ${error?.message}`;
  }
}

export async function generateContent(prompt: string, systemPrompt: string = "") {
  if (!model) return `⚠️ MOCK CONTENT (No Google Key) for: ${prompt}`;

  console.log(`🤖 Gemini (${modelName}) is thinking...`);
  
  const fullPrompt = `${systemPrompt}\n\nTask:\n${prompt}`;

  try {
    const result = await model.generateContent(fullPrompt);
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

// 💎 Perplexity Pro: Deep Research Integration
// Perplexity använder OpenAI-kompatibelt SDK
export async function performDeepResearch(topic: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.log("⚠️ No Perplexity Key found. Falling back to Gemini.");
    return generateContent(
      `Perform deep technical research on: ${topic}`,
      "You are a Senior Technical Researcher"
    );
  }

  // Initiera klienten HÄR inne, så vi vet att env-vars är laddade
  const perplexity = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.perplexity.ai",
  });

  console.log("💎 Perplexity Pro: Deep Searching for:", topic);

  try {
    const response = await perplexity.chat.completions.create({
      model: "sonar-pro", // Bästa modellen för kod-research
      messages: [
        {
          role: "system",
          content:
            "You are a Senior Technical Researcher. Search for the latest documentation. Be extremely technical and specific about implementation details, libraries, and versions.",
        },
        { role: "user", content: topic },
      ],
      max_tokens: 4000, // Sonar-pro är pratglad, vi ger den utrymme
    });

    const researchContent = response.choices[0].message.content || "No research found.";
    console.log("✅ Perplexity Research Complete! Length:", researchContent.length);
    return researchContent;
  } catch (error: any) {
    console.error("❌ Perplexity Error:", error?.message);
    // Fallback till Gemini
    console.log("🔄 Falling back to Gemini...");
    return generateContent(
      `Perform deep technical research on: ${topic}`,
      "You are a Senior Technical Researcher"
    );
  }
}
