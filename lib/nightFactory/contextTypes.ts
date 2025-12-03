// =============================================================================
// PIPELINE CONTEXT TYPES - The Golden Baton 🥇
// =============================================================================

import { TechMatrix, ProjectIntent } from './intentParser';

/**
 * Blueprint from Planner - defines what SHOULD exist
 */
export interface Blueprint {
  files: string[];           // Lista på alla filer som SKA finnas
  databaseSchema: string;    // SQL-schema
  apiContract: string;       // Hur frontend/backend pratar
  components: string[];      // Lista på komponenter
  routes: string[];          // API routes
}

/**
 * The Golden Baton - Data that MUST flow between pipeline steps
 * 
 * Rule: Before any step starts, it MUST verify that required data exists.
 * Missing data = CRASH & WARN. We do NOT allow data to be lost.
 */
export interface PipelineContext {
  // Core identifiers
  ticketId: string;
  userRequest: string;
  optimizedRequest?: string;  // After PROMPT_ENGINEER optimization
  
  // Steg 1: DNA (Gatekeeper + Researcher)
  techMatrix?: TechMatrix;      // Från Gatekeeper
  intent?: ProjectIntent;       // Från Intent Parser
  ragKnowledge?: string;        // Från Researcher (Perplexity)
  researchData?: string;        // Additional research context
  
  // Steg 2: Blueprint (Planner)
  blueprint?: Blueprint;        // Från Planner
  plan?: string;                // Raw plan content
  
  // Steg 3: Reality (Coder)
  createdFiles: string[];       // Vad Coder faktiskt skapade
  rootDir: 'src' | '.';         // Project structure decision
  
  // Steg 4: Verification (Tester)
  buildPassed?: boolean;
  testResults?: {
    typescript: boolean;
    eslint: boolean;
    python?: boolean;
  };
  
  // Steg 5: Deployment (Publisher)
  databaseUrl?: string;         // URL till uppsatt DB
  deploymentUrl?: string;       // Final deployment URL
  githubUrl?: string;           // GitHub repo URL
  
  // Metadata
  startedAt: string;
  completedAt?: string;
  currentPhase: 'planner' | 'coder' | 'tester' | 'publisher' | 'completed';
  errors: string[];
}

/**
 * Create a new empty pipeline context
 */
export function createPipelineContext(ticketId: string, userRequest: string): PipelineContext {
  return {
    ticketId,
    userRequest,
    createdFiles: [],
    rootDir: 'src',
    startedAt: new Date().toISOString(),
    currentPhase: 'planner',
    errors: [],
  };
}

/**
 * Validate context has required data for a stage
 */
export function validateContextForStage(context: PipelineContext, stage: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  switch (stage) {
    case 'coder':
      if (!context.techMatrix) missing.push('techMatrix');
      if (!context.blueprint && !context.plan) missing.push('blueprint or plan');
      // ragKnowledge is optional but recommended
      break;
      
    case 'tester':
      if (context.createdFiles.length === 0) missing.push('createdFiles');
      break;
      
    case 'publisher':
      if (!context.buildPassed) missing.push('buildPassed');
      break;
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

