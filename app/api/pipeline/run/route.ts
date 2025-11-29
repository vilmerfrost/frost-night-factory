import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { canRunAgent, createAgentRunLog, markAgentCompleted } from "@/lib/nightFactory/pipelineController";
import type { AgentRole } from "@/lib/nightFactory/pipelineTypes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, stage, content } = body;

    if (!taskId || !stage || !content) {
      return NextResponse.json(
        { error: "Missing taskId, stage, or content" },
        { status: 400 }
      );
    }

    // 1. Fetch latest run for this task (must match the stage being processed)
    const { data: lastRun, error: fetchError } = await supabase
      .from("night_task_runs")
      .select("*")
      .eq("task_id", taskId)
      .eq("stage", stage)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching last run:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!lastRun) {
      return NextResponse.json(
        { error: `No ${stage} run found for this task` },
        { status: 404 }
      );
    }

    // Ensure we're updating the correct run (must be processing or pending)
    if (lastRun.status !== "processing" && lastRun.status !== "pending") {
      return NextResponse.json(
        { error: `Run ${lastRun.id} is not in a processable state (status: ${lastRun.status})` },
        { status: 400 }
      );
    }

    // STRICT AGENT PROTOCOL: Check if agent can run
    const allowed = await canRunAgent(taskId, stage as AgentRole);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Agent blocked: this role has already completed or pipeline order violated.",
        },
        { status: 400 }
      );
    }

    // Create agent run log
    let agentRunLog;
    try {
      agentRunLog = await createAgentRunLog(taskId, lastRun.id, stage as AgentRole);
    } catch (logError: any) {
      console.error("Failed to create agent run log:", logError);
      // Continue anyway - log is optional for debugging
    }

    // 2. Determine next stage
    // Vi lägger till : Record<string, string | null> för att göra TypeScript nöjd
    const nextStageMap: Record<string, string | null> = {
      planner: "coder",
      coder: "reviewer",
      reviewer: null,
    };
    const nextStage = nextStageMap[stage];

    // Get previous stage output for diff viewer
    let previousOutput = null;
    if (stage === "coder" || stage === "reviewer") {
      const { data: previousRuns } = await supabase
        .from("night_task_runs")
        .select("cleaned_output, stage")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (previousRuns && previousRuns.length > 0) {
        const previousStage = stage === "coder" ? "planner" : "coder";
        const prevRun = previousRuns.find((r) => r.stage === previousStage);
        if (prevRun && prevRun.cleaned_output) {
          previousOutput = prevRun.cleaned_output;
        }
      }
    }

    // Clean the output (remove prompts, metadata, etc.)
    // Inline clean function to avoid import issues
    const cleanModelOutput = (output: string): string => {
      if (!output) return "";
      let cleaned = output;
      // Remove system echoes
      cleaned = cleaned.replace(/^(User:|Assistant:|System:).*/gim, "");
      // Extract content from markdown code blocks
      const codeBlockMatch = cleaned.match(/```(?:tsx|ts|jsx|js|typescript|javascript)?\n?([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim();
      } else {
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => {
          return block.replace(/```.*?\n/, "").replace(/```$/, "");
        });
      }
      // Remove prompt mirrors
      if (cleaned.trim().startsWith("THIS IS A VALIDATION TASK")) {
        cleaned = cleaned.split("\n").slice(1).join("\n");
      }
      // Remove common AI meta-responses
      const metaPhrases = [
        /^Understood.*?\n/gi,
        /^Waiting for instructions.*?\n/gi,
        /^Acknowledged.*?\n/gi,
        /^Here is what I will do.*?\n/gi,
        /^I'll.*?\n/gi,
        /^Let me.*?\n/gi,
      ];
      metaPhrases.forEach((phrase) => {
        cleaned = cleaned.replace(phrase, "");
      });
      return cleaned.trim();
    };

    const cleanedOutput = cleanModelOutput(content);

    // 3. Update current run with output
    const { error: updateError } = await supabase
      .from("night_task_runs")
      .update({
        output: content,
        cleaned_output: cleanedOutput,
        previous_output: previousOutput,
        status: "completed",
        files: [],
      })
      .eq("id", lastRun.id);

    // Mark agent as completed in strict protocol
    if (agentRunLog) {
      await markAgentCompleted(
        taskId,
        stage as AgentRole,
        lastRun.id,
        agentRunLog.id,
        "completed"
      );
    }

    if (updateError) {
      console.error("Error updating run:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Save into conversation
    await supabase.from("night_task_messages").insert({
      task_id: taskId,
      role: "assistant",
      content: cleanedOutput,
    });

    // 4. If reviewer is done → close the task
    if (stage === "reviewer") {
      await supabase
        .from("night_tasks")
        .update({ status: "completed" })
        .eq("id", taskId);

      // Save to storage
      try {
        await supabase.storage
          .from("night_factory_outputs")
          .upload(`task_${taskId}/reviewer.md`, cleanedOutput, {
            contentType: "text/markdown",
          });
      } catch (err) {
        console.error("Failed to save to storage:", err);
      }

      return NextResponse.json({
        message: "Task completed",
        completed: true,
      });
    }

    // 5. Otherwise → create next stage run
    if (!nextStage) {
      return NextResponse.json(
        { error: "Invalid stage transition" },
        { status: 400 }
      );
    }

    // Get the prompt for the next stage
    const rolePrompts: Record<string, string> = {
      planner:
        "You are a senior planner. Convert this user task into clear, numbered steps.\n\nDo NOT produce code. Only produce a structured plan.",
      coder:
        "You are a coding agent. Produce optimal code and technical implementation.\n\nWrite the complete .tsx file in a code block. No explanations, ONLY the code.",
      reviewer:
        "You are the Reviewer. You MUST return corrected final code.\n\nAbsolutely forbidden to say phrases like:\n- 'Understood'\n- 'Waiting for instructions'\n- 'Acknowledged'\n- 'Here is what I will do'\n\nFix and validate the .tsx file. Return ONLY the final .tsx file inside a single ```tsx codeblock. No commentary, no explanation. DO NOT WAIT FOR USER INPUT. DO NOT SAY YOU ARE READY.",
    };

    const nextPrompt = `${rolePrompts[nextStage]}\n\nUSER INPUT:\n${cleanedOutput}`;

    const { data: nextRun, error: insertError } = await supabase
      .from("night_task_runs")
      .insert({
        task_id: taskId,
        stage: nextStage,
        status: "pending",
        input: cleanedOutput,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating next run:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Stage completed",
      nextRun,
    });
  } catch (error: any) {
    console.error("Pipeline run error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

