// runner/llm.ts
// v0.1: Placeholder LLM calls
// TODO: Wire this to a real LLM (OpenAI, Gemini, etc.)

export async function callLLM(prompt: string): Promise<string> {
  console.log("\n📝 LLM Prompt:");
  console.log("─".repeat(60));
  console.log(prompt);
  console.log("─".repeat(60));

  // TODO: Replace with actual LLM call
  // For now, return placeholder JSON
  return JSON.stringify({ placeholder: true, message: "LLM not wired yet" });
}

