import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

async function testSupabase() {
  console.log('🗄️ Testing Supabase MCP...\n');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔑 Supabase URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT FOUND');
  console.log('🔑 Service Key:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'NOT FOUND');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found!');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test: Get pipelines
  const { data, error } = await supabase
    .from('pipelines')
    .select('id, name, status')
    .limit(3);
  
  if (error) {
    console.error('❌ Supabase error:', error);
    throw error;
  }
  
  console.log('\n✅ Supabase MCP works!');
  console.log('📊 Sample pipelines:', data);
  
  // Test: Get tables list
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .limit(5);
  
  console.log('\n📋 Your tables:', tables?.map(t => t.table_name));
}

testSupabase().catch(console.error);