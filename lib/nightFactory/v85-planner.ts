// =============================================================================
// FROST NIGHT FACTORY v8.5 - PLANNER PHASE
// =============================================================================
// Enhanced planner with Zod-validated blueprint output

import { 
  ProjectBlueprintSchema, 
  DEFAULT_FILE_TYPE_CONSTRAINTS 
} from './v85-types';
import type { 
  ProjectBlueprint, 
  FileTypeConstraints
} from './v85-types';

/**
 * System prompt for planner phase with constraint awareness
 */
export function getPlannerSystemPrompt(): string {
  return `
You are the Lead Architect for a Next.js 15 + Supabase application.

OUTPUT FORMAT:
You must output a single valid JSON object adhering to this schema:

{
  "project_name": string,
  "fileTypeConstraints": {
    "api_routes": {
      "extension": ".ts",
      "location": "/src/app/api/**",
      "rules": ["NO_REACT_IMPORTS", "NO_JSX", "PURE_ASYNC_FUNCTIONS", "NAMED_EXPORTS_ONLY"],
      "example": "export async function GET(req: NextRequest) { return NextResponse.json({ data }); }"
    },
    "components": {
      "extension": ".tsx",
      "location": "/src/components/** or /src/app/**",
      "rules": ["CAN_REACT", "CAN_JSX", "DEFAULT_OR_NAMED_EXPORT"],
      "example": "export default function Invoice() { return <div>...</div>; }"
    },
    "utilities": {
      "extension": ".ts",
      "location": "/src/lib/**",
      "rules": ["NO_REACT", "NO_JSX", "PURE_FUNCTIONS"],
      "example": "export function formatPrice(amount: number): string { return amount.toFixed(2); }"
    }
  },
  "files": [
    {
      "path": "src/app/page.tsx",
      "kind": "page" | "layout" | "component" | "api_route" | "utility" | "type",
      "expected_extension": ".ts" | ".tsx",
      "description": "Detailed instruction for the coder",
      "constraints": ["use_client", "no_jsx", "zod_validation", etc.]
    }
  ]
}

CRITICAL RULES:
1. API Routes (src/app/api/**) MUST use ".ts" extension and have kind "api_route".
2. Components and Pages MUST use ".tsx" extension.
3. Utility functions (src/lib/**) MUST use ".ts".
4. Never mix JSX into ".ts" files.
5. ALWAYS include fileTypeConstraints in your output.
6. Each file must have a clear description for the coder.
7. Constraints must be actionable and specific.

EXAMPLES:

For an API route:
{
  "path": "src/app/api/invoices/route.ts",
  "kind": "api_route",
  "expected_extension": ".ts",
  "description": "GET: Return all invoices from Supabase. POST: Create new invoice with validation.",
  "constraints": ["no_jsx", "no_react", "zod_validation", "supabase_client"]
}

For a page component:
{
  "path": "src/app/dashboard/page.tsx",
  "kind": "page",
  "expected_extension": ".tsx",
  "description": "Dashboard page showing invoice stats and recent activity.",
  "constraints": ["use_client", "can_jsx", "use_suspense_for_data"]
}

For a utility:
{
  "path": "src/lib/invoice-utils.ts",
  "kind": "utility",
  "expected_extension": ".ts",
  "description": "Pure functions for invoice calculations and formatting.",
  "constraints": ["no_react", "no_jsx", "pure_functions", "typed_returns"]
}
  `;
}

/**
 * Validate planner output against schema
 */
export function validateBlueprint(data: unknown): {
  valid: boolean;
  blueprint?: ProjectBlueprint;
  errors?: string[];
} {
  const result = ProjectBlueprintSchema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    );
    return { valid: false, errors };
  }
  
  // Additional semantic validation
  const semanticErrors = validateBlueprintSemantics(result.data);
  if (semanticErrors.length > 0) {
    return { valid: false, errors: semanticErrors };
  }
  
  return { valid: true, blueprint: result.data };
}

