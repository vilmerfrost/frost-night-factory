import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, prompt, reference_images } = body; // Tar nu emot bilder

    const taskTitle = title || "Untitled Task";
    const taskPrompt = prompt || "Hello Night Factory!";

    // Insert task with images
    const { data: task, error: taskError } = await supabase
      .from("night_tasks")
      .insert({
        title: taskTitle,
        prompt: taskPrompt,
        status: "pending",
        reference_images: reference_images || [] // Spara Base64-arrayen
      })
      .select()
      .single();

    if (taskError) {
        console.error("DB Error:", taskError);
        return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

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

  } catch (e) {
    console.error("Server Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

