// agent-runner/event-logger.ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Log pipeline events for debugging and monitoring
 */
export async function logEvent(pipelineId, eventType, stepName, details) {
    try {
        await supabase.from('pipeline_events').insert({
            pipeline_id: pipelineId,
            event_type: eventType,
            step_name: stepName,
            details: details || {}
        });
    }
    catch (error) {
        // Don't throw - event logging is non-critical
        console.error('Failed to log event:', error);
    }
}
/**
 * Get recent events for a pipeline
 */
export async function getPipelineEvents(pipelineId, limit = 100) {
    try {
        const { data } = await supabase
            .from('pipeline_events')
            .select('*')
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return data || [];
    }
    catch (error) {
        console.error('Failed to get pipeline events:', error);
        return [];
    }
}
