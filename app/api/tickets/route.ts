// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, description, source, autoHandle, project, vision, stack_config, priority } = body;

    // Support both old format (type/title/description) and new format (vision)
    if (!vision && (!type || !title || !description)) {
      return NextResponse.json(
        { error: "Missing required fields: either 'vision' or 'type/title/description'" },
        { status: 400 }
      );
    }

    // Default stack config if not provided
    const defaultStackConfig = {
      frontend: 'nextjs-16',
      backend: 'none',
      ui: 'shadcn',
      features: [],
    };

    const stackConfig = stack_config || defaultStackConfig;

    // Determine auto_handle and status based on type (or default for vision-based tickets)
    const ticketType = type || 'feature';
    if (!["bug", "feature"].includes(ticketType)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'bug' or 'feature'" },
        { status: 400 }
      );
    }

    const auto_handle = autoHandle ?? (ticketType === "bug");
    const status = ticketType === "bug" ? "new" : "needs_human_review";

    // Build insert payload
    const insertPayload: any = {
      type: ticketType,
      source: source ?? "user_app",
      auto_handle: auto_handle,
      status,
      project: project ?? "frost-solutions",
      stack_config: stackConfig, // Store stack config
    };

    // Use vision if provided, otherwise use title/description
    if (vision) {
      insertPayload.title = `Feature: ${vision.substring(0, 100)}`;
      insertPayload.description = vision;
    } else {
      insertPayload.title = title;
      insertPayload.description = description;
    }

    // Add priority if provided
    if (priority) {
      insertPayload.priority = priority;
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Error inserting ticket", error);
      return NextResponse.json(
        { error: "Failed to create ticket" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ticket: data }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/tickets", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    let query = supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching tickets", error);
      return NextResponse.json(
        { error: "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tickets: data || [] });
  } catch (err) {
    console.error("Unexpected error in /api/tickets", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