/**
 * Semantic validation for blueprint
 */
function validateBlueprintSemantics(blueprint: ProjectBlueprint): string[] {
  const errors: string[] = [];
  
  for (const file of blueprint.files) {
    // API routes must be .ts
    if (file.kind === 'api_route' && file.expected_extension !== '.ts') {
      errors.push(`API route ${file.path} must use .ts extension, not ${file.expected_extension}`);
    }
    
    // Pages and components must be .tsx
    if (['page', 'layout', 'component'].includes(file.kind) && file.expected_extension !== '.tsx') {
      errors.push(`${file.kind} ${file.path} should use .tsx extension for JSX support`);
    }
    
    // Utilities should be .ts
    if (file.kind === 'utility' && file.expected_extension !== '.ts') {
      errors.push(`Utility ${file.path} should use .ts extension (no JSX needed)`);
    }
    
    // Check path matches kind
    if (file.kind === 'api_route' && !file.path.includes('/api/')) {
      errors.push(`API route ${file.path} should be in /app/api/ directory`);
    }
    
    // Check for description
    if (!file.description || file.description.length < 10) {
      errors.push(`File ${file.path} needs a more detailed description`);
    }
  }
  
  return errors;
}

/**
 * Create a default blueprint for a project
 */
export function createDefaultBlueprint(projectName: string): ProjectBlueprint {
  return {
    project_name: projectName,
    fileTypeConstraints: DEFAULT_FILE_TYPE_CONSTRAINTS,
    files: [
      {
        path: 'src/app/page.tsx',
        kind: 'page',
        expected_extension: '.tsx',
        description: 'Home page with hero section and feature highlights',
        constraints: ['use_client', 'can_jsx', 'tailwind_styling'],
      },
      {
        path: 'src/app/layout.tsx',
        kind: 'layout',
        expected_extension: '.tsx',
        description: 'Root layout with providers and global styles',
        constraints: ['can_jsx', 'server_component', 'metadata'],
      },
      {
        path: 'src/lib/utils.ts',
        kind: 'utility',
        expected_extension: '.ts',
        description: 'Utility functions for formatting and calculations',
        constraints: ['no_react', 'no_jsx', 'pure_functions'],
      },
    ],
  };
}

/**
 * Merge user constraints with default constraints
 */
export function mergeConstraints(
  userConstraints: Partial<FileTypeConstraints>
): FileTypeConstraints {
  return {
    api_routes: {
      ...DEFAULT_FILE_TYPE_CONSTRAINTS.api_routes,
      ...userConstraints.api_routes,
    },
    components: {
      ...DEFAULT_FILE_TYPE_CONSTRAINTS.components,
      ...userConstraints.components,
    },
    utilities: {
      ...DEFAULT_FILE_TYPE_CONSTRAINTS.utilities,
      ...userConstraints.utilities,
    },
  };
}

/**
 * Extract file constraints for coder
 */
export function getFileConstraints(
  blueprint: ProjectBlueprint,
  filePath: string
): {
  kind: string;
  extension: string;
  rules: string[];
  constraints: string[];
} | null {
  const file = blueprint.files.find(f => f.path === filePath);
  if (!file) return null;
  
  const typeConstraints = blueprint.fileTypeConstraints;
  
  switch (file.kind) {
    case 'api_route':
      return {
        kind: file.kind,
        extension: typeConstraints.api_routes.extension,
        rules: typeConstraints.api_routes.rules,
        constraints: file.constraints,
      };
    case 'page':
    case 'layout':
    case 'component':
      return {
        kind: file.kind,
        extension: typeConstraints.components.extension,
        rules: typeConstraints.components.rules,
        constraints: file.constraints,
      };
    case 'utility':
    case 'type':
      return {
        kind: file.kind,
        extension: typeConstraints.utilities.extension,
        rules: typeConstraints.utilities.rules,
        constraints: file.constraints,
      };
    default:
      return null;
  }
}

