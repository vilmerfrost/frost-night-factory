// API route for list_files tool
import { NextResponse } from "next/server";
import { listFiles } from "@/lib/agent/tools";

export async function POST(req: Request) {
  try {
    const { dir } = await req.json();

    if (!dir) {
      return NextResponse.json({ error: "dir is required" }, { status: 400 });
    }

    const result = await listFiles(dir);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list files" },
      { status: 500 }
    );
  }
}

