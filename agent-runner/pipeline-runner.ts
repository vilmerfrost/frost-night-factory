import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { generateContent, performDeepResearch } from "../lib/nightFactory/modelClient";
import postgres from "postgres"; 

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Helpers ---

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function getRepoPath(pipeline: any, sandboxPath: string): string {
  return path.join(sandboxPath, `pipeline-${pipeline.id}`);
}

async function updatePipeline(id: string, values: any) {
  await supabase.from("pipelines").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
}

async function createStep(pipelineId: string, phase: string, status: string = "pending", input: any = {}) {
  const { data } = await supabase.from("pipeline_steps").insert({
      pipeline_id: pipelineId, phase, status, input, updated_at: new Date().toISOString()
    }).select().single();
  return data;
}

async function updateStep(stepId: string, values: any) {
  await supabase.from("pipeline_steps").update({ ...values, updated_at: new Date().toISOString() }).eq("id", stepId);
}

// --- Steps ---

async function runResearchStep(pipeline: any) {
  console.log(`🔍 Running Research (Perplexity) for pipeline ${pipeline.id}`);
  await updatePipeline(pipeline.id, { status: "running", current_phase: "research" });

  // Kolla om det redan finns en färdig research (ta den senaste)
  const { data: existing } = await supabase
    .from("pipeline_steps")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "research")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log("⚠️ Research already done, skipping.");
    await updatePipeline(pipeline.id, { current_phase: "planner" });
    return;
  }

  const prompt = `Analyze: "${pipeline.initial_prompt}". Provide technical implementation strategy for Next.js 15 + Supabase. List specific files/libs.`;
  const content = await performDeepResearch(prompt);

  console.log("💾 Saving Research to DB...");
  const { error: saveError } = await supabase.from("pipeline_steps").insert({
    pipeline_id: pipeline.id, 
    phase: "research", 
    status: "completed", 
    output: { content }, 
    input: { prompt },
    updated_at: new Date().toISOString()
  });

  if (saveError) {
    console.error("❌ Failed to save research:", saveError);
    throw new Error(`Database Save Failed: ${saveError.message}`);
  }

  await updatePipeline(pipeline.id, { current_phase: "planner" });
  console.log("✅ Research Complete & Saved.");
}

async function runPlannerStep(pipeline: any) {
  console.log(`📋 Running Planner for pipeline ${pipeline.id}`);
  
  // FIX: Hantera dubbletter genom att ta den senaste (.order + .limit)
  const { data: research, error: fetchError } = await supabase
    .from("pipeline_steps")
    .select("output")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "research")
    .order("created_at", { ascending: false }) // <-- VIKTIGT: Ta senaste
    .limit(1)
    .single();

  if (fetchError || !research) {
    console.error("❌ Planner could not find research:", fetchError);
    throw new Error("Research step missing.");
  }

  const prompt = `Based on research: ${JSON.stringify(research.output)}, create a detailed coding plan. Return JSON with keys: file_structure, dependencies, steps.`;
  const planContent = await generateContent(prompt);

  console.log("💾 Saving Plan to DB...");
  
  const { error: saveError } = await supabase.from("pipeline_steps").insert({
    pipeline_id: pipeline.id, 
    phase: "planner", 
    status: "completed", 
    output: { content: planContent },
    updated_at: new Date().toISOString()
  });

  if (saveError) {
    console.error("❌ Failed to save plan:", saveError);
    throw saveError;
  }

  await updatePipeline(pipeline.id, { current_phase: "coder" });
  console.log("✅ Planner Complete & Saved.");
}

// Hjälpfunktion för att packa upp innehåll från objekt
function unwrapContent(content: any): string {
  if (typeof content === 'string') return content;
  
  if (typeof content === 'object' && content !== null) {
    // 1. Kolla kända nycklar
    if (typeof content.content === 'string') return content.content;
    if (typeof content.code === 'string') return content.code;
    if (typeof content.text === 'string') return content.text;
    if (typeof content.value === 'string') return content.value;

    // 2. Om ingen känd nyckel, men objektet ser ut som en fil (package.json)
    return JSON.stringify(content, null, 2);
  }
  
  return String(content);
}

