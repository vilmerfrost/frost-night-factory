// API route for write_file tool
import { NextResponse } from "next/server";
import { writeFile } from "@/lib/agent/tools";

export async function POST(req: Request) {
  try {
    const { path, content } = await req.json();

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: "path and content are required" },
        { status: 400 }
      );
    }

    const result = await writeFile(path, content);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to write file" },
      { status: 500 }
    );
  }
}

