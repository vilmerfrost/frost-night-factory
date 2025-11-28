// app/api/tickets/[id]/start-pipeline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 1. Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // 2. Check that it's a feature (bugs are auto-handled)
    if (ticket.type !== "feature") {
      return NextResponse.json(
        { error: "Only feature tickets can be manually started" },
        { status: 400 }
      );
    }

    // 3. Check status
    if (ticket.status !== "needs_human_review") {
      return NextResponse.json(
        { error: "Ticket is not in 'needs_human_review' status" },
        { status: 400 }
      );
    }

    // 4. Create pipeline
    const initialPrompt = `You are Frost Night Factory.

Feature request:
Title: ${ticket.title}
Description: ${ticket.description}
Project: ${ticket.project}

Goal:
- Understand the feature requirements
- Design technical implementation
- Build MVP feature in Next.js + Supabase codebase
- Add tests
- Ensure it integrates well with existing codebase
`;

    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .insert({
        name: `Feature: ${ticket.title}`,
        initial_prompt: initialPrompt,
        status: "pending",
        current_phase: "research",
        // created_by: ticket.created_by,
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

    // 5. Update ticket
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        pipeline_id: pipeline.id,
        status: "pipeline_running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating ticket", updateError);
      // Continue anyway - pipeline is created
    }

    return NextResponse.json({ pipeline, ticket }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/tickets/[id]/start-pipeline", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

