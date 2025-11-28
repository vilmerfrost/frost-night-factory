import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { runId } = await req.json();

    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    // List files grouped by stage
    const stages = ["planner", "coder", "reviewer"];
    const filesByStage: Record<string, any[]> = {};

    for (const stage of stages) {
      const { data, error } = await supabase.storage
        .from("night_factory_files")
        .list(`${runId}/${stage}`, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error && error.message !== "The resource was not found") {
        console.error(`Error listing ${stage} files:`, error);
      } else {
        filesByStage[stage] = (data || []).map((file) => ({
          ...file,
          stage,
          path: `${runId}/${stage}/${file.name}`,
        }));
      }
    }

    // Also check for version files
    const { data: versionData } = await supabase.storage
      .from("night_factory_files")
      .list(`${runId}/versions`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (versionData) {
      filesByStage.versions = versionData.map((file) => ({
        ...file,
        stage: "versions",
        path: `${runId}/versions/${file.name}`,
      }));
    }

    return NextResponse.json({ files: filesByStage });
  } catch (error: any) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

