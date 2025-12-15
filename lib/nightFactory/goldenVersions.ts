// =============================================================================
// GOLDEN VERSIONS - Pre-validated package versions that ALWAYS work
// =============================================================================

import { execSync, type ExecSyncOptions } from 'child_process';

/**
 * GOLDEN VERSIONS DATABASE
 * These versions are tested and known to work together.
 * AI models often hallucinate non-existent versions (e.g., tailwindcss@^3.5.7)
 */
export const GOLDEN_VERSIONS = {
  // Core Framework (Next.js 16 Golden Stack - 4x faster builds)
  "next": "^16.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  
  // TypeScript
  "typescript": "^5.3.3",
  "@types/node": "^20.10.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  
  // Styling
  "tailwindcss": "^3.4.15",
  "postcss": "^8.4.31",
  "autoprefixer": "^10.4.19",
  
  // UI Components
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-dropdown-menu": "^2.1.0",
  "lucide-react": "^0.344.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.0",
  
  // Animation
  "framer-motion": "^11.0.0",
  
  // Notifications
  "sonner": "^1.4.0",
  
  // Database & Auth
  "@supabase/supabase-js": "^2.39.0",
  "@supabase/ssr": "^0.1.0",
  
  // Form & Validation
  "zod": "^3.22.0",
  "react-hook-form": "^7.49.0",
  "@hookform/resolvers": "^3.3.0",
  
  // Charts
  "recharts": "^2.10.0",
  
  // Date utilities
  "date-fns": "^3.0.0",
} as const;

/**
 * VERSION ALIASES - Common hallucinated versions mapped to real ones
 */
export const VERSION_ALIASES: Record<string, string> = {
  // Tailwind hallucinations
  "tailwindcss@^3.5.0": "tailwindcss@^3.4.15",
  "tailwindcss@^3.5.7": "tailwindcss@^3.4.15",
  "tailwindcss@^4.0.0": "tailwindcss@^3.4.15",
  "tailwindcss@latest": "tailwindcss@^3.4.15",
  
  // Next.js hallucinations (now allow Next.js 16)
  "next@15.0.0": "next@^16.0.0",
  "next@15.1.0": "next@^16.0.0",
  "next@latest": "next@^16.0.0",
  
  // React hallucinations (now allow React 19)
  "react@18.0.0": "react@^19.0.0",
  "react@^18.0.0": "react@^19.0.0",
  "react@latest": "react@^19.0.0",
  
  // TypeScript hallucinations
  "typescript@^6.0.0": "typescript@^5.3.3",
  "typescript@latest": "typescript@^5.3.3",
};

/**
 * Check if a package version exists in npm registry
 */
export async function checkNpmVersion(pkg: string, version: string): Promise<boolean> {
  try {
    // Clean version string
    const cleanVersion = version.replace(/[\^~>=<]/g, '').split('.')[0];
    
    // Use npm view to check if version exists
    const cmd = `npm view ${pkg}@${version} version 2>/dev/null`;
    const opts: ExecSyncOptions = {
      encoding: "utf8",
      timeout: 10000,
    };
    const out = execSync(cmd, opts) as unknown as string;
    const result = out.trim();
    
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the correct version for a package (from golden versions or aliases)
 */
export function getGoldenVersion(pkg: string, requestedVersion?: string): string {
  // Check if we have a golden version
  if (pkg in GOLDEN_VERSIONS) {
    return GOLDEN_VERSIONS[pkg as keyof typeof GOLDEN_VERSIONS];
  }
  
  // Check if the requested version is a known hallucination
  const key = `${pkg}@${requestedVersion}`;
  if (key in VERSION_ALIASES) {
    const aliasValue = VERSION_ALIASES[key];
    const corrected = aliasValue?.split('@')[1];
    if (corrected) {
      console.log(`   ⚠️ Auto-corrected ${key} → ${corrected}`);
      return corrected;
    }
  }
  
  // Return requested version if no golden version exists
  return requestedVersion || 'latest';
}

/**
 * Validate and fix all dependencies in a package.json
 */
export function validateAndFixDependencies(
  dependencies: Record<string, string>
): { fixed: Record<string, string>; corrections: string[] } {
  const fixed: Record<string, string> = {};
  const corrections: string[] = [];
  
  for (const [pkg, version] of Object.entries(dependencies)) {
    const goldenVersion = getGoldenVersion(pkg, version);
    
    if (goldenVersion !== version) {
      corrections.push(`${pkg}: ${version} → ${goldenVersion}`);
    }
    
    fixed[pkg] = goldenVersion;
  }
  
  return { fixed, corrections };
}

/**
 * Generate a pre-validated package.json
 */
export function generateGoldenPackageJson(projectName: string = 'my-app'): object {
  return {
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      typecheck: "tsc --noEmit"
    },
    dependencies: {
      "next": GOLDEN_VERSIONS.next,
      "react": GOLDEN_VERSIONS.react,
      "react-dom": GOLDEN_VERSIONS["react-dom"],
      "@supabase/supabase-js": GOLDEN_VERSIONS["@supabase/supabase-js"],
      "@supabase/ssr": GOLDEN_VERSIONS["@supabase/ssr"],
      "lucide-react": GOLDEN_VERSIONS["lucide-react"],
      "framer-motion": GOLDEN_VERSIONS["framer-motion"],
      "sonner": GOLDEN_VERSIONS.sonner,
      "clsx": GOLDEN_VERSIONS.clsx,
      "tailwind-merge": GOLDEN_VERSIONS["tailwind-merge"],
      "zod": GOLDEN_VERSIONS.zod,
    },
    devDependencies: {
      "typescript": GOLDEN_VERSIONS.typescript,
      "@types/node": GOLDEN_VERSIONS["@types/node"],
      "@types/react": GOLDEN_VERSIONS["@types/react"],
      "@types/react-dom": GOLDEN_VERSIONS["@types/react-dom"],
      "tailwindcss": GOLDEN_VERSIONS.tailwindcss,
      "postcss": GOLDEN_VERSIONS.postcss,
      "autoprefixer": GOLDEN_VERSIONS.autoprefixer,
    }
  };
}

