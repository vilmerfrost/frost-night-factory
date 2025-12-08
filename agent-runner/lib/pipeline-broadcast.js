// =============================================================================
// PIPELINE BROADCAST - WebSocket/SSE updates for Mission Control
// =============================================================================
// Store active connections (in-memory, would use Redis in production)
const pipelineUpdateClients = new Map();
const logStreamClients = new Map();
/**
 * Broadcast pipeline update to all connected clients
 */
export function broadcastPipelineUpdate(update) {
    const msg = JSON.stringify({
        ...update,
        timestamp: new Date().toISOString(),
    });
    // Broadcast to all pipeline update clients
    pipelineUpdateClients.forEach((clients) => {
        clients.forEach((client) => {
            try {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(msg);
                }
                else {
                    clients.delete(client);
                }
            }
            catch (error) {
                console.error('Failed to send pipeline update:', error);
                clients.delete(client);
            }
        });
    });
    // Also try to send via HTTP endpoint (for SSE fallback)
    // This would be handled by the API route
}
/**
 * Broadcast log to stream
 */
export function broadcastLog(pipelineId, level, message) {
    const log = {
        timestamp: new Date().toISOString(),
        level,
        message,
        pipelineId,
    };
    const msg = JSON.stringify(log);
    // Broadcast to log stream clients for this pipeline
    const clients = logStreamClients.get(pipelineId);
    if (clients) {
        clients.forEach((client) => {
            try {
                if (client.readyState === 1) {
                    client.send(msg);
                }
                else {
                    clients.delete(client);
                }
            }
            catch (error) {
                console.error('Failed to send log:', error);
                clients.delete(client);
            }
        });
    }
    // Also save to database
    saveLogToDatabase(pipelineId, level, message).catch((err) => {
        console.error('Failed to save log to database:', err);
    });
}
/**
 * Save log to database
 */
async function saveLogToDatabase(pipelineId, level, message) {
    try {
        const { supabase } = await import('../supabase-client');
        await supabase.from('pipeline_logs').insert({
            pipeline_id: pipelineId,
            level,
            message,
        });
    }
    catch (error) {
        // Non-critical, just log error
        console.error('Failed to save log:', error);
    }
}
/**
 * Register pipeline update client (called from API route)
 */
export function registerPipelineUpdateClient(client) {
    const id = 'default'; // Could use pipeline ID for filtering
    if (!pipelineUpdateClients.has(id)) {
        pipelineUpdateClients.set(id, new Set());
    }
    pipelineUpdateClients.get(id).add(client);
    client.on('close', () => {
        pipelineUpdateClients.get(id)?.delete(client);
    });
}
/**
 * Register log stream client (called from API route)
 */
export function registerLogStreamClient(pipelineId, client) {
    if (!logStreamClients.has(pipelineId)) {
        logStreamClients.set(pipelineId, new Set());
    }
    logStreamClients.get(pipelineId).add(client);
    client.on('close', () => {
        logStreamClients.get(pipelineId)?.delete(client);
    });
}
