// lib/agent/runtime.ts
import { AgentAction } from "./types";
import { writeFile, readFile, listFiles, deleteFile, logToSystem } from "./tools";
import { nextPipelineStage } from "./pipeline";
import { summarizeText } from "@/lib/nightFactory/modelClient";
import { supabase } from "@/lib/supabase-server";

export async function executeAgentAction(action: AgentAction) {
  // Log all actions to system log
  console.log("🤖 Runtime executing:", action.action);
  
  // Build log message based on action type
  let logDetails = "";
  if ("path" in action) logDetails = action.path;
  else if ("dir" in action) logDetails = action.dir;
  else if ("stage" in action) logDetails = action.stage;
  else if ("task_id" in action) logDetails = `task_${action.task_id}`;
  else if ("message" in action) logDetails = action.message;
  else if ("content" in action) logDetails = `content_${action.content.slice(0, 20)}...`;
  
  await logToSystem(`🤖 ACTION: ${action.action} ${logDetails}`);

  switch (action.action) {
    case "write_file":
      await writeFile(action.path, action.content);
      // File updates will trigger realtime via Supabase storage events
      return { ok: true };

    case "read_file":
      return await readFile(action.path);

    case "list_files":
      return await listFiles(action.dir);

    case "delete_file":
      await deleteFile(action.path);
      // File updates will trigger realtime via Supabase storage events
      return { ok: true };

      case "start_pipeline":
        // Vi skickar "start_pipeline" som "stage" för att trigga första steget
        return await nextPipelineStage(action.task_id, "start_pipeline");
    case "next_stage":
      return await nextPipelineStage(action.task_id, action.stage);

    case "complete_task":
      await nextPipelineStage(action.task_id, "done");
      return { ok: true };

    case "ui_toast":
      // Toast notifications can be handled client-side
      // For now, just return success - client can handle display
      return { ok: true, message: action.message, type: action.type };

    case "ai_summary":
      const summary = await summarizeText(action.content);
      return {
        summary: summary.slice(0, 500),
      };

    default:
      return { error: "UNKNOWN_ACTION" };
  }
}

