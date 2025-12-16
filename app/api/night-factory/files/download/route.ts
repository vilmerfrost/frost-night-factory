import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";
import { uint8ArrayToArrayBuffer } from "@/lib/utils/bytes";

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

    // Eftersom 'data' redan är en Blob, anropa arrayBuffer() direkt på den:
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ✅ Fix: Convert Buffer to Uint8Array then to ArrayBuffer for BodyInit compatibility
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const arrayBuffer = uint8ArrayToArrayBuffer(bytes);

    return new NextResponse(arrayBuffer, {
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