async function runCoderStep(pipeline: any, repoPath: string) {
  console.log(`💻 Running Coder for pipeline ${pipeline.id}`);
  console.log(`🔒 TARGET SANDBOX: ${repoPath}`);

  if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });

  const { data: planStep, error } = await supabase
    .from("pipeline_steps")
    .select("output")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "planner")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !planStep) throw new Error("Planner step not found.");

  const coderPrompt = `
    You are an expert Senior Fullstack Developer.
    Plan: ${JSON.stringify(planStep.output)}
    
    CRITICAL OUTPUT RULES (Follow strictly):
    1. Do NOT use JSON format for the code. It breaks easily.
    2. Use this specific delimiter format for every file:
    
    ### FILE: <filename>
    <file content here>
    ### END_FILE

    3. Generate ALL necessary files: package.json, next.config.mjs, tsconfig.json, app/layout.tsx, app/page.tsx, app/globals.css.
    4. NO external UI libraries (like shadcn). Use standard Tailwind classes.
    5. Ensure package.json has "scripts": { "dev": "next dev", "build": "next build", "start": "next start" }.
    6. IMPORTANT: Do NOT include markdown code blocks (\`\`\`tsx) INSIDE the file content. Just raw code.
  `;

  console.log("🤖 Generating code with Gemini (Delimiter Mode)...");
  const coderResponse = await generateContent(coderPrompt);
  
  console.log("🤖 Parsing AI response...");

  try {
    // Regex matches: ### FILE: <path> [content] ### END_FILE
    const fileRegex = /### FILE: (.*?)\n([\s\S]*?)### END_FILE/g;
    let match;
    let count = 0;

    while ((match = fileRegex.exec(coderResponse)) !== null) {
        let filePath = match[1].trim();
        let content = match[2].trim();

        // 🧹 STÄDA MARKDOWN
        if (content.startsWith("```")) {
            content = content.replace(/^```[a-z]*\s+/, "").replace(/\s+```$/, "").trim();
        }

        // Platta till sökvägar (Samma som förut)
        const parts = filePath.split('/');
        if (parts.length > 1 && !['app', 'src', 'public', 'lib', 'components', 'utils'].includes(parts[0]) && parts[0] !== 'package.json') {
            filePath = parts.slice(1).join('/');
        }

        // 🚨 HARD OVERRIDE FÖR CSS (Efter path flattening!)
        // Vi litar inte på AI:n för CSS just nu. Vi skriver in korrekt Tailwind-bas.
        if (filePath.endsWith('globals.css') || filePath.includes('globals.css')) {
             console.log(`🛡️ Enforcing standard Tailwind CSS for ${filePath}`);
             // Minimal, clean CSS - just Tailwind directives
             content = `@tailwind base;
@tailwind components;
@tailwind utilities;`;
        }

        const fullPath = path.join(repoPath, filePath);
        
        if (!fullPath.startsWith(repoPath)) continue;

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(fullPath, content);
        console.log(`✅ Wrote file: ${filePath}`);
        count++;
    }

    if (count === 0) {
        console.warn("⚠️ No files found. Dumping raw output for debugging.");
        fs.writeFileSync(path.join(repoPath, "debug_output.txt"), coderResponse);
        throw new Error("AI output format invalid. No files parsed.");
    }

  } catch (e: any) {
    console.error("❌ Coder Error:", e.message);
    throw new Error("Failed to write files to sandbox.");
  }

  await updatePipeline(pipeline.id, { current_phase: "sql", updated_at: new Date().toISOString() });
  console.log("✅ Coder complete. Files in sandbox.");
}

