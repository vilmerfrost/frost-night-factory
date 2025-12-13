"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Zap, TrendingUp, AlertCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function MonitorPage() {
  const [metrics, setMetrics] = useState({
    activeBuilds: 0,
    successRate: 0,
    avgBuildTime: 0,
    totalBuilds: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data: pipelines, error } = await supabaseBrowser
          .from('pipelines')
          .select('status, created_at');

        if (error) throw error;

        const activeBuilds = pipelines?.filter(p => p.status === 'running').length || 0;
        const totalBuilds = pipelines?.length || 0;
        const completed = pipelines?.filter(p => p.status === 'completed').length || 0;
        const successRate = totalBuilds > 0 ? Math.round((completed / totalBuilds) * 100) : 0;

        setMetrics({
          activeBuilds,
          successRate,
          avgBuildTime: 23, // TODO: Calculate from actual data
          totalBuilds,
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    fetchMetrics();
    
    // Real-time updates
    const channel = supabaseBrowser
      .channel("metrics-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pipelines",
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    const interval = setInterval(fetchMetrics, 2000);
    return () => {
      clearInterval(interval);
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Live Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time system metrics</p>
        </div>
      </header>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            label="Active Builds"
            value={metrics.activeBuilds}
            icon={Activity}
            color="from-blue-500 to-cyan-500"
          />
          <MetricCard
            label="Success Rate"
            value={`${metrics.successRate}%`}
            icon={TrendingUp}
            color="from-green-500 to-emerald-500"
          />
          <MetricCard
            label="Avg Build Time"
            value={`${metrics.avgBuildTime}m`}
            icon={Zap}
            color="from-purple-500 to-pink-500"
          />
          <MetricCard
            label="Total Builds"
            value={metrics.totalBuilds}
            icon={AlertCircle}
            color="from-orange-500 to-red-500"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
    >
      <div className={`p-3 rounded-xl bg-gradient-to-br ${color} w-fit mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </motion.div>
  );
}
