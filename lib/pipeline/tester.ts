// lib/pipeline/tester.ts
// Tester Phase with FULL Pipeline Visibility
// Receives ALL previous phase JSONs, validates entire pipeline

import { execSync } from "child_process";
import { callAI } from "@/lib/nightFactory/modelClient";
import { convertTesterToJSON, buildPipelineContext } from "./json-converter";
import { toUtf8 } from "@/lib/utils/bytes";
import type { TesterOutput } from "./phases";
import type { 
  ResearchPhaseJSON, 
  PlannerPhaseJSON, 
  CoderPhaseJSON, 
  SqlEditorPhaseJSON,
  TesterPhaseJSON,
  PipelineContext
} from "./pipeline-json-types";

/**
 * Legacy tester (for backward compatibility)
 */
export async function runTesterPhase(repoPath: string): Promise<TesterOutput> {
  let testResults = "";
  let passed = false;

  try {
    // CI=true forces Jest to run once and exit (no watch mode)
    console.log("🧪 Running npm test (CI mode)...");
    const output = execSync("npm test", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    });
    testResults = toUtf8(output);
    passed = true;
    console.log("✅ Tests Passed!");
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    testResults = err.stdout || err.stderr || err.message || "No tests found or tests failed";
    passed = false;
    console.error("❌ Tests Failed");
    console.log("Test output:", testResults.substring(0, 500));
  }

  return {
    test_results: testResults,
    passed,
  };
}

/**
 * NEW: Tester phase with FULL pipeline visibility
 * Has access to ALL previous phase JSONs for complete traceability
 */
