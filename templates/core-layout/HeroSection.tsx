// =============================================================================
// HeroSection - FROZEN LAYOUT TEMPLATE
// =============================================================================
// Generated from layout-contract.ts
// DO NOT EDIT MANUALLY - Regenerate with: npm run generate-layout-templates

'use client';

import React from 'react';

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  cta?: React.ReactNode;
  image?: string;
}

export function HeroSection({ title, subtitle, cta, image }: HeroSectionProps) {
  return (
    <section className="py-20 text-center">
      <h1 className="text-5xl font-bold mb-4">{title}</h1>
      {subtitle && <p className="text-xl text-gray-600 mb-8">{subtitle}</p>}
      {cta && <div className="flex justify-center gap-4">{cta}</div>}
      {image && <img src={image} alt="" className="mt-12 mx-auto max-w-4xl" />}
    </section>
  );
}

export default HeroSection;
