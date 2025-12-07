// =============================================================================
// COST TRACKER - Track AI spending per pipeline
// =============================================================================

import fs from 'fs';
import path from 'path';

interface ModelCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

interface PipelineCost {
  pipelineId: string;
  timestamp: string;
  totalCost: number;
  breakdown: Array<{
    step: string;
    model: string;
    cost: number;
    tokens: { input: number; output: number };
  }>;
}

export class CostTracker {
  private costs: PipelineCost[] = [];
  private currentPipeline: PipelineCost | null = null;
  
  // Pricing as of Dec 2025 (per 1M tokens)
  private readonly pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'deepseek-chat': { input: 0.27, output: 1.10 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    'kimi-k2-thinking': { input: 0.50, output: 0.60 }, // Kimi K2
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  };
  
  startPipeline(pipelineId: string): void {
    this.currentPipeline = {
      pipelineId,
      timestamp: new Date().toISOString(),
      totalCost: 0,
      breakdown: [],
    };
  }
  
  trackModelCall(
    step: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    
    if (!this.currentPipeline) {
      throw new Error('No active pipeline - call startPipeline() first');
    }
    
    // Normalize model name
    const normalizedModel = this.normalizeModelName(model);
    const pricing = this.pricing[normalizedModel] || { input: 1.0, output: 3.0 };
    
    // Convert to cost per 1M tokens
    const cost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output;
    
    this.currentPipeline.breakdown.push({
      step,
      model: normalizedModel,
      cost,
      tokens: { input: inputTokens, output: outputTokens },
    });
    
    this.currentPipeline.totalCost += cost;
    
    console.log(`   💰 [Cost] ${step}: $${cost.toFixed(4)} (${inputTokens + outputTokens} tokens, ${normalizedModel})`);
    
    return cost;
  }
  
  private normalizeModelName(model: string): string {
    // Normalize common model name variations
    if (model.includes('claude') && model.includes('sonnet')) {
      return 'claude-sonnet-4-5';
    }
    if (model.includes('gpt-4o')) {
      return model.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o';
    }
    if (model.includes('deepseek')) {
      return model.includes('reasoner') ? 'deepseek-reasoner' : 'deepseek-chat';
    }
    if (model.includes('moonshot') || model.includes('kimi')) {
      return 'kimi-k2-thinking';
    }
    if (model.includes('llama') || model.includes('groq')) {
      return 'llama-3.3-70b-versatile';
    }
    if (model.includes('gemini')) {
      return 'gemini-2.5-flash';
    }
    return model;
  }
  
  endPipeline(): PipelineCost {
    if (!this.currentPipeline) {
      throw new Error('No active pipeline');
    }
    
    const finalCost = this.currentPipeline;
    this.costs.push(finalCost);
    
    // Save to disk
    this.saveCosts();
    
    // Print summary
    console.log('\n💰 COST SUMMARY:');
    console.log(`   Total: $${finalCost.totalCost.toFixed(4)}`);
    console.log(`   Breakdown:`);
    
    finalCost.breakdown.forEach((item) => {
      console.log(
        `      ${item.step}: $${item.cost.toFixed(4)} (${item.model})`
      );
    });
    
    // ✅ P2: Cost Alerts
    const stats = CostTracker.getStatistics();
    const avgCost = stats.averageCostPerPipeline;
    
    // Alert if 2x higher than average (and we have enough data)
    if (stats.totalPipelines > 5 && avgCost > 0 && finalCost.totalCost > avgCost * 2) {
      console.warn('\n⚠️ COST ALERT: This pipeline cost 2x more than average!');
      console.warn(`   This run: $${finalCost.totalCost.toFixed(4)}`);
      console.warn(`   Average: $${avgCost.toFixed(4)}`);
      console.warn(`   Breakdown: ${finalCost.breakdown.map(b => `${b.step} (${b.model})`).join(', ')}`);
    }
    
    // Alert if success rate drops below 90%
    if (stats.totalPipelines > 10) {
      const recentCosts = CostTracker.loadCosts().slice(-10);
      const failedRecent = recentCosts.filter(c => 
        c.breakdown.some(b => b.step.toLowerCase().includes('failed'))
      ).length;
      
      const recentSuccessRate = ((10 - failedRecent) / 10) * 100;
      
      if (recentSuccessRate < 90) {
        console.warn('\n⚠️ SUCCESS RATE ALERT: Recent success rate dropped below 90%!');
        console.warn(`   Current: ${recentSuccessRate.toFixed(0)}%`);
        console.warn(`   Failed pipelines in last 10: ${failedRecent}`);
      }
    }
    
    this.currentPipeline = null;
    
    return finalCost;
  }
  
  private saveCosts(): void {
    const costsFile = path.join(__dirname, '..', 'data', 'costs.json');
    
    fs.mkdirSync(path.dirname(costsFile), { recursive: true });
    fs.writeFileSync(costsFile, JSON.stringify(this.costs, null, 2));
  }
  
  static loadCosts(): PipelineCost[] {
    const costsFile = path.join(__dirname, '..', 'data', 'costs.json');
    
    if (!fs.existsSync(costsFile)) {
      return [];
    }
    
    return JSON.parse(fs.readFileSync(costsFile, 'utf-8'));
  }
  
  static getStatistics(): {
    totalSpent: number;
    averageCostPerPipeline: number;
    mostExpensiveStep: string;
    totalPipelines: number;
  } {
    const costs = this.loadCosts();
    
    if (costs.length === 0) {
      return {
        totalSpent: 0,
        averageCostPerPipeline: 0,
        mostExpensiveStep: 'N/A',
        totalPipelines: 0,
      };
    }
    
    const totalSpent = costs.reduce((sum, c) => sum + c.totalCost, 0);
    const averageCostPerPipeline = totalSpent / costs.length;
    
    // Find most expensive step
    const stepCosts = new Map<string, number>();
    costs.forEach((pipeline) => {
      pipeline.breakdown.forEach((item) => {
        stepCosts.set(
          item.step,
          (stepCosts.get(item.step) || 0) + item.cost
        );
      });
    });
    
    const mostExpensiveStep = Array.from(stepCosts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || 'N/A';
    
    return {
      totalSpent,
      averageCostPerPipeline,
      mostExpensiveStep,
      totalPipelines: costs.length,
    };
  }
}

