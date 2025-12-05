import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ⚠️ Use SERVICE ROLE KEY to bypass RLS during testing
// Supports both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY for compatibility
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY! // Add this to .env.local
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('🎫 API ROUTE HIT:', body)

    // ⚠️ CRITICAL: Match these to your watcher's expectations
    // Watcher expects: status='queued', table='tickets'
    const { data, error } = await supabase
      .from('tickets') // Match table name in watcher.ts
      .insert({
        vision: body.prompt || body.vision, // Support both field names
        description: body.prompt || body.vision,
        request: body.prompt || body.vision,
        status: 'queued', // Match status in watcher.ts filter
        priority: body.priority || 2,
        stack_config: body.stack || body.stack_config || {
          frontend: 'nextjs-16',
          backend: 'none',
          ui: 'shadcn',
          features: [],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('❌ SUPABASE INSERT ERROR:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ TICKET CREATED:', data.id)
    return NextResponse.json({ ticketId: data.id, ticket: data }, { status: 201 })
  } catch (err: any) {
    console.error('💥 API ROUTE CRASH:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

