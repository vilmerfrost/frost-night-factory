"use client"

import * as React from "react"
import { cn } from '../../../../lib/utils'

interface AppShellProps {
  title?: string
  children: React.ReactNode
  sidebar?: React.ReactNode
  topbar?: React.ReactNode
  className?: string
}

export function AppShell({ title, children, sidebar, topbar, className }: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {topbar && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {topbar}
        </header>
      )}
      <div className="flex">
        {sidebar && (
          <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-16 border-r">
            {sidebar}
          </aside>
        )}
        <main className={cn(
          "flex-1",
          sidebar && "md:ml-64"
        )}>
          {title && (
            <div className="border-b px-6 py-4">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

