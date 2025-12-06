"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Stat {
  title: string
  value: string | number
  description?: string
  trend?: { value: number; isPositive: boolean }
}

interface StatsGridProps {
  title?: string
  stats: Stat[]
  className?: string
}

export function StatsGrid({ title, stats, className }: StatsGridProps) {
  return (
    <section className={cn("py-12", className)}>
      {title && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              )}
              {stat.trend && (
                <p className={cn(
                  "text-xs mt-1",
                  stat.trend.isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {stat.trend.isPositive ? "+" : ""}{stat.trend.value}% from last period
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

