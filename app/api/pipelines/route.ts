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

    // Create pipeline using RPC function (atomic creation with all steps)
    const { data: rpcResult, error: pipelineError } = await supabase.rpc(
      "create_pipeline_atomic",
      {
        p_name: name,
        p_initial_prompt: initial_prompt,
        p_status: "pending",
        p_current_phase: "research",
        p_max_retries: 10,
        p_created_by: null,
      }
    );

    if (pipelineError) {
      console.error("Error creating pipeline", pipelineError);
      return NextResponse.json(
        { error: "Failed to create pipeline", details: pipelineError.message },
        { status: 500 }
      );
    }

    if (!rpcResult || rpcResult.length === 0) {
      return NextResponse.json(
        { error: "Pipeline creation returned no data" },
        { status: 500 }
      );
    }

    const pipelineId = rpcResult[0].pipeline_id;

    // Update with request-specific data
    const { error: updateError } = await supabase
      .from("pipelines")
      .update({
        repo_url: repo_url || null,
        branch,
      })
      .eq("id", pipelineId);

    if (updateError) {
      console.error("Error updating pipeline with repo_url/branch", updateError);
      // Continue anyway - pipeline is created
    }

    // Fetch full pipeline
    const { data: pipeline, error: fetchError } = await supabase
      .from("pipelines")
      .select("*")
      .eq("id", pipelineId)
      .single();

    if (fetchError) {
      console.error("Error fetching pipeline", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch pipeline", details: fetchError.message },
        { status: 500 }
      );
    }

    // Note: RPC function already created all 5 steps atomically, no need to create research step manually

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

