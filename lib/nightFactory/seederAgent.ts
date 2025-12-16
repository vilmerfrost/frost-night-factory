import { callAI } from "./modelClient";
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const FILE_PROTOCOL = `
IMPORTANT - OUTPUT FORMAT: You must provide the full file content for every file you generate. Use this exact format for every file:
[FILE: path/to/filename.ext]
... code content ...
[GOAL]
`;

export async function generateSeedData(projectPath: string, context: string): Promise<boolean> {
    console.log("🌱 Seeding Database with realistic mock data...");
    
    // Detektera om det är Supabase (SQL) eller Python backend
    const hasSupabaseMigrations = fs.existsSync(path.join(projectPath, 'supabase', 'migrations'));
    const hasPythonBackend = fs.existsSync(path.join(projectPath, 'backend', 'main.py')) ||
                            fs.existsSync(path.join(projectPath, 'backend', 'requirements.txt'));
    
    if (!hasSupabaseMigrations && !hasPythonBackend) {
        console.log("🌱 No database detected. Skipping seed data generation.");
        return false;
    }
    
    try {
        // Läs senaste migration för att förstå tabellstrukturen
        let schemaContext = "";
        if (hasSupabaseMigrations) {
            const migrationsDir = path.join(projectPath, 'supabase', 'migrations');
            if (fs.existsSync(migrationsDir)) {
                const migrations = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort()
                    .reverse(); // Senaste först
                
                if (migrations.length > 0) {
                    const firstMigration = migrations[0];
                    if (firstMigration) {
                        const latestMigration = fs.readFileSync(
                            path.join(migrationsDir, firstMigration),
                            'utf-8'
                        );
                        schemaContext = latestMigration.substring(0, 3000); // Begränsa längd
                    }
                }
            }
        } else if (hasPythonBackend) {
            // Försök läsa Python models/schemas
            const possibleModelPaths = [
                path.join(projectPath, 'backend', 'models.py'),
                path.join(projectPath, 'backend', 'models', 'schemas.py'),
                path.join(projectPath, 'backend', 'schemas.py'),
                path.join(projectPath, 'backend', 'main.py')
            ];
            
            for (const modelPath of possibleModelPaths) {
                if (fs.existsSync(modelPath)) {
                    schemaContext = fs.readFileSync(modelPath, 'utf-8').substring(0, 3000);
                    break;
                }
            }
        }
        
        const prompt = `
CONTEXT: We are building "${context}".

DATABASE SCHEMA:
${schemaContext || "No schema found. Generate generic seed data."}

TASK: Generate a script to populate the database with RICH, REALISTIC mock data.

REQUIREMENTS:
- Don't just create 1 row. Create 15-20 rows of diverse, realistic data.
- Use real-sounding names, dates spread over the last 30 days.
- If it's a dashboard, generate data that creates a nice "upward trend" graph.
- If it's a task manager, create tasks with various statuses (completed, in-progress, pending).
- If it's a user system, create users with different roles and activity levels.
- Make dates realistic (some recent, some older).
- Use proper UUIDs (gen_random_uuid() for PostgreSQL, or valid UUID strings).
- For vector embeddings, use array_fill(0, ARRAY[1536])::vector if needed.

OUTPUT FORMAT:
${hasSupabaseMigrations ? `
[FILE: supabase/seed.sql]
-- Seed data script
INSERT INTO ...
[GOAL]
` : `
[FILE: backend/seed.py]
# Seed data script
from models import ...
# Generate and insert data
[GOAL]
`}

${FILE_PROTOCOL}
        `;
        
        const seedCode = await callAI("BACKEND", prompt);
        
        // Parse output och spara fil
        const fileRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
        let match;
        let seedFileCreated = false;
        
        while ((match = fileRegex.exec(seedCode)) !== null) {
            const fileName = match[1]?.trim();
            let content = match[2]?.trim();
            if (!fileName || !content) continue;
            
            // Clean markdown code blocks if present
            if (content.startsWith("```")) {
                content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");
            }
            
            if (fileName && content) {
                const filePath = path.join(projectPath, fileName);
                const dir = path.dirname(filePath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, content);
                console.log(`🌱 Created seed file: ${fileName}`);
                seedFileCreated = true;
                
                // Försök köra seed-filen
                try {
                    if (fileName.endsWith('.sql')) {
                        // Supabase SQL seed
                        console.log("🌱 Executing SQL seed...");
                        // Vi kan köra detta mot Supabase om SUPABASE_DB_URL finns
                        const dbUrl = process.env.SUPABASE_DB_URL;
                        if (dbUrl) {
                            try {
                                execSync(`psql "${dbUrl}" -f "${filePath}"`, {
                                    cwd: projectPath,
                                    stdio: 'pipe'
                                });
                                console.log("✅ Seed data inserted successfully!");
                            } catch (sqlError: any) {
                                console.warn("⚠️ Could not execute SQL seed automatically:", sqlError.message);
                                console.log("💡 Seed file created. Run manually: psql <connection> -f supabase/seed.sql");
                            }
                        } else {
                            console.log("💡 Seed file created. Set SUPABASE_DB_URL to auto-execute, or run manually.");
                        }
                    } else if (fileName.endsWith('.py')) {
                        // Python seed
                        console.log("🌱 Executing Python seed...");
                        try {
                            execSync(`python "${filePath}"`, {
                                cwd: projectPath,
                                stdio: 'pipe'
                            });
                            console.log("✅ Seed data inserted successfully!");
                        } catch (pyError: any) {
                            console.warn("⚠️ Could not execute Python seed automatically:", pyError.message);
                            console.log("💡 Seed file created. Run manually: python backend/seed.py");
                        }
                    }
                } catch (execError: any) {
                    console.warn("⚠️ Seed execution failed (non-critical):", execError.message);
                }
            }
        }
        
        if (!seedFileCreated) {
            console.warn("⚠️ Seeder Agent could not generate seed file.");
            return false;
        }
        
        return true;
    } catch (error: any) {
        console.error("❌ Seeder Agent failed:", error.message);
        return false;
    }
}

