import { NextResponse } from 'next/server';
import { CostTracker } from '@/../../agent-runner/lib/cost-tracker';

export async function GET() {
  try {
    const stats = CostTracker.getStatistics();
    const recentCosts = CostTracker.loadCosts().slice(-20);
    
    return NextResponse.json({
      stats,
      recent: recentCosts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

