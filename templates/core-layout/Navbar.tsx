// =============================================================================
// Navbar - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default Navbar;
