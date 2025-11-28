import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cleanModelOutput } from "./lib/ai/cleanOutput.mjs";
import { parseAgentResponse } from "./lib/agent/protocol.mjs";

// === FALLBACK MODELS ===
const USE_FREE_ONLY = false;

const groqKey = process.env.GROQ_API_KEY;
const qwenKey = process.env.QWEN_API_KEY;

// Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Choose model
async function runModel(prompt) {
  try {
    if (!USE_FREE_ONLY) {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const res = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return res.response.text();
    }
  } catch (err) {
    console.log("Gemini failed → trying Groq");
  }

  // Try Groq
  try {
    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [{ role: "user", content: prompt }],
        }),
      }).then((r) => r.json());
      return res.choices[0].message.content;
    }
  } catch (err) {
    console.log("Groq failed → trying Qwen");
  }

  // Try Qwen
  try {
    if (qwenKey) {
      const res = await fetch(
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${qwenKey}`,
          },
          body: JSON.stringify({
            model: "qwen-max",
            messages: [{ role: "user", content: prompt }],
          }),
        }
      ).then((r) => r.json());
      return res.choices[0].message.content;
    }
  } catch (err) {
    console.log("Qwen failed → trying local");
  }

  // Try local Ollama
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2:7b",
        prompt,
      }),
    }).then((r) => r.json());
    return res.response;
  } catch (err) {
    console.log("All models failed");
    return "All AI engines failed.";
  }
}

// === GET PENDING TASK ===
async function getPendingTask() {
  const { data } = await supabase
    .from("night_tasks")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("id", { ascending: true })
    .limit(1);

  return data?.[0] || null;
}

// === MULTI-AGENT ===
const rolePrompt = {
  planner: `You are a senior planner. Convert this user task into clear, numbered steps.

IMPORTANT: You can return your response in TWO formats:
1. Plain text plan (legacy mode)
2. JSON action format (preferred):

{
  "action": "write_file",
  "path": "{runId}/planner/plan.md",
  "content": "Your structured plan here"
}

If you want to save your plan to a file, use the write_file action. Otherwise, return plain text.`,
  
  coder: `You are a coding agent. Produce optimal code and technical implementation.

IMPORTANT: You can return your response in TWO formats:
1. Plain code in markdown code block (legacy mode)
2. JSON action format (preferred):

{
  "action": "write_file",
  "path": "{runId}/coder/component.tsx",
  "content": "Your complete TypeScript/React code here"
}

Always use write_file action to save code files. Return ONLY valid JSON or code block.`,
  
  reviewer: `You are the Reviewer. You MUST return corrected final code.

IMPORTANT: Use JSON action format to save files:

{
  "action": "write_file",
  "path": "{runId}/reviewer/final.tsx",
  "content": "Your corrected final code here"
}

Absolutely forbidden to say phrases like:
- 'Understood'
- 'Waiting for instructions'
- 'Acknowledged'
- 'Here is what I will do'

Return ONLY valid JSON action or code block. No commentary, no explanation.`,
};

async function createRun(taskId, stage, input) {
  const { data } = await supabase
    .from("night_task_runs")
    .insert({
      task_id: taskId,
      stage,
      status: "pending",
      input,
    })
    .select()
    .single();
  return data;
}

async function markTaskAsCompleted(taskId) {
  await supabase.from("night_tasks").update({ status: "completed" }).eq("id", taskId);
  console.log("TASK COMPLETED");
}

async function getNextRunToProcess(task) {
  const { data: runs } = await supabase
    .from("night_task_runs")
    .select("*")
    .eq("task_id", task.id)
    .order("created_at", { ascending: true });

  if (!runs || runs.length === 0) {
    // No runs exist - create planner
    return await createRun(task.id, "planner", task.prompt);
  }

  const planner = runs.find((r) => r.stage === "planner");
  const coder = runs.find((r) => r.stage === "coder");
  const reviewer = runs.find((r) => r.stage === "reviewer");

  // Check stage transitions with EXACT logic
  if (planner && planner.status === "pending") {
    return planner;
  }

  if (planner && planner.status === "completed") {
    if (!coder) {
      return await createRun(task.id, "coder", planner.output);
    }
    if (coder.status === "pending") {
      return coder;
    }
  }

  if (coder && coder.status === "completed") {
    if (!reviewer) {
      return await createRun(task.id, "reviewer", coder.output);
    }
    if (reviewer.status === "pending") {
      return reviewer;
    }
  }

  if (reviewer && reviewer.status === "completed") {
    // Validate reviewer output contains code block
    if (!reviewer.output || !reviewer.output.includes("```")) {
      console.log(
        "Reviewer failed to return final code. Marking run as failed."
      );
      await supabase
        .from("night_task_runs")
        .update({ status: "failed" })
        .eq("id", reviewer.id);
      return null;
    }
    await markTaskAsCompleted(task.id);
    return null;
  }

  // If we get here, something is processing or failed - wait
  return null;
}

