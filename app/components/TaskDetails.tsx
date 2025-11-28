"use client";

import { useState } from "react";
import type { Task } from "../types";
import TaskMessages from "./TaskMessages";
import PipelineTimelineV3 from "./pipeline/PipelineTimelineV3";
import { ExportButtons } from "./ExportButtons";
import { AiSummaryPanel } from "./AiSummaryPanel";

interface TaskDetailsProps {
  task: Task | null;
}

export default function TaskDetails({ task }: TaskDetailsProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    if (!task || !message.trim() || sending) return;

    setSending(true);
    try {
      await fetch(`/api/tasks/${task.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      setMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center frost-panel rounded-xl">
        <p className="text-sm text-slate-400">
          Select a task from the queue to inspect details.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col frost-panel rounded-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-slate-900/50 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          <h2 className="text-sm font-semibold text-white tracking-wide">
            {task.title}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-xs font-mono text-slate-400">
            <span>
              ID: <span className="text-cyan-400">{task.external_id ?? task.id}</span>
            </span>
            <span>
              Status: <span className="text-cyan-400">{task.status}</span>
            </span>
          </div>
          <ExportButtons taskId={task.id} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {/* Initial Prompt */}
        <section className="space-y-2">
          <h3 className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
            Initial Prompt
          </h3>
          <div className="bg-black/30 border border-white/5 p-4 rounded-lg text-sm text-slate-300 font-mono">
            {task.prompt}
          </div>
        </section>

        {/* Pipeline Timeline V3 */}
        <PipelineTimelineV3 taskId={task.id} />

        {/* AI Summary Panel */}
        <AiSummaryPanel taskId={task.id} />

        {/* Task Messages Component */}
        <TaskMessages taskId={task.id} />

        {/* Legacy Output (fallback) */}
        {task.output && (
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                Agent Output
              </h3>
              {typeof task.duration_ms === "number" && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  {task.duration_ms}ms
                </span>
              )}
            </div>
            <div className="bg-[#0b1120] border border-cyan-900/30 rounded-lg overflow-hidden">
              <div className="p-4 overflow-x-auto">
                <pre className="text-xs font-mono leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {task.output}
                </pre>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Reply bar */}
      <div className="p-4 border-t border-white/5 bg-slate-900/50">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#0d1117] p-2 rounded text-white border border-[#222] text-sm font-mono"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Reply to agent…"
            disabled={sending || task.status === "failed"}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !message.trim() || task.status === "failed"}
            className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
