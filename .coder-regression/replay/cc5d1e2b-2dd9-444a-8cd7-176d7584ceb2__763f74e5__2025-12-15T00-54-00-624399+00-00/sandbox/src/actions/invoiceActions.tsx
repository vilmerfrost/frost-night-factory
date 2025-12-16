'use server';

import { revalidatePath } from 'next/cache';
import { invoiceSchema } from '@/lib/schemas';

interface ProcessResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function processInvoiceFiles(formData: FormData): Promise<ProcessResult> {
  try {
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return {
        success: false,
        error: 'No files provided',
      };
    }

    const results = [];

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        return {
          success: false,
          error: `Invalid file type: ${file.name}. Only PDF files are allowed.`,
        };
      }

      if (file.size > 10 * 1024 * 1024) {
        return {
          success: false,
          error: `File too large: ${file.name}. Maximum size is 10MB.`,
        };
      }

      const fileFormData = new FormData();
      fileFormData.append('file', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/invoice/extract`, {
        method: 'POST',
        body: fileFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to process file',
        };
      }

      const result = await response.json();
      results.push(result.data);
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('Process invoice files error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}