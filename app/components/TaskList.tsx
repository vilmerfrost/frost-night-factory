"use client";

import type { Task, TaskStatus } from "../types";

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
  onDeleteTask?: (id: number) => void;
}

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

export default function TaskList({
  tasks,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
}: TaskListProps) {

  return (
    <div className="h-full flex flex-col frost-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-slate-900/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">
          Queue
        </h2>
        <span className="text-xs text-slate-500">
          {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {tasks.length === 0 && (
          <p className="text-xs text-slate-500 px-2 py-4">No tasks yet</p>
        )}
        {tasks.map((task) => {
          const isActive = selectedTaskId === task.id;

          // plocka ut tid bara (HH:MM:SS) från created_at
          const created = new Date(task.created_at);
          const timestamp = created.toTimeString().slice(0, 8);

          return (
            <div
              key={task.id}
              className={`
                w-full p-3 rounded-lg border transition-all duration-200 group relative
                ${
                  isActive
                    ? "border-cyan-400 bg-white/10"
                    : "border-transparent hover:border-white/10 hover:bg-white/5"
                }
              `}
            >
              <button
                onClick={() => onSelectTask(task.id)}
                className="w-full text-left"
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`font-mono text-xs ${
                      task.status === "processing"
                        ? "text-cyan-400"
                        : "text-slate-500"
                    }`}
                  >
                    #{task.external_id ?? task.id}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">
                    {timestamp}
                  </span>
                </div>
                <div className="flex items-center justify-between pr-6">
                  <h3 className="text-sm text-slate-200 font-medium truncate mb-2 group-hover:text-white transition-colors">
                    {task.title}
                  </h3>
                </div>
                <StatusBadge status={task.status} />
              </button>
              {onDeleteTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="absolute top-3 right-3 text-red-400 hover:text-red-200 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
