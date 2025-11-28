// API route for next_stage tool
import { NextResponse } from "next/server";
import { nextPipelineStage } from "@/lib/agent/pipeline";

export async function POST(req: Request) {
  try {
    const { task_id, stage } = await req.json();

    if (!task_id || !stage) {
      return NextResponse.json(
        { error: "task_id and stage are required" },
        { status: 400 }
      );
    }

    const result = await nextPipelineStage(task_id, stage);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to advance pipeline" },
      { status: 500 }
    );
  }
}

