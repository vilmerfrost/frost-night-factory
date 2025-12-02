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

export async function runIntegrationStep(localPath: string, backendType: string) {
    console.log("🔗 Integration Agent: Syncing Backend types to Frontend...");

    // 🎯 STEP 1: Try Supabase CLI Type Generation (The Type Generator)
    const supabaseProjectId = process.env.SUPABASE_PROJECT_ID;
    const hasSupabaseMigrations = fs.existsSync(path.join(localPath, 'supabase', 'migrations'));
    
    if (supabaseProjectId && hasSupabaseMigrations) {
        console.log("🔗 Generating real Supabase types using CLI...");
        try {
            const typesDir = path.join(localPath, 'src', 'types');
            if (!fs.existsSync(typesDir)) {
                fs.mkdirSync(typesDir, { recursive: true });
            }
            
            const databaseTypesPath = path.join(typesDir, 'database.ts');
            
            // Generate types using Supabase CLI
            execSync(
                `npx supabase gen types typescript --project-id "${supabaseProjectId}" > "${databaseTypesPath}"`,
                { 
                    cwd: localPath,
                    stdio: 'pipe',
                    env: { ...process.env }
                }
            );
            
            console.log(`✅ Generated real Supabase types: src/types/database.ts`);
            
            // Verify the file was created and has content
            if (fs.existsSync(databaseTypesPath) && fs.statSync(databaseTypesPath).size > 0) {
                console.log("✅ Type Generator: Real database types generated successfully!");
                
                // Create a re-export in src/lib/types.ts for convenience
                const libTypesPath = path.join(localPath, 'src', 'lib', 'types.ts');
                const libTypesDir = path.dirname(libTypesPath);
                if (!fs.existsSync(libTypesDir)) {
                    fs.mkdirSync(libTypesDir, { recursive: true });
                }
                
                // Re-export Supabase types for easier imports
                const reExportContent = `// Re-export Supabase database types
export type { Database } from '../types/database';
`;
                fs.writeFileSync(libTypesPath, reExportContent);
                console.log("✅ Created re-export: src/lib/types.ts");
                
                return; // Success! Exit early
            } else {
                console.warn("⚠️ Type Generator: File created but empty, falling back to AI...");
            }
        } catch (e: any) {
            console.warn("⚠️ Type Generator failed (login required or CLI not available):", e.message);
            console.log("💡 Falling back to AI-generated types...");
            // Continue to AI fallback below
        }
    } else {
        if (!supabaseProjectId) {
            console.log("ℹ️ SUPABASE_PROJECT_ID not set. Using AI-generated types.");
        }
        if (!hasSupabaseMigrations) {
            console.log("ℹ️ No Supabase migrations found. Using AI-generated types.");
        }
    }

    // 🎯 STEP 2: Fallback to AI-generated types (original behavior)
    // 1. Read backend models/schemas
    let backendCode = "";
    let backendFilePath = "";

    if (backendType === "Python") {
        // Try multiple possible locations
        const possiblePaths = [
            path.join(localPath, 'backend/models/schemas.py'),
            path.join(localPath, 'backend/schemas.py'),
            path.join(localPath, 'backend/models.py'),
            path.join(localPath, 'backend/main.py')
        ];

        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                backendCode = fs.readFileSync(filePath, 'utf-8');
                backendFilePath = filePath;
                console.log(`📖 Found backend code at: ${path.relative(localPath, filePath)}`);
                break;
            }
        }

        if (!backendCode) {
            console.warn("⚠️ Could not find Python backend schemas, skipping integration sync.");
            return;
        }
    } else if (backendType === "Node") {
        // Try Prisma schema or TypeScript DTOs
        const possiblePaths = [
            path.join(localPath, 'prisma/schema.prisma'),
            path.join(localPath, 'backend/src/types.ts'),
            path.join(localPath, 'backend/src/models.ts'),
            path.join(localPath, 'src/lib/types.ts')
        ];

        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                backendCode = fs.readFileSync(filePath, 'utf-8');
                backendFilePath = filePath;
                console.log(`📖 Found backend code at: ${path.relative(localPath, filePath)}`);
                break;
            }
        }

        if (!backendCode) {
            console.warn("⚠️ Could not find Node backend types, skipping integration sync.");
            return;
        }
    } else {
        console.warn(`⚠️ Backend type "${backendType}" not yet supported for integration sync.`);
        return;
    }

    const prompt = `
        ROLE: Senior Integration Engineer.
        TASK: Generate TypeScript interfaces that perfectly match the Backend Data Models.

        BACKEND CODE (${backendType}) from ${backendFilePath}:
        ${backendCode}

        REQUIREMENTS:
        - Extract all data models, schemas, and types from the backend code.
        - Convert to TypeScript interfaces with proper naming conventions.
        - Convert snake_case to camelCase if needed (Python -> TypeScript).
        - Ensure all required fields are marked, optional fields use '?'.
        - Include all nested types and enums.

        OUTPUT:
        - A complete 'types.ts' file with all interfaces matching the backend.
        - Ensure naming conventions match (snake_case to camelCase conversion if needed).

        ${FILE_PROTOCOL}
    `;

    try {
        const tsCode = await callAI("BACKEND", prompt); // DeepSeek is good at this
        
        // Parse and write the types file
        const fileRegex = /\[FILE:\s*(.*?)\]([\s\S]*?)(\[GOAL\]|$)/g;
        let match;
        let filesCreated = 0;

        while ((match = fileRegex.exec(tsCode)) !== null) {
            const fileName = match[1].trim();
            let content = match[2].trim();

            // Clean markdown code blocks if present
            if (content.startsWith("```")) {
                content = content.replace(/^```[a-z]*\n/i, "").replace(/```$/, "");
            }

            if (fileName && content) {
                const filePath = path.join(localPath, fileName);
                const dir = path.dirname(filePath);

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(filePath, content);
                console.log(`✅ Created/Updated: ${fileName}`);
                filesCreated++;
            }
        }

        if (filesCreated === 0) {
            // Fallback: Try to extract types directly if FILE protocol wasn't used
            console.warn("⚠️ No files found in response, trying direct extraction...");
            
            // Use src/lib/types.ts for general types, or src/types/database.ts if Supabase
            const typesPath = hasSupabaseMigrations 
                ? path.join(localPath, 'src/types/database.ts')
                : path.join(localPath, 'src/lib/types.ts');
            const dir = path.dirname(typesPath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Clean the response and write directly
            let cleanCode = tsCode.replace(/```typescript|```/g, "").trim();
            fs.writeFileSync(typesPath, cleanCode);
            console.log(`✅ Created/Updated: ${path.relative(localPath, typesPath)} (fallback)`);
        }

        console.log("✅ Frontend/Backend types synchronized.");
    } catch (error) {
        console.error("❌ Integration Agent failed:", error);
        // Don't throw - this is a nice-to-have feature
    }
}

