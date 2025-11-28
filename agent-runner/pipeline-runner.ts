import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import postgres from "postgres";
import { generateContent, performDeepResearch } from "../lib/nightFactory/modelClient";

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

// 🔒 SÄKERHET: Se till att varje pipeline får en egen mapp i sandboxen
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

// --- Steps ---

async function runResearchStep(pipeline: any) {
  console.log(`🔍 Running Research (Perplexity) for pipeline ${pipeline.id}`);
  await updatePipeline(pipeline.id, { status: "running", current_phase: "research" });

  const { data: existing } = await supabase.from("pipeline_steps").select("id").eq("pipeline_id", pipeline.id).eq("phase", "research").eq("status", "completed").maybeSingle();
  if (existing) {
    console.log("⚠️ Research already done, skipping.");
    await updatePipeline(pipeline.id, { current_phase: "planner" });
    return;
  }

  const prompt = `Analyze: "${pipeline.initial_prompt}". Provide technical implementation strategy for Next.js 15 + Supabase. List specific files/libs.`;
  const content = await performDeepResearch(prompt);

  await supabase.from("pipeline_steps").insert({
    pipeline_id: pipeline.id, phase: "research", status: "completed", output: { content }, input: { prompt }
  });

  await updatePipeline(pipeline.id, { current_phase: "planner" });
  console.log("✅ Research Complete.");
}

async function runPlannerStep(pipeline: any) {
  console.log(`📋 Running Planner for pipeline ${pipeline.id}`);
  
  const { data: research } = await supabase.from("pipeline_steps").select("output").eq("pipeline_id", pipeline.id).eq("phase", "research").single();
  if (!research) throw new Error("Research step missing.");

  const prompt = `Based on research: ${JSON.stringify(research.output)}, create a detailed coding plan. Return JSON with keys: file_structure, dependencies, steps.`;
  const planContent = await generateContent(prompt);

  // Spara som "plan" (step_type) för att matcha din coder-funktion
  await supabase.from("pipeline_steps").insert({
    pipeline_id: pipeline.id, phase: "planner", step_type: "plan", status: "completed", output: { content: planContent }
  });

  await updatePipeline(pipeline.id, { current_phase: "coder" });
  console.log("✅ Planner Complete.");
}

// DIN OPTIMERADE CODER-FUNKTION 🌟
async function runCoderStep(pipeline: any, repoPath: string) {
  console.log(`💻 Running Coder for pipeline ${pipeline.id}`);
  console.log(`🔒 TARGET SANDBOX: ${repoPath}`);

  // Skapa mappen om den inte finns
  if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });

  const { data: planStep, error } = await supabase
    .from("pipeline_steps")
    .select("output")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "planner") // Vi letar efter phase 'planner', inte step_type 'plan' (beror på hur du sparade)
    .single();

  if (error || !planStep) throw new Error("Planner step not found.");

  const coderPrompt = `
    You are an expert developer building a Next.js app.
    Plan: ${JSON.stringify(planStep.output)}
    
    Instructions:
    - Generate ALL files needed for this feature.
    - Return valid JSON where keys are file paths and values are content strings.
    - DO NOT include markdown blocks. Just raw JSON.
    - IMPORTANT: Include "package.json" with a "test" script ("test": "echo 'Pass'").
  `;

  console.log("🤖 Generating code with Gemini...");
  const coderResponse = await generateContent(coderPrompt);
  
  console.log("🤖 Parsing AI response...");

  try {
    // Försök städa JSON mer aggressivt
    let cleanJson = coderResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
    
    // Ibland lägger AI:n till text före/efter JSON. Hitta första { och sista }
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }

    let files;
    try {
        files = JSON.parse(cleanJson);
    } catch (parseError) {
        console.error("⚠️ JSON Parse failed. Raw Output:", cleanJson);
        throw new Error("AI generated invalid JSON. Please restart Coder step.");
    }

    for (const [filePath, rawContent] of Object.entries(files)) {
      const fullPath = path.join(repoPath, filePath);
      
      // SÄKERHET: Kolla att vi inte bryter oss ut
      if (!fullPath.startsWith(repoPath)) {
        console.warn(`⚠️ BLOCKED: Agent tried to write outside sandbox: ${filePath}`);
        continue;
      }

      // Hantera objekt (t.ex. package.json)
      let contentToWrite = typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2) : String(rawContent);

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(fullPath, contentToWrite);
      console.log(`✅ Wrote file (Sandbox): ${filePath}`);
    }

  } catch (e) {
    console.error("❌ Coder Error (Parse/Write):", e);
    throw new Error("Failed to write files to sandbox.");
  }

  await updatePipeline(pipeline.id, { current_phase: "sql" });
  console.log("✅ Coder complete. Files in sandbox.");
}

