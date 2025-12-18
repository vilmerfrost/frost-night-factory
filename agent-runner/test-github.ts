import { Octokit } from '@octokit/rest';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

async function testGitHub() {
  console.log('🐙 Testing GitHub MCP...\n');
  
  const token = process.env.GITHUB_TOKEN;
  
  console.log('🔑 GitHub Token:', token ? token.substring(0, 15) + '...' : 'NOT FOUND');
  
  if (!token) {
    throw new Error('GITHUB_TOKEN not found in .env');
  }
  
  const octokit = new Octokit({ auth: token });
  
  // Test 1: Get authenticated user
  const { data: user } = await octokit.users.getAuthenticated();
  console.log('✅ Authenticated as:', user.login);
  console.log('👤 Name:', user.name);
  console.log('📧 Email:', user.email);
  
  // Test 2: List your repos
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    per_page: 5,
    sort: 'updated'
  });
  
  console.log('\n📦 Your recent repos:');
  repos.forEach((repo, i) => {
    console.log(`${i + 1}. ${repo.name} (${repo.private ? 'private' : 'public'})`);
  });
  
  console.log('\n🎉 GitHub MCP works perfectly!');
}

testGitHub().catch(console.error);