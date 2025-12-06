// =============================================================================
// GOLDEN TEMPLATES - Pre-validated, bulletproof templates
// =============================================================================

import { GOLDEN_VERSIONS } from './goldenVersions';

/**
 * Golden package.json template
 */
export const GOLDEN_PACKAGE_JSON = (name: string = 'my-app') => `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.9.0"
  },
  "dependencies": {
    "next": "${GOLDEN_VERSIONS.next}",
    "react": "${GOLDEN_VERSIONS.react}",
    "react-dom": "${GOLDEN_VERSIONS["react-dom"]}",
    "@supabase/supabase-js": "${GOLDEN_VERSIONS["@supabase/supabase-js"]}",
    "@supabase/ssr": "${GOLDEN_VERSIONS["@supabase/ssr"]}",
    "lucide-react": "${GOLDEN_VERSIONS["lucide-react"]}",
    "framer-motion": "${GOLDEN_VERSIONS["framer-motion"]}",
    "sonner": "${GOLDEN_VERSIONS.sonner}",
    "clsx": "${GOLDEN_VERSIONS.clsx}",
    "tailwind-merge": "${GOLDEN_VERSIONS["tailwind-merge"]}",
    "zod": "${GOLDEN_VERSIONS.zod}"
  },
  "devDependencies": {
    "typescript": "${GOLDEN_VERSIONS.typescript}",
    "@types/node": "${GOLDEN_VERSIONS["@types/node"]}",
    "@types/react": "${GOLDEN_VERSIONS["@types/react"]}",
    "@types/react-dom": "${GOLDEN_VERSIONS["@types/react-dom"]}",
    "tailwindcss": "${GOLDEN_VERSIONS.tailwindcss}",
    "postcss": "${GOLDEN_VERSIONS.postcss}",
    "autoprefixer": "${GOLDEN_VERSIONS.autoprefixer}"
  }
}`;

/**
 * Golden tsconfig.json with strict mode
 */
export const GOLDEN_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`;

/**
 * Golden next.config.mjs
 */
export const GOLDEN_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ✅ Fix 3: Explicit root for file tracing - silences many warnings
  outputFileTracingRoot: __dirname,
  // ✅ Fix 2: Explicitly set workspace root to silence warnings
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
`;

/**
 * Golden tailwind.config.ts
 * ✅ Fix 1: Added borderColor extension to fix 'border-border' class error
 */
export const GOLDEN_TAILWIND_CONFIG = `import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // ✅ CRITICAL: Explicit borderColor extension (Fix 1)
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
        border: 'hsl(var(--border))', // Explicit border-border utility
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      // ✅ CRITICAL: Explicit borderColor extension (Fix 1)
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
        border: 'hsl(var(--border))', // Explicit border-border utility
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
`;

/**
 * Golden postcss.config.js
 */
export const GOLDEN_POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

/**
 * Golden globals.css
 */
export const GOLDEN_GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`;

/**
 * Golden layout.tsx
 */
export const GOLDEN_LAYOUT = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frost Night Factory App',
  description: 'Generated by Frost Night Factory',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

/**
 * Golden page.tsx (bulletproof landing page)
 * 
 * ⚠️ CRITICAL: Import order matters!
 * 
 * Correct structure:
 * 1. Directives ('use client', 'use server')
 * 2. Import statements (ALL imports)
 * 3. Route segment config (export const dynamic, etc.)
 * 4. Type definitions (interface, type)
 * 5. Component export (export default function)
 * 
 * NEVER put exports before imports!
 */
export const GOLDEN_PAGE = `'use client';

// ✅ Step 1: ALL imports first
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Code2, Zap } from 'lucide-react';

// ✅ Step 2: Route config (if needed)
// export const dynamic = 'force-dynamic';

