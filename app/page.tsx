"use client";

import { useEffect, useState } from "react";
import TaskList from "./components/TaskList";
import TaskDetails from "./components/TaskDetails";
import FileBrowser from "./components/FileBrowser";
import LogViewer from "./components/LogViewer";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  id: number;
  external_id: string | null;
  title: string;
  prompt: string;
  status: TaskStatus;
  output: string | null;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Initial fetch
  async function loadTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data);
    if (data.length > 0 && selectedTaskId === null) {
      setSelectedTaskId(data[0].id);
    }
  }

  // Real-time listener
  useEffect(() => {
    loadTasks();

    const channel = supabaseBrowser
      .channel("night_tasks_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "night_tasks" },
        (payload) => {
          // Handle DELETE events
          if (payload.eventType === "DELETE" && payload.old && typeof payload.old === "object" && "id" in payload.old) {
            const deletedId = payload.old.id as number;
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
            // Clear selection if deleted task was selected
            if (selectedTaskId === deletedId) {
              setSelectedTaskId(null);
            }
          }
          // Handle INSERT/UPDATE events
          else if (payload.new && typeof payload.new === "object" && "id" in payload.new) {
            const newTask = payload.new as Task;
            setTasks((prev) => {
              const existing = prev.find((t) => t.id === newTask.id);
              if (existing) {
                return prev.map((t) => (t.id === newTask.id ? newTask : t));
              }
              return [newTask, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Top Bar */}
      <header className="flex justify-between items-center h-14 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            NIGHT FACTORY
            <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full border border-white/5 font-normal tracking-wide">
              BETA
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Autonomous development environment
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 rounded-full border border-white/5 shadow-lg backdrop-blur-sm">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              System Status
            </span>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400 font-bold tracking-wide">
                RUNNING
              </span>
            </div>
          </div>

          {/* New Task Button */}
          <button
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm px-6 py-2 rounded-md shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all duration-300 flex items-center gap-2"
            onClick={async () => {
              const title = window.prompt("Task title?");
              if (!title) return;

              const prompt = window.prompt("Task prompt for the AI?");
              if (!prompt) return;

              await fetch("/api/tasks/new", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, prompt }),
              });
              loadTasks();
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Task
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
        {/* Column 1: Queue */}
        <div className="col-span-3 h-full min-h-0">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onDeleteTask={async (id) => {
              try {
                const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
                if (res.ok) {
                  // If deleted task was selected, clear selection
                  if (selectedTaskId === id) {
                    setSelectedTaskId(null);
                  }
                  // Realtime will handle the update, but reload as fallback
                  loadTasks();
                } else {
                  console.error("Failed to delete task");
                }
              } catch (err) {
                console.error("Error deleting task:", err);
              }
            }}
          />
        </div>

        {/* Column 2: Details */}
        <div className="col-span-6 h-full min-h-0">
          <TaskDetails task={tasks.find((t) => t.id === selectedTaskId) ?? null} />
        </div>

        {/* Column 3: Files & Logs */}
        <div className="col-span-3 h-full min-h-0 flex flex-col gap-4">
          <FileBrowser taskId={selectedTaskId} />
          <LogViewer />
        </div>
      </div>
    </div>
  );
}
