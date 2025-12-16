import { NextRequest, NextResponse } from 'next/server';
import { processPDFWithClaude } from '@/lib/claude';
import { invoiceSchema } from '@/lib/schemas';
import { validateFileUpload } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const validation = validateFileUpload(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extractedData = await processPDFWithClaude(buffer, file.type);

    const validatedData = invoiceSchema.parse(extractedData);

    return NextResponse.json({
      success: true,
      data: validatedData,
      message: 'Invoice extracted successfully'
    });
  } catch (error) {
    console.error('Invoice extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract invoice data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}