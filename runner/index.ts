// runner/index.ts
// v0.1: Pipeline Runner - Idea → MVP
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { runResearchPhase } from "./phases/research";
import { runPlannerPhase } from "./phases/planner";
import { runCoderPhase } from "./phases/coder";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const REPO_LOCAL_PATH = process.env.REPO_LOCAL_PATH || process.cwd();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Types
type Pipeline = {
  id: string;
  name: string;
  initial_prompt: string;
  status: string;
  current_phase: string | null;
};

type PipelineStep = {
  id: string;
  pipeline_id: string;
  phase: string;
  status: string;
  input: any;
  output: any;
  logs: string | null;
};

// Helper: Sleep
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: Append logs to step
async function appendStepLogs(stepId: string, message: string) {
  const { data: currentStep } = await supabase
    .from("pipeline_steps")
    .select("logs")
    .eq("id", stepId)
    .single();

  const existingLogs = currentStep?.logs || "";
  const newLogs = existingLogs + `[${new Date().toISOString()}] ${message}\n`;

  await supabase
    .from("pipeline_steps")
    .update({ logs: newLogs, updated_at: new Date().toISOString() })
    .eq("id", stepId);
}

// Helper: Update step status
async function updateStepStatus(
  stepId: string,
  status: string,
  patch?: { output?: any; logs?: string }
) {
  await supabase
    .from("pipeline_steps")
    .update({
      status,
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stepId);
}

// Helper: Update pipeline phase and status
async function updatePipelinePhaseStatus(
  pipelineId: string,
  phase: string,
  status: string
) {
  await supabase
    .from("pipelines")
    .update({
      current_phase: phase,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId);
}

// Core: Get next pending step with its pipeline
async function getNextPendingStep(): Promise<{
  step: PipelineStep;
  pipeline: Pipeline;
} | null> {
  const { data: step, error: stepError } = await supabase
    .from("pipeline_steps")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stepError || !step) {
    return null;
  }

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("*")
    .eq("id", step.pipeline_id)
    .single();

  if (pipelineError || !pipeline) {
    return null;
  }

  return { step, pipeline };
}

// Phase handlers

async function runResearchPhase(pipeline: Pipeline, step: PipelineStep) {
  console.log(`🔍 Running research phase for pipeline ${pipeline.id}`);
  await updateStepStatus(step.id, "running");
  await appendStepLogs(step.id, "🚀 Starting research phase...");

  try {
    const researchOutput = await runResearchPhase(pipeline.initial_prompt);
    await updateStepStatus(step.id, "completed", {
      output: researchOutput,
    });
    await appendStepLogs(step.id, "✅ Research completed");

    // Create next step: planner
    const { error: nextStepError } = await supabase
      .from("pipeline_steps")
      .insert({
        pipeline_id: pipeline.id,
        phase: "planner",
        status: "pending",
        input: {
          idea: pipeline.initial_prompt,
          research: researchOutput,
        },
      });

    if (nextStepError) {
      console.error("Error creating planner step:", nextStepError);
    }

    await updatePipelinePhaseStatus(pipeline.id, "planner", "running");
  } catch (error: any) {
    console.error("Research phase failed:", error);
    await updateStepStatus(step.id, "failed", {
      output: { error: error.message },
    });
    await appendStepLogs(step.id, `❌ Research failed: ${error.message}`);
    await updatePipelinePhaseStatus(pipeline.id, "research", "failed");
  }
}

async function runPlannerPhase(pipeline: Pipeline, step: PipelineStep) {
  console.log(`📋 Running planner phase for pipeline ${pipeline.id}`);
  await updateStepStatus(step.id, "running");
  await appendStepLogs(step.id, "🚀 Starting planner phase...");

  try {
    const plannerOutput = await runPlannerPhase(step.input);
    await updateStepStatus(step.id, "completed", {
      output: plannerOutput,
    });
    await appendStepLogs(step.id, "✅ Planner completed");

    // Create next step: coder
    const { error: nextStepError } = await supabase
      .from("pipeline_steps")
      .insert({
        pipeline_id: pipeline.id,
        phase: "coder",
        status: "pending",
        input: {
          spec: plannerOutput,
        },
      });

    if (nextStepError) {
      console.error("Error creating coder step:", nextStepError);
    }

    await updatePipelinePhaseStatus(pipeline.id, "coder", "running");
  } catch (error: any) {
    console.error("Planner phase failed:", error);
    await updateStepStatus(step.id, "failed", {
      output: { error: error.message },
    });
    await appendStepLogs(step.id, `❌ Planner failed: ${error.message}`);
    await updatePipelinePhaseStatus(pipeline.id, "planner", "failed");
  }
}

async function runCoderPhase(pipeline: Pipeline, step: PipelineStep) {
  console.log(`💻 Running coder phase for pipeline ${pipeline.id}`);
  await updateStepStatus(step.id, "running");
  await appendStepLogs(step.id, "🚀 Starting coder phase...");

  try {
    const coderOutput = await runCoderPhase(step.input.spec, REPO_LOCAL_PATH);
    await updateStepStatus(step.id, "completed", {
      output: coderOutput,
    });
    await appendStepLogs(
      step.id,
      `✅ Coder completed - generated ${coderOutput.files.length} files`
    );

    // Pipeline is complete in v0.1
    await updatePipelinePhaseStatus(pipeline.id, "coder", "completed");
  } catch (error: any) {
    console.error("Coder phase failed:", error);
    await updateStepStatus(step.id, "failed", {
      output: { error: error.message },
    });
    await appendStepLogs(step.id, `❌ Coder failed: ${error.message}`);
    await updatePipelinePhaseStatus(pipeline.id, "coder", "failed");
  }
}

// Main loop
async function run() {
  console.log("❄️  Frost Night Factory Pipeline Runner v0.1");
  console.log(`📁 Repo path: ${REPO_LOCAL_PATH}`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...\n`);

  while (true) {
    const result = await getNextPendingStep();

    if (!result) {
      await sleep(5000);
      continue;
    }

    const { step, pipeline } = result;

    console.log(`\n🎯 Processing step: ${step.phase} for pipeline ${pipeline.id}`);
    console.log(`📝 Pipeline: ${pipeline.name}`);

    try {
      switch (step.phase) {
        case "research":
          await runResearchPhase(pipeline, step);
          break;
        case "planner":
          await runPlannerPhase(pipeline, step);
          break;
        case "coder":
          await runCoderPhase(pipeline, step);
          break;
        default:
          console.error(`❌ Unknown phase: ${step.phase}`);
          await updateStepStatus(step.id, "failed", {
            output: { error: `Unknown phase: ${step.phase}` },
          });
      }
    } catch (error: any) {
      console.error(`❌ Error in phase ${step.phase}:`, error);
      await updateStepStatus(step.id, "failed", {
        output: { error: error.message },
      });
      await updatePipelinePhaseStatus(pipeline.id, step.phase, "failed");
    }

    console.log("⏳ Waiting for next step...\n");
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down gracefully...");
  process.exit(0);
});

run().catch((e) => {
  console.error("💥 Fatal runner error", e);
  process.exit(1);
});

