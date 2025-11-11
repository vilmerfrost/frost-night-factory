/**
 * Budget Meter & Guardrails (Night Factory v2.1)
 * Tracks API call costs and enforces budget limits
 */
import fs from "fs/promises";

const CONFIG_FILE = "config/router.json";
const METER_FILE = "reports/budget_meter.json";

/**
 * Load budget configuration
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Failed to load budget config: ${err.message}`);
  }
}

/**
 * Load or initialize budget meter
 */
async function loadMeter() {
  try {
    const data = await fs.readFile(METER_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {
      total: 0,
      by: {},
      steps: [],
      startTime: new Date().toISOString(),
      warnings: []
    };
  }
}

/**
 * Save budget meter to file
 */
async function saveMeter(meter) {
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(METER_FILE, JSON.stringify(meter, null, 2));
}

/**
 * Get cost visualization bar
 */
function getCostBar(spent, max, width = 20) {
  const percent = Math.min(100, (spent / max) * 100);
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percent.toFixed(1)}%`;
}

/**
 * Check if spending is allowed and update meter
 * @param {string} kind - Type of API call (e.g., 'gemini_call', 'perplexity_call')
 * @param {number} count - Number of calls
 * @param {string} step - Step name for tracking
 * @returns {Promise<{ok: boolean, meter: object, message?: string}>}
 */
export async function canSpend(kind, count = 1, step = "unknown") {
  const cfg = await loadConfig();
  const meter = await loadMeter();
  
  const priceKey = kind + "_SEK";
  const price = cfg.prices[priceKey] || 0;
  const add = price * count;
  const newTotal = meter.total + add;

  // Check total budget
  if (newTotal > cfg.night_total_SEK_max) {
    const remaining = cfg.night_total_SEK_max - meter.total;
    return {
      ok: false,
      meter,
      message: `❌ Budget cap reached!\n` +
               `   Spent: ${meter.total.toFixed(2)} SEK\n` +
               `   Limit: ${cfg.night_total_SEK_max} SEK\n` +
               `   Remaining: ${remaining.toFixed(2)} SEK\n` +
               `   This operation would add: ${add.toFixed(2)} SEK (${count} × ${kind})`
    };
  }

  // Check per-task budget (if applicable)
  const taskTotal = (meter.by[kind] || 0) + add;
  if (cfg.per_task_SEK_max && taskTotal > cfg.per_task_SEK_max) {
    return {
      ok: false,
      meter,
      message: `❌ Per-task budget exceeded for ${kind}!\n` +
               `   Task spent: ${(meter.by[kind] || 0).toFixed(2)} SEK\n` +
               `   Task limit: ${cfg.per_task_SEK_max} SEK\n` +
               `   This operation would add: ${add.toFixed(2)} SEK`
    };
  }

  // Update meter
  meter.total = newTotal;
  meter.by[kind] = (meter.by[kind] || 0) + add;
  meter.steps.push({
    timestamp: new Date().toISOString(),
    step,
    kind,
    count,
    cost: add,
    totalAfter: newTotal
  });

  // Add warnings at thresholds
  const percent = (newTotal / cfg.night_total_SEK_max) * 100;
  if (percent >= 90 && !meter.warnings.includes('90%')) {
    meter.warnings.push('90%');
    console.warn(`⚠️  Budget at ${percent.toFixed(1)}% (${newTotal.toFixed(2)}/${cfg.night_total_SEK_max} SEK)`);
  } else if (percent >= 75 && !meter.warnings.includes('75%')) {
    meter.warnings.push('75%');
    console.warn(`⚠️  Budget at ${percent.toFixed(1)}% (${newTotal.toFixed(2)}/${cfg.night_total_SEK_max} SEK)`);
  }

  await saveMeter(meter);

  return { ok: true, meter };
}

/**
 * Get budget summary for reporting
 */
export async function getBudgetSummary() {
  const cfg = await loadConfig();
  const meter = await loadMeter();

  const breakdown = Object.entries(meter.by || {})
    .map(([k, v]) => `  - ${k}: ${v.toFixed(2)} SEK`)
    .join('\n');

  const bar = getCostBar(meter.total, cfg.night_total_SEK_max);
  const remaining = cfg.night_total_SEK_max - meter.total;
  const percent = ((meter.total / cfg.night_total_SEK_max) * 100).toFixed(1);

  return {
    total: meter.total,
    max: cfg.night_total_SEK_max,
    remaining,
    percent: parseFloat(percent),
    by: meter.by,
    steps: meter.steps,
    warnings: meter.warnings,
    summary: (
      `📊 Budget Status\n` +
      `${bar}\n` +
      `Spent: ${meter.total.toFixed(2)} SEK / ${cfg.night_total_SEK_max} SEK (${percent}%)\n` +
      `Remaining: ${remaining.toFixed(2)} SEK\n` +
      `\nBreakdown:\n${breakdown || '  (ingen aktivitet)'}\n` +
      `\nSteps: ${meter.steps.length} API calls`
    )
  };
}

/**
 * Reset budget meter (for testing or manual reset)
 */
export async function resetBudget() {
  const meter = {
    total: 0,
    by: {},
    steps: [],
    startTime: new Date().toISOString(),
    warnings: []
  };
  await saveMeter(meter);
  console.log("✅ Budget meter reset");
}
