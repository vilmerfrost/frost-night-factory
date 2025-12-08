// =============================================================================
// STATE-DRIVEN ERROR TRACKING - State machine for pipeline management
// =============================================================================
// ChatGPT o1 + Gemini 3.0 Pattern: FOR UPDATE SKIP LOCKED for safe concurrency
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { incPipelinePhaseTransition, incErrorLoopDetection, incPipelineError, setActiveWorkers } from '../monitoring/metrics';
import { snapshots } from '../snapshots/snapshot-manager';
// Lazy initialization to handle missing env vars gracefully
function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.warn('⚠️ Supabase credentials not found - state machine will use in-memory mode');
        return null;
    }
    return createClient(url, key);
}
const supabase = getSupabaseClient();
// State transition rules
const VALID_TRANSITIONS = {
    'idle': ['running'],
    'running': ['success', 'failed', 'blocked'],
    'success': ['idle'], // For next phase
    'failed': ['idle', 'blocked'], // Retry or block
    'blocked': ['idle', 'needs_review'],
    'needs_review': ['idle', 'blocked'],
};
export class PipelineStateMachine {
    workerId;
    heartbeatIntervals = new Map();
    constructor() {
        this.workerId = `worker_${process.pid}_${Date.now()}`;
        console.log(`🔧 State machine initialized: ${this.workerId}`);
    }
    /**
     * Claim a pipeline (pessimistic locking)
     */
    async claimPipeline() {
        try {
            // Try RPC first (if function exists)
            const { data, error } = await supabase.rpc('claim_pipeline', {
                p_worker_id: this.workerId,
            });
            if (!error && data && data.length > 0) {
                const pipeline = data[0];
                this.startHeartbeat(pipeline.id);
                console.log(`✅ Claimed pipeline: ${pipeline.id}`);
                return pipeline;
            }
            // Fallback: Manual claim
            return await this.claimPipelineFallback();
        }
        catch (err) {
            console.warn('RPC claim failed, using fallback:', err);
            return await this.claimPipelineFallback();
        }
    }
    /**
     * Fallback claim method (without RPC)
     */
    async claimPipelineFallback() {
        // Find idle pipeline
        const { data: pipelines } = await supabase
            .from('pipelines')
            .select('*')
            .eq('phase_status', 'idle')
            .is('worker_id', null)
            .order('created_at', { ascending: true })
            .limit(1);
        if (!pipelines || pipelines.length === 0) {
            return null;
        }
        const pipeline = pipelines[0];
        // Try to claim it
        const { data: claimed, error } = await supabase
            .from('pipelines')
            .update({
            phase_status: 'running',
            worker_id: this.workerId,
            last_heartbeat: new Date().toISOString(),
        })
            .eq('id', pipeline.id)
            .is('worker_id', null) // Only if still unclaimed
            .select()
            .single();
        if (error || !claimed) {
            console.log('Pipeline already claimed by another worker');
            return null;
        }
        this.startHeartbeat(claimed.id);
        console.log(`✅ Claimed pipeline (fallback): ${claimed.id}`);
        return claimed;
    }
    /**
     * Transition to a new phase
     */
    async transitionPhase(pipelineId, newPhase, status = 'running', workspaceRoot) {
        const { data: current } = await supabase
            .from('pipelines')
            .select('phase_status')
            .eq('id', pipelineId)
            .single();
        if (!current) {
            console.error(`Pipeline not found: ${pipelineId}`);
            return false;
        }
        // Validate transition
        const validNext = VALID_TRANSITIONS[current.phase_status] || [];
        if (!validNext.includes(status)) {
            console.error(`Invalid transition: ${current.phase_status} -> ${status}`);
            return false;
        }
        // Take snapshot before transition if starting new phase
        if (status === 'running' && workspaceRoot) {
            try {
                const workspaceFiles = await this.getWorkspaceFiles(workspaceRoot);
                await snapshots.takeSnapshot(pipelineId, newPhase, workspaceFiles);
            }
            catch (err) {
                console.warn(`⚠️ Failed to take snapshot: ${err.message}`);
            }
        }
        const { data: current } = await supabase
            ?.from('pipelines')
            .select('phase')
            .eq('id', pipelineId)
            .single() || { data: null };
        const fromPhase = current?.phase || 'unknown';
        const { error } = await supabase
            ?.from('pipelines')
            .update({
            phase: newPhase,
            phase_status: status,
            phase_attempt: 0, // Reset attempts for new phase
            updated_at: new Date().toISOString(),
        })
            .eq('id', pipelineId)
            .eq('worker_id', this.workerId) || { error: null };
        if (error) {
            console.error(`Failed to transition phase:`, error);
            return false;
        }
        incPipelinePhaseTransition(fromPhase, newPhase, status);
        console.log(`📍 Phase transition: ${fromPhase} -> ${newPhase} (${status})`);
        return true;
    }
    /**
     * Get workspace files for snapshot
     */
    async getWorkspaceFiles(workspaceRoot) {
        const files = {};
        const fs = await import('fs/promises');
        const path = await import('path');
        async function walkDir(dir, baseDir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.relative(baseDir, fullPath);
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.next', 'dist', 'build'].includes(entry.name)) {
                            await walkDir(fullPath, baseDir);
                        }
                    }
                    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
                        try {
                            const content = await fs.readFile(fullPath, 'utf-8');
                            files[relPath] = content;
                        }
                        catch {
                            // Skip files that can't be read
                        }
                    }
                }
            }
            catch {
                // Skip directories that can't be read
            }
        }
        await walkDir(workspaceRoot, workspaceRoot);
        return files;
    }
    /**
     * Update phase status
     */
    async updateStatus(pipelineId, status) {
        const { error } = await supabase
            .from('pipelines')
            .update({
            phase_status: status,
            updated_at: new Date().toISOString(),
        })
            .eq('id', pipelineId)
            .eq('worker_id', this.workerId);
        if (error) {
            console.error(`Failed to update status:`, error);
            return false;
        }
        console.log(`📍 Status update: ${status}`);
        return true;
    }
    /**
     * Record error (with loop detection)
     */
    async recordError(pipelineId, errorType, errorMessage) {
        const errorHash = this.hashError(errorType, errorMessage);
        // Get current attempt count
        const { data: current } = await supabase
            .from('pipelines')
            .select('phase_attempt, last_error_hash')
            .eq('id', pipelineId)
            .single();
        const newAttempt = (current?.phase_attempt || 0) + 1;
        const isSameError = current?.last_error_hash === errorHash;
        // Update pipeline
        await supabase
            .from('pipelines')
            .update({
            last_error_type: errorType,
            last_error_hash: errorHash,
            last_error_message: errorMessage.substring(0, 1000),
            phase_attempt: newAttempt,
            phase_status: 'failed',
            updated_at: new Date().toISOString(),
        })
            .eq('id', pipelineId);
        // Track in error_state table
        await this.trackErrorState(errorHash, errorType);
        // Check for loop (3+ attempts with same error)
        const isLoop = isSameError && newAttempt >= 3;
        if (isLoop) {
            incErrorLoopDetection(errorType);
            console.warn(`🚨 Error loop detected: ${errorHash} (${newAttempt} attempts)`);
            // Attempt rollback
            const workspaceRoot = await this.getWorkspaceRoot(pipelineId);
            if (workspaceRoot) {
                const rolledBack = await snapshots.rollback(pipelineId, workspaceRoot);
                if (rolledBack) {
                    await snapshots.markCurrentAsBroken(pipelineId);
                    console.log(`⏪ Rolled back due to error loop`);
                }
            }
            await this.blockPipeline(pipelineId, `Error loop: ${errorMessage.substring(0, 100)}`);
            return { shouldRetry: false, isLoop: true };
        }
        incPipelineError(errorType, current?.phase || 'unknown');
        // Determine if we should retry
        const shouldRetry = newAttempt < 5 && this.isRetryableError(errorType);
        return { shouldRetry, isLoop: false };
    }
    /**
     * Track error in error_state table
     */
    async trackErrorState(errorHash, errorType) {
        try {
            // Try upsert
            const { data: existing } = await supabase
                .from('error_state')
                .select('*')
                .eq('error_hash', errorHash)
                .single();
            if (existing) {
                await supabase
                    .from('error_state')
                    .update({
                    total_attempts: existing.total_attempts + 1,
                    last_seen_at: new Date().toISOString(),
                })
                    .eq('error_hash', errorHash);
            }
            else {
                await supabase
                    .from('error_state')
                    .insert({
                    error_hash: errorHash,
                    error_type: errorType,
                    total_attempts: 1,
                    successful_fixes: 0,
                    last_seen_at: new Date().toISOString(),
                });
            }
        }
        catch (err) {
            // Non-critical
            console.warn('Failed to track error state:', err);
        }
    }
    /**
     * Record successful fix
     */
    async recordFix(errorHash, modelUsed) {
        await supabase
            .from('error_state')
            .update({
            successful_fixes: supabase.rpc('increment', { x: 1 }),
            last_outcome: 'fixed',
            last_model_used: modelUsed,
        })
            .eq('error_hash', errorHash);
    }
    /**
     * Block pipeline (circuit breaker)
     */
    async blockPipeline(pipelineId, reason) {
        this.stopHeartbeat(pipelineId);
        await supabase
            .from('pipelines')
            .update({
            phase_status: 'blocked',
            last_error_message: reason,
            worker_id: null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', pipelineId);
        console.log(`🔌 Pipeline blocked: ${pipelineId} - ${reason}`);
    }
    /**
     * Release pipeline (cleanup)
     */
    async releasePipeline(pipelineId, status = 'idle') {
        this.stopHeartbeat(pipelineId);
        await supabase
            .from('pipelines')
            .update({
            phase_status: status,
            worker_id: null,
            last_heartbeat: null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', pipelineId)
            .eq('worker_id', this.workerId);
        console.log(`🔓 Released pipeline: ${pipelineId}`);
    }
    /**
     * Mark phase as success and move to next
     */
    async completePhase(pipelineId) {
        const { data: current } = await supabase
            .from('pipelines')
            .select('phase')
            .eq('id', pipelineId)
            .single();
        if (!current)
            return false;
        const phaseOrder = ['planner', 'coder', 'tester', 'deployer'];
        const currentIndex = phaseOrder.indexOf(current.phase);
        if (currentIndex === phaseOrder.length - 1) {
            // All phases complete
            await supabase
                .from('pipelines')
                .update({
                phase_status: 'success',
                status: 'completed',
                updated_at: new Date().toISOString(),
            })
                .eq('id', pipelineId);
            console.log(`🎉 Pipeline completed: ${pipelineId}`);
            return true;
        }
        // Move to next phase
        const nextPhase = phaseOrder[currentIndex + 1];
        return this.transitionPhase(pipelineId, nextPhase, 'running');
    }
    /**
     * Heartbeat (zombie prevention)
     */
    startHeartbeat(pipelineId) {
        // Clear existing heartbeat if any
        this.stopHeartbeat(pipelineId);
        const interval = setInterval(async () => {
            await supabase
                .from('pipelines')
                .update({ last_heartbeat: new Date().toISOString() })
                .eq('id', pipelineId)
                .eq('worker_id', this.workerId);
        }, 30000); // Every 30 seconds
        this.heartbeatIntervals.set(pipelineId, interval);
    }
    stopHeartbeat(pipelineId) {
        const interval = this.heartbeatIntervals.get(pipelineId);
        if (interval) {
            clearInterval(interval);
            this.heartbeatIntervals.delete(pipelineId);
        }
    }
    /**
     * Cleanup all heartbeats (on shutdown)
     */
    cleanup() {
        for (const interval of this.heartbeatIntervals.values()) {
            clearInterval(interval);
        }
        this.heartbeatIntervals.clear();
        console.log('🧹 State machine cleaned up');
    }
    /**
     * Hash error for deduplication
     */
    hashError(type, message) {
        const normalized = message.substring(0, 100).replace(/\d+/g, 'N');
        return crypto.createHash('md5').update(`${type}:${normalized}`).digest('hex');
    }
    /**
     * Check if error type is retryable
     */
    isRetryableError(errorType) {
        return ['NETWORK', 'RATE_LIMIT'].includes(errorType);
    }
    /**
     * Get worker ID
     */
    getWorkerId() {
        return this.workerId;
    }
    /**
     * Get workspace root for pipeline (placeholder)
     */
    async getWorkspaceRoot(pipelineId) {
        // In production, query from database or config
        // For now, return null to skip rollback
        return null;
    }
    /**
     * Update active workers count
     */
    async updateActiveWorkersCount() {
        if (!supabase)
            return;
        try {
            const { count } = await supabase
                .from('pipelines')
                .select('*', { count: 'exact', head: true })
                .eq('phase_status', 'running');
            setActiveWorkers(count || 0);
        }
        catch {
            // Non-critical
        }
    }
}
// Singleton instance
export const pipelineState = new PipelineStateMachine();
// Cleanup on process exit
process.on('SIGINT', () => pipelineState.cleanup());
process.on('SIGTERM', () => pipelineState.cleanup());
