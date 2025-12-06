"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeroSectionProps {
  title: string
  subtitle?: string
  primaryAction?: { label: string; href?: string; onClick?: () => void }
  secondaryAction?: { label: string; href?: string; onClick?: () => void }
  className?: string
}

export function HeroSection({ 
  title, 
  subtitle, 
  primaryAction, 
  secondaryAction,
  className 
}: HeroSectionProps) {
  return (
    <section className={cn("relative py-24 sm:py-32", className)}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {subtitle}
            </p>
          )}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {primaryAction && (
              <Button
                size="lg"
                onClick={primaryAction.onClick}
                asChild={!!primaryAction.href}
              >
                {primaryAction.href ? (
                  <a href={primaryAction.href}>{primaryAction.label}</a>
                ) : (
                  primaryAction.label
                )}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="outline"
                size="lg"
                onClick={secondaryAction.onClick}
                asChild={!!secondaryAction.href}
              >
                {secondaryAction.href ? (
                  <a href={secondaryAction.href}>{secondaryAction.label}</a>
                ) : (
                  secondaryAction.label
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

