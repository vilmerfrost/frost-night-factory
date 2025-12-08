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
};
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
export function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
}
/**
 * Format date
 */
export function formatDate(date, options) {
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
export function formatRelativeTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1)
        return 'just now';
    if (diffMins < 60)
        return `${diffMins} min ago`;
    if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30)
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(d);
}
/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
/**
 * Generate UUID
 */
export function uuid() {
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
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
/**
 * Sleep/delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Class name merge utility (for Tailwind)
 */
export function cn(...classes) {
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
};
// =============================================================================
// HOOKS (for React)
// =============================================================================
// Re-export hooks when available
// export { useAuth } from '../hooks/use-auth';
// export { useToast } from '../hooks/use-toast';
// export { usePipeline } from '../hooks/use-pipeline';
