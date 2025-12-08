// =============================================================================
// GOLDEN CONTRACT: Mock Data (Validated by Zod Schemas)
// =============================================================================
// This file provides mock data that matches Zod schemas
// DO NOT MODIFY - This is a golden contract file
/**
 * Mock invoices matching InvoiceSchema
 */
export const MOCK_INVOICES = [
    {
        id: '550e8400-e29b-41d4-a716-446655440000',
        invoiceNumber: 'INV-2024-001',
        customerName: 'Acme Corporation',
        customerEmail: 'billing@acme.com',
        amount: 12500.00,
        currency: 'USD',
        status: 'paid',
        dueDate: new Date('2024-01-15').toISOString(),
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-10').toISOString(),
        items: [
            {
                description: 'Web Development Services',
                quantity: 40,
                unitPrice: 250.00,
                total: 10000.00,
            },
            {
                description: 'Consulting Services',
                quantity: 10,
                unitPrice: 250.00,
                total: 2500.00,
            },
        ],
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440001',
        invoiceNumber: 'INV-2024-002',
        customerName: 'Tech Startup Inc',
        customerEmail: 'finance@techstartup.com',
        amount: 8500.00,
        currency: 'USD',
        status: 'sent',
        dueDate: new Date('2024-02-01').toISOString(),
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-01-15').toISOString(),
        items: [
            {
                description: 'Mobile App Development',
                quantity: 30,
                unitPrice: 200.00,
                total: 6000.00,
            },
            {
                description: 'UI/UX Design',
                quantity: 25,
                unitPrice: 100.00,
                total: 2500.00,
            },
        ],
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440002',
        invoiceNumber: 'INV-2024-003',
        customerName: 'Small Business LLC',
        customerEmail: 'admin@smallbiz.com',
        amount: 3200.00,
        currency: 'USD',
        status: 'overdue',
        dueDate: new Date('2023-12-20').toISOString(),
        createdAt: new Date('2023-12-01').toISOString(),
        updatedAt: new Date('2023-12-25').toISOString(),
        items: [
            {
                description: 'Website Maintenance',
                quantity: 8,
                unitPrice: 400.00,
                total: 3200.00,
            },
        ],
    },
];
/**
 * Mock dashboard statistics matching DashboardStatsSchema
 */
export const MOCK_DASHBOARD_STATS = {
    totalInvoices: 3,
    totalRevenue: 24200.00,
    paidInvoices: 1,
    overdueInvoices: 1,
    draftInvoices: 0,
};
/**
 * Mock processing metrics (optional, for future use)
 */
export const MOCK_PROCESSING_METRICS = {
    averageProcessingTime: 2.5,
    successRate: 0.95,
    totalProcessed: 150,
};
