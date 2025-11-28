// app/api/agent/pipeline/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { ticketId } = await req.json();

    console.log("📥 API received request for Ticket ID:", ticketId);

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
    }

    // 1. Hämta biljetten för att säkerställa att den finns
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("❌ Ticket not found in DB:", ticketId, ticketError);
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    console.log("✅ Ticket found:", ticket.title, "Type:", ticket.type);

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
        { error: `Ticket is not in 'needs_human_review' status (current: ${ticket.status})` },
        { status: 400 }
      );
    }

    // 4. Skapa Prompt baserat på biljetten
    const initialPrompt = `You are Frost Night Factory.

Feature request:
Title: ${ticket.title}
Description: ${ticket.description}
Project: ${ticket.project || "frost-solutions"}

Goal:
- Understand the feature requirements
- Design technical implementation
- Build MVP feature in Next.js + Supabase codebase
- Add tests
- Ensure it integrates well with existing codebase
`;

    // 5. Skapa Pipeline
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
      console.error("❌ Pipeline creation failed:", pipelineError);
      return NextResponse.json(
        { error: "Failed to create pipeline" },
        { status: 500 }
      );
    }

    console.log("✅ Pipeline created:", pipeline.id);

    // 6. Create initial research step
    const { error: stepError } = await supabase
      .from("pipeline_steps")
      .insert({
        pipeline_id: pipeline.id,
        phase: "research",
        status: "pending",
        input: {
          initialPrompt: initialPrompt,
          ticket_type: ticket.type,
        },
      });

    if (stepError) {
      console.error("⚠️ Error creating initial step:", stepError);
      // Continue anyway - pipeline is created
    }

    // 7. Uppdatera Ticket status
    const { error: updateError } = await supabase
      .from("tickets")
      .update({
        pipeline_id: pipeline.id,
        status: "pipeline_running",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (updateError) {
      console.error("⚠️ Error updating ticket:", updateError);
      // Continue anyway - pipeline is created
    }

    console.log("✅ Ticket updated to pipeline_running");

    return NextResponse.json({ success: true, pipeline, ticket }, { status: 201 });
  } catch (e: any) {
    console.error("💥 Server Error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}

