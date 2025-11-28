import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { runId, stage, filename, content } = await req.json();

    if (!runId || !stage || !filename || content === undefined) {
      return NextResponse.json(
        { error: "Missing runId, stage, filename, or content" },
        { status: 400 }
      );
    }

    const path = `${runId}/${stage}/${filename}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const versionPath = `${runId}/versions/${filename}.${timestamp}.bak`;

    // Save main file
    const { error: saveError } = await supabase.storage
      .from("night_factory_files")
      .upload(path, content, {
        contentType: "text/plain",
        upsert: true,
      });

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    // Save version backup
    await supabase.storage
      .from("night_factory_files")
      .upload(versionPath, content, {
        contentType: "text/plain",
      });

    return NextResponse.json({
      success: true,
      path,
      versionPath,
    });
  } catch (error: any) {
    console.error("Save file error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

