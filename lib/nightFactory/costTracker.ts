/**
 * COST TRACKER v10
 * Tracks costs by model and tier
 * Compares v9 vs v10 savings
 */

import type { ModelTier } from './modelRouter';

export interface CostEntry {
  model: string;
  tier: ModelTier;
  cost: number;
  tokens: number;
  file: string;
  timestamp: Date;
}

export interface CostSummary {
  totalCost: number;
  byTier: Record<ModelTier, number>;
  byModel: Record<string, number>;
  filesGenerated: number;
  averageCostPerFile: number;
  estimatedV9Cost: number;
  savingsPercent: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  
  /**
   * Track a generation cost
   */
  track(entry: Omit<CostEntry, 'timestamp'>) {
    this.entries.push({
      ...entry,
      timestamp: new Date()
    });
  }
  
  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    const byTier: Record<ModelTier, number> = {
      premium: 0,
      standard: 0,
      economy: 0
    };
    
    const byModel: Record<string, number> = {};
    let totalCost = 0;
    
    for (const entry of this.entries) {
      totalCost += entry.cost;
      byTier[entry.tier] = (byTier[entry.tier] || 0) + entry.cost;
      byModel[entry.model] = (byModel[entry.model] || 0) + entry.cost;
    }
    
    // Estimate v9 cost (all files with Claude Sonnet 4.5)
    const avgClaudeCost = 0.08; // ~$0.08 per file in v9
    const estimatedV9Cost = this.entries.length * avgClaudeCost;
    
    const savingsPercent = estimatedV9Cost > 0 
      ? ((estimatedV9Cost - totalCost) / estimatedV9Cost) * 100 
      : 0;
    
    return {
      totalCost,
      byTier,
      byModel,
      filesGenerated: this.entries.length,
      averageCostPerFile: totalCost / (this.entries.length || 1),
      estimatedV9Cost,
      savingsPercent
    };
  }
  
  /**
   * Get detailed report
   */
  getReport(): string {
    const summary = this.getSummary();
    
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 COST TRACKER REPORT (v10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Total Cost: $${summary.totalCost.toFixed(2)}
📁 Files Generated: ${summary.filesGenerated}
📊 Average Per File: $${summary.averageCostPerFile.toFixed(3)}

🎯 By Tier:
   💎 Premium (Claude):  $${summary.byTier.premium.toFixed(2)}
   📦 Standard (Qwen):   $${summary.byTier.standard.toFixed(2)}
   💰 Economy (DeepSeek): $${summary.byTier.economy.toFixed(2)}

🤖 By Model:
${Object.entries(summary.byModel)
  .map(([model, cost]) => `   ${model}: $${cost.toFixed(2)}`)
  .join('\n')}

💡 v9 vs v10 Comparison:
   v9 Cost (estimated): $${summary.estimatedV9Cost.toFixed(2)}
   v10 Cost (actual):   $${summary.totalCost.toFixed(2)}
   💵 Savings:          $${(summary.estimatedV9Cost - summary.totalCost).toFixed(2)}
   📈 Savings %:        ${summary.savingsPercent.toFixed(1)}%

${summary.savingsPercent > 60 ? '🎉 AMAZING SAVINGS!' : 
  summary.savingsPercent > 40 ? '✅ Great savings!' : 
  summary.savingsPercent > 20 ? '👍 Good savings!' : 
  '⚠️  Less savings than expected'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
  
  /**
   * Get compact summary for logging
   */
  getCompactSummary(): string {
    const summary = this.getSummary();
    return `💰 $${summary.totalCost.toFixed(2)} (${summary.filesGenerated} files, avg $${summary.averageCostPerFile.toFixed(3)}) | Savings: ${summary.savingsPercent.toFixed(0)}%`;
  }
  
  /**
   * Export data for analysis
   */
  exportData(): CostEntry[] {
    return [...this.entries];
  }
  
  /**
   * Reset tracker
   */
  reset() {
    this.entries = [];
  }
}

// Global instance
export const costTracker = new CostTracker();

