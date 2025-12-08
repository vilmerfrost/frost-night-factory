// =============================================================================
// FeatureGrid - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

import React from 'react';

interface Feature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: number;
}

export function FeatureGrid({ features, columns = 3 }: FeatureGridProps) {
  return (
    <div className={`grid grid-cols-${columns} gap-6`}>
      {features.map((feature, i) => (
        <div key={i} className="p-6 border rounded-lg">
          {feature.icon && <div className="mb-4">{feature.icon}</div>}
          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
          <p className="text-gray-600">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

export default FeatureGrid;
