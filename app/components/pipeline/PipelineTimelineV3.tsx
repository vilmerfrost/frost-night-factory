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
  Flame,
  Minus,
  File,
  Download,
} from "lucide-react";
import clsx from "clsx";
import DiffViewer from "react-diff-viewer-continued";

type Run = {
  id: number;
  task_id: number;
  stage: "planner" | "coder" | "reviewer";
  status: "pending" | "processing" | "completed" | "failed";
  output: string | null;
  cleaned_output: string | null;
  previous_output: string | null;
  created_at: string;
  files?: any[];
};

interface PipelineTimelineV3Props {
  taskId: number | null;
}

export default function PipelineTimelineV3({ taskId }: PipelineTimelineV3Props) {
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

  // Subscribe to realtime updates with polling fallback
  useEffect(() => {
    if (!taskId) return;

    let pollingInterval: NodeJS.Timeout | null = null;

    // Realtime subscription
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

    // Polling fallback (every 2 seconds)
    const pollRuns = async () => {
      const { data } = await supabaseBrowser
        .from("night_task_runs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (data) {
        setRuns(data);
      }
    };

    pollingInterval = setInterval(pollRuns, 2000);

    return () => {
      subscription.unsubscribe();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [taskId]);

  if (!taskId) return null;

  // ICONS
  const STAGE_ICON = {
    planner: <ClipboardList className="w-5 h-5 text-blue-400" />,
    coder: <Code2 className="w-5 h-5 text-green-400" />,
    reviewer: <UserCheck className="w-5 h-5 text-purple-400" />,
  };

  const STATUS_ICON = {
    pending: <Minus className="w-4 h-4 text-yellow-400" />,
    processing: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    failed: <Flame className="w-4 h-4 text-red-400" />,
  };

  const progress = (runs.filter((r) => r.status === "completed").length / 3) * 100;

  if (runs.length === 0) {
    return (
      <div className="space-y-6 bg-black/40 border border-white/10 p-6 rounded-2xl shadow-xl shadow-cyan-500/20 backdrop-blur-xl">
        <h2 className="text-3xl font-bold text-white">Pipeline Timeline V3</h2>
        <p className="text-sm text-slate-400">No runs yet. Waiting for pipeline to start...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-black/40 border border-white/10 p-6 rounded-2xl shadow-xl shadow-cyan-500/20 backdrop-blur-xl">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Pipeline Timeline V3</h2>

        <button
          onClick={() => setExpandedAll(!expandedAll)}
          className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 transition"
        >
          {expandedAll ? <ChevronUp /> : <ChevronDown />}
          {expandedAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* TIMELINE */}
      <div className="space-y-4">
        {runs.map((run) => (
          <details
            key={run.id}
            open={expandedAll}
            className="group border border-white/10 bg-black/30 rounded-xl p-5 transition-all hover:border-cyan-500/30"
          >
            <summary className="flex items-center justify-between list-none cursor-pointer">
              <div className="flex items-center gap-4">
                {STAGE_ICON[run.stage]}

                <div>
                  <div className="capitalize text-lg font-semibold text-white">
                    {run.stage}
                  </div>

                  <div className="text-xs text-white/40">
                    {new Date(run.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {STATUS_ICON[run.status]}
                <span
                  className={clsx(
                    "font-semibold capitalize",
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
                <ChevronDown className="w-5 h-5 text-white/40 group-open:rotate-180 transition" />
              </div>
            </summary>

            {/* OUTPUT */}
            <div className="mt-4 space-y-3">
              {/* FIXED OUTPUT (no prompt echo) */}
              {run.cleaned_output && (
                <div className="p-4 bg-black/60 border border-white/10 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/50 uppercase">Output</span>
                    <button
                      onClick={() => {
                        const blob = new Blob([run.cleaned_output || ""], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${run.stage}_${run.id}_${new Date(run.created_at).toISOString().split("T")[0]}.md`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded transition"
                    >
                      <Download className="w-3 h-3" />
                      Download to MD
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-white text-sm">
                    {run.cleaned_output}
                  </pre>
                </div>
              )}

              {/* Fallback to output if cleaned_output is null */}
              {!run.cleaned_output && run.output && (
                <div className="p-4 bg-black/60 border border-white/10 rounded-lg">
                  <pre className="whitespace-pre-wrap text-white text-sm">
                    {run.output}
                  </pre>
                </div>
              )}

              {/* DIFF VIEWER */}
              {run.previous_output && run.cleaned_output && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <DiffViewer
                    oldValue={run.previous_output}
                    newValue={run.cleaned_output}
                    splitView={true}
                    useDarkTheme={true}
                  />
                </div>
              )}

              {/* FILE BROWSER PLACEHOLDER */}
              {run.files && run.files.length > 0 ? (
                <div className="p-4 border border-white/10 rounded-lg">
                  <div className="flex items-center gap-2 text-white/70 mb-2">
                    <File className="w-4 h-4" /> Files
                  </div>
                  <ul className="text-white/50 text-sm">
                    {run.files.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : run.stage === "reviewer" && run.status === "completed" ? (
                <div className="p-4 border border-white/10 rounded-lg text-white/30 text-sm italic">
                  File browser coming soon…
                </div>
              ) : null}

              {/* Status messages */}
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

              {run.status === "failed" && !run.cleaned_output && !run.output && (
                <div className="text-sm text-red-400 italic">
                  Run failed. Check output for details.
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

