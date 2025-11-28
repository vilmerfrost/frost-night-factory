"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Play, Clock, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Ticket {
  id: string;
  type: "bug" | "feature";
  title: string;
  description: string;
  status: string;
  pipeline_id: string | null;
  created_at: string;
}

export default function FeatureRequestPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/tickets?type=feature&status=needs_human_review");
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      console.error("Error fetching feature requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handleStartPipeline = async (ticketId: string) => {
    setProcessingId(ticketId);
    
    try {
      console.log("🚀 Starting pipeline for ticket:", ticketId); // DEBUG

      // Se till att endpointen matchar din filstruktur!
      const res = await fetch("/api/agent/pipeline/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticketId }), // Skicka explicit som "ticketId"
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("❌ API Error:", error);
        throw new Error(error.error || "Failed to start pipeline");
      }

      const data = await res.json();
      console.log("✅ Pipeline started:", data.pipeline?.id);

      await fetchTickets(); // Refresh list
    } catch (error: any) {
      console.error("❌ Error starting pipeline:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (ticketId: string) => {
    if (!confirm("Are you sure you want to reject this feature request?")) {
      return;
    }

    try {
      const res = await fetch(`/api/tickets/${ticketId}/reject`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to reject ticket");
      }

      await fetchTickets(); // Refresh list
    } catch (error) {
      console.error("Error rejecting ticket:", error);
      alert("Error rejecting ticket");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading feature requests...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Feature Requests</h3>
        <span className="text-xs text-white/50 bg-yellow-500/20 px-2 py-1 rounded">
          Needs Review
        </span>
      </div>

      {tickets.length === 0 ? (
        <p className="text-white/50 text-sm">No feature requests pending review.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-sm mb-1">
                    {ticket.title}
                  </h4>
                  <p className="text-white/60 text-xs line-clamp-3">
                    {ticket.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleStartPipeline(ticket.id)}
                  disabled={processingId === ticket.id}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition",
                    "bg-cyan-500 hover:bg-cyan-600 text-white",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {processingId === ticket.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Start AI Pipeline
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleReject(ticket.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition bg-red-500/20 hover:bg-red-500/30 text-red-400"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

