// app/api/pipelines/[id]/steps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from("pipeline_steps")
      .select("*")
      .eq("pipeline_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pipeline steps", error);
      return NextResponse.json(
        { error: "Failed to fetch steps" },
        { status: 500 }
      );
    }

    return NextResponse.json({ steps: data || [] });
  } catch (err) {
    console.error("Unexpected error in /api/pipelines/[id]/steps", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

