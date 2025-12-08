/**
 * Test script to verify Kimi/Moonshot API key
 * Run with: npx tsx agent-runner/test-kimi-api.ts
 */
import dotenv from 'dotenv';
import path from 'path';
// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const kimiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
if (!kimiKey) {
    console.error('❌ KIMI_API_KEY not found in environment');
    process.exit(1);
}
console.log(`🔑 Testing API key: ${kimiKey.substring(0, 10)}...`);
console.log(`📡 Endpoint: https://api.moonshot.ai/v1/chat/completions`); // ✅ FIXED: Use .ai (not .cn)
const testRequest = async () => {
    try {
        const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${kimiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'kimi-k2-thinking', // ✅ Testing exact model name from Moonshot docs
                messages: [
                    { role: 'user', content: 'Say "test" if you can read this.' }
                ],
                max_tokens: 10
            })
        });
        console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API Error Response:`);
            console.error(errorText);
            if (response.status === 401) {
                console.error('\n🔴 401 Unauthorized - Possible issues:');
                console.error('   1. API key is invalid or expired');
                console.error('   2. Account has no credits/balance');
                console.error('   3. API access not enabled for your region/account');
                console.error('   4. Check account status at: https://platform.moonshot.ai (global)');
                console.error('   5. ⚠️ If using .cn endpoint, switch to .ai for international keys');
            }
            process.exit(1);
        }
        const data = await response.json();
        console.log(`✅ API Key Valid!`);
        console.log(`📝 Response: ${data.choices[0]?.message?.content || 'No content'}`);
        console.log(`📊 Tokens used: ${data.usage?.prompt_tokens || 0} in, ${data.usage?.completion_tokens || 0} out`);
    }
    catch (error) {
        console.error(`❌ Network/Request Error:`, error.message);
        process.exit(1);
    }
};
testRequest();
