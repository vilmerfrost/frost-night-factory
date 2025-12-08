// =============================================================================
// DataTablePage - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default DataTablePage;
