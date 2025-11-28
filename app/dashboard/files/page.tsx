"use client";

import FileBrowser from "./FileBrowser";
import { useSearchParams } from "next/navigation";

export default function FilesPage() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");

  return (
    <div className="h-full p-6">
      <FileBrowser runId={runId ? parseInt(runId) : null} />
    </div>
  );
}

