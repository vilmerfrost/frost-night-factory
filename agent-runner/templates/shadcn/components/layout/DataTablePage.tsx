"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { cn } from '../../../../lib/utils'

interface DataTablePageProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function DataTablePage({ title, description, children, className }: DataTablePageProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

