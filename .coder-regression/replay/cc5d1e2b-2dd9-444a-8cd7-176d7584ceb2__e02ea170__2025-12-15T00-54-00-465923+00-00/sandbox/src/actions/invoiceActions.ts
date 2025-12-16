'use server';

import { revalidatePath } from 'next/cache';
import { invoiceSchema } from '@/lib/schemas';

export async function processInvoiceFiles(formData: FormData) {
  try {
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return {
        success: false,
        error: 'No files provided'
      };
    }

    const results = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        results.push({
          fileName: file.name,
          success: false,
          error: 'File size exceeds 10MB limit'
        });
        continue;
      }

      try {
        const fileFormData = new FormData();
        fileFormData.append('file', file);

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/invoice/extract`, {
          method: 'POST',
          body: fileFormData
        });

        const result = await response.json();

        if (result.success) {
          results.push({
            fileName: file.name,
            success: true,
            data: result.data
          });
        } else {
          results.push({
            fileName: file.name,
            success: false,
            error: result.error || 'Extraction failed'
          });
        }
      } catch (error) {
        results.push({
          fileName: file.name,
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      results,
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length
    };
  } catch (error) {
    console.error('Process invoice files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process files'
    };
  }
}