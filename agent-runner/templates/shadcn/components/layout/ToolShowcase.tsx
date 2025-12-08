"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { Button } from "../../../../../components/ui/button"
import { cn } from '../../../../lib/utils'

interface ToolShowcaseProps {
  title: string
  subtitle?: string
  description?: string
  primaryAction?: { label: string; href?: string; onClick?: () => void }
  className?: string
  children?: React.ReactNode
}

export function ToolShowcase({ 
  title, 
  subtitle, 
  description,
  primaryAction,
  className,
  children 
}: ToolShowcaseProps) {
  return (
    <section className={cn("py-12", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {subtitle && <CardDescription className="text-base">{subtitle}</CardDescription>}
          {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
        </CardHeader>
        <CardContent>
          {children}
          {primaryAction && (
            <div className="mt-6">
              <Button
                onClick={primaryAction.onClick}
                asChild={!!primaryAction.href}
              >
                {primaryAction.href ? (
                  <a href={primaryAction.href}>{primaryAction.label}</a>
                ) : (
                  primaryAction.label
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

