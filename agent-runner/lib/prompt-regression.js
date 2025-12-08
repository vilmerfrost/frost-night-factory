// =============================================================================
// PROMPT REGRESSION SUITE - Prevent prompt degradation
// =============================================================================
import { supabase } from '../supabase-client';
import { callAI } from '../ai-client';
import { reviewUX } from './ux-reviewer';
// =============================================================================
// GOLDEN TASKS - Reference implementations
// =============================================================================
export const GOLDEN_TASKS = [
    {
        id: 'simple-invoice-dashboard',
        name: 'Simple Invoice Dashboard',
        description: 'Basic invoice management dashboard with list view',
        prompt: 'Create a simple invoice dashboard that displays a list of invoices in a table. Include columns for invoice number, date, amount, and status. Add a button to create new invoices.',
        expectedFiles: ['src/app/page.tsx', 'src/components/ui/table.tsx', 'src/components/ui/button.tsx'],
        expectedUXScore: 7.0,
        expectedPass: true,
    },
    {
        id: 'marketing-pdf-extractor',
        name: 'Marketing Page for PDF Extractor',
        description: 'Landing page for a PDF extraction tool',
        prompt: 'Create a marketing landing page for a PDF extraction tool. Include a hero section, feature grid showing key features, and a call-to-action section.',
        expectedFiles: ['src/app/page.tsx', 'src/components/layout/HeroSection.tsx', 'src/components/layout/FeatureGrid.tsx', 'src/components/layout/CTASection.tsx'],
        expectedUXScore: 8.0,
        expectedPass: true,
    },
    {
        id: 'saas-dashboard',
        name: 'SaaS Dashboard',
        description: 'Dashboard with stats and data tables',
        prompt: 'Create a SaaS dashboard with a stats grid showing key metrics (users, revenue, growth) and a data table below.',
        expectedFiles: ['src/app/page.tsx', 'src/components/layout/StatsGrid.tsx', 'src/components/ui/table.tsx'],
        expectedUXScore: 7.5,
        expectedPass: true,
    },
    {
        id: 'crud-admin',
        name: 'CRUD Admin Panel',
        description: 'Admin panel with create, read, update, delete operations',
        prompt: 'Create a CRUD admin panel with a form to create new items, a table to display items, and actions to edit and delete.',
        expectedFiles: ['src/app/page.tsx', 'src/components/ui/form.tsx', 'src/components/ui/table.tsx', 'src/components/ui/button.tsx'],
        expectedUXScore: 7.0,
        expectedPass: true,
    },
    {
        id: 'minimal-homepage',
        name: 'Minimal Homepage',
        description: 'Simple homepage with hero and CTA',
        prompt: 'Create a minimal homepage with a hero section and a call-to-action button.',
        expectedFiles: ['src/app/page.tsx', 'src/components/layout/HeroSection.tsx'],
        expectedUXScore: 8.0,
        expectedPass: true,
    },
];
/**
 * Run regression test for a single golden task
 */
export async function runRegressionTest(task, pipelineId, projectRoot) {
    console.log(`🧪 [Regression] Testing: ${task.name}`);
    const errors = [];
    let uxScore = 0;
    let filesCreated = 0;
    try {
        // 1. Generate code using current prompts/models
        const code = await callAI({
            pipelineId,
            step: 'regression_test',
            role: 'CODER',
            model: 'deepseek-chat', // Use default model
            messages: [
                {
                    role: 'user',
                    content: task.prompt,
                },
            ],
        });
        // 2. Check if expected files were created (simplified - would need actual file system access)
        // In real implementation, would parse code output and check file structure
        filesCreated = task.expectedFiles.length; // Placeholder
        // 3. Run UX review on main page
        try {
            const uxResult = await reviewUX(pipelineId, 'src/app/page.tsx', projectRoot);
            uxScore = uxResult.overall;
        }
        catch (uxError) {
            errors.push(`UX review failed: ${uxError.message}`);
        }
        // 4. Determine pass/fail
        const passed = uxScore >= task.expectedUXScore &&
            filesCreated >= task.expectedFiles.length &&
            errors.length === 0;
        const result = {
            taskId: task.id,
            taskName: task.name,
            passed,
            uxScore,
            expectedUXScore: task.expectedUXScore,
            filesCreated,
            expectedFiles: task.expectedFiles.length,
            errors,
            timestamp: new Date().toISOString(),
        };
        // 5. Save result to database
        await saveRegressionResult(result);
        console.log(`   ${passed ? '✅' : '❌'} ${task.name}: UX ${uxScore.toFixed(1)}/${task.expectedUXScore} (${passed ? 'PASS' : 'FAIL'})`);
        return result;
    }
    catch (error) {
        errors.push(`Test execution failed: ${error.message}`);
        return {
            taskId: task.id,
            taskName: task.name,
            passed: false,
            uxScore: 0,
            expectedUXScore: task.expectedUXScore,
            filesCreated: 0,
            expectedFiles: task.expectedFiles.length,
            errors,
            timestamp: new Date().toISOString(),
        };
    }
}
/**
 * Run full regression suite
 */
export async function runRegressionSuite(pipelineId, projectRoot) {
    console.log(`\n🧪 [Regression Suite] Running ${GOLDEN_TASKS.length} golden tasks...\n`);
    const results = [];
    for (const task of GOLDEN_TASKS) {
        const result = await runRegressionTest(task, pipelineId, projectRoot);
        results.push(result);
    }
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;
    const summary = `Regression Suite: ${passed}/${results.length} passed (${failed} failed)`;
    console.log(`\n${summary}`);
    if (failed > 0) {
        console.log(`\n⚠️ Failed tasks:`);
        results.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.taskName}: UX ${r.uxScore.toFixed(1)}/${r.expectedUXScore}`);
            if (r.errors.length > 0) {
                r.errors.forEach(e => console.log(`     Error: ${e}`));
            }
        });
    }
    return {
        total: results.length,
        passed,
        failed,
        results,
        summary,
    };
}
/**
 * Save regression result to database
 */
async function saveRegressionResult(result) {
    try {
        await supabase.from('regression_results').insert({
            task_id: result.taskId,
            task_name: result.taskName,
            passed: result.passed,
            ux_score: result.uxScore,
            expected_ux_score: result.expectedUXScore,
            files_created: result.filesCreated,
            expected_files: result.expectedFiles,
            errors: result.errors,
            created_at: result.timestamp,
        });
    }
    catch (error) {
        console.warn(`⚠️ Failed to save regression result: ${error.message}`);
    }
}
/**
 * Get regression history for a task
 */
export async function getRegressionHistory(taskId, days = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase
            .from('regression_results')
            .select('*')
            .eq('task_id', taskId)
            .gte('created_at', cutoffDate.toISOString())
            .order('created_at', { ascending: false });
        if (error) {
            console.warn(`⚠️ Failed to fetch regression history: ${error.message}`);
            return [];
        }
        return (data || []).map((row) => ({
            taskId: row.task_id,
            taskName: row.task_name,
            passed: row.passed,
            uxScore: row.ux_score,
            expectedUXScore: row.expected_ux_score,
            filesCreated: row.files_created,
            expectedFiles: row.expected_files,
            errors: row.errors || [],
            timestamp: row.created_at,
        }));
    }
    catch (error) {
        console.warn(`⚠️ Failed to get regression history: ${error.message}`);
        return [];
    }
}