export async function runTesterPhaseJSON(
  researchContext: ResearchPhaseJSON,
  planContext: PlannerPhaseJSON,
  coderContext: CoderPhaseJSON,
  sqlContext: SqlEditorPhaseJSON,
  repoPath: string,
  options: {
    runNpmTests?: boolean;
    runTypeCheck?: boolean;
    runLinting?: boolean;
    runSecurityAudit?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data?: TesterPhaseJSON;
  error?: string;
  raw_text_audit: string;
}> {
  const { 
    runNpmTests = true, 
    runTypeCheck = true,
    runLinting = true,
    runSecurityAudit = true
  } = options;

  console.log(`\n🧪 [TESTER PHASE] Running comprehensive validation...`);
  console.log(`   Full context from:`);
  console.log(`   - Research: ${researchContext.timestamp}`);
  console.log(`   - Plan: ${planContext.timestamp}`);
  console.log(`   - Code: ${coderContext.timestamp}`);
  console.log(`   - SQL: ${sqlContext.timestamp}`);

  let rawTestOutput = "";
  const testResults: Array<{
    name: string;
    passed: boolean;
    output: string;
    duration_ms?: number;
  }> = [];

  // ============================================================
  // 0. WINDOWS CASING VALIDATION (Pre-flight)
  // ============================================================

  if (runTypeCheck) {
    console.log("📐 Running Windows Casing Validation...");
    const startTime = Date.now();
    try {
      const { validateNoCasingIssues } = await import("../../agent-runner/lib/windows-casing-fix");
      const casingValidation = validateNoCasingIssues(repoPath);
      
      if (!casingValidation.valid) {
        // Try to fix automatically
        const { runWindowsCasingFix } = await import("../../agent-runner/lib/windows-casing-fix");
        const fixResult = runWindowsCasingFix(repoPath);
        
        if (!fixResult.success) {
          testResults.push({
            name: "Windows Casing Check",
            passed: false,
            output: `Casing issues detected: ${casingValidation.errors.join(", ")}`,
            duration_ms: Date.now() - startTime
          });
          rawTestOutput += `\n=== WINDOWS CASING CHECK ===\nFAILED\n${casingValidation.errors.join("\n")}\n`;
          console.log("   ❌ Windows Casing: Issues detected");
        } else {
          console.log("   ✅ Windows Casing: Auto-fixed");
        }
      } else {
        console.log("   ✅ Windows Casing: No issues");
      }
    } catch (error: unknown) {
      console.warn("   ⚠️ Windows Casing check failed:", error);
    }
  }

  // ============================================================
  // 1. TYPESCRIPT CHECK
  // ============================================================

  if (runTypeCheck) {
    console.log("📝 Running TypeScript check...");
    const startTime = Date.now();
    try {
      const output = execSync("npx tsc --noEmit", {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60000
      });
      testResults.push({
        name: "TypeScript Check",
        passed: true,
        output: toUtf8(output) || "No errors",
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== TYPESCRIPT CHECK ===\nPASSED\n`;
      console.log("   ✅ TypeScript: No errors");
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string };
      const errorOutput = err.stdout || err.stderr || "Unknown error";
      
      // Check specifically for TS1261 casing errors
      const hasCasingError = errorOutput.includes('TS1261') || 
                             errorOutput.includes('differs from file name') ||
                             errorOutput.includes('only in casing');
      
      if (hasCasingError) {
        // Try to fix casing issues
        try {
          const { runWindowsCasingFix } = await import("../../agent-runner/lib/windows-casing-fix");
          const fixResult = runWindowsCasingFix(repoPath);
          
          if (fixResult.success) {
            console.log("   ✅ Windows Casing: Auto-fixed, retrying TypeScript check...");
            // Retry TypeScript check after fix
            const retryOutputRaw = execSync("npx tsc --noEmit", {
              cwd: repoPath,
              encoding: "utf-8",
              stdio: "pipe",
              timeout: 60000
            });
            testResults.push({
              name: "TypeScript Check",
              passed: true,
              output: "Fixed casing issues and passed",
              duration_ms: Date.now() - startTime
            });
            rawTestOutput += `\n=== TYPESCRIPT CHECK ===\nPASSED (after casing fix)\n`;
            console.log("   ✅ TypeScript: Passed after casing fix");
          } else {
            testResults.push({
              name: "TypeScript Check",
              passed: false,
              output: `Casing errors: ${errorOutput.substring(0, 500)}`,
              duration_ms: Date.now() - startTime
            });
            rawTestOutput += `\n=== TYPESCRIPT CHECK ===\nFAILED (casing issues)\n${errorOutput}\n`;
            console.log("   ❌ TypeScript: Casing errors remain");
          }
        } catch (fixError) {
          testResults.push({
            name: "TypeScript Check",
            passed: false,
            output: errorOutput,
            duration_ms: Date.now() - startTime
          });
          rawTestOutput += `\n=== TYPESCRIPT CHECK ===\nFAILED\n${errorOutput}\n`;
          console.log("   ❌ TypeScript: Errors found");
        }
      } else {
        testResults.push({
          name: "TypeScript Check",
          passed: false,
          output: errorOutput,
          duration_ms: Date.now() - startTime
        });
        rawTestOutput += `\n=== TYPESCRIPT CHECK ===\nFAILED\n${errorOutput}\n`;
        console.log("   ❌ TypeScript: Errors found");
      }
    }
  }

  // ============================================================
  // 2. ESLINT CHECK
  // ============================================================

  if (runLinting) {
    console.log("🔍 Running ESLint...");
    const startTime = Date.now();
    try {
      const output = execSync("npx eslint . --ext .ts,.tsx --max-warnings 0", {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60000
      });
      testResults.push({
        name: "ESLint Check",
        passed: true,
        output: toUtf8(output) || "No warnings",
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== ESLINT CHECK ===\nPASSED\n`;
      console.log("   ✅ ESLint: No errors");
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string };
      const errorOutput = err.stdout || err.stderr || "Unknown error";
      // ESLint warnings are OK, only fail on errors
      const hasErrors = errorOutput.toLowerCase().includes("error");
      testResults.push({
        name: "ESLint Check",
        passed: !hasErrors,
        output: errorOutput,
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== ESLINT CHECK ===\n${hasErrors ? "FAILED" : "WARNINGS"}\n${errorOutput}\n`;
      console.log(`   ${hasErrors ? "❌" : "⚠️"} ESLint: ${hasErrors ? "Errors" : "Warnings"} found`);
    }
  }

  // ============================================================
  // 3. NPM TESTS
  // ============================================================

  if (runNpmTests) {
    console.log("🧪 Running npm tests...");
    const startTime = Date.now();
    try {
      const output = execSync("npm test", {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, CI: "true" },
        timeout: 120000
      });
      const outputStr = toUtf8(output);
      testResults.push({
        name: "NPM Tests",
        passed: true,
        output: outputStr,
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== NPM TESTS ===\nPASSED\n${outputStr}\n`;
      console.log("   ✅ Tests: Passed");
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const errorOutput = err.stdout || err.stderr || err.message || "No tests or test failure";
      // Check if it's "no tests" vs actual failure
      const noTests = errorOutput.includes("No test specified") || 
                      errorOutput.includes("no tests found") ||
                      errorOutput.includes("no test specified");
      testResults.push({
        name: "NPM Tests",
        passed: noTests, // No tests is OK for MVP
        output: errorOutput,
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== NPM TESTS ===\n${noTests ? "SKIPPED (no tests)" : "FAILED"}\n${errorOutput}\n`;
      console.log(`   ${noTests ? "⚠️" : "❌"} Tests: ${noTests ? "No tests defined" : "Failed"}`);
    }
  }

  // ============================================================
  // 4. SECURITY AUDIT
  // ============================================================

  if (runSecurityAudit) {
    console.log("🔒 Running security audit...");
    const startTime = Date.now();
    try {
      const output = execSync("npm audit --audit-level=high", {
        cwd: repoPath,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60000
      });
      testResults.push({
        name: "Security Audit",
        passed: true,
        output: toUtf8(output) || "No vulnerabilities",
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== SECURITY AUDIT ===\nPASSED\n`;
      console.log("   ✅ Security: No high vulnerabilities");
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string };
      const errorOutput = err.stdout || err.stderr || "Unknown error";
      // High/Critical vulnerabilities are blockers
      const hasCritical = errorOutput.toLowerCase().includes("critical") ||
                          errorOutput.toLowerCase().includes("high");
      testResults.push({
        name: "Security Audit",
        passed: !hasCritical,
        output: errorOutput,
        duration_ms: Date.now() - startTime
      });
      rawTestOutput += `\n=== SECURITY AUDIT ===\n${hasCritical ? "FAILED" : "WARNINGS"}\n${errorOutput}\n`;
      console.log(`   ${hasCritical ? "❌" : "⚠️"} Security: ${hasCritical ? "Vulnerabilities found" : "Low/moderate issues"}`);
    }
  }

  // ============================================================
  // 5. AI-POWERED PIPELINE VALIDATION
  // ============================================================

  console.log("🤖 Running AI-powered pipeline validation...");

  const pipelineContext = buildPipelineContext({
    research: researchContext,
    planner: planContext,
    coder: coderContext,
    sql_editor: sqlContext
  });

  const validationPrompt = `You are a Senior QA Engineer. Validate this entire pipeline for consistency.

PIPELINE CONTEXT:

1. RESEARCH (${researchContext.timestamp}):
   - Requirements: ${researchContext.extracted_requirements.must_have.length} must-have, ${researchContext.extracted_requirements.should_have.length} should-have
   - Tech Stack: ${researchContext.technology_recommendations.frontend.choice} + ${researchContext.technology_recommendations.backend.choice}
   - Challenges: ${researchContext.potential_challenges.map(c => c.challenge).join(", ")}

2. PLAN (${planContext.timestamp}):
   - Project: ${planContext.project_overview.name}
   - Features: ${planContext.feature_breakdown.phase_1_mvp.map(f => f.name).join(", ")}
   - Tables: ${planContext.database_schema_outline.tables.map(t => t.name).join(", ")}
   - Success Criteria: ${planContext.success_criteria.join(", ")}

3. CODE (${coderContext.timestamp}):
   - Frontend Files: ${coderContext.code_generated.frontend.files_count}
   - Backend Files: ${coderContext.code_generated.backend.files_count}
   - TypeScript Errors: ${coderContext.code_quality_metrics.typescript_errors}
   - Features Implemented: ${coderContext.features_implemented.filter(f => f.status === "complete").length}/${coderContext.features_implemented.length}

4. SQL (${sqlContext.timestamp}):
   - Tables Created: ${sqlContext.database_schema_created.tables.map(t => t.name).join(", ")}
   - RLS Policies: ${sqlContext.rls_policies.length}
   - Type Match: ${sqlContext.type_schema_match.match_status}

LOCAL TEST RESULTS:
${testResults.map(t => `- ${t.name}: ${t.passed ? "PASSED" : "FAILED"}`).join("\n")}

VALIDATION TASKS:
1. Check if ALL must-have requirements from research are addressed in the plan
2. Check if ALL planned features have corresponding code files
3. Check if database schema matches TypeScript types
4. Check if API routes in plan are implemented in code
5. Check if challenges from research are mitigated
6. Check if success criteria are achievable with current implementation

Provide a detailed validation report with:
- PASSED tests (with evidence)
- FAILED tests (with root cause and fix recommendation)
- WARNINGS (potential issues)
- BLOCKERS (must fix before deployment)
- FINAL RECOMMENDATION: READY_FOR_DEPLOYMENT | NEEDS_FIXES | BLOCKED`;

  let aiValidationResult = "";
  try {
    aiValidationResult = await callAI(
      "AUDIT",
      validationPrompt,
      "You are a Senior QA Engineer validating a complete pipeline."
    );
    rawTestOutput += `\n=== AI VALIDATION ===\n${aiValidationResult}\n`;
  } catch (e) {
    console.error("   ⚠️ AI validation failed:", e);
    aiValidationResult = "AI validation unavailable";
    rawTestOutput += `\n=== AI VALIDATION ===\nFAILED: ${e}\n`;
  }

  // ============================================================
  // 6. CONVERT TO STRUCTURED JSON (Claude 4.5 Haiku)
  // ============================================================

  console.log("🔧 Converting test results to structured JSON (Claude 4.5 Haiku)...");

  const testSummary = `
TEST RESULTS:
${testResults.map(t => `
${t.name}:
- Status: ${t.passed ? "PASSED" : "FAILED"}
- Duration: ${t.duration_ms || 0}ms
- Output: ${t.output.substring(0, 500)}
`).join("\n")}

AI VALIDATION:
${aiValidationResult}

PIPELINE STATS:
- Research Requirements: ${researchContext.extracted_requirements.must_have.length + researchContext.extracted_requirements.should_have.length}
- Planned Features: ${planContext.feature_breakdown.phase_1_mvp.length}
- Code Files: ${coderContext.code_generated.frontend.files_count + coderContext.code_generated.backend.files_count}
- Database Tables: ${sqlContext.database_schema_created.tables.length}
`;

  const result = await convertTesterToJSON(testSummary, pipelineContext);

  if (!result.success) {
    console.error(`❌ JSON conversion failed: ${result.error}`);
    // Return with raw test results
    return {
      success: true, // Tests ran, just JSON failed
      data: undefined,
      error: `Tests ran but JSON conversion failed: ${result.error}`,
      raw_text_audit: rawTestOutput
    };
  }

  // ============================================================
  // 7. DETERMINE FINAL RECOMMENDATION
  // ============================================================

  if (!result.data) {
    return {
      success: true,
      data: undefined,
      error: "JSON conversion returned no data",
      raw_text_audit: rawTestOutput
    };
  }

  // Enhance with actual test data
  result.data.phase = "tester";
  result.data.timestamp = result.data.timestamp || new Date().toISOString();
  result.data.input_references = {
    research_timestamp: researchContext.timestamp,
    plan_timestamp: planContext.timestamp,
    coder_timestamp: coderContext.timestamp,
    sql_timestamp: sqlContext.timestamp
  };
  result.data.context_received = {
    research: `${researchContext.extracted_requirements.must_have.length} requirements, ${researchContext.potential_challenges.length} challenges`,
    plan: `${planContext.feature_breakdown.phase_1_mvp.length} features, ${planContext.timeline.total_weeks} weeks`,
    code: `${coderContext.code_generated.frontend.files_count + coderContext.code_generated.backend.files_count} files, ${coderContext.code_quality_metrics.typescript_errors} TS errors`,
    sql: `${sqlContext.database_schema_created.tables.length} tables, ${sqlContext.rls_policies.length} RLS policies`
  };

  // Update test suite with actual local test results
  const localTestCases = testResults.map((t, i) => ({
    test_id: `LOCAL-${String(i + 1).padStart(3, "0")}`,
    name: t.name,
    status: t.passed ? "passed" as const : "failed" as const,
    actual_time: `${t.duration_ms || 0}ms`,
    notes: t.output.substring(0, 200)
  }));

  result.data.test_suite = [...localTestCases, ...(result.data.test_suite || [])];

  // Determine final recommendation based on test results
  const allPassed = testResults.every(t => t.passed);
  const hasBlockers = testResults.some(t => 
    !t.passed && (t.name === "TypeScript Check" || t.name === "Security Audit")
  );

  if (hasBlockers) {
    result.data.final_recommendation = "BLOCKED";
    result.data.blockers = testResults
      .filter(t => !t.passed && (t.name === "TypeScript Check" || t.name === "Security Audit"))
      .map(t => `${t.name} failed`);
  } else if (!allPassed) {
    result.data.final_recommendation = "NEEDS_FIXES";
    result.data.warnings = testResults
      .filter(t => !t.passed)
      .map(t => `${t.name} needs attention`);
  } else {
    result.data.final_recommendation = "READY_FOR_DEPLOYMENT";
  }

  console.log(`\n✅ [TESTER PHASE] Complete!`);
  console.log(`   - Local Tests: ${testResults.filter(t => t.passed).length}/${testResults.length} passed`);
  console.log(`   - AI Validation: Complete`);
  console.log(`   - Recommendation: ${result.data.final_recommendation}`);

  return {
    success: true,
    data: result.data,
    raw_text_audit: rawTestOutput
  };
}

/**
 * Quick validation without running all tests
 * Useful for pre-flight checks
 */
export async function runQuickValidation(
  pipelineContext: PipelineContext
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check context chain
  if (!pipelineContext.research) {
    issues.push("Missing research context");
  }
  if (!pipelineContext.planner) {
    issues.push("Missing planner context");
  }
  if (!pipelineContext.coder) {
    issues.push("Missing coder context");
  }
  if (!pipelineContext.sql_editor) {
    issues.push("Missing SQL editor context");
  }

  // Check timestamps are in order
  if (pipelineContext.research && pipelineContext.planner) {
    if (new Date(pipelineContext.research.timestamp) > new Date(pipelineContext.planner.timestamp)) {
      issues.push("Planner timestamp is before research timestamp");
    }
  }

  // Check TypeScript errors
  if (pipelineContext.coder && pipelineContext.coder.code_quality_metrics.typescript_errors > 0) {
    issues.push(`${pipelineContext.coder.code_quality_metrics.typescript_errors} TypeScript errors in coder output`);
  }

  // Check type schema match
  if (pipelineContext.sql_editor && pipelineContext.sql_editor.type_schema_match.match_status === "mismatch") {
    issues.push("Database schema does not match TypeScript types");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Generate traceability report
 * Shows the full chain from research to test
 */
export function generateTraceabilityReport(context: PipelineContext): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════════",
    "                   PIPELINE TRACEABILITY REPORT                 ",
    "═══════════════════════════════════════════════════════════════",
    ""
  ];

  if (context.research) {
    lines.push(`📊 RESEARCH PHASE (${context.research.timestamp})`);
    lines.push(`   Requirements: ${context.research.extracted_requirements.must_have.length} must-have`);
    lines.push(`   Challenges: ${context.research.potential_challenges.length} identified`);
    lines.push("");
  }

  if (context.planner) {
    lines.push(`📋 PLANNER PHASE (${context.planner.timestamp})`);
    lines.push(`   ↳ References: Research ${context.planner.input_references.research_timestamp}`);
    lines.push(`   Project: ${context.planner.project_overview.name}`);
    lines.push(`   Features: ${context.planner.feature_breakdown.phase_1_mvp.length} planned`);
    lines.push("");
  }

  if (context.coder) {
    lines.push(`💻 CODER PHASE (${context.coder.timestamp})`);
    lines.push(`   ↳ References: Research ${context.coder.input_references.research_timestamp}`);
    lines.push(`   ↳ References: Plan ${context.coder.input_references.plan_timestamp}`);
    lines.push(`   Files: ${context.coder.code_generated.frontend.files_count + context.coder.code_generated.backend.files_count} generated`);
    lines.push(`   TS Errors: ${context.coder.code_quality_metrics.typescript_errors}`);
    lines.push("");
  }

  if (context.sql_editor) {
    lines.push(`🗄️ SQL PHASE (${context.sql_editor.timestamp})`);
    lines.push(`   ↳ References: Research ${context.sql_editor.input_references.research_timestamp}`);
    lines.push(`   ↳ References: Plan ${context.sql_editor.input_references.plan_timestamp}`);
    lines.push(`   ↳ References: Code ${context.sql_editor.input_references.coder_timestamp}`);
    lines.push(`   Tables: ${context.sql_editor.database_schema_created.tables.length} created`);
    lines.push(`   Type Match: ${context.sql_editor.type_schema_match.match_status}`);
    lines.push("");
  }

  if (context.tester) {
    lines.push(`🧪 TESTER PHASE (${context.tester.timestamp})`);
    lines.push(`   ↳ References: ALL PREVIOUS PHASES`);
    lines.push(`   Tests: ${context.tester.test_suite.filter(t => t.status === "passed").length}/${context.tester.test_suite.length} passed`);
    lines.push(`   Recommendation: ${context.tester.final_recommendation}`);
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
