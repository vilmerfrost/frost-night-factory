// lib/agent/pipeline.ts
import { writeFile, readFile, logToSystem, saveMemory } from "./tools";
import { generateContent } from "@/lib/nightFactory/modelClient";
import { supabase } from "@/lib/supabase-server";
export async function nextPipelineStage(taskId, currentStage) {
    await logToSystem(`🔄 Pipeline Transition: Leaving ${currentStage}...`);
    // 1. START -> PLANNER
    if (currentStage === "start_pipeline") {
        let userPrompt = "Create a simple Hello World component";
        try {
            const { content } = await readFile("USER_PROMPT.txt");
            userPrompt = content;
        }
        catch (e) {
            // ignore
        }
        await logToSystem("🧠 PLANNER: Thinking...");
        const plan = await generateContent(`Create a technical implementation plan for: "${userPrompt}". 
      Focus on component structure, props, and state.`, "You are a Senior Architect.");
        await writeFile("PLAN.md", plan);
        // Update task status
        await supabase
            .from("night_tasks")
            .update({ status: "processing" })
            .eq("id", taskId);
        return { next_stage: "planner", status: "Plan created" };
    }
    // 2. PLANNER -> CODER (Nu med STRICT TypeScript instructions)
    if (currentStage === "planner") {
        await logToSystem("🧠 CODER: Writing STRICT TypeScript code...");
        const { content: plan } = await readFile("PLAN.md");
        const code = await generateContent(`Write a single-file React Functional Component using Tailwind CSS based on this plan:

      ${plan}

      CRITICAL RULES:

      1. Use STRICT TYPESCRIPT. Define interfaces for ALL props.

      2. No 'any' types. Explicitly type events (e.g., React.ChangeEvent<HTMLInputElement>).

      3. Return ONLY the code. Start with 'import React'.`, "You are an expert React TypeScript Developer.");
        await writeFile("App.tsx", code);
        return { next_stage: "coder", status: "Code generated" };
    }
    // 3. CODER -> REVIEWER
    if (currentStage === "coder") {
        await logToSystem("🧠 REVIEWER: Looking for logic & security issues...");
        const { content: code } = await readFile("App.tsx");
        const review = await generateContent(`Review this code. Focus on Logic, Security, and Best Practices. 
      Ignore missing types for now, the Polisher will fix that.

      Code: ${code}`, "You are a Senior Tech Lead.");
        await writeFile("REVIEW.md", review);
        return { next_stage: "reviewer", status: "Review complete" };
    }
    // 4. REVIEWER -> FIXER (Logic Fixes)
    if (currentStage === "reviewer") {
        await logToSystem("🔧 FIXER: Applying logical improvements...");
        const { content: originalCode } = await readFile("App.tsx");
        const { content: feedback } = await readFile("REVIEW.md");
        const fixedCode = await generateContent(`Refactor this code based on the review.

      Original: ${originalCode}

      Review: ${feedback}

      Keep it in TypeScript. Return ONLY the code.`, "You are a Refactoring Engineer.");
        await writeFile("App.tsx", fixedCode);
        return { next_stage: "fixer", status: "Logic fixed" };
    }
    // 5. FIXER -> TS POLISHER (The Type Cleaner) 🛡️
    if (currentStage === "fixer") {
        await logToSystem("🛡️ TS POLISHER: Fixing type errors & imports...");
        const { content: code } = await readFile("App.tsx");
        const polishedCode = await generateContent(`Fix ALL TypeScript errors in this code.

      CODE TO FIX:

      ${code}

      CHECKLIST:

      1. Define interface Props {} for all components.

      2. Fix "implicit any" on events (e.g. use React.FormEvent).

      3. Fix "implicit any" on props.

      4. Ensure all external libraries (like lucide-react or framer-motion) are handled or standard HTML is used if simpler.

      5. Return ONLY the fully working .tsx code.`, "You are a TypeScript Compiler Humanizer.");
        await writeFile("App.tsx", polishedCode);
        // Spara minne nu när koden är perfekt
        try {
            const { content: prompt } = await readFile("USER_PROMPT.txt");
            await saveMemory(prompt, polishedCode);
        }
        catch (e) {
            await logToSystem("⚠️ Could not save memory (USER_PROMPT.txt not found)");
        }
        // Mark task as completed
        await supabase
            .from("night_tasks")
            .update({ status: "completed" })
            .eq("id", taskId);
        return { next_stage: "done", status: "Polished & Saved" };
    }
    // 5. DONE
    if (currentStage === "done") {
        await logToSystem("✅ Pipeline Finished.");
        return { next_stage: "done", status: "Pipeline complete" };
    }
    return { next_stage: "unknown" };
}
