// =============================================================================
// HIVE MIND LEARNING SYSTEM - Phase 1-4
// =============================================================================
// Self-learning system that caches fixes, learns patterns, and optimizes model selection
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
// ✅ Phase 1: Initialize OpenAI for embeddings (if available)
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
/**
 * Phase 1: Generate error signature hash
 * Normalizes error message + file path to create a unique signature
 */
export function generateErrorSignature(errorMessage, filePath) {
    // Normalize error message (remove line numbers, paths, etc.)
    let normalized = errorMessage
        .toLowerCase()
        .replace(/\d+/g, 'N') // Replace numbers with N
        .replace(/[\/\\]/g, '/') // Normalize path separators
        .replace(/['"]/g, '') // Remove quotes
        .trim();
    if (filePath) {
        const fileName = filePath.split(/[\/\\]/).pop() || '';
        normalized += `|${fileName.toLowerCase()}`;
    }
    // Hash to 16 chars
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
}
/**
 * Phase 1: Generate embedding for semantic search
 */
async function generateEmbedding(text) {
    if (!openai) {
        return null; // Skip if OpenAI not configured
    }
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.substring(0, 8000), // Limit length
        });
        return response.data[0].embedding;
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Failed to generate embedding: ${error.message}`);
        return null;
    }
}
/**
 * Phase 1: Query cached solution
 * Returns cached fix if available and success_rate > threshold
 */
export async function querySolution(errorMessage, filePath, minSuccessRate = 0.7) {
    const errorSignature = generateErrorSignature(errorMessage, filePath);
    try {
        // First try exact signature match
        const { data: exactMatch, error: exactError } = await supabase
            .from('hive_mind_solutions')
            .select('*')
            .eq('error_signature', errorSignature)
            .gte('success_rate', minSuccessRate)
            .order('success_rate', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (exactMatch && !exactError) {
            // Update last_used_at
            await supabase
                .from('hive_mind_solutions')
                .update({ last_used_at: new Date().toISOString() })
                .eq('id', exactMatch.id);
            console.log(`🧠 [Hive Mind] Found cached solution (signature match, success_rate: ${exactMatch.success_rate})`);
            return exactMatch;
        }
        // Fallback: Semantic search using embeddings (if available)
        if (openai) {
            const embedding = await generateEmbedding(errorMessage);
            if (embedding) {
                const { data: semanticMatches, error: semanticError } = await supabase.rpc('match_documents', {
                    query_embedding: embedding,
                    match_threshold: 0.7,
                    match_count: 1,
                });
                if (semanticMatches && semanticMatches.length > 0 && !semanticError) {
                    const match = semanticMatches[0];
                    if (match.success_rate >= minSuccessRate) {
                        console.log(`🧠 [Hive Mind] Found semantic match (success_rate: ${match.success_rate})`);
                        return match;
                    }
                }
            }
        }
        return null;
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Query failed: ${error.message}`);
        return null;
    }
}
/**
 * Phase 1: Save successful solution
 */
export async function saveSolution(errorMessage, filePath, successfulFix, aiModelUsed, errorType) {
    const errorSignature = generateErrorSignature(errorMessage, filePath);
    const embedding = await generateEmbedding(errorMessage);
    try {
        // Check if solution already exists
        const { data: existing } = await supabase
            .from('hive_mind_solutions')
            .select('id, times_reused, times_succeeded, times_failed')
            .eq('error_signature', errorSignature)
            .maybeSingle();
        if (existing) {
            // Update existing solution
            await supabase
                .from('hive_mind_solutions')
                .update({
                successful_fix: successfulFix,
                ai_model_used: aiModelUsed,
                times_succeeded: existing.times_succeeded + 1,
                times_reused: existing.times_reused + 1,
                last_used_at: new Date().toISOString(),
                embedding: embedding || undefined,
            })
                .eq('id', existing.id);
            console.log(`🧠 [Hive Mind] Updated existing solution (times_reused: ${existing.times_reused + 1})`);
        }
        else {
            // Create new solution
            await supabase
                .from('hive_mind_solutions')
                .insert({
                error_signature: errorSignature,
                error_type: errorType,
                target_file: filePath || null,
                error_message: errorMessage,
                successful_fix: successfulFix,
                ai_model_used: aiModelUsed,
                success_rate: 1.0,
                times_reused: 0,
                times_succeeded: 1,
                times_failed: 0,
                embedding: embedding || undefined,
            });
            console.log(`🧠 [Hive Mind] Saved new solution (error_type: ${errorType})`);
        }
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Save failed: ${error.message}`);
    }
}
/**
 * Phase 1: Record solution failure (when cached fix doesn't work)
 */
export async function recordSolutionFailure(errorSignature) {
    try {
        const { data: existing } = await supabase
            .from('hive_mind_solutions')
            .select('id, times_failed')
            .eq('error_signature', errorSignature)
            .maybeSingle();
        if (existing) {
            await supabase
                .from('hive_mind_solutions')
                .update({
                times_failed: existing.times_failed + 1,
            })
                .eq('id', existing.id);
            console.log(`🧠 [Hive Mind] Recorded solution failure`);
        }
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Record failure failed: ${error.message}`);
    }
}
/**
 * Phase 2: Log pipeline run
 */
