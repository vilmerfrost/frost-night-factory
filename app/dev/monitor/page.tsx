"use client"

import { usePipelineStream } from './hooks/usePipelineStream'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TerminalViewer } from '@/components/dev/TerminalViewer'
import { useState } from 'react'

export default function MonitorPage() {
  const { pipelines, connected, error } = usePipelineStream()
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)

  const running = pipelines.filter((p) => p.status === 'running').length
  const completed = pipelines.filter((p) => p.status === 'completed').length
  const failed = pipelines.filter((p) => p.status === 'failed' || p.status === 'failed_hard').length
  const needsReview = pipelines.filter((p) => p.status === 'needs_review').length

  const avgCost =
    pipelines.length > 0
      ? pipelines.reduce((sum, p) => sum + (p.cost || 0), 0) / pipelines.length
      : 0

  const activePipelines = pipelines
    .filter((p) => p.status === 'running' || p.status === 'needs_review')
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mission Control</h1>
            <p className="text-muted-foreground">
              Real-time pipeline monitoring and management
            </p>
          </div>
          <Badge variant={connected ? 'default' : 'destructive'} className="text-lg px-4 py-2">
            {connected ? '🟢 Live' : '🔴 Offline'}
          </Badge>
        </div>

        {error && (
          <Card className="border-red-500 bg-red-950/20">
            <CardContent className="pt-6">
              <p className="text-red-400">Connection error: {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Running"
            value={running}
            color="blue"
            icon="⚡"
          />
          <StatCard
            label="Completed"
            value={completed}
            color="green"
            icon="✅"
          />
          <StatCard
            label="Failed"
            value={failed}
            color="red"
            icon="❌"
          />
          <StatCard
            label="Avg Cost"
            value={`$${avgCost.toFixed(2)}`}
            color="purple"
            icon="💰"
          />
        </div>

        {/* Active Pipelines */}
        <Card>
          <CardHeader>
            <CardTitle>Active Pipelines</CardTitle>
            <CardDescription>
              {activePipelines.length} pipeline(s) currently running or pending review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activePipelines.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No active pipelines
                </p>
              ) : (
                activePipelines.map((pipeline) => (
                  <PipelineRow
                    key={pipeline.id}
                    pipeline={pipeline}
                    selected={selectedPipeline === pipeline.id}
                    onSelect={() =>
                      setSelectedPipeline(
                        selectedPipeline === pipeline.id ? null : pipeline.id
                      )
                    }
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Terminal Viewer */}
        {selectedPipeline && (
          <Card>
            <CardHeader>
              <CardTitle>Terminal Logs</CardTitle>
              <CardDescription>
                Real-time logs for pipeline {selectedPipeline.slice(0, 8)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TerminalViewer pipelineId={selectedPipeline} />
            </CardContent>
          </Card>
        )}

        {/* Recent Pipelines */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Pipelines</CardTitle>
            <CardDescription>Last 20 pipeline executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelines.slice(0, 20).map((pipeline) => (
                <PipelineRow
                  key={pipeline.id}
                  pipeline={pipeline}
                  selected={selectedPipeline === pipeline.id}
                  onSelect={() =>
                    setSelectedPipeline(
                      selectedPipeline === pipeline.id ? null : pipeline.id
                    )
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: string | number
  color: 'blue' | 'green' | 'red' | 'purple'
  icon?: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/30 border-blue-600',
    green: 'bg-green-900/30 border-green-600',
    red: 'bg-red-900/30 border-red-600',
    purple: 'bg-purple-900/30 border-purple-600',
  }

  return (
    <Card className={`p-4 border ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </Card>
  )
}

function PipelineRow({
  pipeline,
  selected,
  onSelect,
}: {
  pipeline: any
  selected: boolean
  onSelect: () => void
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-600'
      case 'completed':
        return 'bg-green-600'
      case 'failed':
      case 'failed_hard':
        return 'bg-red-600'
      case 'needs_review':
        return 'bg-yellow-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <Card
      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
        selected ? 'border-cyan-500 bg-cyan-950/20' : 'bg-slate-900 border-slate-700'
      } hover:border-cyan-500/50`}
      onClick={onSelect}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm text-cyan-400">
            {pipeline.id?.slice(0, 8) || 'unknown'}
          </p>
          <Badge
            variant="outline"
            className={`text-xs ${getStatusColor(pipeline.status || 'unknown')}`}
          >
            {pipeline.status || 'unknown'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {pipeline.name || pipeline.initial_prompt || 'Untitled'}
        </p>
        <p className="text-xs text-muted-foreground">
          Phase: {pipeline.current_phase || 'unknown'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-white">
          ${(pipeline.cost || 0).toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          {pipeline.created_at
            ? new Date(pipeline.created_at).toLocaleString()
            : 'Unknown'}
        </p>
      </div>
    </Card>
  )
}

