"use client"

import * as React from "react"
import { AppShell } from '../../../../components/layout/AppShell'
import { DashboardShell } from '../../../../components/layout/DashboardShell'
import { FormPage } from '../../../../components/layout/FormPage'
import { DataTablePage } from '../../../../components/layout/DataTablePage'
import { HeroSection } from '../../../../components/layout/HeroSection'
import { StatsGrid } from '../../../../components/layout/StatsGrid'
import { FeatureGrid } from '../../../../components/layout/FeatureGrid'
import { ToolShowcase } from '../../../../components/layout/ToolShowcase'
import { CTASection } from '../../../../components/layout/CTASection'
import type { PageBlueprint, SectionConfig } from '../../../../lib/blueprints'

function renderSection(section: SectionConfig, index: number) {
  switch (section.kind) {
    case 'hero':
      return (
        <HeroSection
          key={index}
          title={section.title ?? ''}
          subtitle={section.subtitle}
          primaryAction={section.primaryAction}
          secondaryAction={section.secondaryAction}
        />
      );
    
    case 'feature-grid':
      return (
        <FeatureGrid
          key={index}
          title={section.title}
          features={section.features ?? []}
        />
      );
    
    case 'stats':
      return (
        <StatsGrid
          key={index}
          title={section.title}
          stats={section.stats ?? []}
        />
      );
    
    case 'tool-showcase':
      return (
        <ToolShowcase
          key={index}
          title={section.title ?? ''}
          subtitle={section.subtitle}
          description={section.description}
          primaryAction={section.primaryAction}
        />
      );
    
    case 'cta':
      return (
        <CTASection
          key={index}
          title={section.title ?? ''}
          subtitle={section.subtitle}
          primaryAction={section.primaryAction ?? { label: 'Get Started' }}
          secondaryAction={section.secondaryAction}
        />
      );
    
    // table/form handled separately in pages
    default:
      return null;
  }
}

export function PageRenderer({ blueprint }: { blueprint: PageBlueprint }) {
  const content = (
    <>
      {blueprint.sections.map((s, i) => renderSection(s, i))}
    </>
  );

  switch (blueprint.template) {
    case 'dashboard':
      return (
        <AppShell title={blueprint.sections[0]?.title ?? 'Dashboard'}>
          <DashboardShell>{content}</DashboardShell>
        </AppShell>
      );
    
    case 'tool':
      return (
        <AppShell title={blueprint.sections[0]?.title ?? 'Tool'}>
          {content}
        </AppShell>
      );
    
    case 'marketing':
    default:
      return (
        <AppShell title={blueprint.sections[0]?.title ?? 'Welcome'}>
          {content}
        </AppShell>
      );
  }
}

