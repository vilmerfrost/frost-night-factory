import React from 'react';
import Link from 'next/link';

export interface HeroSectionProps {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

export function HeroSection({ title, subtitle, primaryAction, secondaryAction }: HeroSectionProps) {
  return (
    <section className="hero-section text-center py-12">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {subtitle && <p className="text-xl text-muted-foreground mb-6">{subtitle}</p>}
      <div className="flex gap-4 justify-center">
        {primaryAction && (
          <Link href={primaryAction.href} className="px-6 py-2 bg-primary text-primary-foreground rounded">
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction && (
          <Link href={secondaryAction.href} className="px-6 py-2 border rounded">
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </section>
  );
}
