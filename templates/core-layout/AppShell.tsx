// =============================================================================
// AppShell - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function AppShell({ children, sidebar, header, className }: AppShellProps) {
  return (
    <div className={`min-h-screen flex ${className || ''}`}>
      {sidebar && <aside className="w-64 border-r">{sidebar}</aside>}
      <div className="flex-1 flex flex-col">
        {header && <header className="h-16 border-b">{header}</header>}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
