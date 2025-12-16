import React from 'react';
import Link from 'next/link';

export interface CTASectionProps {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

export function CTASection({ title, subtitle, primaryAction, secondaryAction }: CTASectionProps) {
  return (
    <section className="cta-section text-center py-12 border rounded-lg">
      <h2 className="text-3xl font-bold mb-2">{title}</h2>
      {subtitle && <p className="text-muted-foreground mb-6">{subtitle}</p>}
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
