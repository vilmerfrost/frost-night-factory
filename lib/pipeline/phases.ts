// lib/pipeline/phases.ts
// Phase definitions and order for MVP Pipeline system

export const PHASE_ORDER = [
  "research",
  "planner",
  "coder",
  "prompt_architect",
  "external_tool_wait",
  "reviewer",
  "sql",
  "tester",
] as const;

export type PipelinePhase = typeof PHASE_ORDER[number];

export interface ResearchOutput {
  summary: string;
  user_segments: string[];
  similar_tools: string[];
  key_requirements: string[];
  tech_recommendations: {
    frontend: string;
    backend: string;
    auth: string;
    db_notes: string[];
  };
  key_insights?: string[];
  key_findings?: string[]; // For bug reports
  file_candidates?: string[]; // For bug reports
  api_considerations?: string[]; // For bug reports
  recommended_solution_shape?: string; // For bug reports
  references?: Array<{ title: string; url: string }>;
  risks?: string[];
  recommended_scope_for_mvp?: string[];
}

export interface PlannerOutput {
  app_name: string;
  stack: {
    frontend: string;
    backend: string;
    db_style: string;
  };
  entities: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      pk?: boolean;
      fk?: string;
      required?: boolean;
      enum?: string[];
    }>;
  }>;
  pages: Array<{
    route: string;
    type: string;
    description?: string;
    entity?: string;
  }>;
  api_endpoints: Array<{
    method: string;
    path: string;
    entity?: string;
  }>;
}

export interface CoderOutput {
  status?: "ok" | "need_external_help";
  reason?: string;
  patches?: Array<{
    file: string;
    operation: "replace" | "create" | "delete";
    old_snippet?: string;
    new_snippet: string;
  }>;
  notes?: string[];
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface PromptArchitectOutput {
  cursor_prompt: string;
  cursor_instructions: {
    branch_name: string;
    files_to_focus: string[];
    style_notes: string[];
  };
  human_short_explanation: string;
  risk_flags: string[];
}

export interface ReviewerOutput {
  summary: string[];
  file_changes: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;
  risks: string[];
  human_todos: string[];
}

export interface SqlOutput {
  migration_sql: string;
  migration_name: string;
}

export interface TesterOutput {
  test_results: string;
  passed: boolean;
  coverage?: number;
}

