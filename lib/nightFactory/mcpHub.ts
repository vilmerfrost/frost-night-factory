/**
 * 🔌 MCP HUB - Centralized Model Context Protocol Integration
 * All external service integrations through standardized MCPs
 */

import { createClient } from '@supabase/supabase-js';

// Optional Octokit import (only if package is installed)
let OctokitClass: any = null;
try {
  const octokitModule = require('@octokit/rest');
  OctokitClass = octokitModule.Octokit || octokitModule.default?.Octokit || octokitModule.default;
} catch {
  // Octokit not available - GitHub MCP will throw error when used
}

// ═══════════════════════════════════════════════════════════════════
// 1️⃣ BRAVE SEARCH MCP
// ═══════════════════════════════════════════════════════════════════
export namespace BraveSearchMCP {
  interface SearchResult {
    title: string;
    url: string;
    description: string;
  }

  export async function search(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    
    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured');
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.web?.results || [];
  }

  export async function deepResearch(topic: string): Promise<string> {
    const results = await search(topic);
    
    return results.map((r, i) => 
      `${i + 1}. ${r.title}\n   ${r.description}\n   URL: ${r.url}`
    ).join('\n\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2️⃣ SUPABASE MCP
// ═══════════════════════════════════════════════════════════════════
export namespace SupabaseMCP {
  let client: ReturnType<typeof createClient> | null = null;

  function getClient() {
    if (!client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) {
        throw new Error('Supabase credentials not configured');
      }

      client = createClient(url, key);
    }

    return client;
  }

  export async function query(sql: string, params?: any[]) {
    const client = getClient();
    
    // Note: This requires a custom RPC function 'execute_sql' in Supabase
    // The RPC function signature should be: execute_sql(sql_query text, sql_params jsonb)
    // For now, we'll use a simpler approach that works with existing Supabase setup
    throw new Error('Supabase query() requires a custom RPC function. Use Supabase client directly for queries.');
  }

  export async function executeMigration(sql: string): Promise<void> {
    const client = getClient();
    
    // Note: Direct SQL execution requires a custom RPC function
    // For migrations, use Supabase migrations or the Supabase client directly
    throw new Error('Supabase executeMigration() requires a custom RPC function. Use Supabase migrations for schema changes.');
  }

  export async function getTableSchema(tableName: string) {
    const client = getClient();
    const { data, error } = await client
      .from('information_schema.columns')
      .select('*')
      .eq('table_name', tableName);

    if (error) throw error;
    return data;
  }

  export async function createTable(tableName: string, schema: any) {
    // Generate CREATE TABLE statement from schema
    const columns = Object.entries(schema)
      .map(([name, type]) => `${name} ${type}`)
      .join(', ');
    
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
    await executeMigration(sql);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3️⃣ GITHUB MCP
// ═══════════════════════════════════════════════════════════════════
export namespace GitHubMCP {
  let octokit: any | null = null;

  function getClient() {
    if (!OctokitClass) {
      throw new Error('@octokit/rest package not installed. Run: npm install @octokit/rest');
    }

    if (!octokit) {
      const token = process.env.GITHUB_TOKEN;

      if (!token) {
        throw new Error('GITHUB_TOKEN not configured');
      }

      octokit = new OctokitClass({ auth: token });
    }

    return octokit;
  }

  export async function createRepo(name: string, options?: {
    description?: string;
    private?: boolean;
  }) {
    const client = getClient();
    
    const { data } = await client.repos.createForAuthenticatedUser({
      name,
      description: options?.description || '',
      private: options?.private || false,
      auto_init: true
    });

    return data;
  }

  export async function cloneRepo(owner: string, repo: string, targetDir: string) {
    const client = getClient();
    
    // Get repo info
    const { data } = await client.repos.get({ owner, repo });
    
    return {
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      defaultBranch: data.default_branch
    };
  }

  export async function createCommit(
    owner: string,
    repo: string,
    message: string,
    files: Array<{ path: string; content: string }>
  ) {
    const client = getClient();

    // Get current commit SHA
    const { data: ref } = await client.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });

    const commitSha = ref.object.sha;

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(file => 
        client.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64'
        })
      )
    );

    // Create tree
    const { data: tree } = await client.git.createTree({
      owner,
      repo,
      base_tree: commitSha,
      tree: files.map((file, i) => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobs[i].data.sha
      }))
    });

    // Create commit
    const { data: commit } = await client.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [commitSha]
    });

    // Update reference
    await client.git.updateRef({
      owner,
      repo,
      ref: 'heads/main',
      sha: commit.sha
    });

    return commit;
  }

  export async function createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string = 'main'
  ) {
    const client = getClient();

    const { data } = await client.pulls.create({
      owner,
      repo,
      title,
      head,
      base
    });

    return data;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4️⃣ TESTSPRITE MCP
// ═══════════════════════════════════════════════════════════════════
export namespace TestSpriteMCP {
  const BASE_URL = 'https://api.testsprite.com/v1';

  function getHeaders() {
    const apiKey = process.env.TESTSPRITE_API_KEY;

    if (!apiKey) {
      throw new Error('TESTSPRITE_API_KEY not configured');
    }

    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  export async function createProject(name: string, url: string) {
    const response = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, url })
    });

    if (!response.ok) {
      throw new Error(`TestSprite API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  export async function runTests(projectId: string, options?: {
    browser?: string;
    viewport?: { width: number; height: number };
  }) {
    const response = await fetch(`${BASE_URL}/projects/${projectId}/runs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        browser: options?.browser || 'chromium',
        viewport: options?.viewport || { width: 1280, height: 720 }
      })
    });

    if (!response.ok) {
      throw new Error(`TestSprite API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  export async function getTestResults(runId: string) {
    const response = await fetch(`${BASE_URL}/runs/${runId}/results`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`TestSprite API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  export async function waitForTestCompletion(runId: string, timeout: number = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const results = await getTestResults(runId);

      if (results.status === 'completed' || results.status === 'failed') {
        return results;
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Test run ${runId} timed out after ${timeout}ms`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5️⃣ KIMI K2 MCP (Already integrated via ai-client.ts)
// ═══════════════════════════════════════════════════════════════════
// Note: Kimi K2 is already fully integrated through ai-client.ts
// This is just a reference/documentation entry

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
export const MCPHub = {
  brave: BraveSearchMCP,
  supabase: SupabaseMCP,
  github: GitHubMCP,
  testsprite: TestSpriteMCP,
};
