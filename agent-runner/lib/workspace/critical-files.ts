// agent-runner/lib/workspace/critical-files.ts
import * as fs from "fs";
import * as path from "path";
import { assertInsideWorkspace } from "./config";

/**
 * Critical files that MUST exist in every generated project.
 * Auto-heals if missing.
 */
const CRITICAL_FILES = {
  "package.json": `{
  "name": "generated-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5.0.0"
  }
}`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
  ".gitignore": `# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
`,
};

/**
 * Ensure critical files exist in project root.
 * Auto-heals if missing (logs event and creates file).
 * 
 * This MUST run immediately after pipeline directory is created.
 */
export function ensureCriticalFiles(projectRoot: string): void {
  assertInsideWorkspace(projectRoot);
  
  console.log(`🔧 [Critical Files] Ensuring critical files exist in: ${projectRoot}`);
  
  let healedCount = 0;
  
  for (const [filename, content] of Object.entries(CRITICAL_FILES)) {
    const filePath = path.join(projectRoot, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️ Missing critical file: ${filename} - auto-healing...`);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(filePath, content, "utf-8");
      healedCount++;
      console.log(`   ✅ Created: ${filename}`);
    } else {
      // Validate existing file (basic check)
      try {
        const existing = fs.readFileSync(filePath, "utf-8");
        if (filename === "package.json" || filename === "tsconfig.json") {
          JSON.parse(existing); // Validate JSON
        }
      } catch (e: any) {
        console.warn(`   ⚠️ Corrupted ${filename} detected - overwriting...`);
        fs.writeFileSync(filePath, content, "utf-8");
        healedCount++;
        console.log(`   ✅ Healed: ${filename}`);
      }
    }
  }
  
  if (healedCount > 0) {
    console.log(`✅ [Critical Files] Auto-healed ${healedCount} critical file(s)`);
  } else {
    console.log(`✅ [Critical Files] All critical files present`);
  }
}

