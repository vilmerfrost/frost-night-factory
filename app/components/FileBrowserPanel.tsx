"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Loader2, FileIcon, Trash2, Eye, Download, Edit } from "lucide-react";
import clsx from "clsx";

interface FileItem {
  name: string;
  stage: string;
  path: string;
  created_at?: string;
  metadata?: {
    size?: number;
  };
}

interface FileBrowserPanelProps {
  runId: number | null;
}

export default function FileBrowserPanel({ runId }: FileBrowserPanelProps) {
  const [files, setFiles] = useState<Record<string, FileItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedStage, setSelectedStage] = useState<"planner" | "coder" | "reviewer" | "all">("all");

  const loadFiles = async () => {
    if (!runId) {
      setFiles({});
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/night-factory/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      const json = await res.json();
      if (json.files) {
        setFiles(json.files);
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // Poll every 2 seconds for real-time updates
    const interval = setInterval(loadFiles, 2000);
    return () => clearInterval(interval);
  }, [runId]);

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Delete ${file.name}?`)) return;

    try {
      const res = await fetch("/api/night-factory/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          stage: file.stage,
          filename: file.name,
        }),
      });

      if (res.ok) {
        loadFiles();
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const res = await fetch("/api/night-factory/files/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          stage: file.stage,
          filename: file.name,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const allFiles = Object.values(files).flat();
  const filteredFiles =
    selectedStage === "all"
      ? allFiles
      : allFiles.filter((f) => f.stage === selectedStage);

  const stages = ["planner", "coder", "reviewer"] as const;

  return (
    <div className="h-full flex flex-col bg-zinc-950/70 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest">
          Files
        </h2>
        {runId && (
          <button
            onClick={loadFiles}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Refresh
          </button>
        )}
      </div>

      {!runId ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-zinc-400">Select a run to view files</p>
        </div>
      ) : loading && allFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading files...</span>
        </div>
      ) : (
        <>
          {/* Stage Tabs */}
          <div className="flex gap-1 p-2 border-b border-zinc-800 bg-zinc-900/30">
            <button
              onClick={() => setSelectedStage("all")}
              className={clsx(
                "px-3 py-1 text-xs rounded transition",
                selectedStage === "all"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              All
            </button>
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => setSelectedStage(stage)}
                className={clsx(
                  "px-3 py-1 text-xs rounded transition capitalize",
                  selectedStage === stage
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {stage}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredFiles.length === 0 ? (
              <p className="text-sm text-zinc-400 p-4 text-center">
                No files generated for this run yet.
              </p>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between bg-zinc-800/40 px-3 py-2 rounded border border-zinc-700/40 hover:bg-zinc-800/60 transition group"
                >
                  <div className="flex items-center gap-2 text-zinc-200 flex-1 min-w-0">
                    <FileIcon className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-sm truncate">{file.name}</span>
                    {file.metadata?.size && (
                      <span className="text-xs text-zinc-500">
                        {(file.metadata.size / 1024).toFixed(1)}kb
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-1.5 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700/50 rounded transition"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-900/30 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

