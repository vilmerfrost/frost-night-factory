// Shared types for Frost Night Factory

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
  id: number;
  external_id: string | null;
  title: string;
  prompt: string;
  status: TaskStatus;
  output: string | null;
  model: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