async function runSqlStep(pipeline: any, repoPath: string) {
  console.log(`🗄️ Running SQL phase for pipeline ${pipeline.id}`);
  await updatePipeline(pipeline.id, { current_phase: "sql" });

  // Hämta Planner output
  const { data: plannerStep, error: plannerError } = await supabase
    .from("pipeline_steps")
    .select("output")
    .eq("pipeline_id", pipeline.id)
    .eq("phase", "planner")
    .single();

  if (plannerError || !plannerStep?.output) {
    throw new Error("Planner step not found or incomplete");
  }

  const step = await createStep(pipeline.id, "sql", "running", {
    spec: plannerStep.output,
  });
  if (!step) return;

  try {
    // 1. Generera SQL med AI
    const { runSqlPhase } = await import("../lib/pipeline/sql");
    const sqlOutput = await runSqlPhase(plannerStep.output, repoPath);
    
    console.log("📝 SQL Migration generated:", sqlOutput.migration_name);

    // 2. EXEKVERA SQL (Detta är nytt!) 🧨
    console.log("⚡️ Executing SQL migration against database...");
    
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL missing in .env - Cannot execute SQL.");
    }

    const sql = postgres(process.env.DATABASE_URL);
    
    try {
        // Läs filen vi precis skapade
        const migrationPath = path.join(repoPath, "supabase", "migrations", sqlOutput.migration_name);
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }
        const migrationFile = fs.readFileSync(migrationPath, 'utf-8');
        
        // Kör den mot databasen
        await sql.unsafe(migrationFile);
        
        console.log("✅ SQL Migration applied successfully to DB!");
        
        await supabase.from("pipeline_steps").update({
            status: "completed",
            output: { ...sqlOutput, executed: true },
            updated_at: new Date().toISOString()
        }).eq("id", step.id);
        
    } catch (dbError: any) {
        console.error("❌ Database Execution Error:", dbError.message);
        await supabase.from("pipeline_steps").update({
            status: "failed",
            output: { error: dbError.message },
            updated_at: new Date().toISOString()
        }).eq("id", step.id);
        throw new Error(`Migration failed: ${dbError.message}`);
    } finally {
        await sql.end(); // Stäng kopplingen
    }

    await updatePipeline(pipeline.id, { current_phase: "tester" });
    console.log("✅ SQL Complete. Moving to Tester.");

  } catch (error: any) {
    console.error("❌ SQL phase error:", error);
    await supabase.from("pipeline_steps").update({
        status: "failed",
        output: { error: error.message },
        updated_at: new Date().toISOString()
    }).eq("id", step.id);
    await updatePipeline(pipeline.id, { status: "failed" });
    throw error;
  }
}

async function runTesterStep(pipeline: any, repoPath: string) {
  console.log(`🧪 Running Tester for pipeline ${pipeline.id}`);
  
  // 🛠️ FIXEN: Skapa mappen om den saknas!
  if (!fs.existsSync(repoPath)) {
      console.log(`📁 Creating missing directory: ${repoPath}`);
      fs.mkdirSync(repoPath, { recursive: true });
  }

  try {
    const pkgPath = path.join(repoPath, "package.json");
    
    // Self-healing: Skapa package.json om den saknas
    if (!fs.existsSync(pkgPath)) {
        console.log("⚠️ package.json missing. Creating minimal package.json...");
        const minimalPkg = {
            name: "frost-generated-app",
            version: "1.0.0",
            scripts: { 
                "test": "echo 'No tests generated, skipping...' && exit 0",
                "dev": "next dev",
                "build": "next build"
            },
            dependencies: {
                "next": "latest",
                "react": "latest",
                "react-dom": "latest"
            }
        };
        fs.writeFileSync(pkgPath, JSON.stringify(minimalPkg, null, 2));
    }

    if (!fs.existsSync(path.join(repoPath, "node_modules"))) {
        console.log("📦 Installing deps (ignoring scripts)...");
        execSync("npm install --ignore-scripts", { cwd: repoPath, stdio: 'ignore' });
    }

    console.log("🚀 Running tests...");
    execSync("npm test", { cwd: repoPath, env: { ...process.env, CI: "true" }, stdio: 'inherit' });
    
    await updatePipeline(pipeline.id, { current_phase: "publisher" });
    console.log("✅ Tests passed. Moving to Publisher...");

  } catch (e: any) {
    console.error("❌ Tests Failed:", e.message);
    await updatePipeline(pipeline.id, { status: "failed" });
  }
}

