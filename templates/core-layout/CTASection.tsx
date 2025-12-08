// =============================================================================
// CTASection - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

import React from 'react';

interface CTASectionProps {
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function CTASection({ title, description, primaryAction, secondaryAction }: CTASectionProps) {
  return (
    <section className="py-16 bg-gray-50 text-center">
      <h2 className="text-3xl font-bold mb-4">{title}</h2>
      {description && <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">{description}</p>}
      <div className="flex justify-center gap-4">
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

export default CTASection;
