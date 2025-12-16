"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface Message {
  id: number;
  task_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface TaskMessagesProps {
  taskId: number | null;
}

export default function TaskMessages({ taskId }: TaskMessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  async function load() {
    if (!taskId) return;

    const { data } = await supabaseBrowser
      .from("night_task_messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  }

  useEffect(() => {
    load();

    if (!taskId) return;

    const channel = supabaseBrowser
      .channel("task_msgs_" + taskId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "night_task_messages",
          filter: `task_id=eq.${taskId}`,
        },
        (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: unknown; old: unknown }) => {
          if (payload.new) {
            setMessages((prev) => {
              const newMessage = payload.new as Message;
              // Check if message already exists
              const exists = prev.find((m) => m.id === newMessage.id);
              if (exists) {
                return prev.map((m) =>
                  m.id === newMessage.id ? newMessage : m
                );
              }
              return [...prev, newMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [taskId]);

  if (!taskId) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
        Conversation
      </h3>
      <div className="bg-[#0d1117] p-3 rounded-lg h-64 overflow-y-auto text-sm space-y-2 custom-scrollbar">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No messages yet. Start a conversation!
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded ${
                m.role === "user"
                  ? "bg-blue-800/40 border border-blue-500/20"
                  : "bg-green-800/40 border border-green-500/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <b className="text-[10px] uppercase text-slate-300">
                  {m.role === "user" ? "You" : "Assistant"}
                </b>
                <span className="text-[10px] text-slate-600 font-mono">
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-slate-200 font-mono whitespace-pre-wrap">
                {m.content}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

