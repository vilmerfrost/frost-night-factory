// lib/agent/protocol.mjs (ESM version for worker.mjs)
export function validateAgentAction(action) {
  if (!action || typeof action !== "object" || !action.action) {
    return false;
  }

  const validActions = [
    "write_file",
    "read_file",
    "list_files",
    "delete_file",
    "start_pipeline",
    "next_stage",
    "complete_task",
    "ui_toast",
    "ai_summary",
  ];

  if (!validActions.includes(action.action)) {
    return false;
  }

  // Validate required fields for each action type
  switch (action.action) {
    case "write_file":
      return typeof action.path === "string" && typeof action.content === "string";
    case "read_file":
    case "delete_file":
      return typeof action.path === "string";
    case "list_files":
      return typeof action.dir === "string";
    case "start_pipeline":
    case "complete_task":
      return typeof action.task_id === "number";
    case "next_stage":
      return (
        typeof action.task_id === "number" &&
        ["planner", "coder", "reviewer"].includes(action.stage)
      );
    case "ui_toast":
      return (
        typeof action.message === "string" &&
        ["success", "error", "info"].includes(action.type)
      );
    case "ai_summary":
      return typeof action.content === "string";
    default:
      return false;
  }
}

export function parseAgentResponse(text) {
  // Try to extract JSON from text (might be wrapped in code blocks)
  let jsonStr = text.trim();

  // Remove markdown code blocks
  jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Try to find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (validateAgentAction(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse agent response:", e);
  }

  return null;
}

