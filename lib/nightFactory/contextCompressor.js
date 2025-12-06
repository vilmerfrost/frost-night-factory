// lib/nightFactory/contextCompressor.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;
const modelName = "gemini-2.0-flash-exp";
const geminiModel = genAI ? genAI.getGenerativeModel({ model: modelName }) : null;
/**
 * Compress long context using Gemini 2.0 Flash
 * Reduces token count by ~50% while keeping structural logic visible
 */
export async function compressContext(longText, type) {
    if (!longText || longText.length < 500)
        return longText; // Don't compress small text
    if (!geminiModel) {
        console.warn("⚠️ Gemini not available for compression. Using original text.");
        return longText;
    }
    console.log(`🗜️ Compressing ${type} context (${longText.length} chars)...`);
    const prompt = type === 'code'
        ? `
      TASK: Compress this codebase context for an LLM.
      RULES:
      1. Remove all comments, empty lines, and whitespace.
      2. Keep all interfaces, function signatures, and exports intact.
      3. Summarize implementation details of long functions to "// ... implementation".
      4. OBJECTIVE: Reduce token count by 50% while keeping structural logic visible.
      
      CODE:
      ${longText}
      `
        : `
      TASK: Summarize this technical documentation for a Developer.
      RULES:
      1. Extract ONLY the critical rules, breaking changes, and syntax examples.
      2. Remove all marketing fluff, intros, and generic tutorials.
      3. Output a dense, bulleted list of constraints.
      
      DOCS:
      ${longText}
      `;
    try {
        const result = await geminiModel.generateContent(prompt);
        const compressed = result.response.text();
        const reduction = Math.round((1 - compressed.length / longText.length) * 100);
        console.log(`✅ Compressed to ${compressed.length} chars (${reduction}% reduction)`);
        return compressed;
    }
    catch (e) {
        console.warn("⚠️ Compression failed (Gemini error), using original text:", e?.message);
        return longText;
    }
}
