'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

interface Pipeline {
  id: string
  name: string | null
  initial_prompt: string | null
  status: 'pending' | 'running' | 'completed' | 'failed_hard'
  current_phase: string | null
  created_at: string
  updated_at: string
}

interface Step {
  id: string
  pipeline_id: string
  name: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  input: string | null
  output: string | null
  created_at: string
  updated_at: string
}

const STEP_ORDER = ['research', 'planner', 'coder', 'tester', 'publisher']

export default function MonitorPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [steps, setSteps] = useState<Record<string, Step[]>>({})
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [remoteTriggering, setRemoteTriggering] = useState(false)
  const supabase = supabaseBrowser
  
  // Remote server configuration (can be moved to env vars)
  const REMOTE_SERVER_URL = process.env.NEXT_PUBLIC_REMOTE_SERVER_URL || 'http://localhost:8080'
  const REMOTE_SERVER_TOKEN = process.env.NEXT_PUBLIC_REMOTE_SERVER_TOKEN || ''
  
  const triggerRemotePipeline = async () => {
    if (!REMOTE_SERVER_TOKEN) {
      alert('⚠️ Remote server token not configured. Set NEXT_PUBLIC_REMOTE_SERVER_TOKEN in .env')
      return
    }
    
    setRemoteTriggering(true)
    try {
      const response = await fetch(`${REMOTE_SERVER_URL}/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REMOTE_SERVER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ branch: 'main', commit: 'manual' })
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`✅ Pipeline started on home PC!\nPID: ${data.pid}`)
      } else {
        const error = await response.text()
        alert(`❌ Failed to start pipeline: ${error}`)
      }
    } catch (error: any) {
      alert(`❌ Connection error: ${error.message}\n\nMake sure:\n1. Remote server is running\n2. Tailscale/VPN is connected\n3. URL is correct`)
    } finally {
      setRemoteTriggering(false)
    }
  }

  // Load pipelines
  const loadPipelines = async () => {
    const { data } = await supabase
      .from('pipelines')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (data) setPipelines(data as Pipeline[])
  }

  // Load steps for a pipeline
  const loadSteps = async (pipelineId: string) => {
    const { data } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: true })
    
    if (data) {
      setSteps(prev => ({
        ...prev,
        [pipelineId]: data as Step[]
      }))
    }
  }

  // Initial load
  useEffect(() => {
    loadPipelines()
    
    // Auto-refresh every 2 seconds when enabled
    const interval = autoRefresh ? setInterval(loadPipelines, 2000) : null
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  // Load steps when pipeline selected
  useEffect(() => {
    if (!selectedPipeline) return
    
    loadSteps(selectedPipeline)
    
    // Auto-refresh steps
    const interval = autoRefresh ? setInterval(() => loadSteps(selectedPipeline), 1500) : null
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [selectedPipeline, autoRefresh])

  // Subscribe to real-time changes
  useEffect(() => {
    const pipelineChannel = supabase
      .channel('pipelines-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'pipelines' },
        () => loadPipelines()
      )
      .subscribe()

    const stepChannel = supabase
      .channel('steps-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pipeline_steps' },
        (payload: any) => {
          if (payload.new?.pipeline_id) {
            loadSteps(payload.new.pipeline_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(pipelineChannel)
      supabase.removeChannel(stepChannel)
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
      case 'complete': case 'completed': return 'bg-green-500/20 border-green-500 text-green-400'
      case 'failed': case 'failed_hard': return 'bg-red-500/20 border-red-500 text-red-400'
      default: return 'bg-gray-500/20 border-gray-500 text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '⚡'
      case 'complete': case 'completed': return '✅'
      case 'failed': case 'failed_hard': return '❌'
      default: return '⏸️'
    }
  }

  const selectedPipelineData = pipelines.find(p => p.id === selectedPipeline)
  const currentSteps = selectedPipeline ? steps[selectedPipeline] || [] : []

  return (
    <div className="min-h-screen bg-[#050505] text-[#00F0FF] font-mono">
      {/* Header */}
      <div className="border-b border-[#00F0FF]/30 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                ❄️ FROST NIGHT FACTORY
                <span className={`text-sm px-3 py-1 rounded border ${
                  autoRefresh 
                    ? 'bg-green-500/20 border-green-500 text-green-400 animate-pulse' 
                    : 'bg-gray-500/20 border-gray-500 text-gray-400'
                }`}>
                  {autoRefresh ? '● LIVE' : '○ PAUSED'}
                </span>
              </h1>
              <p className="text-gray-400">Real-time Pipeline Monitor</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={triggerRemotePipeline}
                disabled={remoteTriggering}
                className={`px-4 py-2 rounded border transition-all ${
                  remoteTriggering
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 cursor-wait'
                    : 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {remoteTriggering ? '⏳ Starting...' : '🚀 Run on Home PC'}
              </button>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded border transition-all ${
                  autoRefresh
                    ? 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30'
                    : 'bg-gray-500/20 border-gray-500 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                {autoRefresh ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button
                onClick={() => {
                  loadPipelines()
                  if (selectedPipeline) loadSteps(selectedPipeline)
                }}
                className="px-4 py-2 rounded border bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF]/30 transition-all"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pipeline List */}
          <div className="lg:col-span-1">
            <div className="border border-[#00F0FF]/30 rounded-lg bg-black/50 backdrop-blur-sm overflow-hidden">
              <div className="bg-[#00F0FF]/10 border-b border-[#00F0FF]/30 px-4 py-3">
                <h2 className="text-xl font-bold">Active Pipelines ({pipelines.length})</h2>
              </div>
              <div className="p-4 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {pipelines.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No pipelines running</p>
                    <p className="text-xs text-gray-600">Start agent-runner to see pipelines</p>
                  </div>
                ) : (
                  pipelines.map(pipeline => (
                    <button
                      key={pipeline.id}
                      onClick={() => setSelectedPipeline(pipeline.id)}
                      className={`w-full text-left p-4 rounded border transition-all ${
                        selectedPipeline === pipeline.id
                          ? 'bg-[#00F0FF]/20 border-[#00F0FF] shadow-lg shadow-[#00F0FF]/20'
                          : 'bg-black/50 border-gray-700 hover:border-[#00F0FF]/50 hover:bg-black/70'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-bold text-sm truncate flex-1">
                          {pipeline.name || 'Unnamed Pipeline'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded border ml-2 ${getStatusColor(pipeline.status)}`}>
                          {pipeline.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 truncate">
                        ID: {pipeline.id.slice(0, 8)}...
                      </p>
                      {pipeline.current_phase && (
                        <p className="text-xs text-[#00F0FF]">
                          📍 {pipeline.current_phase}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        {new Date(pipeline.created_at).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Details */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedPipeline ? (
              <div className="border border-[#00F0FF]/30 rounded-lg bg-black/50 backdrop-blur-sm p-12 flex flex-col items-center justify-center min-h-[500px]">
                <p className="text-gray-500 text-center text-lg mb-4">
                  👈 Select a pipeline to view details
                </p>
                <p className="text-gray-600 text-sm">
                  Live monitoring with real-time updates
                </p>
              </div>
            ) : (
              <>
                {/* Pipeline Info */}
                {selectedPipelineData && (
                  <div className="border border-[#00F0FF]/30 rounded-lg bg-black/50 backdrop-blur-sm p-6">
                    <h2 className="text-2xl font-bold mb-4">{selectedPipelineData.name || 'Pipeline Details'}</h2>
                    {selectedPipelineData.initial_prompt && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Initial Prompt:</p>
                        <p className="text-sm text-gray-300 bg-black/50 p-3 rounded border border-gray-800">
                          {selectedPipelineData.initial_prompt.slice(0, 200)}
                          {selectedPipelineData.initial_prompt.length > 200 && '...'}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded border ${getStatusColor(selectedPipelineData.status)}`}>
                          {selectedPipelineData.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Started:</span>
                        <span className="ml-2 text-[#00F0FF]">
                          {new Date(selectedPipelineData.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step Progress */}
                <div className="border border-[#00F0FF]/30 rounded-lg bg-black/50 backdrop-blur-sm overflow-hidden">
                  <div className="bg-[#00F0FF]/10 border-b border-[#00F0FF]/30 px-6 py-3">
                    <h2 className="text-xl font-bold">Pipeline Steps</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {STEP_ORDER.map((stepName, index) => {
                      const step = currentSteps.find(s => s.name === stepName)
                      const status = step?.status || 'pending'
                      const isActive = status === 'running'
                      
                      return (
                        <div
                          key={stepName}
                          className={`p-5 rounded-lg border transition-all ${getStatusColor(status)} ${
                            isActive ? 'animate-pulse shadow-lg' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <span className="text-3xl">{getStatusIcon(status)}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <p className="font-bold uppercase text-base">{stepName}</p>
                                  {isActive && (
                                    <span className="text-xs px-2 py-1 bg-yellow-500/30 border border-yellow-500 rounded">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                {step && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Updated: {new Date(step.updated_at).toLocaleTimeString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono opacity-70">
                                Step {index + 1}/5
                              </span>
                            </div>
                          </div>
                          
                          {/* Step output preview */}
                          {step?.output && (
                            <div className="mt-3 pt-3 border-t border-current/20">
                              <p className="text-xs text-gray-400 mb-1">Output Preview:</p>
                              <p className="text-xs text-gray-300 bg-black/50 p-2 rounded font-mono">
                                {typeof step.output === 'string' 
                                  ? step.output.slice(0, 150) + (step.output.length > 150 ? '...' : '')
                                  : JSON.stringify(step.output).slice(0, 150) + '...'}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Live Logs */}
                <div className="border border-[#00F0FF]/30 rounded-lg bg-black/50 backdrop-blur-sm overflow-hidden">
                  <div className="bg-[#00F0FF]/10 border-b border-[#00F0FF]/30 px-6 py-3">
                    <h2 className="text-xl font-bold">🖥️ Live Logs</h2>
                  </div>
                  <div className="bg-black/80 p-6 max-h-96 overflow-y-auto font-mono text-sm">
                    {currentSteps.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">Waiting for logs...</p>
                    ) : (
                      <div className="space-y-2">
                        {currentSteps.map(step => (
                          <div key={step.id} className="leading-relaxed">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-xs">
                                [{new Date(step.created_at).toLocaleTimeString()}]
                              </span>
                              <span className="text-[#00F0FF] font-bold">[{step.name.toUpperCase()}]</span>
                              <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(step.status)}`}>
                                {step.status}
                              </span>
                            </div>
                            {step.output && (
                              <div className="ml-6 mt-1 text-gray-400 text-xs whitespace-pre-wrap bg-black/50 p-2 rounded border border-gray-800">
                                {typeof step.output === 'string' 
                                  ? step.output
                                  : JSON.stringify(step.output, null, 2)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