async function executeAgentAction(action, runId) {
  // Replace {runId} placeholder in paths
  if (action.path && action.path.includes("{runId}")) {
    action.path = action.path.replace("{runId}", runId.toString());
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  try {
    const res = await fetch(`${baseUrl}/api/agent/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Agent action failed");
    }

    return await res.json();
  } catch (error) {
    console.error(`Failed to execute agent action ${action.action}:`, error.message);
    throw error;
  }
}

async function processRun(run, task) {
  // Update status to processing/running
  await supabase
    .from("night_task_runs")
    .update({ status: "processing" })
    .eq("id", run.id);

  // Get previous stage output for diff viewer
  let previousOutput = null;
  if (run.stage === "coder" || run.stage === "reviewer") {
    const { data: previousRuns } = await supabase
      .from("night_task_runs")
      .select("cleaned_output, stage")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    
    if (previousRuns && previousRuns.length > 0) {
      const previousStage = run.stage === "coder" ? "planner" : "coder";
      const prevRun = previousRuns.find((r) => r.stage === previousStage);
      if (prevRun && prevRun.cleaned_output) {
        previousOutput = prevRun.cleaned_output;
      }
    }
  }

  // Build prompt with runId placeholder
  const promptWithRunId = rolePrompt[run.stage].replace(/{runId}/g, run.id.toString());
  const prompt = `${promptWithRunId}\n\nUSER INPUT:\n${run.input}`;

  try {
    const rawOutput = await runModel(prompt);

    // Try to parse as agent action first
    const agentAction = parseAgentResponse(rawOutput);
    
    let cleanedOutput = "";
    let outputContent = rawOutput;

    if (agentAction) {
      console.log(`✓ Agent returned action: ${agentAction.action}`);
      
      // Execute the agent action
      try {
        await executeAgentAction(agentAction, run.id);
        
        // Extract content from action for output display
        if (agentAction.action === "write_file") {
          outputContent = agentAction.content;
          cleanedOutput = cleanModelOutput(agentAction.content);
        } else {
          // For other actions, use the raw output
          cleanedOutput = cleanModelOutput(rawOutput);
        }
      } catch (actionError) {
        console.error(`✗ Agent action failed:`, actionError.message);
        // Fallback to legacy behavior
        cleanedOutput = cleanModelOutput(rawOutput);
      }
    } else {
      // Legacy mode: no agent action, just clean the output
      cleanedOutput = cleanModelOutput(rawOutput);
    }

    // Validate reviewer output
    if (run.stage === "reviewer") {
      const hasCode = rawOutput?.includes("```") || 
                     agentAction?.action === "write_file" ||
                     cleanedOutput?.trim().length > 0;
      
      if (!hasCode) {
        console.log(
          "Reviewer failed to return final code. Marking run as failed."
        );
        await supabase
          .from("night_task_runs")
          .update({
            status: "failed",
            output: rawOutput || "No output generated",
            cleaned_output: cleanedOutput || "No output generated",
            previous_output: previousOutput,
            files: [],
          })
          .eq("id", run.id);
        return;
      }
    }

    // Save output with cleaned_output and previous_output
    await supabase
      .from("night_task_runs")
      .update({
        status: "completed",
        output: outputContent || rawOutput,
        cleaned_output: cleanedOutput,
        previous_output: previousOutput,
        files: agentAction?.action === "write_file" ? [agentAction.path] : [],
      })
      .eq("id", run.id);

    // Save into conversation (use cleaned output)
    await supabase.from("night_task_messages").insert({
      task_id: task.id,
      role: "assistant",
      content: cleanedOutput,
    });

    // If reviewer is complete, save to storage
    if (run.stage === "reviewer") {
      try {
        await supabase.storage
          .from("night_factory_outputs")
          .upload(`task_${task.id}/reviewer.md`, cleanedOutput, {
            contentType: "text/markdown",
          });
        console.log(`✓ Saved reviewer output to storage for task ${task.id}`);
      } catch (err) {
        console.error(`✗ Failed to save to storage:`, err.message);
      }
    }

    console.log(`✓ Completed ${run.stage} for task ${task.id}`);
  } catch (err) {
    console.error(`✗ Error processing ${run.stage}:`, err.message);

    // Handle rate limiting - reset to pending for retry
    if (err.message?.includes("429") || err.status === 429) {
      console.log(`Rate limited, resetting ${run.stage} to pending`);
      await supabase
        .from("night_task_runs")
        .update({ status: "pending" })
        .eq("id", run.id);
      return;
    }

    // Mark as failed for other errors
    const errorMessage = err.message || "Unknown error";
    await supabase
      .from("night_task_runs")
      .update({
        status: "failed",
        output: errorMessage,
        cleaned_output: `Error in ${run.stage}: ${errorMessage}`,
        previous_output: previousOutput,
        files: [],
      })
      .eq("id", run.id);
  }
}

async function loop() {
  try {
    const task = await getPendingTask();
    if (!task) {
      return;
    }

    await supabase.from("night_tasks").update({ status: "processing" }).eq("id", task.id);

    const run = await getNextRunToProcess(task);
    if (!run) {
      return;
    }

    // Only process if status is pending
    if (run.status !== "pending") {
      return;
    }

    console.log(`Processing: ${run.stage} for task ${task.id}`);
    await processRun(run, task);
  } catch (err) {
    console.error("Error in main loop:", err.message);
  }
}

setInterval(loop, 2500);
