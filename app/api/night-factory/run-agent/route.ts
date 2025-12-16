import { NextRequest, NextResponse } from "next/server";
import type { AgentRole } from "@/lib/nightFactory/pipelineTypes";
import {
  canRunAgent,
  createAgentRunLog,
  markAgentCompleted,
} from "@/lib/nightFactory/pipelineController";
import { supabase } from "@/lib/supabase-server";

// This route enforces strict agent protocol
// Agents can only run once per task, in strict order: planner -> coder -> reviewer

export async function POST(req: NextRequest) {
  try {
    const { taskId, role, runId } = (await req.json()) as {
      taskId: number;
      role: AgentRole;
      runId: number;
    };

    if (!taskId || !role || !runId) {
      return NextResponse.json(
        { error: "taskId, role, and runId are required" },
        { status: 400 }
      );
    }

    // Check if agent can run (strict protocol)
    const allowed = await canRunAgent(taskId, role);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Agent blocked: this role has already completed or pipeline order violated.",
        },
        { status: 400 }
      );
    }

    // Create agent run log
    const log = await createAgentRunLog(taskId, runId, role);

    try {
      // The actual agent execution happens in worker.mjs or pipeline/run route
      // This route just enforces the protocol
      // Return success - the worker will handle the actual execution
      return NextResponse.json({
        success: true,
        agentRunId: log.id,
        message: `Agent ${role} approved for execution`,
      });
    } catch (err: any) {
      await markAgentCompleted(
        taskId,
        role,
        runId,
        log.id,
        "failed",
        err?.message ?? "unknown error"
      );
      throw err;
    }
  } catch (error: any) {
    console.error("[run-agent] error", error);
    return NextResponse.json(
      { error: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

