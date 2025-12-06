// =============================================================================
// TICKET WATCHER - Directly runs pipelines from tickets (DIRECT MODE)
// =============================================================================
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const POLL_INTERVAL = 5000; // Check every 5 seconds
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Run full pipeline directly from ticket
 * Creates a minimal pipeline record for compatibility, then executes
 */
async function runPipelineForTicket(ticket) {
    const vision = ticket.vision || ticket.description || ticket.request || '';
    console.log(`\n🚀 Starting pipeline execution for ticket ${ticket.id}`);
    console.log(`   Vision: ${vision.substring(0, 100)}...`);
    // ✅ FIX: Create pipeline with ALL fields that exist in pipelines table
    // This ensures insert succeeds and runner can process it immediately
    const { data: pipeline, error: pipelineError } = await supabase
        .from('pipelines')
        .insert({
        ticket_id: ticket.id,
        name: `Feature: ${vision.substring(0, 50) || 'Untitled'}`,
        initial_prompt: vision,
        status: 'running',
        current_phase: 'research',
        stage: 'research',
        type: 'feature',
        is_python: false,
        retry_count: 0,
        max_retries: 10,
        total_ai_cost_cents: 0,
        total_tokens_in: 0,
        total_tokens_out: 0,
        vision_score: 0,
    })
        .select()
        .single();
    if (pipelineError) {
        console.error('❌ Failed to create pipeline:', pipelineError);
        throw new Error(`Failed to create pipeline: ${pipelineError.message}`);
    }
    if (!pipeline) {
        throw new Error('Pipeline insert returned null despite no error');
    }
    const pipelineId = pipeline.id;
    console.log(`✅ Pipeline created: ${pipelineId}`);
    console.log(`   Name: ${pipeline.name || 'Untitled'}`);
    console.log(`   Initial Prompt: ${(pipeline.initial_prompt || '').substring(0, 80)}...`);
    console.log(`   Status: ${pipeline.status}`);
    console.log(`   Phase: ${pipeline.current_phase}`);
    console.log(`🚀 Pipeline will be executed by pipeline-runner\n`);
    // The pipeline-runner loop will pick this up and execute it
    // We just need to wait for it to complete
    let completed = false;
    let attempts = 0;
    const maxAttempts = 3600; // 1 hour max (5s * 3600 = 5 hours actually)
    while (!completed && attempts < maxAttempts) {
        await sleep(5000);
        attempts++;
        const { data: pipelineStatus } = await supabase
            .from('pipelines')
            .select('status, current_phase')
            .eq('id', pipelineId)
            .single();
        if (pipelineStatus?.status === 'completed' || pipelineStatus?.status === 'done') {
            completed = true;
            console.log(`✅ Pipeline ${pipelineId} completed successfully`);
        }
        else if (pipelineStatus?.status === 'failed' || pipelineStatus?.status === 'failed_hard') {
            const { data: failedPipeline } = await supabase
                .from('pipelines')
                .select('last_error')
                .eq('id', pipelineId)
                .single();
            throw new Error(`Pipeline failed: ${failedPipeline?.last_error || 'Unknown error'}`);
        }
        // Log progress every 30 seconds
        if (attempts % 6 === 0) {
            console.log(`   ⏳ Pipeline still running... (${pipelineStatus?.current_phase || 'unknown'})`);
        }
    }
    if (!completed) {
        throw new Error('Pipeline execution timeout - exceeded maximum wait time');
    }
}
async function main() {
    console.log('🏭 Frost Night Factory - Ticket Watcher (DIRECT MODE)');
    console.log('📡 Polling for queued tickets...\n');
    while (true) {
        try {
            // 1. Find next ticket
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('status', 'queued') // ✅ Match API - only look for 'queued'
                .order('created_at', { ascending: true })
                .limit(1);
            if (error) {
                console.error('❌ Fetch error:', error);
                await sleep(POLL_INTERVAL);
                continue;
            }
            if (!data || data.length === 0) {
                await sleep(POLL_INTERVAL);
                continue;
            }
            const ticket = data[0];
            console.log('🎫 Found ticket:', ticket.id);
            console.log('   Vision:', ticket.vision || ticket.description || ticket.request);
            console.log('   Priority:', ticket.priority);
            console.log('   Stack:', JSON.stringify(ticket.stack_config || {}));
            // 2. Mark ticket as running
            await supabase
                .from('tickets')
                .update({ status: 'running', updated_at: new Date().toISOString() })
                .eq('id', ticket.id);
            // 3. Run the FULL pipeline here
            try {
                console.log('🚀 Starting pipeline for ticket', ticket.id);
                await runPipelineForTicket(ticket); // <– THIS DOES EVERYTHING
                console.log('✅ Pipeline finished for ticket', ticket.id);
                await supabase
                    .from('tickets')
                    .update({ status: 'completed', updated_at: new Date().toISOString() })
                    .eq('id', ticket.id);
            }
            catch (e) {
                console.error('❌ Pipeline failed for ticket', ticket.id, e);
                await supabase
                    .from('tickets')
                    .update({
                    status: 'failed',
                    error_log: e?.message || String(e),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', ticket.id);
            }
            // 4. Small delay before checking next ticket
            await sleep(2000);
        }
        catch (error) {
            console.error('❌ Polling error:', error);
            await sleep(POLL_INTERVAL);
        }
    }
}
main().catch((e) => {
    console.error('❌ Fatal watcher error:', e);
    process.exit(1);
});
