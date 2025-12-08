// =============================================================================
// Sidebar - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default Sidebar;
