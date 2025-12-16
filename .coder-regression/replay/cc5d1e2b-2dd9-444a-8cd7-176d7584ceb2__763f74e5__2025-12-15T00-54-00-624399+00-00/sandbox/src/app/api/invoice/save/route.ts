import { NextRequest, NextResponse } from 'next/server';
import { invoiceSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validatedData = invoiceSchema.parse(body);

    console.log('Saving invoice data:', validatedData);

    await new Promise(resolve => setTimeout(resolve, 500));

    const mockSavedInvoice = {
      id: `INV-${Date.now()}`,
      ...validatedData,
      savedAt: new Date().toISOString(),
      status: 'saved',
    };

    return NextResponse.json({
      success: true,
      message: 'Invoice saved successfully',
      data: mockSavedInvoice,
    });
  } catch (error) {
    console.error('Invoice save error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid invoice data', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save invoice data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}