// lib/pipeline/sql.ts
// SQL Editor Phase with Full JSON Context
// Receives ResearchPhaseJSON + PlannerPhaseJSON + CoderPhaseJSON, outputs SqlEditorPhaseJSON
import { generateContent, callAI } from "@/lib/nightFactory/modelClient";
import { convertSqlEditorToJSON } from "./json-converter";
import fs from "fs/promises";
import path from "path";
/**
 * Legacy SQL phase (for backward compatibility)
 */
export async function runSqlPhase(spec, repoPath) {
    const prompt = `You are a senior PostgreSQL/Supabase architect.

Given the following entity definitions, generate a single SQL migration file for Supabase.

ENTITY SPECIFICATIONS:
${JSON.stringify(spec.entities, null, 2)}

REQUIREMENTS:
1. Create all tables with proper types and foreign keys
2. Use uuid with default gen_random_uuid() for id fields
3. Include created_at timestamptz default now() on all tables
4. Include updated_at timestamptz default now() on all tables
5. Use IF NOT EXISTS where possible for idempotency
6. Add proper foreign key constraints
7. Create indexes on foreign keys and commonly queried fields
8. Consider RLS (Row Level Security) if multi-tenant (add comments)

Return ONLY the SQL code, no markdown code blocks, no explanations.
Start directly with CREATE TABLE statements.`;
    const sql = await generateContent(prompt, "You are a Senior PostgreSQL Architect");
    // Clean up SQL (remove markdown if present)
    let cleanSql = sql.trim();
    if (cleanSql.includes("```sql")) {
        cleanSql = cleanSql.split("```sql")[1].split("```")[0].trim();
    }
    else if (cleanSql.includes("```")) {
        cleanSql = cleanSql.split("```")[1].split("```")[0].trim();
    }
    // Write migration file
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0]
        .replace("T", "");
    const migrationName = `${timestamp}_auto_init.sql`;
    const migrationsDir = path.join(repoPath, "supabase", "migrations");
    try {
        await fs.mkdir(migrationsDir, { recursive: true });
    }
    catch (e) {
        // Directory might exist
    }
    const migrationPath = path.join(migrationsDir, migrationName);
    await fs.writeFile(migrationPath, cleanSql, "utf8");
    console.log(`✅ Wrote migration: ${migrationPath}`);
    return {
        migration_sql: cleanSql,
        migration_name: migrationName,
    };
}
/**
 * NEW: SQL Editor phase with full JSON context
 * Receives all previous phase JSONs, outputs SqlEditorPhaseJSON
 */
