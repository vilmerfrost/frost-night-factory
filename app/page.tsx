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

  const statsData = [
    { label: 'Total Pipelines', value: stats.total.toString(), icon: Sparkles, color: 'from-blue-500 to-cyan-500' },
    { label: 'Running', value: stats.running.toString(), icon: Zap, color: 'from-purple-500 to-pink-500', badge: stats.running > 0 ? 'Active' : undefined },
    { label: 'Completed', value: stats.completed.toString(), icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
    { label: 'Failed', value: stats.failed.toString(), icon: XCircle, color: 'from-red-500 to-orange-500' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's your overview.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            New Pipeline
          </button>
        </div>
      </header>

      <div className="p-8 space-y-8">
        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all hover:shadow-xl cursor-pointer overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  {stat.badge && (
                    <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                      {stat.badge}
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Hero CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl p-8 md:p-12"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-600/20 animate-pulse-slow" />
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              AI-Powered Development
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Build Apps in Minutes
            </h2>
            <p className="text-gray-300 text-lg mb-6">
              Describe your app idea and let our AI build a production-ready application with full-stack code, database, and deployment.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-semibold transition-all shadow-2xl hover:shadow-xl hover:scale-105"
            >
              Create Your First App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* Active Pipelines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Active Pipelines</h3>
              <p className="text-sm text-gray-500 mt-0.5">Monitor your running builds</p>
            </div>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
              {pipelines.length} active
            </span>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🚀</div>
                <p className="text-gray-500 text-sm mb-4">No pipelines yet</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Create your first pipeline
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {pipeline.name || 'Untitled Pipeline'}
                      </h4>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {pipeline.initial_prompt || 'No description'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 mb-1">{pipeline.current_phase || 'research'}</div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        pipeline.status === 'running' ? 'bg-blue-50 text-blue-700' :
                        pipeline.status === 'completed' ? 'bg-green-50 text-green-700' :
                        pipeline.status === 'failed' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {pipeline.status}
                      </span>
                    </div>
                  </div>
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
