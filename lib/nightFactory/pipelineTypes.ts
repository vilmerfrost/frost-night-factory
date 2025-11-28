// lib/nightFactory/pipelineTypes.ts

export type AgentRole = "planner" | "coder" | "reviewer";

export interface AgentRunLog {
  id: string;
  run_id: number;
  role: AgentRole;
  started_at: string;
  finished_at: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string | null;
}

export interface PipelineState {
  task_id: number;
  planner_completed: boolean;
  coder_completed: boolean;
  reviewer_completed: boolean;
}

