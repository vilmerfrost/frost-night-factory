"use client"

import { useEffect, useState } from 'react'

export function usePipelineStream() {
  const [pipelines, setPipelines] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Use Server-Sent Events (SSE) for Next.js compatibility
    const eventSource = new EventSource('/api/dev/pipeline-stream')

    eventSource.onopen = () => {
      setConnected(true)
      setError(null)
      console.log('🔌 SSE connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)

        // Skip connection messages
        if (update.type === 'connected') {
          return
        }

        setPipelines((prev) => {
          const idx = prev.findIndex((p) => p.id === update.id)
          if (idx >= 0) {
            // Update existing pipeline
            const updated = [...prev]
            updated[idx] = { ...updated[idx], ...update }
            return updated
          } else {
            // Add new pipeline at the beginning
            return [update, ...prev]
          }
        })
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      setError('Connection error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return { pipelines, connected, error }
}
