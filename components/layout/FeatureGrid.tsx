import React from 'react';

export interface Feature {
  title: string;
  description: string;
}

export interface FeatureGridProps {
  title?: string;
  features: Feature[];
}

export function FeatureGrid({ title, features }: FeatureGridProps) {
  return (
    <div className="feature-grid">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="grid md:grid-cols-3 gap-4">
        {features.map((feature, i) => (
          <div key={i} className="border rounded p-4">
            <h3 className="font-semibold mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
