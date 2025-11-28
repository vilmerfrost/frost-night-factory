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

    const { data, error } = await supabase.storage
      .from("night_factory_files")
      .download(path);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const blob = await data.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Download file error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

