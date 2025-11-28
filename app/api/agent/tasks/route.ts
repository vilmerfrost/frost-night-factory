// app/api/agent/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, repoUrl, branch = "main" } = body;

    if (!title || !description || !repoUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Note: For V1, we'll skip auth check. Add it later with:
    // const { data: { user }, error: userError } = await supabase.auth.getUser();
    // if (userError || !user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({
        title,
        description,
        repo_url: repoUrl,
        branch,
        status: "pending",
        // created_by: user.id, // Uncomment when auth is added
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error inserting agent_task", error);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/agent/tasks", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase.from("agent_tasks").select("*").order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching agent_tasks", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data || [] });
  } catch (err) {
    console.error("Unexpected error in /api/agent/tasks", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

