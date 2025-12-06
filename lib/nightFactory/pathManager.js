// =============================================================================
// PATH MANAGER - Single Source of Truth for all file paths
// =============================================================================
import * as path from 'path';
import * as fs from 'fs';
/**
 * Centralized Path Manager
 * Ensures all paths are consistent and validated
 */
export class PathManager {
    static instance;
    workspaceRoot;
    constructor() {
        // SINGLE SOURCE OF TRUTH
        // 🛡️ FIX: Prevent double agent-runner in path
        // If we're already in agent-runner/, use it directly
        // Otherwise, go into agent-runner/workspace/sandbox
        const cwd = process.cwd();
        if (cwd.includes('agent-runner') && path.basename(cwd) === 'agent-runner') {
            // We're already in agent-runner/, so workspace is relative
            this.workspaceRoot = path.join(cwd, 'workspace', 'sandbox');
        }
        else if (cwd.includes('agent-runner')) {
            // We're somewhere inside agent-runner/, find the root
            const parts = cwd.split(path.sep);
            const agentRunnerIndex = parts.findIndex(p => p === 'agent-runner');
            if (agentRunnerIndex >= 0) {
                const agentRunnerRoot = parts.slice(0, agentRunnerIndex + 1).join(path.sep);
                this.workspaceRoot = path.join(agentRunnerRoot, 'workspace', 'sandbox');
            }
            else {
                // Fallback: assume we need to go into agent-runner
                this.workspaceRoot = path.join(cwd, 'agent-runner', 'workspace', 'sandbox');
            }
        }
        else {
            // We're in project root, go into agent-runner
            this.workspaceRoot = path.join(cwd, 'agent-runner', 'workspace', 'sandbox');
        }
        // Normalize path to remove any double slashes or weirdness
        this.workspaceRoot = path.normalize(this.workspaceRoot);
        // Ensure it exists
        if (!fs.existsSync(this.workspaceRoot)) {
            fs.mkdirSync(this.workspaceRoot, { recursive: true });
            console.log(`📁 Created workspace root: ${this.workspaceRoot}`);
        }
        console.log(`🔍 PathManager initialized:`);
        console.log(`   Current working directory: ${cwd}`);
        console.log(`   Workspace root: ${this.workspaceRoot}`);
        // 🛡️ CRITICAL: Verify no double agent-runner and fix it
        const doublePattern = new RegExp(`agent-runner[${path.sep.replace(/\\/g, '\\\\')}]+agent-runner`, 'g');
        if (doublePattern.test(this.workspaceRoot)) {
            console.error(`🚨 WARNING: Double agent-runner detected in path!`);
            console.error(`   Original path: ${this.workspaceRoot}`);
            // Fix it by removing the duplicate
            this.workspaceRoot = this.workspaceRoot.replace(doublePattern, 'agent-runner');
            this.workspaceRoot = path.normalize(this.workspaceRoot);
            console.log(`   ✅ Fixed to: ${this.workspaceRoot}`);
            // Verify fix worked
            if (doublePattern.test(this.workspaceRoot)) {
                throw new Error(`Failed to fix double agent-runner path: ${this.workspaceRoot}`);
            }
        }
        // Final verification: count agent-runner occurrences
        const occurrences = (this.workspaceRoot.match(/agent-runner/g) || []).length;
        if (occurrences > 1) {
            console.error(`🚨 WARNING: Found ${occurrences} occurrences of 'agent-runner' in path!`);
            console.error(`   Path: ${this.workspaceRoot}`);
        }
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!PathManager.instance) {
            PathManager.instance = new PathManager();
        }
        return PathManager.instance;
    }
    /**
     * Get workspace root directory
     */
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    /**
     * Get project path for a pipeline
     * CRITICAL: This is the ONLY way to get project paths
     */
    getProjectPath(pipelineId) {
        const projectPath = path.join(this.workspaceRoot, `pipeline-${pipelineId}`);
        // Ensure it exists
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
            console.log(`📁 Created project path: ${projectPath}`);
        }
        return projectPath;
    }
    /**
     * Verify path exists and is within sandbox (security)
     */
    validatePath(targetPath) {
        const normalized = path.resolve(targetPath);
        const sandbox = path.resolve(this.workspaceRoot);
        if (!normalized.startsWith(sandbox)) {
            throw new Error(`🚨 SECURITY VIOLATION 🚨\n` +
                `Path ${targetPath} is outside sandbox!\n` +
                `Sandbox: ${sandbox}\n` +
                `Target: ${normalized}`);
        }
        return fs.existsSync(normalized);
    }
    /**
     * Ensure directory exists (with validation)
     */
    ensureDirectory(dirPath) {
        this.validatePath(dirPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Created directory: ${path.relative(this.workspaceRoot, dirPath)}`);
        }
    }
    /**
     * Get all active projects
     */
    listProjects() {
        if (!fs.existsSync(this.workspaceRoot)) {
            return [];
        }
        return fs.readdirSync(this.workspaceRoot)
            .filter(f => f.startsWith('pipeline-'))
            .map(f => path.join(this.workspaceRoot, f))
            .filter(f => fs.statSync(f).isDirectory());
    }
    /**
     * Get project count
     */
    getProjectCount() {
        return this.listProjects().length;
    }
    /**
     * Clean up old projects (optional utility)
     */
    cleanupOldProjects(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const projects = this.listProjects();
        let cleaned = 0;
        const now = Date.now();
        for (const projectPath of projects) {
            try {
                const stats = fs.statSync(projectPath);
                const age = now - stats.mtimeMs;
                if (age > maxAge) {
                    fs.rmSync(projectPath, { recursive: true, force: true });
                    cleaned++;
                    console.log(`🧹 Cleaned up old project: ${path.basename(projectPath)}`);
                }
            }
            catch (e) {
                console.warn(`⚠️ Failed to clean ${projectPath}:`, e);
            }
        }
        return cleaned;
    }
    /**
     * Verify path is writable
     */
    async verifyWritable(targetPath) {
        try {
            // Ensure parent directory exists
            const parent = path.dirname(targetPath);
            this.ensureDirectory(parent);
            // Test write
            const testFile = path.join(parent, '.path-test-' + Date.now());
            fs.writeFileSync(testFile, 'test');
            // Verify write succeeded
            if (!fs.existsSync(testFile)) {
                return false;
            }
            // Clean up
            fs.unlinkSync(testFile);
            return true;
        }
        catch (e) {
            console.error(`❌ Path not writable: ${targetPath}`, e);
            return false;
        }
    }
    /**
     * Get relative path from workspace root
     */
    getRelativePath(fullPath) {
        return path.relative(this.workspaceRoot, fullPath);
    }
}
