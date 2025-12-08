// =============================================================================
// GOLDEN CONTRACT: Zod Schemas for Invoice Domain
// =============================================================================
// This file defines runtime-validated types using Zod schemas
// DO NOT MODIFY - This is a golden contract file
// This is the SINGLE SOURCE OF TRUTH for all invoice-related types
import { z } from 'zod';
/**
 * Invoice Item Schema
 */
export const InvoiceItemSchema = z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    total: z.number().positive(),
});
/**
 * Invoice Status Enum
 */
export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']);
/**
 * Main Invoice Schema - Single Source of Truth
 */
export const InvoiceSchema = z.object({
    id: z.string().uuid(),
    invoiceNumber: z.string().min(1),
    customerName: z.string().min(1),
    customerEmail: z.string().email().optional(),
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    status: InvoiceStatusSchema,
    dueDate: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    items: z.array(InvoiceItemSchema).optional(),
});
/**
 * Dashboard Statistics Schema
 */
export const DashboardStatsSchema = z.object({
    totalInvoices: z.number().int().nonnegative(),
    totalRevenue: z.number().nonnegative(),
    paidInvoices: z.number().int().nonnegative(),
    overdueInvoices: z.number().int().nonnegative(),
    draftInvoices: z.number().int().nonnegative(),
});
/**
 * Invoice Create Schema (for POST requests)
 */
export const InvoiceCreateSchema = InvoiceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});
/**
 * Invoice Update Schema (for PUT/PATCH requests)
 */
export const InvoiceUpdateSchema = InvoiceSchema.partial().omit({
    id: true,
    createdAt: true, // createdAt should never be updated
});
