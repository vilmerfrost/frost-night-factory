#!/usr/bin/env node
/**
 * Budget Report Tool (Night Factory v2.1)
 * View current budget status, breakdown, and history
 * 
 * Usage:
 *   node scripts/budget_report.js           # Show current status
 *   node scripts/budget_report.js --reset   # Reset meter (careful!)
 */
import { getBudgetSummary, resetBudget } from "./budget.js";

const args = process.argv.slice(2);

(async () => {
  // Handle reset command
  if (args.includes("--reset")) {
    const confirm = args.includes("--confirm");
    if (!confirm) {
      console.error("⚠️  Budget reset requires confirmation.");
      console.error("   Run with: node scripts/budget_report.js --reset --confirm");
      process.exit(1);
    }
    await resetBudget();
    return;
  }

  // Show budget summary
  try {
    const summary = await getBudgetSummary();
    
    console.log("\n" + "=".repeat(60));
    console.log("  NIGHT FACTORY BUDGET REPORT");
    console.log("=".repeat(60) + "\n");
    
    console.log(summary.summary);
    
    // Show detailed steps if available
    if (summary.steps && summary.steps.length > 0) {
      console.log("\n" + "-".repeat(60));
      console.log("  DETAILED STEPS");
      console.log("-".repeat(60));
      
      summary.steps.forEach((step, i) => {
        const time = new Date(step.timestamp).toLocaleTimeString();
        console.log(
          `${i + 1}. [${time}] ${step.step}: ` +
          `${step.kind} x${step.count} = ${step.cost.toFixed(2)} SEK ` +
          `(total: ${step.totalAfter.toFixed(2)} SEK)`
        );
      });
    }
    
    // Show warnings if any
    if (summary.warnings && summary.warnings.length > 0) {
      console.log("\n" + "-".repeat(60));
      console.log("  ⚠️  WARNINGS");
      console.log("-".repeat(60));
      summary.warnings.forEach(w => console.log(`  - Budget threshold crossed: ${w}`));
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    
    // Status code based on budget usage
    const percent = summary.percent;
    if (percent >= 90) {
      console.log("🔴 Status: CRITICAL - Budget nearly exhausted");
      process.exit(2);
    } else if (percent >= 75) {
      console.log("🟡 Status: WARNING - Budget usage high");
      process.exit(1);
    } else {
      console.log("🟢 Status: OK - Budget usage normal");
      process.exit(0);
    }
    
  } catch (err) {
    console.error(`\n❌ Failed to generate budget report:\n${err.message}`);
    process.exit(1);
  }
})();
