"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import CreateTaskModal from "@/components/CreateTaskModal";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPipelines(data || []);
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
    
    // Real-time updates
    const channel = supabaseBrowser
      .channel("pipelines-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipelines",
        },
        () => {
          fetchPipelines();
        }
      )
      .subscribe();

    // Refresh every 5 seconds
    const interval = setInterval(fetchPipelines, 5000);
    return () => {
      clearInterval(interval);
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const filteredPipelines = pipelines.filter((pipeline: any) => {
    const matchesSearch = pipeline.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pipeline.initial_prompt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || pipeline.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const statusConfig: any = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    running: { label: 'Running', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage all your application builds
              </p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              New Pipeline
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search pipelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredPipelines.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No pipelines found
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery ? "Try a different search term" : "Create your first pipeline to get started"}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Create Pipeline
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPipelines.map((pipeline: any, index: number) => {
              const status = statusConfig[pipeline.status] || statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={pipeline.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/pipelines/${pipeline.id}`}>
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xl">⚡</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {pipeline.name || 'Untitled Pipeline'}
                            </h3>
                            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${status.color}`}>
                              <StatusIcon className={`w-3.5 h-3.5 ${pipeline.status === 'running' ? 'animate-spin' : ''}`} />
                              {status.label}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {pipeline.initial_prompt || 'No description'}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Phase: <span className="font-medium text-gray-700">{pipeline.current_phase || 'research'}</span></span>
                            <span>•</span>
                            <span>Created: {new Date(pipeline.created_at).toLocaleDateString()}</span>
                            {pipeline.updated_at && (
                              <>
                                <span>•</span>
                                <span>Updated: {new Date(pipeline.updated_at).toLocaleTimeString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchPipelines}
      />
    </div>
  );
}