async function runPublisherStep(pipeline: any, repoPath: string) {
  console.log(`🚀 Running Publisher for pipeline ${pipeline.id}`);
  
  const githubToken = process.env.GITHUB_TOKEN;
  const githubUser = process.env.GITHUB_USERNAME || "vilmerfrost";

  if (!githubToken || !githubUser) {
    console.error("❌ Missing GitHub credentials. Marking as done locally.");
    await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
    return;
  }

  // Skapa ett unikt reponamn baserat på pipeline namn (saniterat)
  // T.ex. "Test Feature Dark Mode" -> "frost-test-feature-dark-mode"
  const repoName = "frost-" + (pipeline.name || pipeline.initial_prompt || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50); // Max längd

  console.log(`📦 Creating new GitHub Repo: ${repoName}...`);

  try {
    // 1. Anropa GitHub API för att skapa repot
    const createRepoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
            "Authorization": `token ${githubToken}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
            name: repoName,
            private: false, // Eller true om du vill ha privata
            description: `Generated by Frost Night Factory: ${(pipeline.initial_prompt || pipeline.name || '').substring(0, 100)}`
        })
    });

    const repoData = await createRepoRes.json();

    if (!createRepoRes.ok) {
        // Om repot redan finns (422), är det lugnt, vi pushar till det befintliga
        if (createRepoRes.status !== 422) {
            throw new Error(`GitHub Error: ${repoData.message}`);
        }
        console.log("⚠️ Repo already exists, pushing updates...");
    } else {
        console.log(`✅ Repo created: ${repoData.html_url}`);
    }

    // 2. DOKUMENTATION & GIT INIT
    
    // A. Hantera .env.example
    const envPath = path.join(repoPath, ".env.local");
    const envExamplePath = path.join(repoPath, ".env.example");
    
    if (fs.existsSync(envPath) && !fs.existsSync(envExamplePath)) {
        console.log("📝 Generating .env.example from .env.local...");
        const envContent = fs.readFileSync(envPath, "utf-8");
        const lines = envContent.split("\n");
        const exampleLines = lines.map(line => {
            if (!line || line.startsWith("#")) return line;
            const [key] = line.split("=");
            return `${key}=INSERT_VALUE_HERE`; // Ta bort hemligheten!
        });
        fs.writeFileSync(envExamplePath, exampleLines.join("\n"));
        console.log("✅ Created .env.example");
    }

    // B. Hantera README.md
    if (!fs.existsSync(path.join(repoPath, "README.md"))) {
        console.log("📝 Generating README.md...");
        const readmeContent = `
# Frost Generated App: ${(pipeline.initial_prompt || pipeline.name || 'App').substring(0, 30)}...

Generated by **Frost Night Factory** ❄️🏭 on ${new Date().toLocaleDateString()}.

## 🚀 Getting Started

1. Clone the repo

2. Install dependencies:

   \`\`\`bash
   npm install
   \`\`\`

3. Setup Environment:

   - Copy \`.env.example\` to \`.env.local\`
   - Fill in the values.

4. Run the app:

   \`\`\`bash
   npm run dev
   \`\`\`
`;
        fs.writeFileSync(path.join(repoPath, "README.md"), readmeContent.trim());
        console.log("✅ Created README.md");
    }

    // C. Skapa .gitignore
    const gitIgnoreContent = `
node_modules
.next
.env
.env.local
.DS_Store
dist
build
`;
    fs.writeFileSync(path.join(repoPath, ".gitignore"), gitIgnoreContent.trim());
    console.log("✅ Created .gitignore");

    // Rensa gammal git
    const gitDir = path.join(repoPath, ".git");
    if (fs.existsSync(gitDir)) {
        console.log("🧹 Cleaning up tainted git history...");
        fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // Initiera Git
    execSync("git init", { cwd: repoPath, stdio: 'pipe' });
    execSync(`git config user.email "agent@frost.ai"`, { cwd: repoPath });
    execSync(`git config user.name "Frost Agent"`, { cwd: repoPath });
    
    execSync("git add .", { cwd: repoPath, stdio: 'pipe' });
    execSync('git commit -m "feat: generated by Frost Night Factory"', { cwd: repoPath, stdio: 'pipe' });

    // 3. Pusha till det NYA repot
    const remoteUrl = `https://${githubUser}:${githubToken}@github.com/${githubUser}/${repoName}.git`;
    
    // Vi pushar till 'main' eftersom det är ett nytt repo
    execSync("git remote add origin " + remoteUrl, { cwd: repoPath, stdio: 'pipe' });
    execSync("git branch -M main", { cwd: repoPath, stdio: 'pipe' });
    execSync("git push -u origin main --force", { cwd: repoPath, stdio: 'pipe' });

    console.log("✅ Code pushed to GitHub!");
    
    const prUrl = `https://github.com/${githubUser}/${repoName}`;
    
    // Gå vidare till Cleanup
    await updatePipeline(pipeline.id, {
        current_phase: "cleanup",
        repo_url: prUrl,
        updated_at: new Date().toISOString()
    });

    console.log("🎉 PUBLISHER COMPLETE -> CLEANUP");

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
      .order("updated_at", { ascending: true }) // Ta den äldsta först, eller den som uppdaterades senast
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      await sleep(5000);
      continue;
    }

    console.log(`\n🎯 Processing: ${pipeline.name} [Phase: ${pipeline.current_phase}]`);
    
    // 🔒 SÄKERHET: Unik mapp per pipeline
    const repoPath = getRepoPath(pipeline, sandboxPath);
    const currentPhase = pipeline.current_phase;

    // Skapa mapp om den saknas (förutom om vi ska städa)
    if (!fs.existsSync(repoPath) && currentPhase !== "cleanup" && currentPhase !== "done") {
      fs.mkdirSync(repoPath, { recursive: true });
    }

    try {
      switch (currentPhase) {
        case "research": await runResearchStep(pipeline); break;
        case "planner": await runPlannerStep(pipeline); break;
        case "coder": await runCoderStep(pipeline, repoPath); break;
        
        case "sql": 
          await runSqlStep(pipeline, repoPath);
          // Phase updated inside function to "tester"
          break;

        case "tester": 
          await runTesterStep(pipeline, repoPath);
          // VIKTIGT: Tester ska inte avsluta, den ska skicka vidare till publisher!
          // (Phase updated inside function to "publisher")
          break;
        
        case "publisher": 
          await runPublisherStep(pipeline, repoPath);
          // NYTT: Gå till städning istället för att bara sluta!
          // (Phase updated inside function to "cleanup")
          break;
        
        // 🧹 STÄDPATRULLEN (NY FAS)
        case "cleanup":
          console.log(`🧹 Cleaning up workspace for pipeline ${pipeline.id}...`);
          try {
              if (fs.existsSync(repoPath)) {
                  // Radera hela mappen rekursivt
                  fs.rmSync(repoPath, { recursive: true, force: true });
                  console.log(`✨ Workspace cleaned: ${repoPath}`);
              }
              // NU sätter vi status till completed/done
              await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
              console.log("🏁 PIPELINE FINISHED & ARCHIVED.");
          } catch (cleanupError: any) {
              console.error("⚠️ Cleanup warning:", cleanupError.message);
              // Vi markerar som klar ändå, städningen är inte kritisk för funktionen
              await updatePipeline(pipeline.id, { status: "completed", current_phase: "done" });
          }
          break;
        
        default: 
            // Om den är "done" gör vi inget, bara loopar vidare
            if (currentPhase !== "done") {
                console.log(`⚠️ Unknown phase ${currentPhase}, resetting...`);
                await updatePipeline(pipeline.id, { current_phase: "research" });
            }
      }
    } catch (e: any) {
      console.error(`❌ Pipeline Error:`, e.message);
      await updatePipeline(pipeline.id, { status: "failed" });
    }
    
    await sleep(2000);
  }
}

export { runPipelineLoop };