export async function runSqlPhaseJSON(researchContext, planContext, coderContext, repoPath, options = {}) {
    const { includeRLS = true, includeSeedData = true, optimizeQueries = true } = options;
    console.log(`\n🗄️ [SQL PHASE] Generating database schema...`);
    console.log(`   Research context from: ${researchContext.timestamp}`);
    console.log(`   Plan context from: ${planContext.timestamp}`);
    console.log(`   Coder context from: ${coderContext.timestamp}`);
    let rawSqlOutput = "";
    // ============================================================
    // 1. BUILD RICH PROMPT WITH FULL CONTEXT
    // ============================================================
    const contextPreamble = `
PROJECT: ${planContext.project_overview.name}

RESEARCH CONTEXT (${researchContext.timestamp}):
- Challenges: ${researchContext.potential_challenges.map(c => c.challenge).join(", ")}
- Best Practices: ${researchContext.best_practices_found.slice(0, 3).join(", ")}

PLAN CONTEXT (${planContext.timestamp}):
- Database Schema Outline:
${JSON.stringify(planContext.database_schema_outline, null, 2)}

CODER CONTEXT (${coderContext.timestamp}):
- Types Defined: ${coderContext.type_definitions.types_defined.map(t => t.name).join(", ")}
- Critical Notes: ${coderContext.critical_notes_for_sql_editor.join(", ")}
`;
    const sqlPrompt = `${contextPreamble}

You are a Senior PostgreSQL/Supabase Database Architect.

Generate a COMPLETE SQL migration file that:

1. CREATES ALL TABLES from the schema outline
   - Use uuid with gen_random_uuid() for primary keys
   - Include created_at and updated_at timestamps
   - Add proper foreign key constraints
   - Use appropriate column types (text, timestamptz, boolean, jsonb, etc.)

2. HANDLES RELATIONSHIPS
   - Define foreign keys with ON DELETE CASCADE/SET NULL as appropriate
   - Create junction tables for many-to-many relationships

3. CREATES INDEXES
   - Index all foreign key columns
   - Index commonly queried fields (user_id, created_at)
   - Consider composite indexes for common query patterns

${includeRLS ? `
4. IMPLEMENTS ROW LEVEL SECURITY (RLS)
   - Enable RLS on all tables
   - Create policies for:
     - SELECT: Users can only see their own data
     - INSERT: Users can only insert their own data
     - UPDATE: Users can only update their own data
     - DELETE: Users can only delete their own data
   - Use auth.uid() for user identification
` : '4. SKIP RLS (not requested)'}

${optimizeQueries ? `
5. OPTIMIZATION
   - Add comments explaining index choices
   - Include performance hints for common queries
` : ''}

${includeSeedData ? `
6. SEED DATA (for testing)
   - Create 3-5 test records for each table
   - Use realistic data
   - Wrap in a transaction
` : ''}

CRITICAL REQUIREMENTS:
- TypeScript types from coder phase MUST match database columns exactly
- Use IF NOT EXISTS for idempotency
- Follow Supabase conventions

Return ONLY SQL code. No markdown code blocks. Start with comments.`;
    // ============================================================
    // 2. CALL AI (DeepSeek for SQL generation)
    // ============================================================
    try {
        console.log("🔧 DeepSeek V3: Generating SQL schema...");
        rawSqlOutput = await callAI("BACKEND", sqlPrompt, "You are a Senior PostgreSQL Database Architect specializing in Supabase.");
    }
    catch (e) {
        console.error("❌ SQL generation failed:", e);
        return {
            success: false,
            error: `SQL generation failed: ${e}`,
            raw_text_audit: ""
        };
    }
    // ============================================================
    // 3. CLEAN SQL OUTPUT
    // ============================================================
    let cleanSql = rawSqlOutput.trim();
    // Remove markdown code blocks if present
    if (cleanSql.includes("```sql")) {
        cleanSql = cleanSql.split("```sql")[1].split("```")[0].trim();
    }
    else if (cleanSql.includes("```")) {
        cleanSql = cleanSql.split("```")[1].split("```")[0].trim();
    }
    // ============================================================
    // 4. FAIL FAST: Validate SQL has content
    // ============================================================
    if (!cleanSql || cleanSql.length < 50) {
        return {
            success: false,
            error: "Generated SQL is too short or empty",
            raw_text_audit: rawSqlOutput
        };
    }
    // Basic SQL validation
    if (!cleanSql.toLowerCase().includes("create table")) {
        return {
            success: false,
            error: "Generated SQL does not contain CREATE TABLE statements",
            raw_text_audit: rawSqlOutput
        };
    }
    // ============================================================
    // 5. WRITE MIGRATION FILE
    // ============================================================
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0]
        .replace("T", "");
    const migrationName = `${timestamp}_auto_schema.sql`;
    const migrationsDir = path.join(repoPath, "supabase", "migrations");
    let migrationFile = "";
    try {
        await fs.mkdir(migrationsDir, { recursive: true });
        const migrationPath = path.join(migrationsDir, migrationName);
        // Add header comment
        const headerComment = `-- ============================================================
-- AUTO-GENERATED MIGRATION
-- Project: ${planContext.project_overview.name}
-- Generated: ${new Date().toISOString()}
-- Research: ${researchContext.timestamp}
-- Plan: ${planContext.timestamp}
-- Coder: ${coderContext.timestamp}
-- ============================================================

`;
        await fs.writeFile(migrationPath, headerComment + cleanSql, "utf8");
        migrationFile = migrationPath;
        console.log(`   ✅ Wrote migration: ${migrationName}`);
    }
    catch (e) {
        console.error(`   ⚠️ Failed to write migration file:`, e);
    }
    // ============================================================
    // 6. CONVERT TO STRUCTURED JSON (Claude 4.5 Haiku)
    // ============================================================
    console.log("🔧 Converting SQL output to structured JSON (Claude 4.5 Haiku)...");
    // Extract table names from SQL
    const tableMatches = cleanSql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/gi) || [];
    const tableNames = tableMatches.map(m => m.replace(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+/i, ""));
    // Build summary for JSON conversion
    const sqlSummary = `
MIGRATION FILE: ${migrationName}

TABLES CREATED:
${tableNames.map(t => `- ${t}`).join("\n")}

RLS POLICIES: ${cleanSql.toLowerCase().includes("enable row level security") ? "Yes" : "No"}

INDEXES: ${(cleanSql.match(/CREATE INDEX/gi) || []).length} created

SEED DATA: ${cleanSql.toLowerCase().includes("insert into") ? "Yes" : "No"}

SQL LENGTH: ${cleanSql.length} characters

FULL SQL:
${cleanSql}
`;
    const result = await convertSqlEditorToJSON(sqlSummary, researchContext, planContext, coderContext);
    if (!result.success) {
        console.error(`❌ JSON conversion failed: ${result.error}`);
        // Return partial success - SQL was written
        return {
            success: true,
            data: undefined,
            error: `Migration written but JSON conversion failed: ${result.error}`,
            raw_text_audit: rawSqlOutput,
            migration_file: migrationFile
        };
    }
    // ============================================================
    // 7. VALIDATE & RETURN
    // ============================================================
    if (!result.data) {
        return {
            success: true,
            data: undefined,
            error: "JSON conversion returned no data",
            raw_text_audit: rawSqlOutput,
            migration_file: migrationFile
        };
    }
    // Enhance with actual data
    result.data.phase = "sql_editor";
    result.data.timestamp = result.data.timestamp || new Date().toISOString();
    result.data.input_references = {
        research_timestamp: researchContext.timestamp,
        plan_timestamp: planContext.timestamp,
        coder_timestamp: coderContext.timestamp,
        context_summary: `Schema for ${planContext.project_overview.name} with ${tableNames.length} tables`
    };
    // Update migrations with actual file
    if (migrationFile) {
        result.data.migrations_created = [{
                version: migrationName.split("_")[0],
                description: `Auto-generated schema for ${planContext.project_overview.name}`,
                sql_file: `supabase/migrations/${migrationName}`,
                status: "ready_to_apply",
                tested: false
            }];
    }
    console.log(`✅ [SQL PHASE] Complete!`);
    console.log(`   - Tables: ${tableNames.length}`);
    console.log(`   - RLS: ${result.data.rls_policies.length} policies`);
    console.log(`   - Migration: ${migrationName}`);
    return {
        success: true,
        data: result.data,
        raw_text_audit: rawSqlOutput,
        migration_file: migrationFile
    };
}
/**
 * Convert legacy SqlOutput to SqlEditorPhaseJSON
 */
