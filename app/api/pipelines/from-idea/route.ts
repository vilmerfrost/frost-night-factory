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

    // Insert pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        name,
        initial_prompt: ideaPrompt,
        status: "pending",
        current_phase: "research",
        created_by: (user as any)?.id ?? null,      })
      .select("*")
      .single();

    if (pipelineError) {
      console.error("Error creating pipeline:", pipelineError);
      return NextResponse.json(
        { error: "Failed to create pipeline" },
        { status: 500 }
      );
    }

    // Insert initial research step
    const { error: stepError } = await supabase
      .from("pipeline_steps")
      .insert({
        pipeline_id: pipeline.id,
        phase: "research",
        status: "pending",
        input: {
          initialPrompt: ideaPrompt,
        },
      });

    if (stepError) {
      console.error("Error creating initial step:", stepError);
      // Continue anyway - pipeline is created
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

