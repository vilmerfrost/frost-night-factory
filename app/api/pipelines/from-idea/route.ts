// app/api/pipelines/from-idea/route.ts
// v0.1: Create pipeline from idea prompt
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ideaPrompt } = body;

    if (!name || !ideaPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, ideaPrompt" },
        { status: 400 }
      );
    }

    // Get user (optional - don't crash if unauthenticated)
    // const supabaseClient = createRouteHandlerClient({ cookies });
    // const { data: { user } } = await supabaseClient.auth.getUser();
    const user = null; // For v0.1, skip auth

    // ✅ ATOMIC PIPELINE CREATION: Use RPC function for ACID-compliant transaction
    let pipeline;
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "create_pipeline_atomic",
        {
          p_name: name,
          p_initial_prompt: ideaPrompt,
          p_status: "pending",
          p_current_phase: "research",
          p_max_retries: 10,
          p_created_by: (user as any)?.id ?? null,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!rpcResult || rpcResult.length === 0) {
        throw new Error("RPC returned no data");
      }

      const pipelineId = rpcResult[0].pipeline_id;

      // Fetch the created pipeline
      const { data: fetchedPipeline, error: fetchError } = await supabase
        .from("pipelines")
        .select("*")
        .eq("id", pipelineId)
        .single();

      if (fetchError || !fetchedPipeline) {
        throw new Error(
          `Failed to fetch created pipeline: ${fetchError?.message || "Not found"}`
        );
      }

      pipeline = fetchedPipeline;
    } catch (rpcError: any) {
      // Fallback to manual creation if RPC is not available
      console.warn(
        "⚠️ RPC function not available, falling back to manual creation:",
        rpcError.message
      );

      const { data: createdPipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .insert({
          name,
          initial_prompt: ideaPrompt,
          status: "pending",
          current_phase: "research",
          max_retries: 10,
          retry_count: 0,
          created_by: (user as any)?.id ?? null,
        })
        .select("*")
        .single();

      if (pipelineError) {
        console.error("Error creating pipeline:", pipelineError);
        return NextResponse.json(
          { error: "Failed to create pipeline" },
          { status: 500 }
        );
      }

      // Create ALL steps upfront (prevents PGRST116 errors)
      const steps = [
        {
          phase: "research",
          status: "pending",
          input: { initialPrompt: ideaPrompt },
        },
        { phase: "planner", status: "pending", input: {} },
        { phase: "coder", status: "pending", input: {} },
        { phase: "tester", status: "pending", input: {} },
        { phase: "publisher", status: "pending", input: {} },
      ].map((step) => ({
        pipeline_id: createdPipeline.id,
        phase: step.phase,
        status: step.status,
        input: step.input,
        output: {},
      }));

      const { error: stepsError } = await supabase
        .from("pipeline_steps")
        .insert(steps);

      if (stepsError) {
        // Rollback pipeline if steps fail
        console.error("Error creating pipeline steps:", stepsError);
        await supabase.from("pipelines").delete().eq("id", createdPipeline.id);
        return NextResponse.json(
          { error: "Failed to create pipeline steps" },
          { status: 500 }
        );
      }

      pipeline = createdPipeline;
    }

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/pipelines/from-idea", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

