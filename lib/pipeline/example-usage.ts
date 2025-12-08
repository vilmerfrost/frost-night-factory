// lib/pipeline/example-usage.ts
// Example usage of the JSON-based pipeline system
// 
// This file demonstrates how to use the new pipeline orchestrator
// with full JSON context passing between phases.

import { runFullPipeline, type PipelineResult } from "./pipeline-orchestrator";
import { 
  runResearchPhaseJSON,
  runPlannerPhaseJSON,
  runCoderPhaseJSON,
  runSqlPhaseJSON,
  runTesterPhaseJSON,
  buildPipelineContext,
  generateTraceabilityReport
} from "./phases";
import type { 
  ResearchPhaseJSON, 
  PlannerPhaseJSON, 
  CoderPhaseJSON,
  SqlEditorPhaseJSON,
  PipelineContext 
} from "./pipeline-json-types";

// ============================================================
// EXAMPLE 1: Full Pipeline (Recommended)
// ============================================================

async function runFullPipelineExample(): Promise<void> {
  console.log("🚀 Running full pipeline...\n");

  const result: PipelineResult = await runFullPipeline(
    "Build an invoice management app with PDF upload and data extraction",
    "./workspace/invoice-app",
    {
      // Research options
      usePerplexity: true,
      useKimi: false,
      ticketType: "feature",
      
      // Planner options
      useDeepSeekR1: true,
      
      // Coder options
      generateFrontend: true,
      generateBackend: true,
      useClaude: true,
      
      // SQL options
      includeRLS: true,
      includeSeedData: true,
      
      // Tester options
      runNpmTests: true,
      runTypeCheck: true,
      runLinting: true,
      runSecurityAudit: true,
      
      // Pipeline control
      stopOnError: false, // Continue even if a phase fails
    }
  );

  console.log("\n📊 Pipeline Result:");
  console.log(`   Success: ${result.success}`);
  console.log(`   Files Written: ${result.files_written.length}`);
  console.log(`   Recommendation: ${result.final_recommendation}`);
  console.log("\n📜 Traceability Report:");
  console.log(result.traceability_report);

  // Access individual phase contexts
  if (result.context.research) {
    console.log("\n📊 Research found:");
    console.log(`   - ${result.context.research.extracted_requirements.must_have.length} must-have requirements`);
    console.log(`   - ${result.context.research.potential_challenges.length} challenges`);
  }

  if (result.context.planner) {
    console.log("\n📋 Plan created:");
    console.log(`   - Project: ${result.context.planner.project_overview.name}`);
    console.log(`   - ${result.context.planner.feature_breakdown.phase_1_mvp.length} MVP features`);
  }

  if (result.context.coder) {
    console.log("\n💻 Code generated:");
    console.log(`   - ${result.context.coder.code_generated.frontend.files_count} frontend files`);
    console.log(`   - ${result.context.coder.code_generated.backend.files_count} backend files`);
  }

  if (result.context.sql_editor) {
    console.log("\n🗄️ SQL created:");
    console.log(`   - ${result.context.sql_editor.database_schema_created.tables.length} tables`);
    console.log(`   - ${result.context.sql_editor.rls_policies.length} RLS policies`);
  }

  if (result.context.tester) {
    console.log("\n🧪 Tests run:");
    console.log(`   - ${result.context.tester.test_suite.filter(t => t.status === "passed").length}/${result.context.tester.test_suite.length} passed`);
    console.log(`   - Final: ${result.context.tester.final_recommendation}`);
  }
}

// ============================================================
// EXAMPLE 2: Step-by-Step Pipeline (More Control)
// ============================================================

