"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, ArrowRight, Sparkles, Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import CreateTaskModal from "@/components/CreateTaskModal";

interface Pipeline {
  id: string;
  name: string;
  status: string;
  current_phase: string;
  initial_prompt?: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchPipelines = async () => {
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
      const mockPipelines: Pipeline[] = [
        {
          id: "1",
          name: "Spotify Clone",
          status: "running",
          current_phase: "coder",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      setPipelines(mockPipelines);
      updateStats(mockPipelines);
    } finally {
      setIsLoading(false);
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
    fetchPipelines();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

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
        (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: unknown; old: unknown }) => {
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

  const statsData = [
    { label: 'Total Pipelines', value: stats.total.toString(), icon: Sparkles, color: 'from-blue-500 to-cyan-500' },
    { label: 'Running', value: stats.running.toString(), icon: Zap, color: 'from-purple-500 to-pink-500', badge: stats.running > 0 ? 'Active' : undefined },
    { label: 'Completed', value: stats.completed.toString(), icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
    { label: 'Failed', value: stats.failed.toString(), icon: XCircle, color: 'from-red-500 to-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-white/20 shadow-sm">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1 font-medium">Welcome back! Here's your overview.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-100"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span>New Pipeline</span>
          </button>
        </div>
      </header>

      <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/50 shadow-lg shadow-black/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-300 cursor-pointer overflow-hidden hover:scale-[1.02]"
            >
              {/* Animated gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
              
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg shadow-black/10 group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  {stat.badge && (
                    <span className="px-3 py-1.5 bg-emerald-100/80 backdrop-blur-sm text-emerald-700 text-xs font-bold rounded-full border border-emerald-200/50">
                      {stat.badge}
                    </span>
                  )}
                </div>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Hero CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-3xl p-10 md:p-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl shadow-purple-500/25"
        >
          {/* Animated background effects */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGMwIDMuMzE0LTIuNjg2IDYtNiA2cy02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNnoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
          
          {/* Floating orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 max-w-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold mb-6 border border-white/30 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              AI-Powered Development
            </motion.div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight">
              Build Apps in Minutes
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed font-medium">
              Describe your app idea and let our AI build a production-ready application with full-stack code, database, and deployment.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:scale-105 active:scale-100 overflow-hidden"
            >
              <span className="relative z-10">Create Your First App</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>
        </motion.div>

        {/* Recent Pipelines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl shadow-black/5 overflow-hidden"
        >
          <div className="px-8 py-6 border-b border-gray-200/50 bg-gradient-to-r from-white to-gray-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Recent Pipelines
              </h3>
              <p className="text-sm text-gray-600 mt-1 font-medium">View all your pipelines</p>
            </div>
            <span className="px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 text-sm font-bold rounded-full border border-indigo-200/50 shadow-sm">
              {stats.total} total
            </span>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="relative">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <div className="absolute inset-0 w-8 h-8 border-4 border-indigo-100 rounded-full" />
                </div>
              </div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
                  <span className="text-4xl">🚀</span>
                </div>
                <p className="text-gray-600 text-lg font-semibold mb-2">No pipelines yet</p>
                <p className="text-gray-500 text-sm mb-6">Get started by creating your first AI-powered pipeline</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Create your first pipeline
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {pipelines.map((pipeline, index) => (
                  <motion.div
                    key={pipeline.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center gap-5 p-5 rounded-2xl bg-gradient-to-r from-white to-gray-50/50 border border-gray-200/50 hover:border-indigo-300/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                      pipeline.status === 'running' ? 'from-purple-500 to-pink-500' :
                      pipeline.status === 'completed' ? 'from-emerald-500 to-green-500' :
                      pipeline.status === 'failed' ? 'from-red-500 to-orange-500' :
                      'from-gray-400 to-gray-500'
                    }`}>
                      {pipeline.status === 'running' ? <Zap className="w-7 h-7 text-white" /> :
                       pipeline.status === 'completed' ? <CheckCircle2 className="w-7 h-7 text-white" /> :
                       pipeline.status === 'failed' ? <XCircle className="w-7 h-7 text-white" /> :
                       <Sparkles className="w-7 h-7 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 mb-1.5 text-lg group-hover:text-indigo-600 transition-colors">
                        {pipeline.name || 'Untitled Pipeline'}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-1 font-medium">
                        {pipeline.initial_prompt || 'No description'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{pipeline.current_phase || 'research'}</div>
                      <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full shadow-sm ${
                        pipeline.status === 'running' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        pipeline.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        pipeline.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {pipeline.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchPipelines}
      />
    </div>
  );
}
