import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const taskId = parseInt(params.id);

  const { data, error } = await supabase
    .from("night_task_messages")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