// ✅ Step 3: Component
export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Badge */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-indigo-300">AI-Powered Development</span>
            </motion.div>
            
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              Build Something
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Amazing
              </span>
            </h1>
            
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
              This application was generated by Frost Night Factory. 
              Edit the code to customize it for your needs.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-indigo-500/25 transition-shadow"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-xl bg-slate-800/50 text-white font-medium border border-slate-700 hover:border-slate-600 transition-colors"
              >
                View Documentation
              </motion.button>
            </div>
          </motion.div>
          
          {/* Feature Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid md:grid-cols-3 gap-6 mt-24"
          >
            {[
              { icon: Code2, title: 'Modern Stack', desc: 'Built with Next.js 14, TypeScript, and Tailwind CSS' },
              { icon: Zap, title: 'Lightning Fast', desc: 'Optimized for performance with server components' },
              { icon: Sparkles, title: 'Beautiful UI', desc: 'Carefully crafted design with smooth animations' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ y: -4 }}
                className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
`;

/**
 * Golden lib/types.ts - Schema-agnostic version (safe for empty database)
 */
export const GOLDEN_TYPES = `// Golden template for src/lib/types.ts
// Used as fallback when type generation fails or database is empty

import type { Database as SupabaseDatabase } from '@/types/database';

// Re-export Database type
export type Database = SupabaseDatabase;

// Safe generic helper types that work with empty or populated databases
export type Tables<T extends string> = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

export type Inserts<T extends string> = Record<string, unknown>;
export type Updates<T extends string> = Record<string, unknown>;
export type Enums<T extends string> = string;

// This file will be auto-replaced when Supabase tables are detected
// Run the pipeline again after adding tables to generate proper type-safe accessors
`;

/**
 * Golden lib/mock-data.ts
 */
export const GOLDEN_MOCK_DATA = `// lib/mock-data.ts
// Demo data for Simulation First approach - app works even without database

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const MOCK_USERS = [
  { id: '1', name: 'Alex Johnson', email: 'alex@example.com', avatar: '👨‍💻', role: 'admin' as const, createdAt: new Date().toISOString() },
  { id: '2', name: 'Sarah Chen', email: 'sarah@example.com', avatar: '👩‍🎨', role: 'user' as const, createdAt: new Date().toISOString() },
  { id: '3', name: 'Mike Wilson', email: 'mike@example.com', avatar: '🧑‍💼', role: 'user' as const, createdAt: new Date().toISOString() },
];

export const MOCK_ITEMS = [
  { id: '1', title: 'Getting Started Guide', description: 'Learn how to use this application', status: 'active' as const, createdAt: new Date().toISOString() },
  { id: '2', title: 'API Documentation', description: 'Complete API reference', status: 'active' as const, createdAt: new Date().toISOString() },
  { id: '3', title: 'Deployment Guide', description: 'Deploy to production', status: 'draft' as const, createdAt: new Date().toISOString() },
  { id: '4', title: 'Security Best Practices', description: 'Keep your app secure', status: 'completed' as const, createdAt: new Date().toISOString() },
];

/**
 * Safe data fetch with mock fallback
 * The app NEVER crashes - always returns data
 */
export async function safeDataFetch<T>(
  fetchFn: () => Promise<T>,
  mockData: T,
  options?: { silent?: boolean }
): Promise<T> {
  // In demo mode, always use mock data
  if (DEMO_MODE) {
    if (!options?.silent) {
      console.log('[DEMO MODE] Using mock data');
    }
    return mockData;
  }
  
  try {
    return await fetchFn();
  } catch (error) {
    console.warn('Fetch failed, using mock data:', error);
    return mockData;
  }
}
`;

/**
 * Golden lib/utils.ts (cn helper)
 */
export const GOLDEN_UTILS = `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

/**
 * Golden RefreshProvider (client component)
 */
export const GOLDEN_REFRESH_PROVIDER = `'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useCallback, ReactNode } from 'react';

interface RefreshContextValue {
  refresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue | undefined>(undefined);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);
  
  return (
    <RefreshContext.Provider value={{ refresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
}
`;

/**
 * Get all golden templates as a map
 */
export const GOLDEN_TEMPLATES: Record<string, string | ((name?: string) => string)> = {
  'package.json': GOLDEN_PACKAGE_JSON,
  'tsconfig.json': GOLDEN_TSCONFIG,
  'next.config.mjs': GOLDEN_NEXT_CONFIG,
  'tailwind.config.ts': GOLDEN_TAILWIND_CONFIG,
  'postcss.config.js': GOLDEN_POSTCSS_CONFIG,
  'app/globals.css': GOLDEN_GLOBALS_CSS,
  'app/layout.tsx': GOLDEN_LAYOUT,
  'app/page.tsx': GOLDEN_PAGE,
  'lib/types.ts': GOLDEN_TYPES,
  'lib/mock-data.ts': GOLDEN_MOCK_DATA,
  'lib/utils.ts': GOLDEN_UTILS,
  'components/RefreshProvider.tsx': GOLDEN_REFRESH_PROVIDER,
};

/**
 * Get a golden template by filename (always returns resolved string)
 */
export function getGoldenTemplate(filename: string, projectName?: string): string | null {
  const template = GOLDEN_TEMPLATES[filename];
  
  if (!template) {
    return null;
  }
  
  // Resolve function templates
  if (typeof template === 'function') {
    return (template as (name?: string) => string)(projectName);
  }
  
  return template as string;
}

/**
 * Check if a file has a golden template available
 */
export function hasGoldenTemplate(filename: string): boolean {
  return filename in GOLDEN_TEMPLATES;
}

