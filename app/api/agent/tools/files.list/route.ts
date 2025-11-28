import { NextResponse } from "next/server";
import { listFiles } from "@/lib/agent/tools";

export async function POST() {
  try {
    // Hämta filer från roten (vi lämnar argumentet tomt för default)
    const files = await listFiles("");
    
    // UI förväntar sig antagligen en JSON med en 'files' array
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}