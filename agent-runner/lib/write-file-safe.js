// =============================================================================
// SAFE FILE WRITER - Prevents AI from mutating protected contract files
// =============================================================================
import fs from 'fs/promises';
import path from 'path';
import { isProtectedFile } from './protected-files';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}
/**
 * Safe file writer that blocks writes to protected contract files
 * Also checks for dangerous content before writing
 */
export async function writeFileSafe(targetPath, content, pipelineId) {
    // Check for dangerous content first
    const danger = isDangerousContent(content, path.basename(targetPath));
    if (danger) {
        const reason = `[SECURITY] Dangerous content detected: ${danger}`;
        console.error(`❌ ${reason}`);
        // Log event to Supabase
        if (supabase && pipelineId) {
            try {
                await supabase.from('error_events').insert({
                    pipeline_id: pipelineId,
                    phase: 'file_guard',
                    error_message: reason,
                    error_type: 'DANGEROUS_CONTENT_DETECTED',
                    file_path: targetPath,
                });
            }
            catch (error) {
                console.warn(`⚠️ Failed to log dangerous content: ${error.message}`);
            }
        }
        return { success: false, blocked: true, reason };
    }
    // Check if file is protected
    if (isProtectedFile(targetPath)) {
        const reason = `[FILE-GUARD] Blocked AI write to protected file: ${targetPath}`;
        console.warn(`⚠️ ${reason}`);
        // Log event to Supabase
        if (supabase && pipelineId) {
            try {
                await supabase.from('error_events').insert({
                    pipeline_id: pipelineId,
                    phase: 'file_guard',
                    error_message: reason,
                    error_type: 'PROTECTED_FILE_WRITE_BLOCKED',
                    file_path: targetPath,
                });
            }
            catch (error) {
                console.warn(`⚠️ Failed to log protected file write: ${error.message}`);
            }
        }
        return { success: false, blocked: true, reason };
    }
    // Safe to write - ensure directory exists and write
    try {
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(targetPath, content, 'utf-8');
        return { success: true, blocked: false };
    }
    catch (error) {
        return { success: false, blocked: false, reason: error.message };
    }
}
/**
 * Check if content is safe to write (dangerous content check)
 */
export function isDangerousContent(content, fileName) {
    if (!fileName.endsWith('.ts') && !fileName.endsWith('.tsx') && !fileName.endsWith('.js') && !fileName.endsWith('.jsx')) {
        return null;
    }
    // Git conflict markers
    if (content.includes('<<<<<<< HEAD') || content.includes('>>>>>>>') || content.includes('=======')) {
        return 'Git conflict markers detected';
    }
    // Markdown code fences
    if (content.trim().startsWith('```') || content.includes('```typescript') || content.includes('```tsx')) {
        return 'Markdown code fences detected';
    }
    // Conversational text
    if (content.includes('Here is the code') ||
        content.includes('I have updated the file') ||
        content.includes('Here\'s the') ||
        content.includes('This code')) {
        return 'Conversational text detected';
    }
    // Brace mismatch
    const open = (content.match(/{/g) || []).length;
    const close = (content.match(/}/g) || []).length;
    if (Math.abs(open - close) > 5) {
        return `Severe brace mismatch (open ${open}, close ${close})`;
    }
    // Parenthesis mismatch
    const openParen = (content.match(/\(/g) || []).length;
    const closeParen = (content.match(/\)/g) || []).length;
    if (Math.abs(openParen - closeParen) > 5) {
        return `Severe parenthesis mismatch (open ${openParen}, close ${closeParen})`;
    }
    // Bracket mismatch
    const openBracket = (content.match(/\[/g) || []).length;
    const closeBracket = (content.match(/\]/g) || []).length;
    if (Math.abs(openBracket - closeBracket) > 5) {
        return `Severe bracket mismatch (open ${openBracket}, close ${closeBracket})`;
    }
    return null;
}
