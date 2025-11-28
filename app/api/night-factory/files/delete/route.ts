import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { runId, stage, filename } = await req.json();

    if (!runId || !stage || !filename) {
      return NextResponse.json(
        { error: "Missing runId, stage, or filename" },
        { status: 400 }
      );
    }

    const path = `${runId}/${stage}/${filename}`;

    const { error } = await supabase.storage
      .from("night_factory_files")
      .remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

