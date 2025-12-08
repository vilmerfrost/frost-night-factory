// =============================================================================
// DOMAIN TYPES - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This is a golden template. Regenerate with: npm run generate-fortress
// 
// Flow: database.ts → types.ts (this file) → mock-data.ts → components
// This file contains PURE ADAPTERS - no re-exports, no mutations

// Placeholder for Supabase types - replace with actual import
// import type { Database } from '@/types/database';

// =============================================================================
// LOCKED ENUMS - NEVER CHANGE THESE
// =============================================================================

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type UserRole = 'admin' | 'member' | 'viewer';

// =============================================================================
// DOMAIN TYPE ADAPTERS
// =============================================================================

/**
 * Invoice with customer info derived from join
 */
export interface InvoiceData {
  id: string;
  amount: number;
  status: InvoiceStatus;
  created_at: string;
  due_date: string;
  customerName: string;
  customerEmail: string;
}

/**
 * User profile with auth info
 */
export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Project with owner info
 */
export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  ownerName: string;
  memberCount: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<{ data: T | null; error: string | null }>;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

