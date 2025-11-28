import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { summarizeText } from "@/lib/nightFactory/modelClient";

export async function POST(req: NextRequest) {
  try {
    const { taskId } = (await req.json()) as { taskId: number };

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    // Get runs for this task
    const { data: runs, error: runsError } = await supabase
      .from("night_task_runs")
      .select("stage, cleaned_output, output")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (runsError) {
      return NextResponse.json({ error: runsError.message }, { status: 500 });
    }

    // Get task prompt
    const { data: task } = await supabase
      .from("night_tasks")
      .select("prompt")
      .eq("id", taskId)
      .single();

    // Build full text from all stages
    const parts: string[] = [];
    
    if (task?.prompt) {
      parts.push(`Initial Prompt: ${task.prompt}`);
    }

    runs?.forEach((run) => {
      const output = run.cleaned_output || run.output;
      if (output) {
        parts.push(`${run.stage.toUpperCase()} Output: ${output}`);
      }
    });

    const fullText = parts.join("\n\n");

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: "No content found to summarize" },
        { status: 400 }
      );
    }

    const summary = await summarizeText(fullText);

    // Save summary to task (we'll add a summary column or use a separate table)
    // For now, we'll just return it

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error("[summary] error", error);
    return NextResponse.json(
      { error: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

