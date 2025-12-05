import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

// Support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Support both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey)

async function testInsert() {
  console.log('🧪 Testing direct Supabase insert...')
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  console.log(`   Supabase URL: ${supabaseUrl?.substring(0, 30)}...`)
  console.log(`   Service Role Key: ${serviceKey ? '✅ Set' : '❌ Missing'}`)
  
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      vision: 'TEST FROM SCRIPT - Delete this',
      description: 'TEST FROM SCRIPT - Delete this',
      request: 'TEST FROM SCRIPT - Delete this',
      status: 'queued',
      priority: 2,
      stack_config: {
        frontend: 'nextjs-16',
        backend: 'none',
        ui: 'shadcn',
        features: [],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('❌ INSERT FAILED:', error)
    console.error('   Details:', JSON.stringify(error, null, 2))
  } else {
    console.log('✅ TICKET CREATED:', data.id)
    console.log('   Status:', data.status)
    console.log('   Vision:', data.vision)
    console.log('🔍 Check watcher terminal for pickup...')
    console.log('   (Watcher should log 🎫 Found ticket: within 5 seconds)')
  }
}

testInsert().catch(console.error)

