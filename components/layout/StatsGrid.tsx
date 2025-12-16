import React from 'react';

export interface Stat {
  title: string;
  value: string;
  description?: string;
}

export interface StatsGridProps {
  title?: string;
  stats: Stat[];
}

export function StatsGrid({ title, stats }: StatsGridProps) {
  return (
    <div className="stats-grid">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="border rounded p-4">
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm font-medium">{stat.title}</div>
            {stat.description && <div className="text-xs text-muted-foreground">{stat.description}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
