// =============================================================================
// SHARED TYPES - Used across frontend and backend
// =============================================================================

export interface StackConfig {
  frontend: 'nextjs-16' | 'nextjs-15' | 'nextjs-14';
  backend: 'fastapi' | 'none' | 'nextjs-api';
  ui: 'shadcn' | 'daisyui' | 'nextui';
  features: string[];
}

export interface FrostTicket {
  id: string;
  vision: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  stack_config?: StackConfig;
  created_at: string;
  updated_at: string;
  error_log?: string;
  metadata?: Record<string, any>;
}

