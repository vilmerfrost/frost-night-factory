import { NextResponse } from 'next/server'
import { getCostSummary } from '@/../../agent-runner/lib/cost-tracker'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '7', 10)

  try {
    const summary = await getCostSummary(days)
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('Failed to get cost summary:', error)
    return NextResponse.json(
      {
        total: 0,
        byModel: {},
        byPhase: {},
        averagePerPipeline: 0,
        pipelines: 0,
      },
      { status: 500 }
    )
  }
}

