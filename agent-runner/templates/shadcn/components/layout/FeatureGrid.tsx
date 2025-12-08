"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { cn } from '../../../../lib/utils'

interface Feature {
  title: string
  description: string
  icon?: React.ReactNode
}

interface FeatureGridProps {
  title?: string
  features: Feature[]
  className?: string
}

export function FeatureGrid({ title, features, className }: FeatureGridProps) {
  return (
    <section className={cn("py-12", className)}>
      {title && (
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Card key={index}>
            <CardHeader>
              {feature.icon && <div className="mb-2">{feature.icon}</div>}
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

