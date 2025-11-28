// lib/agent/types.ts

export type AgentAction =
  | {
      action: "write_file";
      path: string;
      content: string;
    }
  | {
      action: "read_file";
      path: string;
    }
  | {
      action: "list_files";
      dir: string;
    }
  | {
      action: "delete_file";
      path: string;
    }
  | {
      action: "start_pipeline";
      task_id: number;
    }
  | {
      action: "next_stage";
      task_id: number;
      stage: "planner" | "coder" | "reviewer";
    }
  | {
      action: "complete_task";
      task_id: number;
    }
  | {
      action: "ui_toast";
      message: string;
      type: "success" | "error" | "info";
    }
  | {
      action: "ai_summary";
      content: string;
    };

