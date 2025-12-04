// app/api/pipelines/[id]/retry/route.ts
// Dead Letter Queue: Retry failed_hard pipelines
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pipelineId = params.id;

    if (!pipelineId) {
      return NextResponse.json(
        { error: "Pipeline ID is required" },
        { status: 400 }
      );
    }

    // Get pipeline
    const { data: pipeline, error: fetchError } = await supabase
      .from("pipelines")
      .select("status, retry_count, max_retries")
      .eq("id", pipelineId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching pipeline:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch pipeline" },
        { status: 500 }
      );
    }

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    // Validate can retry
    if (pipeline.status !== "failed_hard") {
      return NextResponse.json(
        {
          error: "Only failed_hard pipelines can be retried",
          current_status: pipeline.status,
        },
        { status: 400 }
      );
    }

    if (pipeline.retry_count >= pipeline.max_retries) {
      return NextResponse.json(
        {
          error: "Max retries exceeded. Increase max_retries first.",
          retry_count: pipeline.retry_count,
          max_retries: pipeline.max_retries,
        },
        { status: 400 }
      );
    }

    // Reset pipeline to pending using state machine
    const { error: updateError } = await supabase
      .from("pipelines")
      .update({
        status: "pending",
        current_phase: "research",
        last_error: null,
        retry_count: pipeline.retry_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pipelineId);

    if (updateError) {
      console.error("Error updating pipeline:", updateError);
      return NextResponse.json(
        { error: "Failed to reset pipeline" },
        { status: 500 }
      );
    }

    // Reset all steps to pending
    const { error: stepsError } = await supabase
      .from("pipeline_steps")
      .update({
        status: "pending",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("pipeline_id", pipelineId);

    if (stepsError) {
      console.error("Error resetting steps:", stepsError);
      // Continue anyway - pipeline is reset
    }

    return NextResponse.json({
      success: true,
      message: "Pipeline reset to pending state",
      retry_count: pipeline.retry_count + 1,
      pipeline_id: pipelineId,
    });
  } catch (err: any) {
    console.error("Unexpected error in /api/pipelines/[id]/retry", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}

