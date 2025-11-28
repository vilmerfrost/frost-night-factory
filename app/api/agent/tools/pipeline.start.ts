// API route for start_pipeline tool
import { NextResponse } from "next/server";
import { nextPipelineStage } from "@/lib/agent/pipeline";

export async function POST(req: Request) {
  try {
    const { task_id } = await req.json();

    if (!task_id) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    const result = await nextPipelineStage(task_id, "planner");
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to start pipeline" },
      { status: 500 }
    );
  }
}

