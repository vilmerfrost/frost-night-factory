"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Download, Trash2, FileIcon } from "lucide-react";

interface FileBrowserProps {
  runId: number | null;
}

export default function FileBrowser({ runId }: FileBrowserProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // List files from workspace root (no runId needed anymore)
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_files", dir: "" }),
      });

      if (res.ok) {
        const data = await res.json();
        setFiles(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    if (!runId) return;

    // Subscribe to file updates via Supabase Realtime
    const channel = supabaseBrowser
      .channel(`files-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "night_task_runs",
          filter: `task_id=eq.${runId}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    // Also listen for broadcast events
    const broadcastChannel = supabaseBrowser
      .channel(`files-broadcast-${runId}`)
      .on("broadcast", { event: "files_updated" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
      supabaseBrowser.removeChannel(broadcastChannel);
    };
  }, [runId]);

  async function deleteFile(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;

    try {
      await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_file", path: filename }),
      });

      load();
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  }

  async function downloadMD(filename: string) {
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_file", path: filename }),
      });

      if (!res.ok) throw new Error("Failed to read file");

      const data = await res.json();
      const content = data.content || "";

      const md = `# Frost Night Factory Export\n\n**File:** ${filename}\n\n\`\`\`\n${content}\n\`\`\``;

      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/\//g, "_") + ".md";
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download file:", error);
      alert("Failed to download file");
    }
  }

  // No longer need runId - we show all workspace files

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">📁 Frost File Browser</h2>
        <button
          onClick={load}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-400">No files generated yet</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between bg-zinc-900/50 px-3 py-2 rounded border border-zinc-800 hover:bg-zinc-800/50 transition"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm text-white truncate">{f}</span>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  className="text-cyan-400 hover:text-cyan-300 p-1"
                  onClick={() => downloadMD(f)}
                  title="Download as MD"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  className="text-red-400 hover:text-red-300 p-1"
                  onClick={() => deleteFile(f)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

