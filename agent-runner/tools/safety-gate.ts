// agent-runner/tools/safety-gate.ts
import { execSync } from "node:child_process";

/**
 * Safety Gate: Runs all critical checks before deployment.
 * 
 * This ensures:
 * - TypeScript compiles without errors
 * - Unit tests pass
 * - Workspace root consistency
 * - Claude resilience works
 * - No forbidden patterns
 * 
 * Exit code: 0 = PASS, 1 = FAIL
 */
function run(cmd: string, description: string): void {
  console.log(`\n🔍 [Safety Gate] ${description}...`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
    console.log(`✅ [Safety Gate] ${description} PASSED`);
  } catch (error: any) {
    console.error(`❌ [Safety Gate] ${description} FAILED`);
    throw error;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          FROST NIGHT FACTORY - SAFETY GATE                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  try {
    // 1) TypeScript compilation (core)
    run(
      "npx tsc -p tsconfig.core.json --noEmit --pretty false",
      "TypeScript core compilation"
    );

    // 2) TypeScript compilation (tools)
    run(
      "npx tsc -p tsconfig.tools.json --noEmit --pretty false",
      "TypeScript tools compilation"
    );

    // 3) Workspace root consistency
    run(
      "npx tsx test-workspace-root-consistency.ts",
      "Workspace root consistency"
    );

    // 4) Claude resilience (unit test)
    run(
      "npx tsx test-claude-resilience.ts",
      "Claude resilience unit test"
    );

    // 5) Claude overload shortcircuit (integration test)
    run(
      "npx tsx test-claude-overload-shortcircuit.ts",
      "Claude overload shortcircuit"
    );

    // 6) ESM Hygiene Gate (prevents require() without createRequire)
    run(
      "npx tsx tools/esm-hygiene-gate.ts",
      "ESM hygiene check"
    );

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              ✅ SAFETY GATE PASSED                            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    process.exit(0);
  } catch (error: any) {
    console.error("\n╔══════════════════════════════════════════════════════════════╗");
    console.error("║              ❌ SAFETY GATE FAILED                             ║");
    console.error("╚══════════════════════════════════════════════════════════════╝\n");
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();

