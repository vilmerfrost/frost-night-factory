import { NextResponse } from "next/server";
import { executeAgentAction } from "@/lib/agent/runtime";
import { validateAgentAction } from "@/lib/agent/protocol";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Validate action
    if (!validateAgentAction(data)) {
      return NextResponse.json(
        { error: "INVALID_ACTION", details: "Action format is invalid" },
        { status: 400 }
      );
    }

    const result = await executeAgentAction(data);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Agent execution error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

