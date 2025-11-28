"use client";

import { useEffect, useState } from "react";
import { subscribeToPipelineRuns } from "@/lib/supabase/realtime";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ChevronDown, CheckCircle, CircleDot, XCircle, Code2, ClipboardList } from "lucide-react";
import clsx from "clsx";

type PipelineRun = {
  id: number;
  task_id: number;
  stage: "planner" | "coder" | "reviewer";
  status: "pending" | "processing" | "completed" | "failed";
  output: string | null;
  created_at: string;
};

interface PipelineTimelineProps {
  taskId: number | null;
}

export default function PipelineTimeline({ taskId }: PipelineTimelineProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);

  // Load initial runs
  useEffect(() => {
    if (!taskId) {
      setRuns([]);
      return;
    }

    async function loadInitialRuns() {
      const { data } = await supabaseBrowser
        .from("night_task_runs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (data) {
        setRuns(data);
      }
    }

    loadInitialRuns();
  }, [taskId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!taskId) return;

    const subscription = subscribeToPipelineRuns(taskId, (newRun) => {
      setRuns((prev) => {
        const exists = prev.find((r) => r.id === newRun.id);
        if (exists) {
          return prev.map((r) => (r.id === newRun.id ? newRun : r));
        }
        return [...prev, newRun].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId]);

  if (!taskId) return null;

  const getIcon = (stage: string) => {
    switch (stage) {
      case "planner":
        return <ClipboardList className="w-5 h-5 text-blue-400" />;
      case "coder":
        return <Code2 className="w-5 h-5 text-green-400" />;
      case "reviewer":
        return <CheckCircle className="w-5 h-5 text-purple-400" />;
      default:
        return <CircleDot className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) =>
    ({
      pending: "text-yellow-400",
      processing: "text-blue-400",
      completed: "text-green-400",
      failed: "text-red-400",
    }[status] || "text-slate-400");

  if (runs.length === 0) {
    return (
      <div className="space-y-4 p-4 bg-black/30 rounded-xl border border-white/10 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white">Pipeline Timeline</h2>
        <p className="text-sm text-slate-400">No runs yet. Waiting for pipeline to start...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-black/30 rounded-xl border border-white/10 backdrop-blur-xl">
      <h2 className="text-xl font-bold text-white">Pipeline Timeline</h2>

      {runs.map((run) => (
        <div
          key={run.id}
          className="border border-white/10 rounded-lg bg-black/20 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(run.stage)}
              <div>
                <div className="text-white font-semibold capitalize">
                  {run.stage}
                </div>
                <div className="text-xs text-white/50">
                  {new Date(run.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div className={clsx("font-bold", getStatusColor(run.status))}>
              {run.status}
            </div>
          </div>

          {run.output && (
            <details className="bg-black/30 p-3 rounded-md border border-white/5">
              <summary className="cursor-pointer text-white/70 flex items-center gap-2">
                <ChevronDown className="w-4 h-4" />
                View Output
              </summary>
              <pre className="mt-2 p-2 text-sm bg-black/40 text-white overflow-auto rounded-md whitespace-pre-wrap">
                {run.output}
              </pre>
            </details>
          )}

          {run.status === "processing" && !run.output && (
            <div className="text-sm text-blue-400 italic animate-pulse">
              Processing...
            </div>
          )}

          {run.status === "pending" && (
            <div className="text-sm text-yellow-400 italic">
              Waiting to start...
            </div>
          )}

          {run.status === "failed" && (
            <div className="text-sm text-red-400 italic">
              Run failed. Check output for details.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

