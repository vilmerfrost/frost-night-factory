"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface Run {
  id: number;
  task_id: number;
  stage: "planner" | "coder" | "reviewer";
  status: "pending" | "processing" | "completed" | "failed";
  input: string | null;
  output: string | null;
  created_at: string;
}

interface TaskRunsProps {
  taskId: number | null;
}

export default function TaskRuns({ taskId }: TaskRunsProps) {
  const [runs, setRuns] = useState<Run[]>([]);

  async function loadRuns() {
    if (!taskId) return;

    const { data } = await supabaseBrowser
      .from("night_task_runs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    setRuns(data || []);
  }

  useEffect(() => {
    loadRuns();

    if (!taskId) return;

    const channel = supabaseBrowser
      .channel("task_runs_" + taskId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "night_task_runs",
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          loadRuns();
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [taskId]);

  if (!taskId || runs.length === 0) return null;

  const stageColors = {
    planner: "bg-purple-950/30 border-purple-500/30 text-purple-400",
    coder: "bg-blue-950/30 border-blue-500/30 text-blue-400",
    reviewer: "bg-emerald-950/30 border-emerald-500/30 text-emerald-400",
  };

  const statusColors = {
    pending: "bg-slate-800 text-slate-400",
    processing: "bg-cyan-950/30 text-cyan-400 animate-pulse",
    completed: "bg-emerald-950/30 text-emerald-400",
    failed: "bg-red-950/30 text-red-400",
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
        Pipeline Runs
      </h3>
      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className={`p-4 rounded-lg border ${stageColors[run.stage]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase">
                  {run.stage}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${statusColors[run.status]}`}
                >
                  {run.status}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(run.created_at).toLocaleTimeString()}
              </span>
            </div>
            {run.output && (
              <div className="mt-2 p-3 bg-black/30 rounded text-xs font-mono text-slate-300">
                {run.stage === "reviewer" ? (
                  <pre className="whitespace-pre-wrap">{run.output}</pre>
                ) : (
                  <div className="whitespace-pre-wrap">{run.output}</div>
                )}
              </div>
            )}
            {run.status === "processing" && !run.output && (
              <div className="mt-2 text-xs text-slate-400 italic">
                Processing...
              </div>
            )}
            {run.status === "pending" && (
              <div className="mt-2 text-xs text-slate-500 italic">
                Waiting to start...
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

