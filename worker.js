import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function runLoop() {
  // get next pending task
  const { data: tasks } = await supabase
    .from("night_tasks")
    .select("*")
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(1);

  if (!tasks || tasks.length === 0) {
    console.log("No pending tasks.");
    return;
  }

  const task = tasks[0];

  await supabase
    .from("night_tasks")
    .update({ status: "processing" })
    .eq("id", task.id);

  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const start = Date.now();

  const result = await model.generateContent(task.prompt);
  const output = result.response.text();

  const duration_ms = Date.now() - start;

  await supabase
    .from("night_tasks")
    .update({
      status: "completed",
      output,
      duration_ms,
      model: "gemini-pro",
    })
    .eq("id", task.id);

  console.log("Completed:", task.id);
}

async function main() {
  while (true) {
    await runLoop();
    await new Promise((res) => setTimeout(res, 4000)); // poll every 4s
  }
}

main();

