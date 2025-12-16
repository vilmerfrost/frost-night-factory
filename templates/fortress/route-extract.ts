// =============================================================================
// INVOICE EXTRACTION ROUTE - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This is a golden template for src/app/api/invoice/extract/route.ts
// Handles file uploads and invoice data extraction

import { NextResponse } from "next/server";
import { z } from "zod";
import { extractInvoiceData } from "@/lib/extraction";

export const runtime = "nodejs";

const UploadSchema = z.object({
  file: z.instanceof(File),
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    const parsed = UploadSchema.safeParse({ file });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid upload",
          details: parsed.error.flatten(), // ✅ Use .flatten() instead of .errors
        },
        { status: 400 }
      );
    }

    const invoiceData = await extractInvoiceData(parsed.data.file);

    return NextResponse.json({ ok: true, invoiceData });
  } catch (err) {
    return NextResponse.json(
      { 
        error: "Extraction failed", 
        message: err instanceof Error ? err.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
