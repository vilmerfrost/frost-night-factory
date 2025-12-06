// lib/agent/tools.ts
import fs from "fs/promises";
import path from "path";
import { supabase } from "@/lib/supabase-server";
// 🔒 SANDBOX: Allt låses till 'workspace'-mappen
const WORK_DIR = path.join(process.cwd(), "workspace");
const LOG_FILE = path.join(WORK_DIR, "_agent_logs.txt");
// Hjälpfunktion för att logga till fil
export async function logToSystem(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}\n`;
    try {
        // Ensure workspace directory exists
        await fs.mkdir(WORK_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, logLine, "utf-8");
    }
    catch (e) {
        console.error("Logging failed", e);
    }
}
export async function writeFile(filepath, content) {
    try {
        // Säkerställ att vi inte skriver utanför workspace
        const fullPath = path.join(WORK_DIR, filepath);
        if (!fullPath.startsWith(WORK_DIR)) {
            throw new Error("Access denied: Outside workspace");
        }
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, content, "utf-8");
        await logToSystem(`📝 Wrote file: ${filepath}`);
        return { ok: true, path: filepath };
    }
    catch (error) {
        await logToSystem(`❌ Write Error: ${error.message}`);
        throw error;
    }
}
export async function readFile(filepath) {
    try {
        const fullPath = path.join(WORK_DIR, filepath);
        if (!fullPath.startsWith(WORK_DIR)) {
            throw new Error("Access denied: Outside workspace");
        }
        const content = await fs.readFile(fullPath, "utf-8");
        await logToSystem(`📖 Read file: ${filepath}`);
        return { content, path: filepath };
    }
    catch (error) {
        await logToSystem(`❌ Read Error: ${error.message}`);
        throw error;
    }
}
export async function listFiles(dir = "") {
    try {
        const fullPath = path.join(WORK_DIR, dir);
        if (!fullPath.startsWith(WORK_DIR)) {
            return [];
        }
        // Skapa mappen om den inte finns
        try {
            await fs.access(fullPath);
        }
        catch {
            await fs.mkdir(fullPath, { recursive: true });
        }
        const files = await fs.readdir(fullPath);
        // Visa inte loggfilen i den vanliga listan
        return files.filter((f) => f !== "_agent_logs.txt" && !f.startsWith("."));
    }
    catch (error) {
        return [];
    }
}
export async function deleteFile(filepath) {
    try {
        const fullPath = path.join(WORK_DIR, filepath);
        if (!fullPath.startsWith(WORK_DIR)) {
            throw new Error("Access denied: Outside workspace");
        }
        await fs.unlink(fullPath);
        await logToSystem(`🗑️ Deleted file: ${filepath}`);
        return { ok: true };
    }
    catch (error) {
        return { ok: true };
    }
}
export async function saveMemory(prompt, code) {
    try {
        const { error } = await supabase
            .from('night_memories')
            .insert({
            prompt: prompt,
            code: code
        });
        if (error)
            throw error;
        await logToSystem("💾 Memory Saved to Supabase!");
    }
    catch (e) {
        await logToSystem(`❌ Memory Save Failed: ${e.message}`);
    }
}
