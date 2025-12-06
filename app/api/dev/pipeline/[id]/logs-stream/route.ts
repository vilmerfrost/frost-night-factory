import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for API routes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
)

// Store log stream clients per pipeline (in-memory, use Redis in production)
const logStreamClients = new Map<string, Set<any>>()

/**
 * Stream logs for a specific pipeline
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const pipelineId = params.id

  if (!pipelineId) {
    return new Response('Pipeline ID required', { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      // Create SSE client wrapper
      const client = {
        readyState: 1, // OPEN
        send: (data: string) => {
          try {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } catch (error) {
            console.error('Failed to send log:', error)
          }
        },
      }

      // Register client for this pipeline
      if (!logStreamClients.has(pipelineId)) {
        logStreamClients.set(pipelineId, new Set())
      }
      logStreamClients.get(pipelineId)!.add(client)

      // Send initial connection message
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', pipelineId })}\n\n`
        )
      )

      // Fetch recent logs from database
      fetchRecentLogs(pipelineId).then((logs) => {
        logs.forEach((log) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(log)}\n\n`)
          )
        })
      })

      // Poll for new logs (in production, use Supabase realtime subscriptions)
      const pollInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('pipeline_logs')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false })
            .limit(10)

          if (!error && data) {
            data.reverse().forEach((log) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(log)}\n\n`)
              )
            })
          }
        } catch (err) {
          console.error('Failed to poll logs:', err)
        }
      }, 2000) // Poll every 2 seconds

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval)
        logStreamClients.get(pipelineId)?.delete(client)
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

/**
 * Broadcast log to stream (called from pipeline-broadcast.ts)
 */
export function broadcastLogToStream(
  pipelineId: string,
  level: string,
  message: string
) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    message,
    pipelineId,
  }

  const msg = JSON.stringify(log)

  // Broadcast to log stream clients for this pipeline
  const clients = logStreamClients.get(pipelineId)
  if (clients) {
    clients.forEach((client: any) => {
      try {
        if (client.readyState === 1) {
          client.send(msg)
        } else {
          clients.delete(client)
        }
      } catch (error) {
        console.error('Failed to send log:', error)
        clients.delete(client)
      }
    })
  }
}

async function fetchRecentLogs(pipelineId: string, limit: number = 100) {
  try {
    const { data, error } = await supabase
      .from('pipeline_logs')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to fetch recent logs:', error)
      return []
    }

    return (data || []).reverse() // Reverse to show oldest first
  } catch (error) {
    console.error('Failed to fetch recent logs:', error)
    return []
  }
}
