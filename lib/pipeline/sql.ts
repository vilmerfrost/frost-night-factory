// lib/pipeline/sql.ts
import { generateContent } from "@/lib/nightFactory/modelClient";
import type { PlannerOutput, SqlOutput } from "./phases";
import fs from "fs/promises";
import path from "path";

export async function runSqlPhase(
  spec: PlannerOutput,
  repoPath: string
): Promise<SqlOutput> {
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
  } else if (cleanSql.includes("```")) {
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
  } catch (e) {
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

