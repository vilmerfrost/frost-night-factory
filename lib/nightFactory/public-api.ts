// =============================================================================
// PUBLIC API - Single entry point for all imports
// =============================================================================
// Kimi K2 Facade Pattern: ONE public API. All other imports are banned.
//
// ⚠️ AI-PROMPT INSTRUCTION ⚠️
// 
// ALWAYS import from '@/api' - NEVER from deeper paths
// This is the STABLE PUBLIC API - internal paths can change
// 
// Example:
//   ✅ import { Invoice, Components, formatCurrency } from '@/api'
//   ❌ import { Invoice } from './types'
//   ❌ import { Invoice } from '../lib/types'

// =============================================================================
// TYPES - Domain models and interfaces
// =============================================================================

// Pipeline types
export type PipelinePhase = 'planner' | 'coder' | 'tester' | 'deployer';
export type PhaseStatus = 'idle' | 'running' | 'success' | 'failed' | 'blocked' | 'needs_review';
export type ErrorType = 'SYNTAX' | 'IMPORT' | 'BUILD' | 'RUNTIME' | 'NETWORK' | 'RATE_LIMIT';

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  phase: PipelinePhase;
  phase_status: PhaseStatus;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface Permission {
  id: string;
  name: string;
  actions: string[];
}

// Financial types (example domain)
export interface Invoice {
  id: string;
  number: string;
  vendor: string;
  date: string;
  due_date?: string;
  total: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue';
  line_items: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  method: 'card' | 'bank' | 'cash';
  status: 'pending' | 'completed' | 'failed';
  paid_at?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// =============================================================================
// COMPONENTS - Lazy-loaded UI components
// =============================================================================

export const Components = {
  // Layout
  AppShell: () => import('../components/layout/app-shell'),
  DashboardShell: () => import('../components/layout/dashboard-shell'),
  PageRenderer: () => import('../components/layout/page-renderer'),
  
  // UI
  Button: () => import('../components/ui/button'),
  Card: () => import('../components/ui/card'),
  Input: () => import('../components/ui/input'),
  Badge: () => import('../components/ui/badge'),
  Toast: () => import('../components/ui/toast'),
  
  // Domain-specific
  InvoiceCard: () => import('../components/invoice/invoice-card'),
  InvoiceTable: () => import('../components/invoice/invoice-table'),
  PaymentForm: () => import('../components/payment/payment-form'),
  UserProfile: () => import('../components/user/user-profile'),
} as const;

export type ComponentKey = keyof typeof Components;

// =============================================================================
// SERVICES - Business logic
// =============================================================================

// Re-export services (when they exist)
// export { InvoiceService } from './services/invoice-service';
// export { UserService } from './services/user-service';
// export { PaymentService } from './services/payment-service';

// =============================================================================
// UTILITIES - Helper functions
// =============================================================================

/**
 * Format currency value
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(d);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate UUID
 */
export function uuid(): string {
  return crypto.randomUUID?.() || 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Sleep/delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Class name merge utility (for Tailwind)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const CONSTANTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_RETRIES: 3,
  API_TIMEOUT: 30000, // 30 seconds
  PAGE_SIZE: 20,
} as const;

// =============================================================================
// HOOKS (for React)
// =============================================================================

// Re-export hooks when available
// export { useAuth } from '../hooks/use-auth';
// export { useToast } from '../hooks/use-toast';
// export { usePipeline } from '../hooks/use-pipeline';