async function runSqlStep(pipeline: any, repoPath: string) {
  console.log(`🗄️ Running SQL phase for pipeline ${pipeline.id}`);
  await updatePipeline(pipeline.id, { current_phase: "sql" });

  const { data: plannerStep } = await supabase
    .from("pipeline_steps")
    .select("output")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "planner")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!plannerStep) {
    throw new Error("Planner step not found.");
  }

  const step = await createStep(pipeline.id, "sql", "running");
  if (!step) {
    throw new Error("Failed to create SQL step.");
  }
  
  try {
    // 1. Generera SQL med AI
    const prompt = `
      You are a Senior PostgreSQL Database Architect.

      Create a robust, idempotent migration file based on this plan: ${JSON.stringify(plannerStep.output)}

      CRITICAL RULES FOR IDEMPOTENCY (Must follow):

      1. Use "CREATE TABLE IF NOT EXISTS".

      2. For Policies: ALWAYS run "DROP POLICY IF EXISTS <policy_name> ON <table_name>;" before creating the policy.

      3. For Triggers: Drop them if they exist before creating.

      4. Use "DO $$ BEGIN ... END $$;" blocks for complex logic if needed to avoid errors.

      5. Enable RLS: "ALTER TABLE x ENABLE ROW LEVEL SECURITY;" (safe to run multiple times).

      6. Return ONLY valid SQL content. No markdown blocks.

      Specific instructions from architecture review:

      - Create separate policies for SELECT, INSERT, UPDATE, DELETE.

      - Use "auth.uid()" for user checks.

      - Ensure all tables have "created_at" and "updated_at".

    `;
    
    console.log("🤖 Generating SQL...");
    let sqlContent = await generateContent(prompt);
    sqlContent = sqlContent.replace(/```sql/g, "").replace(/```/g, "").trim();

    // Spara filen
    const migrationPath = path.join(repoPath, "supabase", "migrations");
    if (!fs.existsSync(migrationPath)) fs.mkdirSync(migrationPath, { recursive: true });
    
    const fileName = `${new Date().toISOString().replace(/[-:T.Z]/g, "")}_init.sql`;
    const filePath = path.join(migrationPath, fileName);
    fs.writeFileSync(filePath, sqlContent);
    
    console.log(`✅ Migration file created: ${fileName}`);

    // 2. EXEKVERA SQL (Detta du saknade!) 🧨
    if (process.env.DATABASE_URL) {
        console.log("⚡️ Executing SQL against DB...");
        const sql = postgres(process.env.DATABASE_URL);
        try {
            await sql.unsafe(sqlContent);
            console.log("✅ DB Migration Applied!");
        } catch (dbErr: any) {
            console.error("❌ DB Exec Failed:", dbErr.message);
            throw new Error(`SQL Syntax Error: ${dbErr.message}`);
        } finally {
            await sql.end();
        }
    } else {
        console.warn("⚠️ No DATABASE_URL found. Skipping execution.");
    }

    await updateStep(step.id, { status: "completed", output: { sql: sqlContent } });
    await updatePipeline(pipeline.id, { current_phase: "tester" }); // Gå vidare

  } catch (error: any) {
    console.error("❌ SQL Failed:", error.message);
    if (step) {
      await updateStep(step.id, { status: "failed", output: { error: error.message } });
    }
    await updatePipeline(pipeline.id, { status: "failed" });
    throw error;
  }
}

async function runTesterStep(pipeline: any, repoPath: string) {
  console.log(`🧪 Running Build Check for pipeline ${pipeline.id}`);
  
  // 1. Skapa mapp om den saknas
  if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
  }

  try {
    const pkgPath = path.join(repoPath, "package.json");
    
    // 2. Läs eller Skapa package.json
    let pkg: any = {};
    if (fs.existsSync(pkgPath)) {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } else {
        console.log("⚠️ package.json missing. Creating minimal...");
        pkg = {
            name: "frost-app",
            dependencies: { "next": "latest", "react": "latest", "react-dom": "latest" }
        };
    }

    // 3. 🚑 SELF-HEALING: Injicera Scripts
    pkg.scripts = pkg.scripts || {};
    
    // Se till att "build" finns!
    if (!pkg.scripts.build) {
        console.log("💉 Injecting missing 'build' script...");
        pkg.scripts.build = "next build";
    }
    
    // Se till att "dev" och "start" finns
    if (!pkg.scripts.dev) pkg.scripts.dev = "next dev";
    if (!pkg.scripts.start) pkg.scripts.start = "next start";

    // Spara filen
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // 4. Installera
    if (!fs.existsSync(path.join(repoPath, "node_modules"))) {
        console.log("📦 Installing dependencies...");
        // Använder --no-audit för att det går snabbare
        execSync("npm install --no-audit", { cwd: repoPath, stdio: 'inherit' });
    }

    // 5. KÖR BUILD
    console.log("🚀 Running 'npm run build'...");
    
    // Vi kör builden. Om den failar kastas ett error och vi fångar det nedan.
    execSync("npm run build", { 
        cwd: repoPath, 
        stdio: 'inherit',
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }
    });
    
    console.log("✅ Build Successful! Code is valid.");
    
    // Gå vidare till Publisher
    await updatePipeline(pipeline.id, { current_phase: "publisher" });

  } catch (e: any) {
    console.error("❌ Build/Test Failed:", e.message);
    await updatePipeline(pipeline.id, { status: "failed" });
  }
}

