// =============================================================================
// ToolShowcase - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default ToolShowcase;
