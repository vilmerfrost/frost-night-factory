/**
 * 🗺️ PLANNER MANIFEST CONVERTER
 * Extracts file structure from planner output
 */

export interface PlannerManifest {
  files: Array<{
    path: string;
    description: string;
    dependencies: string[];
  }>;
  architecture?: {
    frontend: any[];
    backend: any[];
  };
  apiRoutes?: string[];
  _raw?: string;
  _errors?: string[];
}

/**
 * Extract file paths from planner text output
 * Supports multiple formats:
 * - JSON with files array
 * - Markdown file lists
 * - Plain text file paths
 */
function extractFilePathsFromText(text: string): string[] {
  const paths: Set<string> = new Set();
  
  // Method 1: Try to parse as JSON first
  try {
    const json = JSON.parse(text);
    
    // Look for files in various JSON structures
    if (json.files && Array.isArray(json.files)) {
      json.files.forEach((f: any) => {
        if (typeof f === 'string') paths.add(f);
        if (f.path) paths.add(f.path);
        if (f.file) paths.add(f.file);
        if (f.filepath) paths.add(f.filepath);
      });
    }
    
    if (json.fileStructure && Array.isArray(json.fileStructure)) {
      json.fileStructure.forEach((f: any) => {
        if (typeof f === 'string') paths.add(f);
        if (f.path) paths.add(f.path);
      });
    }
    
    if (json.structure && Array.isArray(json.structure)) {
      json.structure.forEach((f: any) => {
        if (typeof f === 'string') paths.add(f);
        if (f.path) paths.add(f.path);
      });
    }
  } catch {
    // Not JSON, continue with text parsing
  }
  
  // Method 2: Extract paths using regex patterns
  const patterns = [
    // Matches: src/app/page.tsx, lib/utils.ts, etc.
    /(?:^|\s|["'])((?:src|lib|components|app|pages|styles|public|api)\/[^\s"',;)}\]]+\.(?:tsx?|jsx?|css|json|md|sql))/gm,
    
    // Matches: - src/components/Button.tsx
    /[-*]\s+((?:src|lib|components|app)\/[^\s]+\.(?:tsx?|jsx?))/gm,
    
    // Matches: file: "src/app/layout.tsx"
    /file[:\s]+["']([^"']+\.(?:tsx?|jsx?|css))["']/gm,
    
    // Matches: path: src/components/ui/card.tsx
    /path[:\s]+["']?([^\s"',;]+\.(?:tsx?|jsx?|css))["']?/gm,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const path = match[1];
      if (path && path.length > 3 && path.length < 200) {
        paths.add(path);
      }
    }
  });
  
  // Method 3: Look for common file structures in markdown
  const lines = text.split('\n');
  for (const line of lines) {
    // Look for markdown code blocks with file paths
    if (line.includes('```') || line.includes('`')) continue;
    
    // Extract anything that looks like a file path
    const fileMatch = line.match(/((?:src|lib|components|app)\/[^\s,;]+\.(?:tsx?|jsx?|css|json))/);
    if (fileMatch) {
      paths.add(fileMatch[1]);
    }
  }
  
  return Array.from(paths).sort();
}

/**
 * Extract API routes from planner text
 */
function extractApiRoutes(text: string): string[] {
  const routes: Set<string> = new Set();
  
  // Try JSON first
  try {
    const json = JSON.parse(text);
    if (json.apiRoutes && Array.isArray(json.apiRoutes)) {
      json.apiRoutes.forEach((r: any) => {
        if (typeof r === 'string') routes.add(r);
        if (r.path) routes.add(r.path);
        if (r.route) routes.add(r.route);
      });
    }
  } catch {}
  
  // Look for API route patterns
  const patterns = [
    /\/api\/[^\s"',;)}\]]+/g,
    /route[:\s]+["']([^"']+)["']/g,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const route = match[1] || match[0];
      if (route.startsWith('/api/')) {
        routes.add(route);
      }
    }
  });
  
  return Array.from(routes).sort();
}

/**
 * Main converter function
 * ALWAYS returns a valid manifest (never throws)
 */
export async function convertPlannerToManifestStable(
  plannerRawText: string
): Promise<PlannerManifest> {
  const errors: string[] = [];
  
  try {
    console.log('🔍 [Planner Converter] Processing planner output...');
    console.log('   Input length:', plannerRawText.length);
    
    // Extract files
    const filePaths = extractFilePathsFromText(plannerRawText);
    console.log('   Extracted file paths:', filePaths.length);
    
    if (filePaths.length > 0) {
      console.log('   First 5 files:', filePaths.slice(0, 5));
    }
    
    // Extract API routes
    const apiRoutes = extractApiRoutes(plannerRawText);
    console.log('   Extracted API routes:', apiRoutes.length);
    
    // Build manifest
    const manifest: PlannerManifest = {
      files: filePaths.map(path => ({
        path,
        description: '',
        dependencies: [],
      })),
      apiRoutes,
      _raw: plannerRawText,
      _errors: errors.length > 0 ? errors : undefined,
    };
    
    // Try to extract architecture if present
    try {
      const json = JSON.parse(plannerRawText);
      if (json.architecture) {
        manifest.architecture = json.architecture;
      }
    } catch {
      // Not JSON or no architecture, that's ok
    }
    
    console.log('✅ [Planner Converter] Manifest created successfully');
    return manifest;
    
  } catch (error: any) {
    errors.push(`Conversion failed: ${error.message}`);
    console.error('❌ [Planner Converter] Error:', error.message);
    
    // Return minimal but valid manifest
    return {
      files: [],
      apiRoutes: [],
      _raw: plannerRawText,
      _errors: errors,
    };
  }
}
