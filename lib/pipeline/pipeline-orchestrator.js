// lib/pipeline/pipeline-orchestrator.ts
// Unified Pipeline Orchestrator
// Runs all phases with full JSON context passing
import { runResearchPhaseJSON } from "./research";
import { runPlannerPhaseJSON } from "./planner";
import { runCoderPhaseJSON } from "./coder";
import { runSqlPhaseJSON } from "./sql";
import { runTesterPhaseJSON, generateTraceabilityReport } from "./tester";
import { buildPipelineContext, getPipelineContextSummary } from "./json-converter";
// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
/**
 * Run the complete pipeline with full JSON context passing
 *
 * Flow:
 * 1. Research → JSON
 * 2. Planner → JSON (receives Research JSON)
 * 3. Coder → JSON (receives Research + Planner JSON)
 * 4. SQL → JSON (receives Research + Planner + Coder JSON)
 * 5. Tester → JSON (receives ALL previous JSON)
 */
export async function runFullPipeline(userPrompt, repoPath, options = {}) {
    const { stopOnError = true, skipPhases = [], ...phaseOptions } = options;
    console.log("\n" + "═".repeat(60));
    console.log("🚀 FROST NIGHT FACTORY - FULL PIPELINE");
    console.log("═".repeat(60));
    console.log(`User Prompt: "${userPrompt.substring(0, 100)}..."`);
    console.log(`Repo Path: ${repoPath}`);
    console.log("═".repeat(60) + "\n");
    const result = {
        success: false,
        context: {},
        errors: [],
        warnings: [],
        raw_audit_trail: {},
        files_written: [],
        traceability_report: ""
    };
    // ============================================================
    // PHASE 1: RESEARCH
    // ============================================================
    let researchJSON;
    if (!skipPhases.includes("research")) {
        const researchResult = await runResearchPhaseJSON(userPrompt, {
            usePerplexity: phaseOptions.usePerplexity,
            useKimi: phaseOptions.useKimi,
            ticketType: phaseOptions.ticketType
        });
        result.raw_audit_trail.research = researchResult.raw_text_audit;
        if (!researchResult.success) {
            result.errors.push(`Research phase failed: ${researchResult.error}`);
            if (stopOnError) {
                result.traceability_report = generateTraceabilityReport(result.context);
                return result;
            }
        }
        else {
            researchJSON = researchResult.data;
            result.context.research = researchJSON;
        }
    }
    // Fallback if research was skipped
    if (!researchJSON) {
        result.warnings.push("Research phase skipped or failed, using minimal context");
        researchJSON = createMinimalResearchJSON(userPrompt);
        result.context.research = researchJSON;
    }
    // ============================================================
    // PHASE 2: PLANNER
    // ============================================================
    let plannerJSON;
    if (!skipPhases.includes("planner")) {
        const plannerResult = await runPlannerPhaseJSON(userPrompt, researchJSON, {
            useDeepSeekR1: phaseOptions.useDeepSeekR1
        });
        result.raw_audit_trail.planner = plannerResult.raw_text_audit;
        if (!plannerResult.success) {
            result.errors.push(`Planner phase failed: ${plannerResult.error}`);
            if (stopOnError) {
                result.traceability_report = generateTraceabilityReport(result.context);
                return result;
            }
        }
        else {
            plannerJSON = plannerResult.data;
            result.context.planner = plannerJSON;
        }
    }
    // Fallback if planner was skipped
    if (!plannerJSON) {
        result.warnings.push("Planner phase skipped or failed, using minimal context");
        plannerJSON = createMinimalPlannerJSON(userPrompt, researchJSON);
        result.context.planner = plannerJSON;
    }
    // ============================================================
    // PHASE 3: CODER
    // ============================================================
    let coderJSON;
    if (!skipPhases.includes("coder")) {
        const coderResult = await runCoderPhaseJSON(researchJSON, plannerJSON, repoPath, {
            generateFrontend: phaseOptions.generateFrontend,
            generateBackend: phaseOptions.generateBackend,
            useClaude: phaseOptions.useClaude
        });
        result.raw_audit_trail.coder = coderResult.raw_text_audit;
        result.files_written.push(...coderResult.files_written);
        if (!coderResult.success) {
            result.errors.push(`Coder phase failed: ${coderResult.error}`);
            if (stopOnError) {
                result.traceability_report = generateTraceabilityReport(result.context);
                return result;
            }
        }
        else {
            coderJSON = coderResult.data;
            result.context.coder = coderJSON;
        }
    }
    // Fallback if coder was skipped
    if (!coderJSON) {
        result.warnings.push("Coder phase skipped or failed, using minimal context");
        coderJSON = createMinimalCoderJSON(researchJSON, plannerJSON);
        result.context.coder = coderJSON;
    }
    // ============================================================
    // PHASE 4: SQL
    // ============================================================
    let sqlJSON;
    if (!skipPhases.includes("sql")) {
        const sqlResult = await runSqlPhaseJSON(researchJSON, plannerJSON, coderJSON, repoPath, {
            includeRLS: phaseOptions.includeRLS,
            includeSeedData: phaseOptions.includeSeedData
        });
        result.raw_audit_trail.sql = sqlResult.raw_text_audit;
        if (sqlResult.migration_file) {
            result.migration_file = sqlResult.migration_file;
        }
        if (!sqlResult.success) {
            result.errors.push(`SQL phase failed: ${sqlResult.error}`);
            if (stopOnError) {
                result.traceability_report = generateTraceabilityReport(result.context);
                return result;
            }
        }
        else {
            sqlJSON = sqlResult.data;
            result.context.sql_editor = sqlJSON;
        }
    }
    // Fallback if SQL was skipped
    if (!sqlJSON) {
        result.warnings.push("SQL phase skipped or failed, using minimal context");
        sqlJSON = createMinimalSqlJSON(researchJSON, plannerJSON, coderJSON);
        result.context.sql_editor = sqlJSON;
    }
    // ============================================================
    // PHASE 5: TESTER
    // ============================================================
    let testerJSON;
    if (!skipPhases.includes("tester")) {
        const testerResult = await runTesterPhaseJSON(researchJSON, plannerJSON, coderJSON, sqlJSON, repoPath, {
            runNpmTests: phaseOptions.runNpmTests,
            runTypeCheck: phaseOptions.runTypeCheck,
            runLinting: phaseOptions.runLinting,
            runSecurityAudit: phaseOptions.runSecurityAudit
        });
        result.raw_audit_trail.tester = testerResult.raw_text_audit;
        if (!testerResult.success) {
            result.errors.push(`Tester phase failed: ${testerResult.error}`);
        }
        else {
            testerJSON = testerResult.data;
            result.context.tester = testerJSON;
            result.final_recommendation = testerJSON?.final_recommendation;
        }
    }
    // ============================================================
    // FINAL REPORT
    // ============================================================
    result.success = result.errors.length === 0;
    result.traceability_report = generateTraceabilityReport(result.context);
    console.log("\n" + "═".repeat(60));
    console.log("📊 PIPELINE COMPLETE");
    console.log("═".repeat(60));
    console.log(`Success: ${result.success ? "✅ YES" : "❌ NO"}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Files Written: ${result.files_written.length}`);
    console.log(`Recommendation: ${result.final_recommendation || "N/A"}`);
    console.log("═".repeat(60));
    if (result.errors.length > 0) {
        console.log("\n❌ ERRORS:");
        result.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    }
    if (result.warnings.length > 0) {
        console.log("\n⚠️ WARNINGS:");
        result.warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
    }
    console.log("\n" + result.traceability_report);
    return result;
}
// ============================================================
// MINIMAL CONTEXT GENERATORS (Fallbacks)
// ============================================================
function createMinimalResearchJSON(userPrompt) {
    return {
        phase: "research",
        timestamp: new Date().toISOString(),
        sources: {
            gemini: {
                query: userPrompt,
                results: [],
                summary: "Minimal research context"
            }
        },
        extracted_requirements: {
            must_have: [{
                    id: "req-1",
                    name: "Core Functionality",
                    description: userPrompt,
                    priority: "critical",
                    technical_constraints: [],
                    source: ["user_prompt"]
                }],
            should_have: [],
            nice_to_have: []
        },
        technology_recommendations: {
            frontend: { choice: "Next.js 16", reason: "Default", alternatives: [], confidence: 0.8 },
            backend: { choice: "Supabase", reason: "Default", alternatives: [], confidence: 0.8 },
            database: { choice: "PostgreSQL", reason: "Default", alternatives: [], confidence: 0.8 }
        },
        potential_challenges: [],
        best_practices_found: [],
        estimated_scope: {
            total_features: 3,
            estimated_dev_hours: 40,
            estimated_timeline_weeks: 2,
            complexity_score: 5
        }
    };
}
function createMinimalPlannerJSON(userPrompt, research) {
    return {
        phase: "planner",
        timestamp: new Date().toISOString(),
        input_references: {
            research_timestamp: research.timestamp,
            research_summary: "Minimal context"
        },
        project_overview: {
            name: "Generated App",
            description: userPrompt,
            objectives: ["Implement core functionality"]
        },
        tech_stack: {
            frontend: { framework: "Next.js 16", language: "TypeScript", ui_library: "shadcn/ui", styling: "Tailwind CSS" },
            backend: { runtime: "Node.js", language: "TypeScript" },
            database: { type: "PostgreSQL", provider: "Supabase", auth: "Supabase Auth" }
        },
        feature_breakdown: {
            phase_1_mvp: [{
                    feature_id: "feat-core",
                    name: "Core Feature",
                    description: userPrompt,
                    estimated_hours: 40,
                    dependencies: [],
                    priority: 1,
                    status: "planned"
                }],
            phase_2_optional: []
        },
        database_schema_outline: { tables: [] },
        component_tree: {
            app: { children: ["layout.tsx", "page.tsx"] },
            components: { ui: [] }
        },
        api_routes_planned: [],
        timeline: { total_weeks: 2, phases: [] },
        risks_and_mitigations: [],
        success_criteria: []
    };
}
function createMinimalCoderJSON(research, planner) {
    return {
        phase: "coder",
        timestamp: new Date().toISOString(),
        input_references: {
            research_timestamp: research.timestamp,
            plan_timestamp: planner.timestamp,
            plan_summary: "Minimal context"
        },
        code_generated: {
            frontend: { files_count: 0, total_lines: 0, language: "TypeScript", files: [] },
            backend: { files_count: 0, total_lines: 0, language: "TypeScript", files: [] }
        },
        type_definitions: {
            coverage: 0,
            strict_mode: true,
            files_with_any: 0,
            types_defined: []
        },
        dependencies_used: [],
        code_quality_metrics: {
            typescript_errors: 0,
            typescript_warnings: 0,
            eslint_errors: 0,
            eslint_warnings: 0,
            linting_status: "passing"
        },
        features_implemented: [],
        critical_notes_for_sql_editor: []
    };
}
function createMinimalSqlJSON(research, planner, coder) {
    return {
        phase: "sql_editor",
        timestamp: new Date().toISOString(),
        input_references: {
            research_timestamp: research.timestamp,
            plan_timestamp: planner.timestamp,
            coder_timestamp: coder.timestamp,
            context_summary: "Minimal context"
        },
        database_schema_created: { tables: [] },
        rls_policies: [],
        migrations_created: [],
        queries_optimized: [],
        type_schema_match: {
            invoice_type_columns: [],
            database_columns: [],
            match_status: "unknown"
        },
        seed_data: { provided: false, records_created: 0 },
        performance_expectations: {
            read_operations: {},
            write_operations: {}
        },
        critical_notes_for_tester: []
    };
}
// ============================================================
// UTILITY EXPORTS
// ============================================================
export { buildPipelineContext, getPipelineContextSummary, generateTraceabilityReport };
