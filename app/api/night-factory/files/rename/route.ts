import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { runId, stage, oldName, newName } = await req.json();

    if (!runId || !stage || !oldName || !newName) {
      return NextResponse.json(
        { error: "Missing runId, stage, oldName, or newName" },
        { status: 400 }
      );
    }

    const oldPath = `${runId}/${stage}/${oldName}`;
    const newPath = `${runId}/${stage}/${newName}`;

    // Download old file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("night_factory_files")
      .download(oldPath);

    if (downloadError) {
      return NextResponse.json({ error: downloadError.message }, { status: 404 });
    }

    const content = await fileData.text();

    // Upload to new path
    const { error: uploadError } = await supabase.storage
      .from("night_factory_files")
      .upload(newPath, content, {
        contentType: "text/plain",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Delete old file
    await supabase.storage.from("night_factory_files").remove([oldPath]);

    return NextResponse.json({ success: true, newPath });
  } catch (error: any) {
    console.error("Rename file error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

