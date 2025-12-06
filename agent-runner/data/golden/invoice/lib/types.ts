// =============================================================================
// GOLDEN CONTRACT: Type Definitions (Derived from Zod Schemas)
// =============================================================================
// This file re-exports types from schemas.ts
// DO NOT MODIFY - This is a golden contract file
// Types are derived from Zod schemas to ensure runtime validation

export type {
  Invoice,
  DashboardStats,
  InvoiceCreate,
  InvoiceUpdate,
} from './schemas';

// Additional utility types that don't need runtime validation
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

