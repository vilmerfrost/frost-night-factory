// =============================================================================
// FILE STRUCTURE PLANNER (V7.5) - The Architect
// =============================================================================
// This module plans the perfect file structure BEFORE coding begins.
// This eliminates guesswork and ensures consistency.

import { callAI } from "./modelClient";
import { DESIGN_SYSTEM } from "./design-system";

export interface FileStructurePlan {
  files: Array<{
    path: string;
    type: 'component' | 'page' | 'api' | 'model' | 'util' | 'config' | 'test';
    description: string;
    imports: string[]; // Exakta import statements
    exports: string[]; // Vad filen ska exportera
  }>;
  root: string;
  dependencies: string[];
}

export async function planPerfectFileStructure(requirements: string, rootDir: string = 'src'): Promise<FileStructurePlan> {
  console.log("🏗️ PLANNER (V7.5): Architecting Perfect File Structure...");
  
  const appPath = rootDir === 'src' ? 'src/app' : 'app';
  const componentsPath = rootDir === 'src' ? 'src/components' : 'components';
  const libPath = rootDir === 'src' ? 'src/lib' : 'lib';
  
  const prompt = `
  ROLE: You are a Senior Software Architect.

  TASK: Create a DETAILED file structure plan for a Next.js 14 Application.

  REQUIREMENTS: ${requirements}

  DESIGN SYSTEM (MUST USE):
  ${JSON.stringify(DESIGN_SYSTEM.colors)}

  CRITICAL RULES:
  1. ROOT: Use '${rootDir}' as the root for all code.
  2. APP ROUTER: Use '${appPath}' for pages.
  3. COMPONENTS: Use '${componentsPath}/ui' for Shadcn-like components.
  4. TYPES: Consolidate ALL types into '${libPath}/types.ts'.
  5. EXPORTS: Be explicit. Pages export 'default'. Components export 'named'.
  6. IMPORTS: Use @/ aliases (e.g., @/components/ui/Button, @/lib/types).
  7. FILE STRUCTURE: Use FLAT FILES, NOT directory/index.ts structures.
     - ✅ CORRECT: src/lib/extractors.ts
     - ❌ WRONG: src/lib/extractors/index.ts
     - This prevents EISDIR errors and simplifies imports.
  8. DATABASE-FIRST TYPES: Types in ${libPath}/types.ts are AUTO-GENERATED from database schema.
     - ALL database field names use snake_case (e.g. invoice_number, created_at)
     - NEVER convert to camelCase - use exact field names from types.ts
     - When accessing database rows:
       ✅ CORRECT: invoice.invoice_number, invoice.created_at
       ❌ WRONG: invoice.invoiceNumber, invoice.createdAt
     - Type definitions are READ-ONLY - never modify types.ts manually
     - Use db-mappers.ts to convert between DB (snake_case) and App (camelCase) layers.

  OUTPUT JSON ONLY:
  {
    "root": "${rootDir}",
    "files": [
      {
        "path": "${appPath}/page.tsx",
        "type": "page",
        "description": "Main dashboard",
        "imports": ["import { Button } from '@/components/ui/Button'", "import { Card } from '@/components/ui/Card'"],
        "exports": ["default"]
      },
      {
        "path": "${componentsPath}/ui/Button.tsx",
        "type": "component",
        "description": "Reusable button",
        "imports": ["import * as React from 'react'", "import { cva } from 'class-variance-authority'"],
        "exports": ["Button", "buttonVariants"]
      }
    ],
    "dependencies": ["lucide-react", "clsx", "tailwind-merge"]
  }
  `;

  const response = await callAI("PLANNER", prompt);
  
  try {
    const json = response.replace(/```json|```/g, "").trim();
    return JSON.parse(json);
  } catch (e) {
    throw new Error("Failed to parse file structure plan.");
  }
}

