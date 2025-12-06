// =============================================================================
// GOLDEN CONTRACT: PageBlueprint Types
// =============================================================================
// This file defines the blueprint architecture for page generation
// DO NOT MODIFY - This is a golden contract file

export type PageTemplate = 'marketing' | 'dashboard' | 'tool';

export type SectionKind =
  | 'hero'
  | 'feature-grid'
  | 'stats'
  | 'table'
  | 'form'
  | 'tool-showcase'
  | 'cta';

export interface SectionConfig {
  kind: SectionKind;
  title?: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  primaryAction?: { label: string; href?: string };
  secondaryAction?: { label: string; href?: string };
  // Extra fields per kind
  stats?: Array<{ title: string; value: string | number; description?: string }>;
  features?: Array<{ title: string; description: string }>;
  // ... other section-specific fields as needed
}

export interface PageBlueprint {
  template: PageTemplate;
  sections: SectionConfig[];
  primaryAction?: { label: string; href?: string };
}

