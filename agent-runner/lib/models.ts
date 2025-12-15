// agent-runner/lib/models.ts
/**
 * Model Constants - Single Source of Truth
 * 
 * Claude Sonnet 4.5 = bulk frontend
 * Gemini 2.5 Flash = repair/debug
 * DeepSeek = backend-heavy
 */
export const MODELS = {
  // Bulk coding / high quality UI
  FRONTEND_BULK: "claude-sonnet-4-5", // May 2025 - Fast + Smart
  CLAUDE_SONNET_45: "claude-sonnet-4-5", // Alias for compatibility

  // Backend heavy logic
  BACKEND_HEAVY: "deepseek-chat",
  DEEPSEEK_CHAT: "deepseek-chat", // Alias for compatibility

  // Repair / debug / small diffs (NOT flash-lite)
  REPAIR: "gemini-2.5-flash",
  GEMINI_25_FLASH: "gemini-2.5-flash", // Alias for compatibility

  // JSON converter (for planner/coder JSON conversion)
  JSON_CONVERTER_PRIMARY: "claude-3-5-haiku-20241022",
  
  // Google Gemini models (for repair/debug)
  google: {
    // ✅ Stabil modellsträng (Google säger den finns)
    GEMINI_25_FLASH: "gemini-2.5-flash",
    // (valfritt) om du vill kunna testa preview också
    GEMINI_25_FLASH_PREVIEW_092025: "gemini-2.5-flash-preview-09-2025",
  },
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
export type ModelName = ModelId; // Alias for compatibility
export type GoogleModel = (typeof MODELS)["google"][keyof (typeof MODELS)["google"]];

