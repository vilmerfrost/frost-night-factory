"use client";

import { useEffect, useState } from "react";
import { subscribeToPipelineRuns } from "@/lib/supabase/realtime";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  Code2,
  ClipboardList,
  UserCheck,
  Minus,
  Flame,
} from "lucide-react";
import clsx from "clsx";

type Run = {
  id: number;
  task_id: number;
  stage: "planner" | "coder" | "reviewer";
  status: "pending" | "processing" | "completed" | "failed";
  output: string | null;
  created_at: string;
};

const stageOrder = ["planner", "coder", "reviewer"] as const;

interface PipelineTimelineV2Props {
  taskId: number | null;
}

export default function PipelineTimelineV2({ taskId }: PipelineTimelineV2Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedAll, setExpandedAll] = useState(false);

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
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId]);

  if (!taskId) return null;

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case "planner":
        return <ClipboardList className="w-5 h-5 text-blue-400" />;
      case "coder":
        return <Code2 className="w-5 h-5 text-green-400" />;
      case "reviewer":
        return <UserCheck className="w-5 h-5 text-purple-400" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Minus className="w-4 h-4 text-yellow-400" />;
      case "processing":
        return (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        );
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <Flame className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const stageProgress = runs.filter((r) => r.status === "completed").length;
  const progressPercent = Math.min(stageProgress / 3, 1) * 100;

  if (runs.length === 0) {
    return (
      <div className="space-y-5 p-6 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-cyan-500/10">
        <h2 className="text-2xl font-extrabold text-white tracking-wide">
          Pipeline Timeline V2
        </h2>
        <p className="text-sm text-slate-400">No runs yet. Waiting for pipeline to start...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-cyan-500/10">
      {/* 🧊 HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-white tracking-wide">
          Pipeline Timeline V2
        </h2>

        <button
          onClick={() => setExpandedAll(!expandedAll)}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white text-sm flex items-center gap-2"
        >
          {expandedAll ? <ChevronUp /> : <ChevronDown />}
          {expandedAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* 🧊 PROGRESS BAR */}
      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 🧊 TIMELINE */}
      <div className="space-y-4">
        {runs.map((run) => (
          <details
            key={run.id}
            open={expandedAll}
            className="border border-white/10 bg-black/30 p-4 rounded-xl group transition-all duration-300"
          >
            <summary className="flex items-center justify-between cursor-pointer list-none">
              {/* Left side */}
              <div className="flex items-center gap-4">
                {getStageIcon(run.stage)}

                <div>
                  <div className="text-white text-lg font-semibold capitalize">
                    {run.stage}
                  </div>

                  <div className="text-xs text-white/40">
                    {new Date(run.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                {getStatusIcon(run.status)}
                <span
                  className={clsx(
                    "capitalize font-semibold",
                    {
                      "text-yellow-400": run.status === "pending",
                      "text-blue-400": run.status === "processing",
                      "text-green-400": run.status === "completed",
                      "text-red-400": run.status === "failed",
                    }
                  )}
                >
                  {run.status}
                </span>
                <ChevronDown className="w-4 h-4 text-white/50 group-open:rotate-180 transition" />
              </div>
            </summary>

            {/* OUTPUT */}
            {run.output && (
              <div className="mt-3 p-4 rounded-lg bg-black/50 border border-white/10">
                <pre className="whitespace-pre-wrap text-white/90 text-sm">
                  {run.output}
                </pre>
              </div>
            )}

            {run.status === "processing" && !run.output && (
              <div className="mt-3 text-sm text-blue-400 italic animate-pulse">
                Processing...
              </div>
            )}

            {run.status === "pending" && (
              <div className="mt-3 text-sm text-yellow-400 italic">
                Waiting to start...
              </div>
            )}

            {run.status === "failed" && !run.output && (
              <div className="mt-3 text-sm text-red-400 italic">
                Run failed. Check output for details.
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

