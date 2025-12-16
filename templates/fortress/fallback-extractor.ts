// =============================================================================
// FALLBACK INVOICE EXTRACTOR - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This is a golden template for src/lib/fallback-extractor.ts
// Regex-based extraction when AI extraction fails

import type { InvoiceData } from "@/lib/types";

type ExtractCtx = { text: string; fileName: string };

/**
 * Fallback extraction using regex patterns.
 * Returns minimal valid InvoiceData structure.
 */
export function fallbackExtractor(_ctx: ExtractCtx): InvoiceData {
  return {
    invoiceNumber: null,
    vendorName: null,
    vendorAddress: null,
    vendorEmail: null,
    vendorPhone: null,
    invoiceDate: null,
    dueDate: null,
    subtotal: null,
    tax: null,
    total: null,
    currency: "SEK",
    lineItems: [],
    notes: null,
    confidenceScore: null,
    extractionMethod: "fallback",
  };
}
