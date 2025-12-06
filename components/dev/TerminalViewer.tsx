"use client"

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TerminalViewerProps {
  pipelineId: string
  autoScroll?: boolean
  maxLines?: number
}

export function TerminalViewer({ 
  pipelineId, 
  autoScroll = true,
  maxLines = 1000 
}: TerminalViewerProps) {
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: string; message: string }>>([])
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pipelineId) return

    const eventSource = new EventSource(
      `/api/dev/pipeline/${pipelineId}/logs-stream`
    )

    eventSource.onopen = () => {
      setConnected(true)
    }

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        
        setLogs(prev => {
          const updated = [...prev, {
            timestamp: data.timestamp || new Date().toISOString(),
            level: data.level || 'info',
            message: data.message || e.data,
          }]
          
          // Limit log lines to prevent memory issues
          if (updated.length > maxLines) {
            return updated.slice(-maxLines)
          }
          
          return updated
        })

        // Auto-scroll to bottom
        if (autoScroll) {
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }, 0)
        }
      } catch (err) {
        // If not JSON, treat as plain text
        setLogs(prev => {
          const updated = [...prev, {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: e.data,
          }]
          
          if (updated.length > maxLines) {
            return updated.slice(-maxLines)
          }
          
          return updated
        })
      }
    }

    eventSource.onerror = () => {
      setConnected(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [pipelineId, autoScroll, maxLines])

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-400'
      case 'warn':
      case 'warning':
        return 'text-yellow-400'
      case 'success':
        return 'text-green-400'
      case 'info':
        return 'text-cyan-400'
      default:
        return 'text-gray-300'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return '❌'
      case 'warn':
      case 'warning':
        return '⚠️'
      case 'success':
        return '✅'
      case 'info':
        return 'ℹ️'
      default:
        return '•'
    }
  }

  return (
    <Card className="bg-[#0a0e27] border-cyan-900/50 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-cyan-900/50 bg-[#0d1229]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm font-mono text-cyan-400">Terminal</span>
          <Badge variant="outline" className="text-xs">
            {logs.length} lines
          </Badge>
        </div>
        <Badge variant={connected ? 'default' : 'destructive'} className="text-xs">
          {connected ? '🟢 Live' : '🔴 Offline'}
        </Badge>
      </div>
      
      <div 
        ref={containerRef}
        className="h-96 overflow-auto p-4 font-mono text-sm"
        style={{
          backgroundColor: '#0a0e27',
          color: '#e0e0e0',
        }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Waiting for logs...
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gray-600 text-xs flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`flex-shrink-0 ${getLevelColor(log.level)}`}>
                  {getLevelIcon(log.level)}
                </span>
                <span className={`flex-1 ${getLevelColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </Card>
  )
}

