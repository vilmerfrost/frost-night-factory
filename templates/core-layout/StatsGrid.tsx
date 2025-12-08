// =============================================================================
// StatsGrid - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

import React from 'react';

interface Stat {
  label: string;
  value: string | number;
  change?: string;
}

interface StatsGridProps {
  stats: Stat[];
  columns?: number;
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  return (
    <div className={`grid grid-cols-${columns} gap-4`}>
      {stats.map((stat, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className="text-2xl font-bold">{stat.value}</p>
          {stat.change && <p className="text-sm text-green-600">{stat.change}</p>}
        </div>
      ))}
    </div>
  );
}

export default StatsGrid;
