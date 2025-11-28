import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

// === MULTI-AGENT ===
const rolePrompt = {
  planner:
    "You are a senior planner. Convert this user task into clear, numbered steps.\n\nDo NOT produce code. Only produce a structured plan.",
  coder:
    "You are a coding agent. Produce optimal code and technical implementation.\n\nWrite the complete .tsx file in a code block. No explanations, ONLY the code.",
  reviewer:
    "You are the Reviewer. You MUST return corrected final code.\n\nAbsolutely forbidden to say phrases like:\n- 'Understood'\n- 'Waiting for instructions'\n- 'Acknowledged'\n- 'Here is what I will do'\n\nFix and validate the .tsx file. Return ONLY the final .tsx file inside a single ```tsx codeblock. No commentary, no explanation. DO NOT WAIT FOR USER INPUT. DO NOT SAY YOU ARE READY.",
};

async function runPipelineWorker() {
  // 1. Get next pending run
  const { data: run, error } = await supabase
    .from("night_task_runs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching run:", error);
    return "error";
  }

  if (!run) {
    return "no pending tasks";
  }

  console.log(`🔥 Running stage: ${run.stage} for task ${run.task_id}`);

  // 2. Update status to processing
  await supabase
    .from("night_task_runs")
    .update({ status: "processing" })
    .eq("id", run.id);

  // 3. Build prompt
  const prompt = `${rolePrompt[run.stage]}\n\nUSER INPUT:\n${run.input}`;

  try {
    // 4. Call model
    const output = await runModel(prompt);

    // 5. Call backend controller
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/pipeline/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: run.task_id,
        stage: run.stage,
        content: output,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "API call failed");
    }

    const result = await response.json();
    console.log(`✓ ${run.stage} completed:`, result.message);

    return "done";
  } catch (err) {
    console.error(`✗ Error processing ${run.stage}:`, err.message);

    // Handle rate limiting - reset to pending for retry
    if (err.message?.includes("429") || err.message?.includes("rate limit")) {
      console.log(`Rate limited, resetting ${run.stage} to pending`);
      await supabase
        .from("night_task_runs")
        .update({ status: "pending" })
        .eq("id", run.id);
      return "rate_limited";
    }

    // Mark as failed
    await supabase
      .from("night_task_runs")
      .update({
        status: "failed",
        output: err.message || "Unknown error",
        cleaned_output: `Error in ${run.stage}: ${err.message || "Unknown error"}`,
        files: [],
      })
      .eq("id", run.id);

    return "failed";
  }
}

// Main loop
async function main() {
  while (true) {
    await runPipelineWorker();
    await new Promise((resolve) => setTimeout(resolve, 2500)); // Poll every 2.5s
  }
}

main();

