"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import clsx from "clsx";

interface AgentTask {
  id: string;
  title: string;
  description: string;
  repo_url: string;
  branch: string;
  status: "pending" | "running" | "failed" | "completed";
  logs: string | null;
  created_at: string;
  updated_at: string;
}

export default function AgentTaskList() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/agent/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching agent tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      case "running":
        return "text-blue-400";
      default:
        return "text-yellow-400";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading agent tasks...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-bold text-white">Agent Tasks</h3>

      {tasks.length === 0 ? (
        <p className="text-white/50 text-sm">No agent tasks yet. Create one to get started!</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={clsx(
                "p-3 rounded-lg border cursor-pointer transition",
                selectedTask?.id === task.id
                  ? "bg-cyan-500/20 border-cyan-500"
                  : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(task.status)}
                    <span className="font-semibold text-white text-sm">{task.title}</span>
                  </div>
                  <p className="text-white/60 text-xs line-clamp-2">{task.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                    <span>{task.branch}</span>
                    <span>•</span>
                    <span>{new Date(task.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span className={clsx("text-xs font-semibold capitalize", getStatusColor(task.status))}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <div className="mt-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-white">{selectedTask.title}</h4>
            <button
              onClick={() => setSelectedTask(null)}
              className="text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-white/60">Status: </span>
              <span className={clsx("font-semibold capitalize", getStatusColor(selectedTask.status))}>
                {selectedTask.status}
              </span>
            </div>
            <div>
              <span className="text-white/60">Repo: </span>
              <span className="text-white font-mono text-xs">{selectedTask.repo_url}</span>
            </div>
            <div>
              <span className="text-white/60">Branch: </span>
              <span className="text-white">{selectedTask.branch}</span>
            </div>
            {selectedTask.logs && (
              <div className="mt-3">
                <span className="text-white/60 block mb-1">Logs:</span>
                <pre className="bg-black/50 p-2 rounded text-xs text-green-400/80 font-mono overflow-auto max-h-40">
                  {selectedTask.logs}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

