"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface ExportButtonsProps {
  taskId: number;
}

export function ExportButtons({ taskId }: ExportButtonsProps) {
  const [loadingMode, setLoadingMode] = useState<"output" | "conversation" | null>(null);

  const handleDownload = async (mode: "output" | "conversation") => {
    setLoadingMode(mode);
    try {
      const res = await fetch("/api/night-factory/export/markdown", {
        method: "POST",
        body: JSON.stringify({ taskId, mode }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to export markdown");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const suffix = mode === "output" ? "output" : "conversation";
      a.href = url;
      a.download = `night-factory-${suffix}-task-${taskId}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Export error:", error);
      alert(`Failed to export: ${error.message}`);
    } finally {
      setLoadingMode(null);
    }
  };

  const label = (mode: "output" | "conversation") =>
    loadingMode === mode
      ? "Generating…"
      : mode === "output"
      ? "Download Output .md"
      : "Download Convo .md";

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleDownload("output")}
        disabled={!!loadingMode}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-500/30 transition disabled:opacity-50"
      >
        <Download className="w-3 h-3" />
        {label("output")}
      </button>
      <button
        onClick={() => handleDownload("conversation")}
        disabled={!!loadingMode}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-500/30 transition disabled:opacity-50"
      >
        <Download className="w-3 h-3" />
        {label("conversation")}
      </button>
    </div>
  );
}

