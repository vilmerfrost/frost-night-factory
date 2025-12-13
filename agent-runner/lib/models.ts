// agent-runner/lib/models.ts
export const MODELS = {
  // ✅ Keep your exact Claude model id you already use in the codebase
  CLAUDE_SONNET_45: "claude-4-5-sonnet-20241029",

  // ✅ As requested (NOT flash-lite)
  GEMINI_25_FLASH: "gemini-2.5-flash",

  // Your existing DeepSeek id (keep whatever you already use if different)
  DEEPSEEK_CHAT: "deepseek-chat",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