async function runPublisherStep(pipeline: any, repoPath: string) {
  console.log(`🚀 Running Publisher for pipeline ${pipeline.id}`);
  
  const githubToken = process.env.GITHUB_TOKEN;
  const githubUser = process.env.GITHUB_USERNAME;
  const repoName = "frost-" + pipeline.name.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 40); 

  if (!githubToken || !githubUser) {
    console.error("❌ Missing GitHub credentials. Marking as done locally.");
    await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
    return;
  }

  try {
    // 1. Skapa Repo via API (frivilligt, men bra)
    try {
        await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: { 
                "Authorization": `token ${githubToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: repoName, private: true })
        });
    } catch(e) { /* Repo kanske finns, ignorera */ }

    // 2. Dokumentation
    if (!fs.existsSync(path.join(repoPath, "README.md"))) {
        fs.writeFileSync(path.join(repoPath, "README.md"), `# ${pipeline.name}\nGenerated by Frost Night Factory`);
    }

    // 3. Git Push
    const gitDir = path.join(repoPath, ".git");
    if (fs.existsSync(gitDir)) fs.rmSync(gitDir, { recursive: true, force: true });

    const gitIgnore = "node_modules\n.next\n.env\n";
    fs.writeFileSync(path.join(repoPath, ".gitignore"), gitIgnore);

    execSync("git init", { cwd: repoPath });
    execSync(`git config user.email "agent@frost.ai"`, { cwd: repoPath });
    execSync(`git config user.name "Frost Agent"`, { cwd: repoPath });
    execSync("git add .", { cwd: repoPath });
    execSync('git commit -m "feat: generated by Frost"', { cwd: repoPath });

    const remoteUrl = `https://${githubUser}:${githubToken}@github.com/${githubUser}/${repoName}.git`;
    
    // Hantera remote
    try { execSync(`git remote add origin ${remoteUrl}`, { cwd: repoPath }); } 
    catch { execSync(`git remote set-url origin ${remoteUrl}`, { cwd: repoPath }); }

    execSync("git branch -M main", { cwd: repoPath });
    execSync("git push -u origin main --force", { cwd: repoPath });

    console.log("✅ Code pushed to GitHub!");
    
    const prUrl = `https://github.com/${githubUser}/${repoName}`;
    
    // Gå till Cleanup
    await updatePipeline(pipeline.id, {
        current_phase: "cleanup",
        repo_url: prUrl,
        updated_at: new Date().toISOString()
    });

  } catch (e: any) {
    console.error("❌ Publisher Failed:", e.message);
    await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
  }
}

// --- Main Loop ---

async function runPipelineLoop(sandboxPath: string) {
  console.log("❄️  Frost Pipeline Runner started...");
  console.log(`🔒 Sandbox path: ${sandboxPath}`);

  while (true) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("*")
      .in("status", ["pending", "running"])
      .order("updated_at", { ascending: true }) 
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      await sleep(5000);
      continue;
    }

    console.log(`\n🎯 Processing: ${pipeline.name} [Phase: ${pipeline.current_phase}]`);
    const repoPath = getRepoPath(pipeline, sandboxPath);

    try {
      switch (pipeline.current_phase) {
        case "research": await runResearchStep(pipeline); break;
        case "planner": await runPlannerStep(pipeline); break;
        case "coder": await runCoderStep(pipeline, repoPath); break;
        case "sql": await runSqlStep(pipeline, repoPath); break;
        case "tester": await runTesterStep(pipeline, repoPath); break;
        case "publisher": await runPublisherStep(pipeline, repoPath); break;
        case "cleanup": 
            console.log("🧹 Cleanup skipped for debugging (or implement rmSync here)");
            await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
            break;
        default: 
            console.log(`⚠️ Unknown phase ${pipeline.current_phase}, resetting.`);
            await updatePipeline(pipeline.id, { current_phase: "research" });
      }
    } catch (e: any) {
      console.error(`❌ Pipeline Error:`, e.message);
      await updatePipeline(pipeline.id, { status: "failed" });
    }
    
    await sleep(2000);
  }
}

export { runPipelineLoop };