async function runStepByStepExample(): Promise<void> {
  console.log("🔧 Running step-by-step pipeline...\n");

  const userPrompt = "Build a task management app with real-time updates";
  const repoPath = "./workspace/task-app";

  // Step 1: Research
  console.log("📊 Step 1: Research...");
  const researchResult = await runResearchPhaseJSON(userPrompt, {
    usePerplexity: true,
    ticketType: "feature"
  });

  if (!researchResult.success || !researchResult.data) {
    console.error("❌ Research failed:", researchResult.error);
    return;
  }

  const researchJSON: ResearchPhaseJSON = researchResult.data;
  console.log(`   ✅ Research complete: ${researchJSON.extracted_requirements.must_have.length} requirements`);

  // Step 2: Planner (receives Research context)
  console.log("\n📋 Step 2: Planner...");
  const plannerResult = await runPlannerPhaseJSON(userPrompt, researchJSON, {
    useDeepSeekR1: true
  });

  if (!plannerResult.success || !plannerResult.data) {
    console.error("❌ Planner failed:", plannerResult.error);
    return;
  }

  const plannerJSON: PlannerPhaseJSON = plannerResult.data;
  console.log(`   ✅ Plan complete: ${plannerJSON.feature_breakdown.phase_1_mvp.length} features`);

  // Note the reference chain:
  console.log(`   📎 References research from: ${plannerJSON.input_references.research_timestamp}`);

  // Step 3: Coder (receives Research + Planner context)
  console.log("\n💻 Step 3: Coder...");
  const coderResult = await runCoderPhaseJSON(researchJSON, plannerJSON, repoPath, {
    generateFrontend: true,
    generateBackend: true,
    useClaude: true
  });

  if (!coderResult.success || !coderResult.data) {
    console.error("❌ Coder failed:", coderResult.error);
    return;
  }

  const coderJSON: CoderPhaseJSON = coderResult.data;
  console.log(`   ✅ Code complete: ${coderResult.files_written.length} files written`);
  console.log(`   📎 References research from: ${coderJSON.input_references.research_timestamp}`);
  console.log(`   📎 References plan from: ${coderJSON.input_references.plan_timestamp}`);

  // Step 4: SQL (receives all previous contexts)
  console.log("\n🗄️ Step 4: SQL...");
  const sqlResult = await runSqlPhaseJSON(researchJSON, plannerJSON, coderJSON, repoPath, {
    includeRLS: true,
    includeSeedData: true
  });

  if (!sqlResult.success || !sqlResult.data) {
    console.error("❌ SQL failed:", sqlResult.error);
    return;
  }

  const sqlJSON: SqlEditorPhaseJSON = sqlResult.data;
  console.log(`   ✅ SQL complete: ${sqlJSON.database_schema_created.tables.length} tables`);
  console.log(`   📎 References all previous phases`);

  // Step 5: Tester (has FULL visibility)
  console.log("\n🧪 Step 5: Tester...");
  const testerResult = await runTesterPhaseJSON(
    researchJSON,
    plannerJSON,
    coderJSON,
    sqlJSON,
    repoPath,
    {
      runNpmTests: true,
      runTypeCheck: true,
      runLinting: true,
      runSecurityAudit: true
    }
  );

  if (!testerResult.success || !testerResult.data) {
    console.error("❌ Tester failed:", testerResult.error);
    return;
  }

  const testerJSON = testerResult.data;
  console.log(`   ✅ Tests complete: ${testerJSON.final_recommendation}`);

  // Build complete context
  const fullContext: PipelineContext = buildPipelineContext({
    research: researchJSON,
    planner: plannerJSON,
    coder: coderJSON,
    sql_editor: sqlJSON,
    tester: testerJSON
  });

  // Generate traceability report
  console.log("\n" + generateTraceabilityReport(fullContext));
}

// ============================================================
// EXAMPLE 3: Trace a Test Failure Back to Source
// ============================================================

function traceTestFailure(context: PipelineContext): void {
  if (!context.tester) {
    console.log("No test results available");
    return;
  }

  // Find failed tests
  const failedTests = context.tester.test_suite.filter(t => t.status === "failed");

  for (const test of failedTests) {
    console.log(`\n❌ FAILED: ${test.name}`);
    console.log(`   Test ID: ${test.test_id}`);
    
    // Trace back to feature
    if (test.depends_on_feature && context.planner) {
      const feature = context.planner.feature_breakdown.phase_1_mvp.find(
        f => f.feature_id === test.depends_on_feature
      );
      if (feature) {
        console.log(`   📋 Feature: ${feature.name}`);
        console.log(`   📋 Description: ${feature.description}`);
      }
    }

    // Trace back to research
    if (test.context_used && context.research) {
      for (const ref of test.context_used) {
        if (ref.includes("potential_challenges")) {
          const challengeIndex = parseInt(ref.split("[")[1]?.split("]")[0] || "0");
          const challenge = context.research.potential_challenges[challengeIndex];
          if (challenge) {
            console.log(`   📊 Related Challenge: ${challenge.challenge}`);
            console.log(`   📊 Proposed Solution: ${challenge.solution}`);
          }
        }
      }
    }

    // Show code files
    if (context.coder) {
      const relatedFiles = context.coder.features_implemented.find(
        f => f.feature_id === test.depends_on_feature
      );
      if (relatedFiles) {
        console.log(`   💻 Related Files: ${relatedFiles.files_created.join(", ")}`);
      }
    }
  }
}

// ============================================================
// EXAMPLE 4: Access Raw Audit Trail
// ============================================================

async function accessAuditTrail(): Promise<void> {
  const result = await runFullPipeline(
    "Build a simple todo app",
    "./workspace/todo-app",
    { stopOnError: false }
  );

  // Raw text is preserved for audit
  if (result.raw_audit_trail.research) {
    console.log("\n📜 Raw Research Output (first 500 chars):");
    console.log(result.raw_audit_trail.research.substring(0, 500));
  }

  if (result.raw_audit_trail.planner) {
    console.log("\n📜 Raw Planner Output (first 500 chars):");
    console.log(result.raw_audit_trail.planner.substring(0, 500));
  }

  // etc.
}

// ============================================================
// RUN EXAMPLES
// ============================================================

// Uncomment to run:
// runFullPipelineExample();
// runStepByStepExample();

export { 
  runFullPipelineExample, 
  runStepByStepExample, 
  traceTestFailure,
  accessAuditTrail 
};

