// =============================================================================
// FROST NIGHT FACTORY - LAYOUT CONTRACT
// =============================================================================
// Canonical layout component definitions - frozen contracts for all pipelines
// These are the "source of truth" for layout component props

/**
 * All canonical layout components
 */
export type LayoutComponent =
  | 'AppShell'
  | 'DashboardShell'
  | 'FormPage'
  | 'DataTablePage'
  | 'HeroSection'
  | 'StatsGrid'
  | 'FeatureGrid'
  | 'ToolShowcase'
  | 'CTASection'
  | 'PageRenderer'
  | 'Sidebar'
  | 'Navbar'
  | 'Footer';

/**
 * Prop definition with type and optionality
 */
export interface PropDefinition {
  type: string;
  optional: boolean;
  description?: string;
}

/**
 * Contract for a layout component
 */
export interface LayoutPropContract {
  name: LayoutComponent;
  props: Record<string, PropDefinition>;
  description: string;
  example: string;
}

/**
 * All layout contracts - THE SOURCE OF TRUTH
 */
export const LAYOUT_CONTRACTS: LayoutPropContract[] = [
  {
    name: 'AppShell',
    description: 'Main application shell with sidebar and header',
    props: {
      children: { type: 'React.ReactNode', optional: false, description: 'Main content' },
      sidebar: { type: 'React.ReactNode', optional: true, description: 'Sidebar content' },
      header: { type: 'React.ReactNode', optional: true, description: 'Header content' },
      className: { type: 'string', optional: true, description: 'Additional CSS classes' },
    },
    example: `'use client';

import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function AppShell({ children, sidebar, header, className }: AppShellProps) {
  return (
    <div className={\`min-h-screen flex \${className || ''}\`}>
      {sidebar && <aside className="w-64 border-r">{sidebar}</aside>}
      <div className="flex-1 flex flex-col">
        {header && <header className="h-16 border-b">{header}</header>}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;`,
  },
  {
    name: 'DashboardShell',
    description: 'Dashboard layout with navigation and content area',
    props: {
      children: { type: 'React.ReactNode', optional: false, description: 'Dashboard content' },
      title: { type: 'string', optional: true, description: 'Page title' },
      description: { type: 'string', optional: true, description: 'Page description' },
      actions: { type: 'React.ReactNode', optional: true, description: 'Action buttons' },
    },
    example: `'use client';

import React from 'react';

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function DashboardShell({ children, title, description, actions }: DashboardShellProps) {
  return (
    <div className="p-6 space-y-6">
      {(title || description || actions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold">{title}</h1>}
            {description && <p className="text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default DashboardShell;`,
  },
  {
    name: 'FormPage',
    description: 'Page layout for forms with title and description',
    props: {
      children: { type: 'React.ReactNode', optional: false, description: 'Form content' },
      title: { type: 'string', optional: false, description: 'Form title' },
      description: { type: 'string', optional: true, description: 'Form description' },
      onSubmit: { type: '(e: React.FormEvent) => void', optional: true, description: 'Submit handler' },
    },
    example: `'use client';

import React from 'react';

interface FormPageProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  onSubmit?: (e: React.FormEvent) => void;
}

export function FormPage({ children, title, description, onSubmit }: FormPageProps) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-gray-500 mt-1">{description}</p>}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
      </form>
    </div>
  );
}

export default FormPage;`,
  },
  {
    name: 'DataTablePage',
    description: 'Page layout for data tables with filters and actions',
    props: {
      children: { type: 'React.ReactNode', optional: false, description: 'Table content' },
      title: { type: 'string', optional: false, description: 'Page title' },
      description: { type: 'string', optional: true, description: 'Page description' },
      filters: { type: 'React.ReactNode', optional: true, description: 'Filter controls' },
      actions: { type: 'React.ReactNode', optional: true, description: 'Action buttons' },
    },
    example: `'use client';

import React from 'react';

interface DataTablePageProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DataTablePage({ children, title, description, filters, actions }: DataTablePageProps) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {filters && <div className="flex gap-2">{filters}</div>}
      <div className="border rounded-lg overflow-hidden">{children}</div>
    </div>
  );
}

export default DataTablePage;`,
  },
  {
    name: 'HeroSection',
    description: 'Hero section for landing pages',
    props: {
      title: { type: 'string', optional: false, description: 'Main headline' },
      subtitle: { type: 'string', optional: true, description: 'Subtitle text' },
      cta: { type: 'React.ReactNode', optional: true, description: 'Call to action buttons' },
      image: { type: 'string', optional: true, description: 'Hero image URL' },
    },
    example: `'use client';

import React from 'react';

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  cta?: React.ReactNode;
  image?: string;
}

export function HeroSection({ title, subtitle, cta, image }: HeroSectionProps) {
  return (
    <section className="py-20 text-center">
      <h1 className="text-5xl font-bold mb-4">{title}</h1>
      {subtitle && <p className="text-xl text-gray-600 mb-8">{subtitle}</p>}
      {cta && <div className="flex justify-center gap-4">{cta}</div>}
      {image && <img src={image} alt="" className="mt-12 mx-auto max-w-4xl" />}
    </section>
  );
}

export default HeroSection;`,
  },
  {
    name: 'StatsGrid',
    description: 'Grid of statistics/metrics',
    props: {
      stats: { type: 'Array<{ label: string; value: string | number; change?: string }>', optional: false, description: 'Stats array' },
      columns: { type: 'number', optional: true, description: 'Number of columns' },
    },
    example: `'use client';

import React from 'react';

interface Stat {
  label: string;
  value: string | number;
  change?: string;
}

interface StatsGridProps {
  stats: Stat[];
  columns?: number;
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  return (
    <div className={\`grid grid-cols-\${columns} gap-4\`}>
      {stats.map((stat, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className="text-2xl font-bold">{stat.value}</p>
          {stat.change && <p className="text-sm text-green-600">{stat.change}</p>}
        </div>
      ))}
    </div>
  );
}

export default StatsGrid;`,
  },
  {
    name: 'FeatureGrid',
    description: 'Grid of feature cards',
    props: {
      features: { type: 'Array<{ title: string; description: string; icon?: React.ReactNode }>', optional: false, description: 'Features array' },
      columns: { type: 'number', optional: true, description: 'Number of columns' },
    },
    example: `'use client';

import React from 'react';

interface Feature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: number;
}

export function FeatureGrid({ features, columns = 3 }: FeatureGridProps) {
  return (
    <div className={\`grid grid-cols-\${columns} gap-6\`}>
      {features.map((feature, i) => (
        <div key={i} className="p-6 border rounded-lg">
          {feature.icon && <div className="mb-4">{feature.icon}</div>}
          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
          <p className="text-gray-600">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

export default FeatureGrid;`,
  },
  {
    name: 'ToolShowcase',
    description: 'Showcase grid for tools or products',
    props: {
      tools: { type: 'Array<{ name: string; description: string; icon?: React.ReactNode; href?: string }>', optional: false, description: 'Tools array' },
      title: { type: 'string', optional: true, description: 'Section title' },
    },
    example: `'use client';

import React from 'react';

interface Tool {
  name: string;
  description: string;
  icon?: React.ReactNode;
  href?: string;
}

interface ToolShowcaseProps {
  tools: Tool[];
  title?: string;
}

export function ToolShowcase({ tools, title }: ToolShowcaseProps) {
  return (
    <section className="py-12">
      {title && <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tools.map((tool, i) => (
          <a key={i} href={tool.href || '#'} className="p-4 border rounded-lg hover:shadow-lg transition">
            {tool.icon && <div className="mb-2">{tool.icon}</div>}
            <h3 className="font-semibold">{tool.name}</h3>
            <p className="text-sm text-gray-500">{tool.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export default ToolShowcase;`,
  },
  {
    name: 'CTASection',
    description: 'Call to action section',
    props: {
      title: { type: 'string', optional: false, description: 'CTA headline' },
      description: { type: 'string', optional: true, description: 'CTA description' },
      primaryAction: { type: 'React.ReactNode', optional: true, description: 'Primary button' },
      secondaryAction: { type: 'React.ReactNode', optional: true, description: 'Secondary button' },
    },
    example: `'use client';

import React from 'react';

interface CTASectionProps {
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function CTASection({ title, description, primaryAction, secondaryAction }: CTASectionProps) {
  return (
    <section className="py-16 bg-gray-50 text-center">
      <h2 className="text-3xl font-bold mb-4">{title}</h2>
      {description && <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">{description}</p>}
      <div className="flex justify-center gap-4">
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

export default CTASection;`,
  },
  {
    name: 'PageRenderer',
    description: 'Dynamic page renderer based on sections',
    props: {
      sections: { type: 'Array<{ type: string; props: Record<string, unknown> }>', optional: false, description: 'Page sections' },
      className: { type: 'string', optional: true, description: 'Container classes' },
    },
    example: `'use client';

import React from 'react';

interface Section {
  type: string;
  props: Record<string, unknown>;
}

interface PageRendererProps {
  sections: Section[];
  className?: string;
}

export function PageRenderer({ sections, className }: PageRendererProps) {
  return (
    <div className={className}>
      {sections.map((section, i) => (
        <div key={i} data-section-type={section.type}>
          {/* Render section based on type */}
        </div>
      ))}
    </div>
  );
}

export default PageRenderer;`,
  },
  {
    name: 'Sidebar',
    description: 'Navigation sidebar',
    props: {
      items: { type: 'Array<{ label: string; href: string; icon?: React.ReactNode }>', optional: false, description: 'Navigation items' },
      logo: { type: 'React.ReactNode', optional: true, description: 'Logo element' },
      footer: { type: 'React.ReactNode', optional: true, description: 'Footer content' },
    },
    example: `'use client';

import React from 'react';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface SidebarProps {
  items: NavItem[];
  logo?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sidebar({ items, logo, footer }: SidebarProps) {
  return (
    <aside className="w-64 h-screen flex flex-col border-r">
      {logo && <div className="p-4 border-b">{logo}</div>}
      <nav className="flex-1 p-4">
        {items.map((item, i) => (
          <a key={i} href={item.href} className="flex items-center gap-2 p-2 rounded hover:bg-gray-100">
            {item.icon}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      {footer && <div className="p-4 border-t">{footer}</div>}
    </aside>
  );
}

export default Sidebar;`,
  },
  {
    name: 'Navbar',
    description: 'Top navigation bar',
    props: {
      logo: { type: 'React.ReactNode', optional: true, description: 'Logo element' },
      items: { type: 'Array<{ label: string; href: string }>', optional: true, description: 'Nav items' },
      actions: { type: 'React.ReactNode', optional: true, description: 'Action buttons' },
    },
    example: `'use client';

import React from 'react';

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  logo?: React.ReactNode;
  items?: NavItem[];
  actions?: React.ReactNode;
}

export function Navbar({ logo, items, actions }: NavbarProps) {
  return (
    <nav className="h-16 border-b flex items-center justify-between px-6">
      {logo && <div>{logo}</div>}
      {items && (
        <div className="flex gap-6">
          {items.map((item, i) => (
            <a key={i} href={item.href} className="text-gray-600 hover:text-gray-900">
              {item.label}
            </a>
          ))}
        </div>
      )}
      {actions && <div className="flex gap-2">{actions}</div>}
    </nav>
  );
}

export default Navbar;`,
  },
  {
    name: 'Footer',
    description: 'Page footer',
    props: {
      copyright: { type: 'string', optional: true, description: 'Copyright text' },
      links: { type: 'Array<{ label: string; href: string }>', optional: true, description: 'Footer links' },
      social: { type: 'React.ReactNode', optional: true, description: 'Social icons' },
    },
    example: `'use client';

import React from 'react';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  copyright?: string;
  links?: FooterLink[];
  social?: React.ReactNode;
}

export function Footer({ copyright, links, social }: FooterProps) {
  return (
    <footer className="border-t py-8 px-6">
      <div className="flex items-center justify-between">
        {copyright && <p className="text-sm text-gray-500">{copyright}</p>}
        {links && (
          <div className="flex gap-4">
            {links.map((link, i) => (
              <a key={i} href={link.href} className="text-sm text-gray-500 hover:text-gray-900">
                {link.label}
              </a>
            ))}
          </div>
        )}
        {social && <div className="flex gap-2">{social}</div>}
      </div>
    </footer>
  );
}

export default Footer;`,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get contract for a specific layout component
 */
export function getLayoutContract(name: LayoutComponent): LayoutPropContract | null {
  return LAYOUT_CONTRACTS.find(c => c.name === name) || null;
}

/**
 * Get all layout component names
 */
export function getLayoutComponentNames(): LayoutComponent[] {
  return LAYOUT_CONTRACTS.map(c => c.name);
}

/**
 * Check if a component name is a layout component
 */
export function isLayoutComponent(name: string): name is LayoutComponent {
  return getLayoutComponentNames().includes(name as LayoutComponent);
}

/**
 * Generate TypeScript interface from contract
 */
export function generatePropsInterface(contract: LayoutPropContract): string {
  const lines = [`interface ${contract.name}Props {`];
  
  for (const [propName, def] of Object.entries(contract.props)) {
    const optional = def.optional ? '?' : '';
    const comment = def.description ? ` // ${def.description}` : '';
    lines.push(`  ${propName}${optional}: ${def.type};${comment}`);
  }
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate full component code from contract
 */
export function generateComponentFromContract(contract: LayoutPropContract): string {
  return contract.example;
}

/**
 * Validate component props against contract
 */
export function validatePropsAgainstContract(
  componentCode: string,
  contract: LayoutPropContract
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for each required prop
  for (const [propName, def] of Object.entries(contract.props)) {
    if (!def.optional) {
      // Check if prop is used in the interface/type
      const propPattern = new RegExp(`${propName}\\s*[?]?\\s*:`);
      if (!propPattern.test(componentCode)) {
        errors.push(`Missing required prop: ${propName}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get prompt snippet for coder about layout contracts
 */
export function getLayoutContractPromptSnippet(): string {
  const snippets = LAYOUT_CONTRACTS.map(c => {
    const props = Object.entries(c.props)
      .map(([name, def]) => `  ${name}${def.optional ? '?' : ''}: ${def.type}`)
      .join('\n');
    return `${c.name}:\n${props}`;
  });
  
  return `
LAYOUT COMPONENT CONTRACTS (DO NOT CHANGE THESE PROPS):

${snippets.join('\n\n')}

When generating any of these layout components, you MUST:
1. Use EXACTLY the props defined above
2. Do NOT add, rename, or remove any props
3. Do NOT change the types of any props
4. Include the 'use client' directive if the component uses React hooks
`;
}

