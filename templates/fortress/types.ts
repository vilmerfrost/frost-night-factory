// =============================================================================
// AUTO-GENERATED DATABASE TYPES - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// This file is AUTO-GENERATED from database migrations during planner phase
// Regenerate with: db-type-generator.ts (runs automatically)
//
// Flow: Migration SQL → types.ts (this file) → Application code
// All field names preserved from database (snake_case - Postgres standard)
//
// ⚠️ CRITICAL: This file is overwritten by db-type-generator.ts
// If migrations exist, types are generated from them
// If no migrations, golden template below is used as fallback

// =============================================================================
// LOCKED ENUMS - NEVER CHANGE THESE
// =============================================================================

export type InvoiceStatus = "uploaded" | "processing" | "processed" | "failed";
export type CurrencyCode = "SEK" | "EUR" | "USD" | (string & {});

// =============================================================================
// DOMAIN TYPE ADAPTERS
// =============================================================================

/**
 * Line item extracted from an invoice.
 * Keep camelCase in app-layer types. Map to DB snake_case at the boundary.
 */
export interface InvoiceItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
  vatRate: number | null;
}

/**
 * Extracted invoice data from PDF/AI processing.
 * All fields use camelCase for consistency with app layer.
 */
export interface InvoiceData {
  invoiceNumber: string | null;
  vendorName: string | null;
  vendorAddress: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;

  invoiceDate: string | null; // ISO YYYY-MM-DD
  dueDate: string | null;     // ISO YYYY-MM-DD

  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: CurrencyCode | null;

  lineItems: InvoiceItem[];
  notes: string | null;

  confidenceScore: number | null; // 0..1
  extractionMethod: "ai" | "fallback" | "manual" | "unknown";
}

/**
 * App-layer invoice model used by pages/components.
 * NOTE: If database-first generation is active, use Invoices interface (snake_case) instead.
 * This interface uses camelCase for app-layer convenience.
 * Use db-mappers.ts to convert between Invoices (DB) and Invoice (App).
 */
export interface Invoice {
  id: string;
  userId: string;

  filePath: string;
  fileName: string | null;

  status: InvoiceStatus;

  // Flattened "headline" fields for quick table views:
  invoiceNumber: string | null;
  vendorName: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  total: number | null;
  currency: CurrencyCode | null;

  // Full extracted payload:
  extracted: InvoiceData | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Database-first invoice type (generated from migrations)
 * Uses snake_case to match database schema exactly
 * This is generated automatically if migrations exist
 * 
 * ⚠️ CRITICAL: When accessing database rows, use snake_case field names:
 * - invoice.invoice_number (NOT invoice.invoiceNumber)
 * - invoice.created_at (NOT invoice.createdAt)
 * - invoice.user_id (NOT invoice.userId)
 */
export interface Invoices {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string | null;
  status: InvoiceStatus;
  invoice_number: string | null;
  vendor_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  currency: CurrencyCode | null;
  extracted: InvoiceData | null;
  created_at: string;
  updated_at: string;
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

// =============================================================================
// VALIDATION RESULT (for form validation)
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// === AUTO_CONTRACT_START ===
// This block is maintained by Frost Night Factory (DO NOT hand-edit exports here)
export const Database = {} as any;
// === AUTO_CONTRACT_END ===


























