export async function logPipelineRun(pipelineId, phase, status, aiModelUsed, costUsd, durationMs, tokensUsed, errorTypes, fixesApplied) {
    try {
        await supabase
            .from('pipeline_runs')
            .insert({
            pipeline_id: pipelineId,
            phase,
            status,
            ai_model_used: aiModelUsed || null,
            cost_usd: costUsd || 0,
            duration_ms: durationMs || null,
            tokens_used: tokensUsed || null,
            error_types: errorTypes || [],
            fixes_applied: fixesApplied || [],
        });
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Log pipeline run failed: ${error.message}`);
    }
}
/**
 * Phase 2: Log error event
 */
export async function logErrorEvent(pipelineId, pipelineRunId, errorMessage, errorCode, filePath, lineNumber, errorType, aiModelUsed) {
    const errorHash = generateErrorSignature(errorMessage, filePath);
    try {
        const { data, error } = await supabase
            .from('error_events')
            .insert({
            pipeline_id: pipelineId,
            pipeline_run_id: pipelineRunId || null,
            error_code: errorCode || null,
            error_hash: errorHash,
            error_message: errorMessage,
            file_path: filePath || null,
            line_number: lineNumber || null,
            error_type: errorType || null,
            ai_model_used: aiModelUsed || null,
        })
            .select('id')
            .single();
        return data?.id || '';
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Log error event failed: ${error.message}`);
        return '';
    }
}
/**
 * Phase 2: Log fix candidate
 */
export async function logFixCandidate(errorEventId, pipelineId, fixCode, aiModelUsed, promptUsed, outcome, buildPassed, testsPassed) {
    try {
        await supabase
            .from('fix_candidates')
            .insert({
            error_event_id: errorEventId,
            pipeline_id: pipelineId,
            fix_code: fixCode,
            ai_model_used: aiModelUsed,
            prompt_used: promptUsed || null, // Can contain debugger explanation
            outcome: outcome || null,
            build_passed: buildPassed || null,
            tests_passed: testsPassed || null,
        });
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Log fix candidate failed: ${error.message}`);
    }
}
/**
 * Update fix candidate outcome after retest
 */
export async function updateFixCandidateOutcome(errorEventId, outcome, buildPassed, testsPassed) {
    try {
        // Find the most recent fix candidate for this error event
        const { data: candidates } = await supabase
            .from('fix_candidates')
            .select('id')
            .eq('error_event_id', errorEventId)
            .order('created_at', { ascending: false })
            .limit(1);
        if (candidates && candidates.length > 0) {
            await supabase
                .from('fix_candidates')
                .update({
                outcome,
                build_passed: buildPassed,
                tests_passed: testsPassed,
            })
                .eq('id', candidates[0].id);
        }
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Update fix candidate failed: ${error.message}`);
    }
}
/**
 * Phase 3: Update model performance
 */
