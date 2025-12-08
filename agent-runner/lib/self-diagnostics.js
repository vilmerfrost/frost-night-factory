// =============================================================================
// SELF-DIAGNOSTICS - Auto-generate summaries for needs_review pipelines
// =============================================================================
import { supabase } from '../supabase-client';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Generate diagnostic summary for a pipeline
 */
export async function generateDiagnosticSummary(pipelineId) {
    try {
        // Get pipeline status
        const { data: pipeline, error: pipelineError } = await supabase
            .from('pipelines')
            .select('status, current_phase, last_error, error_message')
            .eq('id', pipelineId)
            .maybeSingle();
        if (pipelineError || !pipeline) {
            return null;
        }
        const phase = pipeline.current_phase || 'unknown';
        const errors = [];
        const suggestions = [];
        // Parse last_error or error_message
        const errorText = pipeline.last_error || pipeline.error_message || '';
        // Extract common error patterns
        if (errorText.includes('TS1005') || errorText.includes('TS2305') || errorText.includes('TS2322')) {
            const fileMatch = errorText.match(/([^\s]+\.tsx?)/);
            if (fileMatch) {
                errors.push(`TypeScript error in ${fileMatch[1]}`);
                suggestions.push(`Check type definitions in ${fileMatch[1]}`);
            }
            else {
                errors.push('TypeScript compilation error');
                suggestions.push('Run `npm run build` locally to see full error details');
            }
        }
        if (errorText.includes('404') || errorText.toLowerCase().includes('homepage')) {
            errors.push('Homepage shows 404 error');
            suggestions.push('Check that `src/app/page.tsx` exists and exports a default component');
        }
        if (errorText.includes('contrast') || errorText.includes('a11y')) {
            errors.push('Low color contrast detected');
            suggestions.push('Update `globals.css` with higher contrast colors');
        }
        if (errorText.includes('cannot find module') || errorText.includes('module not found')) {
            const moduleMatch = errorText.match(/Cannot find module ['"]([^'"]+)['"]/);
            if (moduleMatch) {
                errors.push(`Missing module: ${moduleMatch[1]}`);
                suggestions.push(`Run: npm install ${moduleMatch[1]}`);
            }
            else {
                errors.push('Missing dependency');
                suggestions.push('Run `npm install` to install missing packages');
            }
        }
        if (errorText.includes('build') && errorText.includes('failed')) {
            errors.push('Build failed');
            suggestions.push('Check build logs for specific TypeScript or configuration errors');
        }
        // Get error events from database
        const { data: errorEvents } = await supabase
            .from('error_events')
            .select('error_type, error_message')
            .eq('pipeline_id', pipelineId)
            .order('created_at', { ascending: false })
            .limit(10);
        if (errorEvents && errorEvents.length > 0) {
            errorEvents.forEach((event) => {
                if (!errors.includes(event.error_type)) {
                    errors.push(event.error_type);
                }
            });
        }
        // Determine if retry is possible
        const canRetry = phase !== 'publisher' && errors.length < 5;
        const retryModel = errors.some(e => e.includes('TypeScript') || e.includes('complex'))
            ? 'claude-3-5-sonnet-20241022' // Use Claude for complex errors
            : 'deepseek-chat'; // Use DeepSeek for simple errors
        return {
            phase,
            mainErrors: errors.slice(0, 5), // Top 5 errors
            errorCount: errors.length,
            suggestions: suggestions.slice(0, 5), // Top 5 suggestions
            canRetry,
            retryModel,
        };
    }
    catch (error) {
        console.warn(`⚠️ Failed to generate diagnostic summary: ${error.message}`);
        return null;
    }
}
/**
 * Get file paths for "Open in editor" link
 */
export function getEditorPaths(pipelineId, projectRoot) {
    const keyFiles = [];
    // Check for common problematic files
    const commonFiles = [
        { path: 'src/app/page.tsx', description: 'Homepage component' },
        { path: 'src/app/layout.tsx', description: 'Root layout' },
        { path: 'src/lib/types.ts', description: 'Type definitions' },
        { path: 'tailwind.config.ts', description: 'Tailwind configuration' },
        { path: 'next.config.js', description: 'Next.js configuration' },
        { path: 'package.json', description: 'Dependencies' },
    ];
    commonFiles.forEach((file) => {
        const fullPath = path.join(projectRoot, file.path);
        if (fs.existsSync(fullPath)) {
            keyFiles.push({
                path: file.path,
                description: file.description,
            });
        }
    });
    return {
        repoPath: projectRoot,
        keyFiles,
    };
}
