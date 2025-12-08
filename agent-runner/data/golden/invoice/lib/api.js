// =============================================================================
// GOLDEN CONTRACT: API Client (Thin, Contract-Safe)
// =============================================================================
// This file uses Zod schemas as the single source of truth
// DO NOT MODIFY - This is a golden contract file
import { z } from 'zod';
import { InvoiceSchema, DashboardStatsSchema, InvoiceCreateSchema, InvoiceUpdateSchema, } from '../../../../../lib/schemas';
import { MOCK_INVOICES, MOCK_DASHBOARD_STATS, } from '../../../../../lib/mock-data';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
/**
 * Fetch all invoices from API (with Zod validation)
 */
export async function fetchInvoices() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/invoices`, {
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            console.error('fetchInvoices failed', res.status, res.statusText);
            // Fall back to mock data but still validate with Zod
            return z.array(InvoiceSchema).parse(MOCK_INVOICES);
        }
        const json = await res.json();
        // Validate response with Zod schema
        return z.array(InvoiceSchema).parse(json);
    }
    catch (error) {
        console.error('fetchInvoices error:', error);
        // Fall back to validated mock data
        return z.array(InvoiceSchema).parse(MOCK_INVOICES);
    }
}
/**
 * Fetch dashboard statistics (with Zod validation)
 */
export async function fetchDashboardStats() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/dashboard`, {
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            console.error('fetchDashboardStats failed', res.status, res.statusText);
            return DashboardStatsSchema.parse(MOCK_DASHBOARD_STATS);
        }
        const json = await res.json();
        // Validate response with Zod schema
        return DashboardStatsSchema.parse(json);
    }
    catch (error) {
        console.error('fetchDashboardStats error:', error);
        return DashboardStatsSchema.parse(MOCK_DASHBOARD_STATS);
    }
}
/**
 * Create a new invoice (with input/output Zod validation)
 */
export async function createInvoice(input) {
    // Validate input before sending
    const payload = InvoiceCreateSchema.parse(input);
    const res = await fetch(`${API_BASE_URL}/api/invoices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`createInvoice failed: ${res.status} ${res.statusText} - ${errorText}`);
    }
    const json = await res.json();
    // Validate response with Zod schema
    return InvoiceSchema.parse(json);
}
/**
 * Update an existing invoice (with input/output Zod validation)
 */
export async function updateInvoice(id, input) {
    // Validate input before sending
    const payload = InvoiceUpdateSchema.parse(input);
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`updateInvoice failed: ${res.status} ${res.statusText} - ${errorText}`);
    }
    const json = await res.json();
    // Validate response with Zod schema
    return InvoiceSchema.parse(json);
}
/**
 * Delete an invoice
 */
export async function deleteInvoice(id) {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`deleteInvoice failed: ${res.status} ${res.statusText} - ${errorText}`);
    }
}
/**
 * Get a single invoice by ID (with Zod validation)
 */
export async function fetchInvoiceById(id) {
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}`, {
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        throw new Error(`fetchInvoiceById failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    // Validate response with Zod schema
    return InvoiceSchema.parse(json);
}
