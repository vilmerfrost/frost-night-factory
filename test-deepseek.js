// Add this at the TOP of the file (before anything else)
require('dotenv').config();

const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

async function test() {
  console.log('🔍 Testing DeepSeek API connection...\n');
  
  // Verify API key is loaded
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY not found in .env file!');
    console.log('Expected location: frost-night-factory/.env');
    return;
  }
  
  console.log('✅ API Key loaded:', 
    process.env.DEEPSEEK_API_KEY.substring(0, 8) + '...' // Show first 8 chars
  );
  
  // Test 1: DeepSeek V3.2 (Chat)
  try {
    console.log('\nTest 1: DeepSeek V3.2 (deepseek-chat)');
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Say "V3.2 working"' }],
      max_tokens: 50
    });
    console.log('✅ V3.2 Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ V3.2 Failed:', error.message);
    console.error('   Status:', error.status);
    console.error('   Code:', error.code);
  }

  console.log('\n---\n');

  // Test 2: DeepSeek R1 (Reasoner)
  try {
    console.log('Test 2: DeepSeek R1 (deepseek-reasoner)');
    const response = await client.chat.completions.create({
      model: 'deepseek-reasoner',
      messages: [{ role: 'user', content: 'Say "R1 working"' }],
      max_tokens: 50
    });
    console.log('✅ R1 Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ R1 Failed:', error.message);
    console.error('   Status:', error.status);
    console.error('   Code:', error.code);
  }
}

test();
