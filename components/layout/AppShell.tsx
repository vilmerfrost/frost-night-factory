import React from 'react';

export interface AppShellProps {
  title?: string;
  children: React.ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="app-shell">
      {title && <h1 className="text-2xl font-bold mb-4">{title}</h1>}
      <div>{children}</div>
    </div>
  );
}
