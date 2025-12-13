// app/api/pipelines/from-idea/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idea } = body;

    if (!idea) {
      return NextResponse.json(
        { error: "Missing required field: idea" },
        { status: 400 }
      );
    }

    const name = idea.length > 50 ? idea.substring(0, 47) + "..." : idea;

    const { data: createdPipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        name,
        initial_prompt: idea,
        status: "pending",
        current_phase: "research",
      })
      .select("*")
      .single();

    if (pipelineError) {
      console.error("❌ Error creating pipeline:", pipelineError);
      return NextResponse.json(
        { error: "Failed to create pipeline", details: pipelineError.message },
        { status: 500 }
      );
    }

    console.log("✅ Pipeline created:", createdPipeline.id);

    // Create steps with name field (FIXED)
    const steps = [
      {
        name: "Research Phase",
        phase: "research",
        status: "pending",
        input: { initialPrompt: idea },
      },
      { 
        name: "Planning Phase",
        phase: "planner", 
        status: "pending", 
        input: {} 
      },
      { 
        name: "Coding Phase",
        phase: "coder", 
        status: "pending", 
        input: {} 
      },
      { 
        name: "Testing Phase",
        phase: "tester", 
        status: "pending", 
        input: {} 
      },
      { 
        name: "Publishing Phase",
        phase: "publisher", 
        status: "pending", 
        input: {} 
      },
    ].map((step) => ({
      pipeline_id: createdPipeline.id,
      name: step.name,                    // ← ADDED
      phase: step.phase,
      status: step.status,
      input: step.input,
      output: {},
    }));

    const { error: stepsError } = await supabase
      .from("pipeline_steps")
      .insert(steps);

    if (stepsError) {
      console.error("❌ Error creating steps:", stepsError);
      await supabase.from("pipelines").delete().eq("id", createdPipeline.id);
      return NextResponse.json(
        { error: "Failed to create pipeline steps", details: stepsError.message },
        { status: 500 }
      );
    }

    console.log("✅ Pipeline steps created");

    return NextResponse.json({ 
      success: true, 
      pipeline: createdPipeline 
    }, { status: 201 });

  } catch (err: any) {
    console.error("💥 Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
