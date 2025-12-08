// =============================================================================
// LOOP PREVENTION - Stops infinite loops with multiple termination conditions
// =============================================================================
export class LoopPrevention {
    iterationCount = 0;
    lastErrors = [];
    errorCounts = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    shouldContinue(currentErrors) {
        this.iterationCount++;
        console.log(`\n🔁 Iteration ${this.iterationCount}/${this.config.maxIterations}`);
        // 1. HARD LIMIT
        if (this.iterationCount >= this.config.maxIterations) {
            return {
                continue: false,
                reason: `❌ HARD STOP: Max iterations (${this.config.maxIterations}) reached`
            };
        }
        // 2. CHECK FOR STUCK (Same error repeating)
        for (const error of currentErrors) {
            const count = (this.errorCounts.get(error) || 0) + 1;
            this.errorCounts.set(error, count);
            const budget = this.config.errorBudget.get(error) || 3;
            if (count > budget) {
                return {
                    continue: false,
                    reason: `❌ STUCK: Error "${error.substring(0, 50)}..." seen ${count} times (budget: ${budget})`
                };
            }
        }
        // 3. CHECK FOR DIVERGENCE (Errors getting worse)
        if (currentErrors.length > 0 && this.lastErrors.length > 0) {
            if (currentErrors.length > this.lastErrors.length * 1.5) {
                return {
                    continue: false,
                    reason: `❌ DIVERGING: Error count increased ${this.lastErrors.length} → ${currentErrors.length}`
                };
            }
        }
        this.lastErrors = [...currentErrors];
        console.log(`   ✅ Can continue`);
        return { continue: true };
    }
    reset() {
        this.iterationCount = 0;
        this.lastErrors = [];
        this.errorCounts.clear();
    }
    getStatus() {
        return {
            iteration: this.iterationCount,
            maxIterations: this.config.maxIterations,
            errorCounts: Object.fromEntries(this.errorCounts)
        };
    }
}
