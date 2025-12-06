import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testErrorLogging() {
  console.log('🧪 Testing pipeline_errors table...');
  
  // Step 1: Get a real pipeline_id from the database
  console.log('🔍 Finding existing pipeline...');
  const { data: pipelines, error: fetchError } = await supabase
    .from('pipelines')
    .select('id')
    .limit(1);
  
  if (fetchError || !pipelines || pipelines.length === 0) {
    console.log('⚠️ No pipelines found in database');
    console.log('Creating a test pipeline first...');
    
    // Create a temporary test pipeline
    const { data: newPipeline, error: createError } = await supabase
      .from('pipelines')
      .insert({
        name: 'Test Pipeline for Error Logging',
        status: 'todo',
        phase: 'research'
      })
      .select()
      .single();
    
    if (createError || !newPipeline) {
      console.log('❌ Could not create test pipeline:', createError);
      process.exit(1);
    }
    
    console.log('✅ Created test pipeline:', newPipeline.id);
    var testPipelineId = newPipeline.id;
  } else {
    testPipelineId = pipelines[0].id;
    console.log('✅ Using existing pipeline:', testPipelineId);
  }
  
  // Step 2: Test insert with all columns
  console.log('📝 Inserting test error...');
  const testError = {
    pipeline_id: testPipelineId,
    step_id: null,
    phase: 'test',
    error_type: 'test_error',
    error_message: 'Integration test message - DELETE ME',
    error_stack: 'Error: test\n    at test.ts:10:5',
    retry_count: 1,
    metadata: { test: true, automated_test: true }
  };

  const { data, error } = await supabase
    .from('pipeline_errors')
    .insert(testError)
    .select();

  if (error) {
    console.log('❌ Insert failed:', error.message);
    console.log('Details:', JSON.stringify(error, null, 2));
    process.exit(1);
  } else {
    console.log('✅ pipeline_errors insert successful!');
    console.log('Data:', JSON.stringify(data, null, 2));

    // Step 3: Clean up test data
    console.log('🧹 Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('pipeline_errors')
      .delete()
      .eq('error_message', 'Integration test message - DELETE ME');
    
    if (deleteError) {
      console.log('⚠️ Cleanup failed:', deleteError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
  }
  
  console.log('\n🎉 All tests passed! Error logging is working correctly.');
}

testErrorLogging().catch(console.error);
