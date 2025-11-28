// app/api/pipelines/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, initial_prompt, repo_url, branch = "main" } = body;

    if (!name || !initial_prompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, initial_prompt" },
        { status: 400 }
      );
    }

    // Create pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        name,
        initial_prompt,
        repo_url: repo_url || null,
        branch,
        status: "pending",
        current_phase: "research",
      })
      .select("*")
      .single();

    if (pipelineError) {
      console.error("Error creating pipeline", pipelineError);
      return NextResponse.json(
        { error: "Failed to create pipeline" },
        { status: 500 }
      );
    }

    // Create initial research step
    const { error: stepError } = await supabase
      .from("pipeline_steps")
      .insert({
        pipeline_id: pipeline.id,
        phase: "research",
        status: "pending",
        input: {
          idea: initial_prompt,
        },
      });

    if (stepError) {
      console.error("Error creating initial step", stepError);
      // Continue anyway - pipeline is created
    }

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/pipelines", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("pipelines")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching pipelines", error);
      return NextResponse.json(
        { error: "Failed to fetch pipelines" },
        { status: 500 }
      );
    }

    return NextResponse.json({ pipelines: data || [] });
  } catch (err) {
    console.error("Unexpected error in /api/pipelines", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

