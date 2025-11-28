// API route for delete_file tool
import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/agent/tools";

export async function POST(req: Request) {
  try {
    const { path } = await req.json();

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const result = await deleteFile(path);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}

