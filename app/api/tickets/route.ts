// app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.vision) {
      return NextResponse.json(
        { error: 'Vision is required' },
        { status: 400 }
      );
    }
    
    // Default stack config if not provided
    const stackConfig = body.stack_config || {
      frontend: 'nextjs-16',
      backend: 'none',
      ui: 'shadcn',
      features: [],
    };
    
    // ✅ MAP PRIORITY STRING TO INTEGER
    const priorityMap: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
    };
    
    // Convert priority to integer
    let priority = 2; // default to medium
    if (typeof body.priority === 'number') {
      priority = body.priority;
    } else if (typeof body.priority === 'string') {
      priority = priorityMap[body.priority.toLowerCase()] || 2;
    }
    
    // Build insert payload
    const insertPayload = {
      // Primary content field
      vision: body.vision,
      description: body.vision,
      request: body.vision,
      
      // Status & priority
      status: 'queued', // ✅ Always use 'queued' so watcher can find it
      priority: priority, // ✅ Now it's an INTEGER!
      
      // Stack configuration
      stack_config: stackConfig,
      
      // Metadata
      metadata: {
        created_from: 'api',
        source: body.source || 'user_app',
        user_agent: request.headers.get('user-agent'),
      },
      
      // Optional fields
      auto_handle: body.autoHandle ?? true,
      project_type: body.project_type || 'new',
      reference_images: body.reference_images || [],
      
      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert ticket
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert(insertPayload)
      .select()
      .single();
    
    if (error) {
      console.error('Error inserting ticket:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }
    
    return NextResponse.json(ticket, { status: 201 });
    
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(tickets || []);
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
