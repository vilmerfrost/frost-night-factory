import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function GET() {
  const { data } = await supabase
    .from("night_tasks")
    .select("*")
    .order("id", { ascending: false });

  return NextResponse.json(data);
}
