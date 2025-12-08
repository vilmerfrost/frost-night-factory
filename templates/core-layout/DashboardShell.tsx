// =============================================================================
// DashboardShell - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

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

export default DashboardShell;
