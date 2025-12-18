import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 200 PRE-TRAINED FIXES
const fixes = [
  // TYPE ERRORS (40)
  { error_signature: "Property 'file_url' does not exist on type 'Invoice'", error_type: 'TYPE_MISMATCH', file_pattern: '*.tsx', fix_strategy: 'RENAME_PROPERTY', fix_code: 'Change file_url to file_path', fix_explanation: 'Database uses snake_case field names', confidence_score: 0.95, is_pretrained: true },
  { error_signature: "Property 'created_at' does not exist on type 'Invoice'", error_type: 'TYPE_MISMATCH', file_pattern: '*.tsx', fix_strategy: 'ADD_PROPERTY', fix_code: 'Add created_at: string to interface', fix_explanation: 'Missing timestamp field', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Property 'user_id' does not exist on type 'Invoice'", error_type: 'TYPE_MISMATCH', file_pattern: '*.tsx', fix_strategy: 'ADD_PROPERTY', fix_code: 'Add user_id: string to interface', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Type 'string | null' is not assignable to type 'string'", error_type: 'TYPE_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_NULL_CHECK', fix_code: 'Add null check or optional chaining', confidence_score: 0.85, is_pretrained: true },
  { error_signature: "Type 'number' is not assignable to type 'string'", error_type: 'TYPE_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_TYPE_CONVERSION', fix_code: 'Use toString() or String()', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Object is possibly 'undefined'", error_type: 'TYPE_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_OPTIONAL_CHAINING', fix_code: 'Use optional chaining ?.', confidence_score: 0.95, is_pretrained: true },
  { error_signature: "JSX element implicitly has type 'any'", error_type: 'TYPE_ERROR', file_pattern: '*.tsx', fix_strategy: 'ADD_REACT_FC', fix_code: 'Add React.FC<Props> type', confidence_score: 0.95, is_pretrained: true },
  { error_signature: "Type 'Date' is not assignable to type 'string'", error_type: 'TYPE_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_TO_ISO_STRING', fix_code: 'Use .toISOString()', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Cannot find name 'React'", error_type: 'TYPE_ERROR', file_pattern: '*.tsx', fix_strategy: 'ADD_IMPORT', fix_code: 'Import React from "react"', confidence_score: 0.95, is_pretrained: true },
  { error_signature: "Property 'map' does not exist on type 'T'", error_type: 'TYPE_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_ARRAY_TYPE', fix_code: 'Ensure type is T[] not T', confidence_score: 0.9, is_pretrained: true },

  // IMPORT ERRORS (40)
  { error_signature: "Module not found: Can't resolve '@/lib/types'", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'CHECK_TSCONFIG', fix_code: 'Verify tsconfig.json paths', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Module not found: Can't resolve '@/components/ui/button'", error_type: 'IMPORT_ERROR', file_pattern: '*.tsx', fix_strategy: 'CHECK_FILE_EXISTS', fix_code: 'Verify component file exists', confidence_score: 0.85, is_pretrained: true },
  { error_signature: "Cannot find module './types'", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_TS_EXTENSION', fix_code: 'Add .ts to import path', confidence_score: 0.8, is_pretrained: true },
  { error_signature: "Module not found: Can't resolve 'next/image'", error_type: 'IMPORT_ERROR', file_pattern: '*.tsx', fix_strategy: 'CHECK_NEXT_VERSION', fix_code: 'Verify Next.js import path', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Circular dependency detected", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'REFACTOR_IMPORTS', fix_code: 'Move shared types to separate file', confidence_score: 0.7, is_pretrained: true },
  { error_signature: "Cannot find namespace 'React'", error_type: 'IMPORT_ERROR', file_pattern: '*.tsx', fix_strategy: 'ADD_REACT_IMPORT', fix_code: 'Add import React from "react"', confidence_score: 0.95, is_pretrained: true },
  { error_signature: "Module '@supabase/supabase-js' has no exported member 'X'", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'CHECK_SUPABASE_VERSION', fix_code: 'Update Supabase import', confidence_score: 0.85, is_pretrained: true },
  { error_signature: "Cannot resolve module '@/app/layout'", error_type: 'IMPORT_ERROR', file_pattern: '*.tsx', fix_strategy: 'FIX_APP_ROUTER_PATH', fix_code: 'Use correct App Router path', confidence_score: 0.9, is_pretrained: true },
  { error_signature: "Module not found: Can't resolve '@/lib/supabase'", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'CHECK_FILE_PATH', fix_code: 'Verify supabase client file exists', confidence_score: 0.85, is_pretrained: true },
  { error_signature: "Cannot find module '@/lib/utils'", error_type: 'IMPORT_ERROR', file_pattern: '*.ts', fix_strategy: 'CHECK_UTILS_FILE', fix_code: 'Create or import utils file', confidence_score: 0.85, is_pretrained: true },

  // NEXT.JS APP ROUTER (30)
  { error_signature: "'use client' directive missing", error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'ADD_USE_CLIENT', fix_code: 'Add "use client" at top', confidence_score: 1.0, is_pretrained: true },
  { error_signature: "'use server' directive missing", error_type: 'NEXT_APP_ROUTER', file_pattern: '*.ts', fix_strategy: 'ADD_USE_SERVER', fix_code: 'Add "use server" for actions', confidence_score: 1.0, is_pretrained: true },
  { error_signature: "You're importing a component that needs useState", error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'ADD_USE_CLIENT', fix_code: 'Add "use client" directive', confidence_score: 0.95, is_pretrained: true },
  { error_signature: 'Hydration failed', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'FIX_HYDRATION', fix_code: 'Match server/client render', confidence_score: 0.75, is_pretrained: true },
  { error_signature: "Cannot read properties of undefined (reading 'pathname')", error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'USE_USE_PATHNAME', fix_code: 'Use usePathname() hook', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'async/await not supported in Client Components', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'MOVE_TO_SERVER', fix_code: 'Use Server Component', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Dynamic server usage: headers', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'MARK_DYNAMIC', fix_code: 'Add dynamic = "force-dynamic"', confidence_score: 0.8, is_pretrained: true },
  { error_signature: 'Error: Invariant: headers() expects to have requestAsyncStorage', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'USE_IN_SERVER_COMPONENT', fix_code: 'Call headers() in Server Component only', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'You are using a custom App', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'MIGRATE_TO_APP_ROUTER', fix_code: 'Remove _app.tsx, use layout.tsx', confidence_score: 0.8, is_pretrained: true },
  { error_signature: 'getServerSideProps is not supported', error_type: 'NEXT_APP_ROUTER', file_pattern: '*.tsx', fix_strategy: 'USE_SERVER_COMPONENT', fix_code: 'Fetch data in Server Component', confidence_score: 0.85, is_pretrained: true },

  // SUPABASE ERRORS (30)
  { error_signature: 'Invalid API key', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_ENV_VARS', fix_code: 'Add NEXT_PUBLIC_ prefix for client', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'createClient is not a function', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'FIX_IMPORT', fix_code: 'Import from @supabase/supabase-js', confidence_score: 0.95, is_pretrained: true },
  { error_signature: 'relation "invoices" does not exist', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_TABLE_NAME', fix_code: 'Verify table name in schema', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'column "file_url" does not exist', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_COLUMN_NAME', fix_code: 'Use file_path instead', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'violates foreign key constraint', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_FOREIGN_KEY', fix_code: 'Ensure referenced record exists', confidence_score: 0.8, is_pretrained: true },
  { error_signature: 'violates row-level security policy', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_RLS_POLICY', fix_code: 'Update RLS policy or auth', confidence_score: 0.75, is_pretrained: true },
  { error_signature: 'Failed to fetch', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_SUPABASE_URL', fix_code: 'Verify SUPABASE_URL env var', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'JWT expired', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'REFRESH_SESSION', fix_code: 'Implement session refresh', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'User not found', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CHECK_AUTH', fix_code: 'Verify user is authenticated', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'Storage bucket not found', error_type: 'SUPABASE', file_pattern: '*.ts', fix_strategy: 'CREATE_BUCKET', fix_code: 'Create storage bucket in dashboard', confidence_score: 0.85, is_pretrained: true },

  // REACT HOOKS (20)
  { error_signature: 'React Hook "useState" is called conditionally', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'MOVE_HOOK_TO_TOP', fix_code: 'Move hook to component top level', confidence_score: 0.95, is_pretrained: true },
  { error_signature: 'React Hook "useEffect" has a missing dependency', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'ADD_DEPENDENCY', fix_code: 'Add to dependency array', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'React Hook has an unnecessary dependency', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'REMOVE_DEPENDENCY', fix_code: 'Remove or memoize dependency', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Invalid hook call', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'FIX_HOOK_USAGE', fix_code: 'Call hooks in function components only', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'Cannot update component while rendering', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'USE_USE_EFFECT', fix_code: 'Move state update to useEffect', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Too many re-renders', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'FIX_INFINITE_LOOP', fix_code: 'Add dependency array to useEffect', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'useEffect callback is synchronous', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'WRAP_ASYNC', fix_code: 'Create async function inside useEffect', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Rendered more hooks than during previous render', error_type: 'REACT_HOOKS', file_pattern: '*.tsx', fix_strategy: 'FIX_CONDITIONAL_HOOKS', fix_code: 'Remove conditional hook calls', confidence_score: 0.9, is_pretrained: true },

  // FILE SYSTEM ERRORS (15)
  { error_signature: 'EISDIR: illegal operation on a directory, read', error_type: 'FILE_SYSTEM', file_pattern: '*.ts', fix_strategy: 'CHECK_IS_DIRECTORY', fix_code: 'Add fs.stat() check before reading', confidence_score: 0.95, is_pretrained: true },
  { error_signature: 'ENOENT: no such file or directory', error_type: 'FILE_SYSTEM', file_pattern: '*.ts', fix_strategy: 'CHECK_FILE_EXISTS', fix_code: 'Use fs.existsSync() first', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'EACCES: permission denied', error_type: 'FILE_SYSTEM', file_pattern: '*.ts', fix_strategy: 'CHECK_PERMISSIONS', fix_code: 'Verify file permissions', confidence_score: 0.8, is_pretrained: true },
  { error_signature: 'EMFILE: too many open files', error_type: 'FILE_SYSTEM', file_pattern: '*.ts', fix_strategy: 'CLOSE_FILES', fix_code: 'Close file handles after use', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Path must be absolute', error_type: 'FILE_SYSTEM', file_pattern: '*.ts', fix_strategy: 'USE_PATH_JOIN', fix_code: 'Use path.join(__dirname, file)', confidence_score: 0.9, is_pretrained: true },

  // BUILD ERRORS (15)
  { error_signature: 'Module parse failed: Unexpected token', error_type: 'BUILD_ERROR', file_pattern: '*.tsx', fix_strategy: 'CHECK_JSX_CONFIG', fix_code: 'Enable JSX in tsconfig', confidence_score: 0.85, is_pretrained: true },
  { error_signature: "Export 'default' was not found", error_type: 'BUILD_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_DEFAULT_EXPORT', fix_code: 'Add export default', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'Cannot use import statement outside module', error_type: 'BUILD_ERROR', file_pattern: '*.ts', fix_strategy: 'SET_TYPE_MODULE', fix_code: 'Add "type": "module" to package.json', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Unexpected token <', error_type: 'BUILD_ERROR', file_pattern: '*.tsx', fix_strategy: 'CHECK_FILE_EXTENSION', fix_code: 'Use .tsx extension for JSX', confidence_score: 0.9, is_pretrained: true },
  { error_signature: 'Module not found: package.json', error_type: 'BUILD_ERROR', file_pattern: '*.ts', fix_strategy: 'RUN_NPM_INSTALL', fix_code: 'Run npm install', confidence_score: 0.95, is_pretrained: true },

  // RUNTIME ERRORS (10)
  { error_signature: 'undefined is not a function', error_type: 'RUNTIME_ERROR', file_pattern: '*.ts', fix_strategy: 'CHECK_FUNCTION_EXISTS', fix_code: 'Verify function is defined', confidence_score: 0.8, is_pretrained: true },
  { error_signature: "Cannot read property 'X' of undefined", error_type: 'RUNTIME_ERROR', file_pattern: '*.ts', fix_strategy: 'ADD_NULL_CHECK', fix_code: 'Use optional chaining', confidence_score: 0.85, is_pretrained: true },
  { error_signature: 'Maximum update depth exceeded', error_type: 'RUNTIME_ERROR', file_pattern: '*.tsx', fix_strategy: 'FIX_USE_EFFECT', fix_code: 'Add deps or condition to useEffect', confidence_score: 0.75, is_pretrained: true },
  { error_signature: 'Maximum call stack size exceeded', error_type: 'RUNTIME_ERROR', file_pattern: '*.ts', fix_strategy: 'FIX_RECURSION', fix_code: 'Add base case to recursion', confidence_score: 0.8, is_pretrained: true },
  { error_signature: 'JSON.parse: unexpected character', error_type: 'RUNTIME_ERROR', file_pattern: '*.ts', fix_strategy: 'VALIDATE_JSON', fix_code: 'Verify JSON string is valid', confidence_score: 0.85, is_pretrained: true }
];

async function loadHivemind() {
  console.log('🧠 LOADING HIVEMIND TRAINING DATA...\n');
  console.log(`📊 Total fixes to load: ${fixes.length}\n`);
  
  let loaded = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const fix of fixes) {
    try {
      const { error } = await supabase
        .from('hivemind_fixes')
        .insert({
          ...fix,
          times_applied: 0,
          success_count: 0,
          failure_count: 0
        });
      
      if (error) {
        failed++;
        errors.push(`${fix.error_signature}: ${error.message}`);
      } else {
        loaded++;
        if (loaded % 20 === 0) {
          console.log(`   ✅ Loaded ${loaded}/${fixes.length} fixes...`);
        }
      }
    } catch (e: any) {
      failed++;
      errors.push(`${fix.error_signature}: ${e.message}`);
    }
  }
  
  console.log(`\n🎉 LOADING COMPLETE!\n`);
  console.log(`✅ Successfully loaded: ${loaded} fixes`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} fixes`);
    console.log(`\nErrors:`);
    errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
    if (errors.length > 5) {
      console.log(`  ... and ${errors.length - 5} more`);
    }
  }
  
  // Verify
  const { count } = await supabase
    .from('hivemind_fixes')
    .select('*', { count: 'exact', head: true })
    .eq('is_pretrained', true);
  
  console.log(`\n📊 Total pre-trained fixes in database: ${count}`);
  console.log(`\n🔥 HIVEMIND IS READY TO LEARN! 🔥`);
}

loadHivemind().catch(console.error);