export async function updateModelPerformance(errorType, aiModel, success, costUsd, durationMs) {
    try {
        const { data: existing } = await supabase
            .from('model_performance')
            .select('*')
            .eq('error_type', errorType)
            .eq('ai_model', aiModel)
            .maybeSingle();
        if (existing) {
            const totalAttempts = existing.total_attempts + 1;
            const successfulFixes = existing.successful_fixes + (success ? 1 : 0);
            const failedFixes = existing.failed_fixes + (success ? 0 : 1);
            // Calculate weighted average cost and duration
            const avgCost = existing.avg_cost_usd
                ? ((existing.avg_cost_usd * existing.total_attempts) + (costUsd || 0)) / totalAttempts
                : costUsd || 0;
            const avgDuration = existing.avg_duration_ms
                ? ((existing.avg_duration_ms * existing.total_attempts) + (durationMs || 0)) / totalAttempts
                : durationMs || 0;
            await supabase
                .from('model_performance')
                .update({
                total_attempts: totalAttempts,
                successful_fixes: successfulFixes,
                failed_fixes: failedFixes,
                avg_cost_usd: avgCost,
                avg_duration_ms: avgDuration,
            })
                .eq('id', existing.id);
        }
        else {
            await supabase
                .from('model_performance')
                .insert({
                error_type: errorType,
                ai_model: aiModel,
                total_attempts: 1,
                successful_fixes: success ? 1 : 0,
                failed_fixes: success ? 0 : 1,
                avg_cost_usd: costUsd || 0,
                avg_duration_ms: durationMs || 0,
                success_rate: success ? 1.0 : 0.0,
            });
        }
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Update model performance failed: ${error.message}`);
    }
}
/**
 * Phase 3: Select best model for error type
 * Returns the model with highest success_rate for this error type
 */
export async function selectBestModel(errorType) {
    try {
        const { data, error } = await supabase
            .from('model_performance')
            .select('ai_model, success_rate, total_attempts')
            .eq('error_type', errorType)
            .gte('total_attempts', 3) // Need at least 3 attempts to be reliable
            .order('success_rate', { ascending: false })
            .order('total_attempts', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (data && !error && data.success_rate >= 0.6) {
            console.log(`🧠 [Hive Mind] Selected best model for ${errorType}: ${data.ai_model} (success_rate: ${data.success_rate})`);
            return data.ai_model;
        }
        return null; // No reliable model found, use default
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Select best model failed: ${error.message}`);
        return null;
    }
}
/**
 * Phase 3: Log feedback record
 */
export async function logFeedback(pipelineId, rating, feedbackText, errorTypes, modelsUsed, fixesApplied, costUsd) {
    try {
        await supabase
            .from('feedback_records')
            .insert({
            pipeline_id: pipelineId,
            rating,
            feedback_text: feedbackText || null,
            error_types: errorTypes || [],
            models_used: modelsUsed || [],
            fixes_applied: fixesApplied || [],
            cost_usd: costUsd || 0,
        });
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Log feedback failed: ${error.message}`);
    }
}
/**
 * Phase 4: Collect training data
 */
export async function collectTrainingData(errorSignature, errorType, errorMessage, contextCode, successfulFix, explanation) {
    try {
        await supabase
            .from('training_data')
            .insert({
            error_signature: errorSignature,
            error_type: errorType,
            error_message: errorMessage,
            context_code: contextCode,
            successful_fix: successfulFix,
            explanation: explanation || null,
            verified: false,
            quality_score: 1.0,
        });
        console.log(`📚 [Hive Mind] Collected training data for ${errorType}`);
    }
    catch (error) {
        console.warn(`⚠️ [Hive Mind] Collect training data failed: ${error.message}`);
    }
}
/**
 * Phase 4: Export training data as JSONL (for fine-tuning)
 */
export async function exportTrainingDataJSONL(errorType, minQualityScore = 0.8, verifiedOnly = true) {
    try {
        let query = supabase
            .from('training_data')
            .select('*')
            .gte('quality_score', minQualityScore);
        if (verifiedOnly) {
            query = query.eq('verified', true);
        }
        if (errorType) {
            query = query.eq('error_type', errorType);
        }
        const { data, error } = await query.order('quality_score', { ascending: false });
        if (error || !data) {
            throw new Error(error?.message || 'Failed to fetch training data');
        }
        // Convert to JSONL format
        const jsonl = data.map(item => {
            return JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: `You are a code fixer. Fix the following ${item.error_type} error.`,
                    },
                    {
                        role: 'user',
                        content: `Error: ${item.error_message}\n\nContext:\n${item.context_code}`,
                    },
                    {
                        role: 'assistant',
                        content: item.successful_fix + (item.explanation ? `\n\nExplanation: ${item.explanation}` : ''),
                    },
                ],
            });
        }).join('\n');
        return jsonl;
    }
    catch (error) {
        console.error(`❌ [Hive Mind] Export training data failed: ${error.message}`);
        return '';
    }
}
