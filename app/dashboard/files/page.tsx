"use client";

import { Suspense } from "react";
import FileBrowser from "./FileBrowser";
import { useSearchParams } from "next/navigation";

// 1. Den inre komponenten som hanterar logiken
function FilesContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");

  return (
    <div className="h-full p-6">
      <FileBrowser runId={runId ? parseInt(runId) : null} />
    </div>
  );
}

// 2. Huvudkomponenten med Suspense-wrapper (Lösningen på byggfelet)
export default function FilesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500 animate-pulse">Loading file browser...</div>}>
      <FilesContent />
    </Suspense>
  );
}