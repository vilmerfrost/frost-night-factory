import { NextRequest, NextResponse } from "next/server";
import {
  buildConversationMarkdown,
  buildOutputMarkdown,
} from "@/lib/nightFactory/markdownExport";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { taskId, mode } = (await req.json()) as {
      taskId: number;
      mode: "output" | "conversation";
    };

    if (!taskId || !mode) {
      return NextResponse.json(
        { error: "taskId and mode are required" },
        { status: 400 }
      );
    }

    if (mode === "output") {
      // Get task and runs
      const { data: task } = await supabase
        .from("night_tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const { data: runs } = await supabase
        .from("night_task_runs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      const plannerOutput = runs?.find((r) => r.stage === "planner")?.cleaned_output || 
                            runs?.find((r) => r.stage === "planner")?.output;
      const coderOutput = runs?.find((r) => r.stage === "coder")?.cleaned_output || 
                         runs?.find((r) => r.stage === "coder")?.output;
      const reviewerOutput = runs?.find((r) => r.stage === "reviewer")?.cleaned_output || 
                            runs?.find((r) => r.stage === "reviewer")?.output;

      const markdown = buildOutputMarkdown({
        taskId,
        initialPrompt: task.prompt,
        plannerOutput: plannerOutput || undefined,
        coderOutput: coderOutput || undefined,
        reviewerOutput: reviewerOutput || undefined,
      });

      return new NextResponse(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="night-factory-output-task-${taskId}.md"`,
        },
      });
    }

    if (mode === "conversation") {
      const { data: messages, error } = await supabase
        .from("night_task_messages")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const markdown = buildConversationMarkdown(
        taskId,
        (messages || []).map((row: any) => ({
          role: row.role,
          content: row.content,
          timestamp: row.created_at,
        }))
      );

      return new NextResponse(markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="night-factory-convo-task-${taskId}.md"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error: any) {
    console.error("[export/markdown] error", error);
    return NextResponse.json(
      { error: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

