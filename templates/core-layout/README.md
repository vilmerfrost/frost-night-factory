# 🧱 Core Layout Templates - FROZEN

> ⚠️ **DO NOT EDIT THESE FILES MANUALLY**
> 
> These templates are **frozen** and version-controlled.
> They serve as the canonical source for all layout components.

## Purpose

These layout templates are:
1. **Frozen**: Once defined, they don't change during pipeline runs
2. **Contract-driven**: Props are defined in `lib/nightFactory/layout-contract.ts`
3. **Trusted**: Not re-validated on every run (only validated during template development)
4. **Shared**: Copied into each pipeline's temp project folder

## Layout Components

| Component | Description | File |
|-----------|-------------|------|
| AppShell | Main application shell | `AppShell.tsx` |
| DashboardShell | Dashboard layout | `DashboardShell.tsx` |
| FormPage | Form page layout | `FormPage.tsx` |
| DataTablePage | Data table layout | `DataTablePage.tsx` |
| HeroSection | Hero section for landing pages | `HeroSection.tsx` |
| StatsGrid | Statistics grid | `StatsGrid.tsx` |
| FeatureGrid | Feature cards grid | `FeatureGrid.tsx` |
| ToolShowcase | Tool showcase section | `ToolShowcase.tsx` |
| CTASection | Call to action section | `CTASection.tsx` |
| PageRenderer | Dynamic page renderer | `PageRenderer.tsx` |
| Sidebar | Navigation sidebar | `Sidebar.tsx` |
| Navbar | Top navigation bar | `Navbar.tsx` |
| Footer | Page footer | `Footer.tsx` |

## Usage in Pipeline

When a pipeline runs:
1. Temp project folder is created
2. These templates are copied as-is (not regenerated)
3. Only feature-specific components are AI-generated
4. Layout components are "library code" that AI uses but doesn't modify

## Modifying Templates

To modify a template:
1. Edit the contract in `lib/nightFactory/layout-contract.ts`
2. Run `npm run generate-layout-templates` to regenerate all templates
3. Test with `npm run v85:test`
4. Commit both contract and templates together

## Contract Validation

Templates are validated against their contracts:
- At build time
- In CI/CD
- NOT during every pipeline run (for performance)

To validate manually:
```bash
npm run validate-layout-contracts
```

