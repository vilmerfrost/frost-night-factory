// =============================================================================
// INVOICE EXTRACTION - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This is a golden template for src/lib/extraction.ts
// Orchestrates PDF loading, AI extraction, and fallback extraction

import type { InvoiceData } from "@/lib/types";
import { PDFLoader } from "@/lib/pdf-loader";
import { extractWithAI } from "@/lib/ai-extractor";
import { fallbackExtractor } from "@/lib/fallback-extractor";

/**
 * Main extraction function that coordinates PDF loading, AI extraction, and fallback.
 * Keep boundary typed as File (matches route usage).
 */
export async function extractInvoiceData(file: File): Promise<InvoiceData> {
  // Convert File to ArrayBuffer for PDFLoader
  const bytes = await file.arrayBuffer();
  const text = await new PDFLoader(bytes).getText();

  try {
    // Try AI extraction first
    const ai = await extractWithAI({ text, fileName: file.name });
    return ai;
  } catch (error) {
    // Swallow AI errors and fallback to regex-based extraction
    console.warn("[Extraction] AI extraction failed, using fallback:", error);
  }

  // Fallback to regex-based extraction
  return fallbackExtractor({ text, fileName: file.name });
}
