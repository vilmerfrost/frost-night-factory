/**
 * Utilities for handling ContentBlock types from Anthropic API
 * Handles both TextBlock and ThinkingBlock variants safely
 */

type TextLikeBlock = { text: string };

/**
 * Type guard to check if a block has a text property
 */
export function hasText(block: unknown): block is TextLikeBlock {
  return !!block && typeof (block as any).text === "string";
}

/**
 * Safely extract text from a ContentBlock, with fallback
 */
export function blockText(block: unknown, fallback = ""): string {
  return hasText(block) ? block.text : fallback;
}
