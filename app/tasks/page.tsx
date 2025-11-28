"use client";

import type { Task, TaskStatus } from "../page";

interface TaskListProps {
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}

const mockTasks: Task[] = [
  { 
    id: 104, 
    external_id: "t-104", 
    title: "Refactor Agent Navigation", 
    prompt: "Refactor the agent navigation system",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "processing",
    output: null,
    model: null,
    duration_ms: null
  },
  { 
    id: 103, 
    external_id: "t-103", 
    title: "Generate SQL Migrations", 
    prompt: "Generate SQL migrations",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "completed",
    output: "Generated migrations successfully",
    model: "gemini-2.0-flash",
    duration_ms: 1234
  },
  { 
    id: 102, 
    external_id: "t-102", 
    title: "Optimize Neuron Weights", 
    prompt: "Optimize neuron weights",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "completed",
    output: "Optimization complete",
    model: "gemini-2.0-flash",
    duration_ms: 2345
  },
  { 
    id: 101, 
    external_id: "t-101", 
    title: "Scrape Market Data", 
    prompt: "Scrape market data",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "failed",
    output: "Failed to scrape data",
    model: null,
    duration_ms: null
  },
  { 
    id: 100, 
    external_id: "t-100", 
    title: "Init Core Systems", 
    prompt: "Initialize core systems",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "completed",
    output: "Core systems initialized",
    model: "gemini-2.0-flash",
    duration_ms: 3456
  },
];

const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const styles: Record<TaskStatus, string> = {
    pending: "bg-slate-800 text-slate-400 border-slate-700",
    processing: "bg-cyan-950/30 text-cyan-400 border-cyan-500/30 animate-pulse-glow",
    completed: "bg-emerald-950/30 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-950/30 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
        styles[status]
      }`}
    >
      {status}
    </span>
  );
};

export default function TaskList({ selectedTask, onSelectTask }: TaskListProps) {
  return (
    <div className="h-full flex flex-col frost-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-slate-900/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">
          Queue
        </h2>
        <span className="text-xs text-slate-500">{mockTasks.length} Active</span>
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {mockTasks.map((task) => {
          const isActive = selectedTask?.id === task.id;

          return (
            <button
              key={task.id}
              onClick={() => onSelectTask(task)}
              className={`
                w-full text-left p-3 rounded-lg cursor-pointer border border-transparent transition-all duration-200 group
                ${
                  task.status === "processing"
                    ? "bg-white/5 border-cyan-500/20"
                    : "hover:bg-white/5 hover:border-white/10"
                }
                ${isActive ? "ring-1 ring-cyan-400/60 bg-white/10" : ""}
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`font-mono text-xs ${
                    task.status === "processing"
                      ? "text-cyan-400"
                      : "text-slate-500"
                  }`}
                >
                  #{task.external_id?.slice(0, 8) || `task-${task.id}`}
                </span>
                <span className="text-[10px] text-slate-600 font-mono">
                  {new Date(task.created_at).toLocaleTimeString("sv-SE", { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    second: "2-digit" 
                  })}
                </span>
              </div>
              <h3 className="text-sm text-slate-200 font-medium truncate mb-2 group-hover:text-white transition-colors">
                {task.title}
              </h3>
              <StatusBadge status={task.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
