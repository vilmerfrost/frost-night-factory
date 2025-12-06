// =============================================================================
// BLUEPRINT LIBRARY - Pre-defined blueprints for common app types
// =============================================================================

import type { PageBlueprint, SectionConfig } from '../templates/shadcn/lib/blueprints';

export interface AppBlueprint {
  appType: 'saas-dashboard' | 'crud-admin' | 'marketing-landing' | 'invoice-pdf' | 'custom';
  pages: Array<{
    route: string;
    blueprint: PageBlueprint;
  }>;
  description: string;
}

/**
 * Get blueprint for app type
 */
export function getBlueprintForAppType(appType: string, customContent?: any): AppBlueprint | null {
  switch (appType) {
    case 'saas-dashboard':
      return {
        appType: 'saas-dashboard',
        description: 'SaaS dashboard with stats, charts, and data tables',
        pages: [
          {
            route: '/',
            blueprint: {
              template: 'dashboard',
              sections: [
                {
                  kind: 'hero',
                  title: 'Dashboard',
                  subtitle: 'Welcome back',
                },
                {
                  kind: 'stats',
                  title: 'Overview',
                  stats: [
                    { title: 'Total Users', value: '0', description: 'Active users' },
                    { title: 'Revenue', value: '$0', description: 'This month' },
                    { title: 'Growth', value: '0%', description: 'vs last month' },
                    { title: 'Active', value: '0', description: 'Right now' },
                  ],
                },
                {
                  kind: 'feature-grid',
                  title: 'Quick Actions',
                  features: [
                    { title: 'Create', description: 'Create new items' },
                    { title: 'View', description: 'View all items' },
                    { title: 'Settings', description: 'Manage settings' },
                  ],
                },
              ],
            },
          },
        ],
      };

    case 'crud-admin':
      return {
        appType: 'crud-admin',
        description: 'CRUD admin panel with data tables and forms',
        pages: [
          {
            route: '/',
            blueprint: {
              template: 'dashboard',
              sections: [
                {
                  kind: 'hero',
                  title: 'Admin Panel',
                  subtitle: 'Manage your data',
                },
                {
                  kind: 'stats',
                  title: 'Statistics',
                  stats: [
                    { title: 'Total Records', value: '0', description: 'In database' },
                    { title: 'Today', value: '0', description: 'New records' },
                    { title: 'Pending', value: '0', description: 'Awaiting review' },
                    { title: 'Completed', value: '0', description: 'This week' },
                  ],
                },
              ],
            },
          },
          {
            route: '/create',
            blueprint: {
              template: 'tool',
              sections: [
                {
                  kind: 'tool-showcase',
                  title: 'Create New Record',
                  subtitle: 'Fill in the form below',
                  description: 'Create a new entry in the system',
                },
              ],
            },
          },
        ],
      };

    case 'marketing-landing':
      return {
        appType: 'marketing-landing',
        description: 'Marketing landing page with hero, features, and CTA',
        pages: [
          {
            route: '/',
            blueprint: {
              template: 'marketing',
              sections: [
                {
                  kind: 'hero',
                  title: customContent?.heroTitle || 'Welcome to Our Platform',
                  subtitle: customContent?.heroSubtitle || 'Build amazing things with our tools',
                  primaryAction: { label: 'Get Started', href: '/signup' },
                  secondaryAction: { label: 'Learn More', href: '/about' },
                },
                {
                  kind: 'feature-grid',
                  title: 'Features',
                  features: customContent?.features || [
                    { title: 'Fast', description: 'Lightning fast performance' },
                    { title: 'Secure', description: 'Enterprise-grade security' },
                    { title: 'Scalable', description: 'Grows with your needs' },
                  ],
                },
                {
                  kind: 'cta',
                  title: 'Ready to get started?',
                  subtitle: 'Join thousands of happy customers',
                  primaryAction: { label: 'Sign Up Now', href: '/signup' },
                },
              ],
            },
          },
        ],
      };

    case 'invoice-pdf':
      return {
        appType: 'invoice-pdf',
        description: 'Invoice/PDF management system',
        pages: [
          {
            route: '/',
            blueprint: {
              template: 'dashboard',
              sections: [
                {
                  kind: 'hero',
                  title: 'Invoice Manager',
                  subtitle: 'Manage your invoices',
                },
                {
                  kind: 'stats',
                  title: 'Overview',
                  stats: [
                    { title: 'Total Invoices', value: '0', description: 'All time' },
                    { title: 'Pending', value: '0', description: 'Awaiting payment' },
                    { title: 'Paid', value: '0', description: 'This month' },
                    { title: 'Revenue', value: '$0', description: 'Total' },
                  ],
                },
              ],
            },
          },
        ],
      };

    default:
      return null;
  }
}

/**
 * Detect app type from prompt/plan
 */
export function detectAppType(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('dashboard') || promptLower.includes('saas') || promptLower.includes('analytics')) {
    return 'saas-dashboard';
  }
  
  if (promptLower.includes('admin') || promptLower.includes('crud') || promptLower.includes('management')) {
    return 'crud-admin';
  }
  
  if (promptLower.includes('landing') || promptLower.includes('marketing') || promptLower.includes('homepage')) {
    return 'marketing-landing';
  }
  
  if (promptLower.includes('invoice') || promptLower.includes('pdf') || promptLower.includes('document')) {
    return 'invoice-pdf';
  }
  
  return 'custom';
}

