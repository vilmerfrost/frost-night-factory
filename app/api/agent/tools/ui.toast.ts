// API route for ui_toast tool
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, type } = await req.json();

    if (!message || !type) {
      return NextResponse.json(
        { error: "message and type are required" },
        { status: 400 }
      );
    }

    // Toast notifications are handled client-side
    // This route just validates and returns success
    return NextResponse.json({ ok: true, message, type });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to show toast" },
      { status: 500 }
    );
  }
}

