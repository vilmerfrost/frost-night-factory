#!/usr/bin/env node

/**
 * ❄️ FROST CLI
 * Command Line Interface for Night Factory (V2 Auto-Pilot)
 */

const BASE_URL = "http://localhost:3000/api/agent/execute";

// Hjälpfunktion för att pausa (sleep)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendCommand(payload) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    console.error("❌ Connection failed. Is 'npm run dev' running?");
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const command = args[0];
const param = args[1]; // Task ID eller Filnamn
const param2 = args[2]; // Prompt eller Stage

console.log("\x1b[36m%s\x1b[0m", "❄️  FROST NIGHT FACTORY CLI (V2 Auto-Pilot)");

(async () => {
  switch (command) {
    // 🔥 AUTO-PILOT MODE
    // Usage: node frost.js run "Build a matrix rain effect"
    case "run":
      if (!param) {
        console.log("⚠️  Please provide a prompt!");
        console.log("Usage: node frost.js run 'Your prompt here'");
        return;
      }

      console.log(`\n🚀 STARTING AUTO-PILOT: "${param}"`);

      // 1. Plan
      console.log("\nPhase 1: 🧠 PLANNING");
      await sendCommand({ action: "write_file", path: "USER_PROMPT.txt", content: param });
      await sendCommand({ action: "start_pipeline", task_id: 1 });
      await wait(3000);

      // 2. Code
      console.log("\nPhase 2: 👨‍💻 CODING");
      await sendCommand({ action: "next_stage", task_id: 1, stage: "planner" });
      await wait(5000);

      // 3. Review
      console.log("\nPhase 3: 🕵️‍♂️ REVIEWING");
      await sendCommand({ action: "next_stage", task_id: 1, stage: "coder" });
      await wait(3000);

      // 4. Logic Fix
      console.log("\nPhase 4: 🔧 LOGIC FIXING");
      await sendCommand({ action: "next_stage", task_id: 1, stage: "reviewer" });
      await wait(5000);

      // 5. TS Polish (NYTT!)
      console.log("\nPhase 5: 🛡️ TYPESCRIPT POLISHING (The 'No Red Lines' Pass)");
      await sendCommand({ action: "next_stage", task_id: 1, stage: "fixer" });

      console.log("\n✨ MISSION ACCOMPLISHED ✨");
      console.log("Your type-safe code is ready in /workspace/App.tsx");
      break;

    // STARTA EN NY TASK
    // Usage: node frost.js start "Build a game"
    case "start":
      if (!param) {
        console.log("⚠️ Usage: node frost.js start \"<your prompt>\"");
        return;
      }

      console.log(`🚀 Initializing Task... Prompt: "${param}"`);

      // 1. Skriv prompten
      await sendCommand({
        action: "write_file",
        path: "USER_PROMPT.txt",
        content: param || "Default prompt",
      });

      // 2. Starta pipeline (Task ID 1 hårdkodat för enkelhet i V1)
      const startRes = await sendCommand({
        action: "start_pipeline",
        task_id: 1,
      });

      console.log("✅ Pipeline Started:", startRes);
      break;

    // GÅ TILL NÄSTA STEG
    // Usage: node frost.js next planner
    case "next":
      if (!param) {
        console.log("⚠️ Usage: node frost.js next <current_stage>");
        console.log("Stages: planner, coder");
        return;
      }
      console.log(`⏭️  Advancing from stage: ${param}...`);
      const nextRes = await sendCommand({
        action: "next_stage",
        task_id: 1,
        stage: param,
      });
      console.log("✅ Moved to:", nextRes);
      break;

    // LÄS FIL
    // Usage: node frost.js cat PLAN.md
    case "cat":
      if (!param) {
        console.log("⚠️ Usage: node frost.js cat <filename>");
        return;
      }
      const readRes = await sendCommand({
        action: "read_file",
        path: param,
      });
      if (readRes.content) {
        console.log("\n--- FILE CONTENT ---");
        console.log(readRes.content);
        console.log("--------------------\n");
      } else {
        console.log("❌ File not found");
      }
      break;

    // RADERA FIL
    // Usage: node frost.js rm filnamn.txt
    case "rm":
      if (!param) {
        console.log("⚠️ Usage: node frost.js rm <filename>");
        return;
      }
      await sendCommand({ action: "delete_file", path: param });
      console.log(`🗑️ Deleted ${param}`);
      break;

    // LISTA FILER
    // Usage: node frost.js ls
    case "ls":
      const listRes = await sendCommand({
        action: "list_files",
        dir: "",
      });
      if (Array.isArray(listRes)) {
        console.log("\n--- FILES ---");
        listRes.forEach((f) => console.log(`  📄 ${f}`));
        console.log("-------------\n");
      } else {
        console.log("❌ Failed to list files");
      }
      break;

    default:
      console.log("\nCommands:");
      console.log("  run <prompt>     -> 🚀 Auto-pilot: Run full pipeline");
      console.log("  start <prompt>   -> Start new task");
      console.log("  next <stage>     -> Trigger next stage (planner/coder)");
      console.log("  cat <file>       -> Read file content");
      console.log("  rm <file>        -> Delete file");
      console.log("  ls               -> List all files");
      break;
  }
})();

