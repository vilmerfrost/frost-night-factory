"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal } from "lucide-react";

export default function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const lastLogCountRef = useRef(0);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read_file", path: "_agent_logs.txt" }),
        });

        const data = await res.json();
        if (data.content) {
          // Dela upp rader och ta de sista 20
          const lines = data.content.split("\n").filter(Boolean);
          const newLogs = lines.slice(-20);
          
          // Check if new logs were added
          const hasNewLogs = newLogs.length > lastLogCountRef.current;
          lastLogCountRef.current = newLogs.length;
          
          setLogs(newLogs);
          
          // Only auto-scroll if user hasn't manually scrolled AND there are new logs
          if (!userHasScrolledRef.current && hasNewLogs && containerRef.current) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
              if (containerRef.current && !userHasScrolledRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }, 50);
          }
        }
      } catch (e) {
        // Ignorera fel (filen kanske inte finns än)
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1000); // Polla varje sekund
    return () => clearInterval(interval);
  }, []);

  // Track manual scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    // If user scrolls away from bottom, mark as manually scrolled
    if (!isAtBottom) {
      userHasScrolledRef.current = true;
    } else {
      // If user scrolls back to bottom, allow auto-scroll again
      userHasScrolledRef.current = false;
    }
  };

  return (
    <div className="bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs h-[200px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 text-zinc-500 mb-2 border-b border-zinc-900 pb-2">
        <Terminal className="w-3 h-3" />
        <span>SYSTEM LOGS (Realtime)</span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 custom-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic">No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-green-500/80 break-all">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

