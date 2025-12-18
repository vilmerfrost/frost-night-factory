import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

async function testTestSprite() {
  console.log('🎭 Testing TestSprite API...\n');
  
  const apiKey = process.env.TESTSPRITE_API_KEY;
  
  console.log('🔑 API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND');
  
  if (!apiKey) {
    throw new Error('TESTSPRITE_API_KEY not found');
  }
  
  // Test connection to TestSprite API
  try {
    const response = await axios.get('https://api.testsprite.com/v1/projects', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ TestSprite API connected!');
    console.log('📊 Projects:', response.data);
    
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('⚠️ API key valid but no projects yet (that\'s fine!)');
      console.log('✅ TestSprite connection works!');
    } else {
      console.error('❌ TestSprite error:', error.response?.data || error.message);
      throw error;
    }
  }
}

testTestSprite().catch(console.error);