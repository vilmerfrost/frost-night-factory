// agent-runner/index.ts
// Main entry point - runs both dispatcher and pipeline runner

// ✅ LAYER 1: Singleton Guard - Prevent duplicate initialization
const g = globalThis as any;
if (g.__FNF_RUNNER_STARTED__) {
  console.warn("⚠️ Agent Runner already started in this process. Skipping duplicate init.");
  process.exit(0);
}
g.__FNF_RUNNER_STARTED__ = true;

import path from "path";
import fs from "fs";
import { startDispatcher } from "./dispatcher";
import { startPipelineRunner } from "./pipeline-runner";

// ═══════════════════════════════════════════════════════════════════
// 🔥 GLOBAL ERROR HANDLERS: Prevent silent crashes
// ═══════════════════════════════════════════════════════════════════
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL: Unhandled Rejection at:', promise);
  console.error('   Reason:', reason);
  console.error('   Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
  
  // Optional: Log to Supabase 'pipeline_errors' table
  // TODO: Implement error logging to database
  
  // Don't exit - let the process continue but log the error
});

process.on('uncaughtException', (error) => {
  console.error('🔥 CRITICAL: Uncaught Exception:', error.message);
  console.error('   Stack:', error.stack);
  
  // Log to console before exiting
  console.error('   Process will exit in 5 seconds...');
  
  // Give time for logs to flush
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

console.log("❄️  Frost Night Factory Agent Runner");
console.log("Starting dispatcher and pipeline runner...\n");

// 🔒 SÄKERHET: Definiera sandbox (kuvös) för agenten
// Denna mapp ligger utanför din källkod, eller i en ignorerad mapp
const SANDBOX_ROOT = path.resolve(__dirname, "../workspace/sandbox");

// Se till att mappen finns
if (!fs.existsSync(SANDBOX_ROOT)) {
  console.log(`🛠️ Creating sandbox directory: ${SANDBOX_ROOT}`);
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
}

console.log(`🔒 SECURITY: Agent is confined to: ${SANDBOX_ROOT}`);

// Start both loops concurrently using idempotent start functions
Promise.all([
  startDispatcher().catch((e) => {
    console.error("💥 Fatal dispatcher error", e);
    process.exit(1);
  }),
  startPipelineRunner(SANDBOX_ROOT).catch((e) => {
    console.error("💥 Fatal pipeline runner error", e);
    process.exit(1);
  }),
]);
