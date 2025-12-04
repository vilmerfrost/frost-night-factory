"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";
import PipelineCreator from "@/components/pipeline/PipelineCreator";
import CreateTaskModal from "@/components/CreateTaskModal";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Plus,
  Clock,
  Cpu,
  Zap,
  Database,
  Code2,
  Rocket,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Pipeline {
  id: string;
  name: string;
  status: string;
  current_phase: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<"operational" | "degraded" | "down">("operational");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load pipelines
  const loadPipelines = async () => {
    try {
      const { data, error } = await supabaseBrowser
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        setPipelines(data);
        updateStats(data);
      }
    } catch (error) {
      console.error("Error loading pipelines:", error);
      // Use mock data on error
      const mockPipelines: Pipeline[] = [
        {
          id: "1",
          name: "Spotify Clone",
          status: "running",
          current_phase: "coder",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "2",
          name: "Todo App v2",
          status: "completed",
          current_phase: "done",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      setPipelines(mockPipelines);
      updateStats(mockPipelines);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const updateStats = (data: Pipeline[]) => {
    setStats({
      total: data.length,
      running: data.filter((p) => p.status === "running").length,
      completed: data.filter((p) => p.status === "completed").length,
      failed: data.filter((p) => p.status === "failed").length,
    });
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    // Uppdatera var 5:e sekund (30s är lite segt när man väntar på agenter!)
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  // Real-time updates
  useEffect(() => {
    const channel = supabaseBrowser
      .channel("pipelines-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipelines",
        },
        (payload) => {
          if (payload.new) {
            const newPipeline = payload.new as Pipeline;
            setPipelines((prev) => {
              const exists = prev.find((p) => p.id === newPipeline.id);
              if (exists) {
                const updated = prev.map((p) =>
                  p.id === newPipeline.id ? newPipeline : p
                );
                updateStats(updated);
                return updated;
              }
              const newList = [newPipeline, ...prev].slice(0, 50);
              updateStats(newList);
              return newList;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit";
    
    switch (status) {
      case "running":
        return (
          <span className={`${baseClasses} bg-blue-500/20 text-blue-400 border border-blue-500/30`}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Running
          </span>
        );
      case "completed":
        return (
          <span className={`${baseClasses} bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`}>
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className={`${baseClasses} bg-red-500/20 text-red-400 border border-red-500/30`}>
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-zinc-500/20 text-zinc-400 border border-zinc-500/30`}>
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case "research":
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case "planner":
        return <Cpu className="w-4 h-4 text-blue-400" />;
      case "coder":
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      case "sql":
        return <Database className="w-4 h-4 text-purple-400" />;
      case "tester":
        return <Activity className="w-4 h-4 text-cyan-400" />;
      case "publisher":
        return <Rocket className="w-4 h-4 text-pink-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Frost Night Factory
            </h1>
            <p className="text-zinc-400 text-sm">
              Mission Control Dashboard
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Live Monitor Link */}
            <Link
              href="/monitor"
              className="px-4 py-2 bg-[#00F0FF]/20 border border-[#00F0FF] rounded hover:bg-[#00F0FF]/30 transition-all font-mono text-sm text-[#00F0FF]"
            >
              📊 Live Monitor
            </Link>

            {/* System Status */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <div className={`w-2 h-2 rounded-full ${
                systemStatus === "operational" ? "bg-emerald-500 animate-pulse" :
                systemStatus === "degraded" ? "bg-yellow-500" :
                "bg-red-500"
              }`}></div>
              <span className="text-xs font-medium text-zinc-300">
                {systemStatus === "operational" ? "Operational" :
                 systemStatus === "degraded" ? "Degraded" :
                 "Down"}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadPipelines();
              }}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-400 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>

            {/* New Task Button */}
            <button
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm px-6 py-2 rounded-md shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all duration-300 flex items-center gap-2"
              onClick={() => setIsModalOpen(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {/* Total */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Total Tasks</div>
          </div>

          {/* Running */}
          <div className="bg-zinc-950 border border-blue-500/30 rounded-xl p-6 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
            <div className="text-3xl font-bold text-blue-400 mb-1">{stats.running}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Running</div>
          </div>

          {/* Completed */}
          <div className="bg-zinc-950 border border-emerald-500/30 rounded-xl p-6 hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400 mb-1">{stats.completed}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Completed</div>
          </div>

          {/* Failed */}
          <div className="bg-zinc-950 border border-red-500/30 rounded-xl p-6 hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-red-400 mb-1">{stats.failed}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Failed</div>
          </div>
        </div>

        {/* Pipeline Creator */}
        <div className="mb-8">
          <PipelineCreator />
        </div>

        {/* Active Pipelines */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Pipelines</h2>
            <span className="text-xs text-zinc-400">{pipelines.length} active</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Loading pipelines...</p>
            </div>
          ) : pipelines.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-2">No active pipelines</p>
              <p className="text-sm text-zinc-500">Create a new task to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {pipelines.map((pipeline) => (
                <div
                  key={pipeline.id}
                  className="px-6 py-4 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Phase Icon */}
                      <div className="flex-shrink-0">
                        {getPhaseIcon(pipeline.current_phase)}
                      </div>

                      {/* Pipeline Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-white truncate">
                            {pipeline.name || "Untitled Project"}
                          </h3>
                          <span className="text-xs text-zinc-500 font-mono">
                            {pipeline.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(pipeline.updated_at).toLocaleString()}
                          </span>
                          <span className="capitalize text-zinc-500">
                            {pipeline.current_phase || "pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {getStatusBadge(pipeline.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mission Control Modal */}
      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreated={() => {
          loadPipelines(); // Ladda om listan
        }} 
      />
    </div>
  );
}
