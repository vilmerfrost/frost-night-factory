"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CostSummary {
  total: number
  byModel: Record<string, number>
  byPhase: Record<string, number>
  averagePerPipeline: number
  pipelines: number
}

export default function AICostMonitorPage() {
  const [summary7d, setSummary7d] = useState<CostSummary | null>(null)
  const [summary30d, setSummary30d] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCosts() {
      try {
        const [res7d, res30d] = await Promise.all([
          fetch('/api/dev/cost-summary?days=7'),
          fetch('/api/dev/cost-summary?days=30'),
        ])

        const data7d = await res7d.json()
        const data30d = await res30d.json()

        setSummary7d(data7d)
        setSummary30d(data30d)
      } catch (error) {
        console.error('Failed to fetch cost summary:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCosts()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">AI Cost Monitor</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Cost Monitor</h1>
          <p className="text-muted-foreground">
            Track AI model costs and performance across pipelines
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Last 7 Days</CardTitle>
              <CardDescription>Total Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${summary7d?.total.toFixed(2) || '0.00'}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {summary7d?.pipelines || 0} pipelines
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last 30 Days</CardTitle>
              <CardDescription>Total Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${summary30d?.total.toFixed(2) || '0.00'}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {summary30d?.pipelines || 0} pipelines
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg per Pipeline</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${summary7d?.averagePerPipeline.toFixed(4) || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Models Used</CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {summary7d ? Object.keys(summary7d.byModel).length : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model (Last 7 Days)</CardTitle>
            <CardDescription>Breakdown of costs per AI model</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary7d && Object.entries(summary7d.byModel)
                .sort(([, a], [, b]) => b - a)
                .map(([model, cost]) => (
                  <div key={model} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{model}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${cost.toFixed(4)}</div>
                      <div className="text-sm text-muted-foreground">
                        {((cost / summary7d.total) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost by Phase */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Phase (Last 7 Days)</CardTitle>
            <CardDescription>Where costs are incurred</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary7d && Object.entries(summary7d.byPhase)
                .sort(([, a], [, b]) => b - a)
                .map(([phase, cost]) => (
                  <div key={phase} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{phase}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${cost.toFixed(4)}</div>
                      <div className="text-sm text-muted-foreground">
                        {((cost / summary7d.total) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

