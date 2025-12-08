// =============================================================================
// PageRenderer - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default PageRenderer;
