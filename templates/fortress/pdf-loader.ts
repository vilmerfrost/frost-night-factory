// =============================================================================
// PDF LOADER - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This is a golden template for src/lib/pdf-loader.ts
// Extracts text from PDF files

/**
 * PDF text extraction loader.
 * No external deps here: keep it compiling.
 * Later: replace with real PDF text extraction library (pdf-parse, pdfjs-dist, etc).
 */
export class PDFLoader {
  constructor(private readonly input: ArrayBuffer | Uint8Array) {}

  /**
   * Extracts text content from PDF.
   * Returns empty string as placeholder - replace with actual PDF parsing logic.
   */
  async getText(): Promise<string> {
    // Placeholder implementation
    // TODO: Integrate real PDF parsing library
    // Example: const pdf = await pdfjs.getDocument({ data: this.input }).promise;
    //          return extractTextFromPDF(pdf);
    return "";
  }
}
