// lib/nightFactory/contextBridge.ts
import { generateContent } from './modelClient';

/**
 * CONTEXT BRIDGE: Gemini Flash Flow Optimizer
 * Tvättar och strukturerar informationen mellan Research och Coding
 * Säkerställer att Kodaren inte blir förvirrad av för mycket text
 */
export async function optimizeContextForCoder(
  researchData: string, 
  plan: string
): Promise<string> {
  const prompt = `
    You are the Communication Officer.

    INPUT 1 (Research): 
    ${researchData.substring(0, 3000)} // Begränsa längd

    INPUT 2 (Architecture Plan): 
    ${plan.substring(0, 3000)} // Begränsa längd

    TASK:
    Combine these into a strictly technical specification for a Junior Developer.
    - Remove all conversational filler.
    - Extract strict requirements.
    - Do NOT change the meaning or logic.
    - Format as:

      1. FILE STRUCTURE
         - List all files that need to be created/modified
         - Include paths and purposes

      2. COMPONENT SPECS
         - Component names and props
         - UI requirements

      3. API ROUTES
         - Endpoints and methods
         - Request/response formats

    OUTPUT: Only technical specifications. No explanations or markdown.
  `;

  try {
    // Använd Gemini Flash (via generateContent) för att optimera kontexten
    const optimized = await generateContent(
      prompt,
      "You are a Technical Specification Writer. Be concise and precise."
    );
    
    console.log("[Context Bridge] ✅ Context optimized for Coder");
    return optimized;
  } catch (e: any) {
    console.error("[Context Bridge] ❌ Error:", e.message);
    // Fallback: Returnera planen som den är
    return plan;
  }
}

