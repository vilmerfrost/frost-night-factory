"use client";

import { useState } from "react";

interface AiSummaryPanelProps {
  taskId: number;
  initialSummary?: string | null;
}

export function AiSummaryPanel({ taskId, initialSummary }: AiSummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get full output from runs
      const res = await fetch("/api/night-factory/summary", {
        method: "POST",
        body: JSON.stringify({ taskId }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate summary");

      setSummary(data.summary);
    } catch (err: any) {
      // Fallback: try agent execute route
      try {
        const res = await fetch("/api/agent/execute", {
          method: "POST",
          body: JSON.stringify({
            action: "ai_summary",
            content: "Generate summary from task outputs",
          }),
          headers: { "Content-Type": "application/json" },
        });

        const data = await res.json();
        if (res.ok && data.summary) {
          setSummary(data.summary);
        } else {
          throw err;
        }
      } catch (fallbackErr: any) {
        setError(err?.message ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-xl shadow-cyan-500/20 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          AI Summary
        </h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md bg-cyan-500/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-cyan-400 transition disabled:opacity-50"
        >
          {loading ? "Summarizing…" : "Generate Summary"}
        </button>
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-400">{error}</p>
      )}

      {summary ? (
        <div className="prose prose-invert max-w-none text-xs text-slate-200">
          {summary.split("\n").map((line, i) => (
            <p key={i} className="mb-1">{line}</p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          No summary generated yet. Click "Generate Summary" to get a short
          report of this run.
        </p>
      )}
    </div>
  );
}

