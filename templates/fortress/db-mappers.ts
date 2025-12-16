// =============================================================================
// DATABASE MAPPERS - FORTRESS FILE (DO NOT MODIFY)
// =============================================================================
// Converts between snake_case (database) and camelCase (app layer)
// This is a golden template for src/lib/db-mappers.ts

import type { Invoice, InvoiceData } from './types';

/**
 * Converts database row (snake_case) to app Invoice model (camelCase)
 * Handles both Invoices (DB) and Invoice (App) types
 */
export function dbToInvoice(row: any): Invoice {
  // Handle both snake_case (Invoices) and camelCase (Invoice) inputs
  const snakeCaseRow = row as any;
  
  return {
    id: snakeCaseRow.id,
    userId: snakeCaseRow.user_id,                    // snake → camel
    filePath: snakeCaseRow.file_path,                // snake → camel
    fileName: snakeCaseRow.file_name,                // snake → camel
    status: snakeCaseRow.status as Invoice['status'],
    invoiceNumber: snakeCaseRow.invoice_number,       // snake → camel
    vendorName: snakeCaseRow.vendor_name,             // snake → camel
    invoiceDate: snakeCaseRow.invoice_date 
      ? (typeof snakeCaseRow.invoice_date === 'string' 
          ? snakeCaseRow.invoice_date 
          : new Date(snakeCaseRow.invoice_date).toISOString().split('T')[0])
      : null,
    dueDate: snakeCaseRow.due_date 
      ? (typeof snakeCaseRow.due_date === 'string' 
          ? snakeCaseRow.due_date 
          : new Date(snakeCaseRow.due_date).toISOString().split('T')[0])
      : null,
    total: snakeCaseRow.total ? Number(snakeCaseRow.total) : null,
    currency: snakeCaseRow.currency as Invoice['currency'],
    extracted: snakeCaseRow.extracted as InvoiceData | null,
    createdAt: snakeCaseRow.created_at 
      ? (typeof snakeCaseRow.created_at === 'string' 
          ? snakeCaseRow.created_at 
          : new Date(snakeCaseRow.created_at).toISOString())
      : new Date().toISOString(),
    updatedAt: snakeCaseRow.updated_at 
      ? (typeof snakeCaseRow.updated_at === 'string' 
          ? snakeCaseRow.updated_at 
          : new Date(snakeCaseRow.updated_at).toISOString())
      : new Date().toISOString()
  };
}

/**
 * Converts app Invoice model (camelCase) to database insert format (snake_case)
 */
export function invoiceToDb(invoice: Partial<Invoice>): any {
  const result: any = {};
  
  if (invoice.userId !== undefined) result.user_id = invoice.userId;
  if (invoice.filePath !== undefined) result.file_path = invoice.filePath;
  if (invoice.fileName !== undefined) result.file_name = invoice.fileName;
  if (invoice.status !== undefined) result.status = invoice.status;
  if (invoice.invoiceNumber !== undefined) result.invoice_number = invoice.invoiceNumber;
  if (invoice.vendorName !== undefined) result.vendor_name = invoice.vendorName;
  if (invoice.invoiceDate !== undefined) {
    result.invoice_date = invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : null;
  }
  if (invoice.dueDate !== undefined) {
    result.due_date = invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : null;
  }
  if (invoice.total !== undefined) result.total = invoice.total;
  if (invoice.currency !== undefined) result.currency = invoice.currency;
  if (invoice.extracted !== undefined) result.extracted = invoice.extracted;
  
  return result;
}

/**
 * Converts array of database rows to Invoice array
 */
export function dbToInvoiceArray(rows: any[]): Invoice[] {
  return rows.map(dbToInvoice);
}
