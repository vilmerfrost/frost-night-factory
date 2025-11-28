import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json();
  const { title, prompt } = body;

  // Use provided values or defaults
  const taskTitle = title || "Untitled Task";
  const taskPrompt = prompt || "Hello Night Factory!";

  const { data: task, error: taskError } = await supabase
    .from("night_tasks")
    .insert({
      title: taskTitle,
      prompt: taskPrompt,
      status: "pending",
    })
    .select()
    .single();

  if (taskError) return NextResponse.json({ error: taskError }, { status: 500 });

  // Create initial planner run
  const { error: runError } = await supabase
    .from("night_task_runs")
    .insert({
      task_id: task.id,
      stage: "planner",
      status: "pending",
      input: taskPrompt,
    });

  if (runError) {
    console.error("Failed to create initial planner run:", runError);
    // Don't fail the task creation, just log the error
  }

  return NextResponse.json(task);
}