export function legacyToSqlEditorPhaseJSON(legacy, researchTimestamp, planTimestamp, coderTimestamp) {
    // Extract table names from SQL
    const tableMatches = legacy.migration_sql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/gi) || [];
    const tableNames = tableMatches.map(m => m.replace(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+/i, ""));
    return {
        phase: "sql_editor",
        timestamp: new Date().toISOString(),
        input_references: {
            research_timestamp: researchTimestamp,
            plan_timestamp: planTimestamp,
            coder_timestamp: coderTimestamp,
            context_summary: "Legacy conversion"
        },
        database_schema_created: {
            tables: tableNames.map(name => ({
                name,
                sql: `-- See migration file`,
                columns_count: 0,
                indexes: 0,
                relationships: 0,
                validation_rules: []
            }))
        },
        rls_policies: [],
        migrations_created: [{
                version: legacy.migration_name.split("_")[0],
                description: "Auto-generated migration",
                sql_file: `supabase/migrations/${legacy.migration_name}`,
                status: "ready_to_apply",
                tested: false
            }],
        queries_optimized: [],
        type_schema_match: {
            invoice_type_columns: [],
            database_columns: tableNames,
            match_status: "unknown"
        },
        seed_data: {
            provided: false,
            records_created: 0
        },
        performance_expectations: {
            read_operations: {},
            write_operations: {}
        },
        critical_notes_for_tester: [
            "Run supabase db push to apply migration",
            "Check RLS policies if multi-tenant"
        ]
    };
}
