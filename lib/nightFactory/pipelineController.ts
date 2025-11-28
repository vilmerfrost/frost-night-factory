// lib/nightFactory/pipelineController.ts
import { createClient } from "@supabase/supabase-js";
import { AgentRole } from "./pipelineTypes";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function ensurePipelineState(taskId: number) {
  const { data, error } = await supabase
    .from("night_factory_pipeline_state")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("night_factory_pipeline_state")
      .insert({ task_id: taskId })
      .select()
      .single();

    if (insertError) throw insertError;
    return inserted;
  }

  return data;
}

export async function canRunAgent(taskId: number, role: AgentRole): Promise<boolean> {
  const state = await ensurePipelineState(taskId);

  // Check if role has already completed
  if (state[`${role}_completed`]) {
    return false;
  }

  // Enforce strict order: planner -> coder -> reviewer
  if (role === "coder" && !state.planner_completed) return false;
  if (role === "reviewer" && (!state.planner_completed || !state.coder_completed)) {
    return false;
  }

  return true;
}

export async function markAgentCompleted(
  taskId: number,
  role: AgentRole,
  runId: number,
  agentRunId: number,
  status: "completed" | "failed",
  errorMessage?: string
) {
  const { error: stateError } = await supabase
    .from("night_factory_pipeline_state")
    .update({
      [`${role}_completed`]: status === "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("task_id", taskId);

  if (stateError) throw stateError;

  const { error: logError } = await supabase
    .from("night_factory_agent_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      error_message: errorMessage ?? null,
    })
    .eq("id", agentRunId);

  if (logError) throw logError;
}

export async function createAgentRunLog(
  taskId: number,
  runId: number,
  role: AgentRole
) {
  const { data, error } = await supabase
    .from("night_factory_agent_runs")
    .insert({
      task_id: taskId,
      run_id: runId,
      role,
      status: "processing",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

