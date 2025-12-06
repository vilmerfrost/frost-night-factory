import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const promptType = params.type

  try {
    // Fetch prompt from database (or file system)
    const { data, error } = await supabase
      .from('system_prompts')
      .select('content')
      .eq('type', promptType)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is OK
      throw error
    }

    return NextResponse.json({
      type: promptType,
      content: data?.content || '',
    })
  } catch (error: any) {
    console.error(`Failed to fetch ${promptType} prompt:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch prompt' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const promptType = params.type
  const body = await req.json()
  const { content } = body

  if (!content) {
    return NextResponse.json(
      { error: 'Content is required' },
      { status: 400 }
    )
  }

  try {
    // Save prompt to database
    const { error } = await supabase
      .from('system_prompts')
      .upsert({
        type: promptType,
        content,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error(`Failed to save ${promptType} prompt:`, error)
    return NextResponse.json(
      { error: 'Failed to save prompt' },
      { status: 500 }
    )
  }
}

