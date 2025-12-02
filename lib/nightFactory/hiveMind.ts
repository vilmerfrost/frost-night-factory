// lib/nightFactory/hiveMind.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Consult Hive Mind: Search for proven solutions to similar errors
 */
export async function consultHiveMind(errorLog: string): Promise<string | null> {
  console.log("🧠 Connecting to Hive Mind...");
  
  try {
    // 1. Skapa en signatur av felet (ta bort filnamn/radnummer för att göra det generellt)
    const signature = errorLog
      .replace(/in \/.*\/([a-zA-Z0-9]+\.tsx?)/g, 'in FILE')
      .replace(/\((\d+),(\d+)\)/g, '(LINE)') // Ta bort radnummer
      .substring(0, 200);
    
    // 2. Sök i databasen
    const { data, error } = await supabase
      .from('solution_memory')
      .select('*')
      .ilike('error_signature', `%${signature}%`)
      .order('success_count', { ascending: false })
      .limit(1);

    if (error) {
      console.warn("⚠️ Hive Mind query failed:", error.message);
      return null;
    }

    if (data && data.length > 0) {
      console.log("💡 Hive Mind recall: Found a proven fix!");
      console.log(`   Success count: ${data[0].success_count || 0}`);
      return data[0].fix_code;
    }
    
    console.log("🧠 Hive Mind: No matching solution found.");
    return null;
  } catch (e: any) {
    console.warn("⚠️ Hive Mind consultation failed:", e?.message);
    return null;
  }
}

/**
 * Memorize Solution: Save a successful fix to the Hive Mind
 */
export async function memorizeSolution(errorLog: string, fixedCode: string) {
  try {
    const signature = errorLog
      .replace(/in \/.*\/([a-zA-Z0-9]+\.tsx?)/g, 'in FILE')
      .replace(/\((\d+),(\d+)\)/g, '(LINE)') // Ta bort radnummer
      .substring(0, 200);
    
    // Spara eller uppdatera
    const { data } = await supabase
      .from('solution_memory')
      .select('id, success_count')
      .eq('error_signature', signature)
      .maybeSingle();
        
    if (data) {
      // Uppdatera success_count
      const { error } = await supabase
        .from('solution_memory')
        .update({ 
          success_count: (data.success_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id);
      
      if (error) {
        console.warn("⚠️ Failed to update Hive Mind:", error.message);
      } else {
        console.log(`🧠 Solution memorized (success count: ${(data.success_count || 0) + 1})`);
      }
    } else {
      // Skapa ny post
      const { error } = await supabase
        .from('solution_memory')
        .insert({
          error_signature: signature,
          fix_strategy: 'AUTO',
          fix_code: fixedCode,
          success_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.warn("⚠️ Failed to memorize solution:", error.message);
      } else {
        console.log("🧠 Solution memorized to Hive Mind.");
      }
    }
  } catch (e: any) {
    console.warn("⚠️ Hive Mind memorization failed:", e?.message);
  }
}

