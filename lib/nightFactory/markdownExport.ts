// lib/nightFactory/markdownExport.ts
import type { AgentRole } from "./pipelineTypes";

export interface ConversationTurn {
  role: "user" | "assistant" | AgentRole;
  content: string;
  timestamp: string;
}

export interface PipelineArtifacts {
  taskId: number;
  initialPrompt: string;
  plannerOutput?: string;
  coderOutput?: string;
  reviewerOutput?: string;
}

export function buildOutputMarkdown(artifacts: PipelineArtifacts): string {
  const lines: string[] = [];

  lines.push(`# Night Factory Run – Task ${artifacts.taskId}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Initial Prompt");
  lines.push("");
  lines.push("```");
  lines.push(artifacts.initialPrompt.trim());
  lines.push("```");
  lines.push("");

  if (artifacts.plannerOutput) {
    lines.push("## Planner Output");
    lines.push("");
    lines.push("```");
    lines.push(artifacts.plannerOutput.trim());
    lines.push("```");
    lines.push("");
  }

  if (artifacts.coderOutput) {
    lines.push("## Coder Output");
    lines.push("");
    lines.push("```tsx");
    lines.push(artifacts.coderOutput.trim());
    lines.push("```");
    lines.push("");
  }

  if (artifacts.reviewerOutput) {
    lines.push("## Reviewer Output");
    lines.push("");
    lines.push("```tsx");
    lines.push(artifacts.reviewerOutput.trim());
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildConversationMarkdown(
  taskId: number,
  convo: ConversationTurn[]
): string {
  const lines: string[] = [];

  lines.push(`# Night Factory Conversation – Task ${taskId}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const turn of convo) {
    const label =
      turn.role === "user"
        ? "User"
        : turn.role === "assistant"
        ? "Assistant"
        : turn.role.toUpperCase();

    lines.push(`### ${label} – ${new Date(turn.timestamp).toLocaleString()}`);
    lines.push("");
    lines.push(turn.content.trim());
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

