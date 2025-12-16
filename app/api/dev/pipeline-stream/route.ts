import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
)

// Store SSE clients (in-memory, use Redis in production)
const clients = new Set<any>()

// Store recent pipeline updates (for clients connecting after updates)
const recentUpdates: Map<string, any> = new Map()
const MAX_RECENT_UPDATES = 100

/**
 * Broadcast pipeline update to all connected clients
 * Called from pipeline-runner.ts via pipeline-broadcast.ts
 */
export function broadcastPipelineUpdate(update: any) {
  const msg = JSON.stringify({
    ...update,
    timestamp: new Date().toISOString(),
  })

  // Store recent update
  const updateId = update.id;
  if (!updateId) return;
  recentUpdates.set(updateId, update)
  if (recentUpdates.size > MAX_RECENT_UPDATES) {
    const firstKey = recentUpdates.keys().next().value
    if (firstKey) recentUpdates.delete(firstKey)
  }

  // Broadcast to all connected SSE clients
  clients.forEach((client) => {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(msg)
      } else {
        clients.delete(client)
      }
    } catch (error) {
      console.error('Failed to send SSE message:', error)
      clients.delete(client)
    }
  })
}

export async function GET(req: NextRequest) {
  // Use Server-Sent Events (SSE) for Next.js compatibility
  // WebSocket would require a custom server (Bun/Node.js)

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      )

      // Send recent updates
      recentUpdates.forEach((update) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(update)}\n\n`))
      })

      // Create SSE client wrapper
      const clientId = crypto.randomUUID()
      const client = {
        id: clientId,
        readyState: 1, // OPEN
        send: (data: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } catch (error) {
            console.error('Failed to send SSE message:', error)
          }
        },
      }

      clients.add(client)

      // Poll for pipeline updates from database
      const pollInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('pipelines')
            .select('*')
            .in('status', ['running', 'needs_review', 'pending'])
            .order('updated_at', { ascending: false })
            .limit(20)

          if (!error && data) {
            data.forEach((pipeline) => {
              const update = {
                id: pipeline.id,
                status: pipeline.status,
                current_phase: pipeline.current_phase,
                name: pipeline.name,
                cost: pipeline.cost,
                timestamp: pipeline.updated_at,
              }
              client.send(JSON.stringify(update))
            })
          }
        } catch (err) {
          console.error('Failed to poll pipeline updates:', err)
        }
      }, 2000) // Poll every 2 seconds

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval)
        clients.delete(client)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
