// agent-runner/dispatcher.ts
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
async function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
async function getNewAutoTickets() {
    const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("status", "new")
        .eq("auto_handle", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error("Error fetching tickets", error);
        return null;
    }
    return data;
}
async function createPipelineForBug(ticket) {
    const initialPrompt = `You are Frost Night Factory.

Bug report:
Title: ${ticket.title}
Description: ${ticket.description}
Project: ${ticket.project}

Goal:
- Understand the bug
- Analyze codebase to find root cause
- Propose minimal fix
- Implement fix in Next.js + Supabase codebase
- Add/update tests
- Ensure fix doesn't break existing functionality
`;
    // ✅ Use RPC function for atomic pipeline creation with all steps
    const { data: rpcResult, error } = await supabase.rpc("create_pipeline_atomic", {
        payload: {
            name: `Bugfix: ${ticket.title}`,
            initial_prompt: initialPrompt,
            status: "pending",
            current_phase: "research",
        }
    });
    if (error) {
        console.error("Error creating pipeline", error);
        return null;
    }
    if (!rpcResult || !rpcResult.success) {
        console.error(`RPC failed: ${rpcResult?.error || 'Unknown error'}`);
        return null;
    }
    // Extract pipeline_id from RPC result
    const pipelineId = rpcResult.pipeline_id;
    // Fetch full pipeline details
    const { data: pipeline, error: fetchError } = await supabase
        .from("pipelines")
        .select("*")
        .eq("id", pipelineId)
        .single();
    if (fetchError) {
        console.error("Error fetching pipeline", fetchError);
        return null;
    }
    // Update with ticket-specific data
    const { error: updateError } = await supabase
        .from("pipelines")
        .update({
        ticket_id: ticket.id,
    })
        .eq("id", pipelineId);
    if (updateError) {
        console.error("Error updating pipeline with ticket_id", updateError);
        // Continue anyway - pipeline is created
    }
    // Update ticket with pipeline_id and new status
    const { error: ticketErr } = await supabase
        .from("tickets")
        .update({
        pipeline_id: pipeline.id,
        status: "pipeline_running",
        updated_at: new Date().toISOString(),
    })
        .eq("id", ticket.id);
    if (ticketErr) {
        console.error("Error updating ticket with pipeline_id", ticketErr);
    }
    return pipeline;
}
// ✅ FIX: Vi behåller 'export' här, men tar bort den längst ner
export async function dispatcherLoop() {
    console.log("🎫 Ticket Dispatcher started...");
    console.log(`🔗 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
    while (true) {
        try {
            const ticket = await getNewAutoTickets();
            if (!ticket) {
                // Inga biljetter, vänta 5 sekunder
                await sleep(5000);
                continue;
            }
            console.log(`\n🎯 Found auto-handle ticket: ${ticket.id}`);
            console.log(`📝 Title: ${ticket.title}`);
            console.log(`🐛 Type: ${ticket.type}`);
            const pipeline = await createPipelineForBug(ticket);
            if (pipeline) {
                console.log(`✅ Pipeline created: ${pipeline.id}`);
                console.log(`🚀 Pipeline will be picked up by pipeline-runner`);
            }
            else {
                console.error(`❌ Failed to create pipeline for ticket ${ticket.id}`);
            }
            await sleep(2000);
        }
        catch (e) {
            console.error("Error in dispatcher loop:", e);
            await sleep(5000);
        }
    }
}
// Handle graceful shutdown
process.on("SIGINT", () => {
    console.log("\n👋 Dispatcher shutting down gracefully...");
    process.exit(0);
});
process.on("SIGTERM", () => {
    console.log("\n👋 Dispatcher shutting down gracefully...");
    process.exit(0);
});
// ✅ FIX: Tog bort "export { dispatcherLoop }" härifrån eftersom det redan är exporterat ovan.
