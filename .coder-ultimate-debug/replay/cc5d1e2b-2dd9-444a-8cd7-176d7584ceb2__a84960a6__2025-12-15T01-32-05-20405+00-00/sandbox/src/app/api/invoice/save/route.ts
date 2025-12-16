import { NextRequest, NextResponse } from 'next/server';
import { invoiceSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validatedData = invoiceSchema.parse(body);

    console.log('Saving invoice data:', validatedData);

    await new Promise(resolve => setTimeout(resolve, 500));

    const savedInvoice = {
      id: `INV-${Date.now()}`,
      ...validatedData,
      savedAt: new Date().toISOString(),
      status: 'saved'
    };

    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      data: savedInvoice
    });
  } catch (error) {
    console.error('Invoice save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save invoice data' },
      { status: 500 }
    );
  }
}