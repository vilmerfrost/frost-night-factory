// =============================================================================
// Footer - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default Footer;
