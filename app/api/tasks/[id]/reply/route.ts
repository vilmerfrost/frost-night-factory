import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const taskId = parseInt(params.id);
  const body = await req.json();
  const { content } = body;

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Create user message
  const { data: message, error } = await supabase
    .from("night_task_messages")
    .insert({
      task_id: taskId,
      role: "user",
      content,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-start task processing when user replies
  await supabase.from("night_tasks").update({ status: "pending" }).eq("id", taskId);

  return NextResponse.json(message);
}

