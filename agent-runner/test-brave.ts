// test-brave.ts
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory
config({ path: join(__dirname, '..', '.env') });

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  
  console.log('🔑 API Key loaded:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
  
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY not found in .env');
  }
  
  console.log('🔍 Searching Brave for:', query);
  
  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      params: {
        q: query,
        count: 10
      }
    });
    
    const results = response.data.web?.results || [];
    
    return results.map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description
    }));
    
  } catch (error: any) {
    console.error('❌ Brave Search error:', error.response?.data || error.message);
    throw error;
  }
}

async function testBrave() {
  console.log('🔍 Testing Brave Search API...\n');
  
  const results = await braveSearch('Next.js 15 App Router latest features');
  
  console.log('✅ Brave Search works!\n');
  console.log('📊 Results:');
  results.slice(0, 3).forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.title}`);
    console.log(`   ${r.url}`);
    console.log(`   ${r.description.substring(0, 100)}...`);
  });
}

testBrave().catch(console.error);