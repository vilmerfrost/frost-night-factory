// agent-runner/index.ts
// Main entry point - runs both dispatcher and pipeline runner
import path from "path";
import fs from "fs";
import { dispatcherLoop } from "./dispatcher";
import { runPipelineLoop } from "./pipeline-runner";

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

// Start both loops concurrently
Promise.all([
  dispatcherLoop().catch((e) => {
    console.error("💥 Fatal dispatcher error", e);
    process.exit(1);
  }),
  runPipelineLoop(SANDBOX_ROOT).catch((e) => {
    console.error("💥 Fatal pipeline runner error", e);
    process.exit(1);
  }),
]);
