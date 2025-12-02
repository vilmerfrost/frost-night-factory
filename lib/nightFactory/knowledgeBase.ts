import { callAI } from "./modelClient";
import * as fs from 'fs';
import * as path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

// Cache duration: 24 hours in milliseconds
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function getLatestFrameworkIntel(techStack: string[]): Promise<string> {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
        fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    }

    let combinedKnowledge = "";

    for (const tech of techStack) {
        // Sanitize filename
        const filename = `${tech.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_latest.md`;
        const filePath = path.join(KNOWLEDGE_DIR, filename);
        
        // Check if cached file exists and is fresh (< 24 hours old)
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtimeMs;
            
            if (age < CACHE_DURATION) {
                console.log(`📚 Loading cached intel for ${tech} (${Math.round(age / (60 * 60 * 1000))}h old)...`);
                combinedKnowledge += `\n\n--- ${tech.toUpperCase()} LATEST DOCS ---\n` + fs.readFileSync(filePath, 'utf-8');
                continue;
            } else {
                console.log(`🔄 Cache expired for ${tech}, fetching fresh intel...`);
            }
        }

        console.log(`🌐 Perplexity researching latest ${tech} breaking changes...`);
        const prompt = `
            RESEARCH TASK: Latest technical documentation for ${tech}.
            FOCUS: Breaking changes, new features, and current best practices (as of 2024/2025).
            
            SPECIFICALLY:
            - If Next.js: Look for v15/v16 changes (Async Request APIs, Caching, Turbopack).
            - If React: Look for v19 changes (Server Actions, useFormStatus).
            - If Python: Look for Pydantic v2 and FastAPI latest patterns.
            - If TypeScript: Look for latest type system features and strict mode requirements.
            - If Rust: Look for latest async patterns, tokio, and performance best practices.
            - If Go: Look for latest module patterns, generics, and concurrency best practices.
            
            OUTPUT: A concise technical summary of rules the coder MUST follow.
        `;
        
        // Use RESEARCH role which maps to Perplexity in modelClient
        try {
            const intel = await callAI("RESEARCH", prompt);
            
            // Save to cache
            fs.writeFileSync(filePath, intel);
            combinedKnowledge += `\n\n--- ${tech.toUpperCase()} LATEST DOCS ---\n` + intel;
        } catch (error) {
            console.error(`❌ Failed to fetch intel for ${tech}:`, error);
            // Continue with other techs even if one fails
        }
    }

    return combinedKnowledge;
}

