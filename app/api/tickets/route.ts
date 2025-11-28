// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, description, source, autoHandle, project } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, description" },
        { status: 400 }
      );
    }

    if (!["bug", "feature"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'bug' or 'feature'" },
        { status: 400 }
      );
    }

    // Determine auto_handle and status based on type
    const auto_handle = autoHandle ?? (type === "bug"); // default: bug = true, feature = false
    const status = type === "bug" ? "new" : "needs_human_review";

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        type,
        title,
        description,
        source: source ?? "user_app",
        auto_handle: auto_handle,
        status,
        project: project ?? "frost-solutions",
        // created_by: user?.id ?? null, // Uncomment when auth is added
      })
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

