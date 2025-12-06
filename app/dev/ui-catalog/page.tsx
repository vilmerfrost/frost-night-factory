"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { HeroSection } from '@/components/layout/HeroSection'
import { StatsGrid } from '@/components/layout/StatsGrid'
import { FeatureGrid } from '@/components/layout/FeatureGrid'
import { CTASection } from '@/components/layout/CTASection'
import { ToolShowcase } from '@/components/layout/ToolShowcase'

export default function UICatalogPage() {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)

  const components = [
    {
      id: 'button',
      name: 'Button',
      category: 'UI Components',
      description: 'Primary action buttons with multiple variants',
      component: (
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      ),
      code: `import { Button } from '@/components/ui/button'

<Button variant="default">Click me</Button>
<Button variant="primary">Primary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>`,
    },
    {
      id: 'card',
      name: 'Card',
      category: 'UI Components',
      description: 'Container component for content sections',
      component: (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description goes here</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card content area. Use this for displaying grouped information.</p>
          </CardContent>
        </Card>
      ),
      code: `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>`,
    },
    {
      id: 'badge',
      name: 'Badge',
      category: 'UI Components',
      description: 'Small status indicators and labels',
      component: (
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      ),
      code: `import { Badge } from '@/components/ui/badge'

<Badge>Status</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>`,
    },
    {
      id: 'input',
      name: 'Input',
      category: 'UI Components',
      description: 'Text input fields',
      component: (
        <div className="space-y-4 w-full max-w-md">
          <Input placeholder="Enter text..." />
          <Input type="email" placeholder="Email address" />
          <Input type="password" placeholder="Password" />
          <Input disabled placeholder="Disabled input" />
        </div>
      ),
      code: `import { Input } from '@/components/ui/input'

<Input placeholder="Enter text..." />
<Input type="email" placeholder="Email" />
<Input disabled placeholder="Disabled" />`,
    },
    {
      id: 'table',
      name: 'Table',
      category: 'UI Components',
      description: 'Data tables with proper styling',
      component: (
        <Table className="w-full max-w-2xl">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John Doe</TableCell>
              <TableCell><Badge>Active</Badge></TableCell>
              <TableCell>2024-01-15</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Jane Smith</TableCell>
              <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
              <TableCell>2024-01-16</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ),
      code: `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>`,
    },
    {
      id: 'hero-section',
      name: 'Hero Section',
      category: 'Layout Components',
      description: 'Hero section for landing pages',
      component: (
        <HeroSection
          title="Welcome to Our Platform"
          subtitle="Build amazing things with our tools"
          primaryAction={{ label: 'Get Started', href: '/signup' }}
          secondaryAction={{ label: 'Learn More', href: '/about' }}
        />
      ),
      code: `import { HeroSection } from '@/components/layout/HeroSection'

<HeroSection
  title="Welcome"
  subtitle="Your subtitle here"
  primaryAction={{ label: 'Get Started', href: '/signup' }}
  secondaryAction={{ label: 'Learn More', href: '/about' }}
/>`,
    },
    {
      id: 'stats-grid',
      name: 'Stats Grid',
      category: 'Layout Components',
      description: 'Statistics display grid',
      component: (
        <StatsGrid
          title="Overview"
          stats={[
            { title: 'Total Users', value: '1,234', description: 'Active users' },
            { title: 'Revenue', value: '$12,345', description: 'This month' },
            { title: 'Growth', value: '+12%', description: 'vs last month' },
            { title: 'Active', value: '567', description: 'Right now' },
          ]}
        />
      ),
      code: `import { StatsGrid } from '@/components/layout/StatsGrid'

<StatsGrid
  title="Overview"
  stats={[
    { title: 'Total', value: '1,234', description: 'Description' },
    { title: 'Revenue', value: '$12k', description: 'This month' },
  ]}
/>`,
    },
    {
      id: 'feature-grid',
      name: 'Feature Grid',
      category: 'Layout Components',
      description: 'Feature showcase grid',
      component: (
        <FeatureGrid
          title="Features"
          features={[
            { title: 'Fast', description: 'Lightning fast performance' },
            { title: 'Secure', description: 'Enterprise-grade security' },
            { title: 'Scalable', description: 'Grows with your needs' },
          ]}
        />
      ),
      code: `import { FeatureGrid } from '@/components/layout/FeatureGrid'

<FeatureGrid
  title="Features"
  features={[
    { title: 'Feature 1', description: 'Description 1' },
    { title: 'Feature 2', description: 'Description 2' },
  ]}
/>`,
    },
    {
      id: 'cta-section',
      name: 'CTA Section',
      category: 'Layout Components',
      description: 'Call-to-action section',
      component: (
        <CTASection
          title="Ready to get started?"
          subtitle="Join thousands of happy customers"
          primaryAction={{ label: 'Sign Up Now', href: '/signup' }}
        />
      ),
      code: `import { CTASection } from '@/components/layout/CTASection'

<CTASection
  title="Ready to get started?"
  subtitle="Join thousands of customers"
  primaryAction={{ label: 'Sign Up', href: '/signup' }}
/>`,
    },
    {
      id: 'app-shell',
      name: 'App Shell',
      category: 'Layout Components',
      description: 'Main application shell with navigation',
      component: (
        <div className="border rounded-lg p-4 bg-background">
          <AppShell title="Dashboard">
            <div className="p-4">
              <p className="text-muted-foreground">App content goes here</p>
            </div>
          </AppShell>
        </div>
      ),
      code: `import { AppShell } from '@/components/layout/AppShell'

<AppShell title="Dashboard">
  <div>Your content here</div>
</AppShell>`,
    },
    {
      id: 'dashboard-shell',
      name: 'Dashboard Shell',
      category: 'Layout Components',
      description: 'Dashboard-specific layout shell',
      component: (
        <div className="border rounded-lg p-4 bg-background">
          <DashboardShell>
            <div className="p-4">
              <p className="text-muted-foreground">Dashboard content goes here</p>
            </div>
          </DashboardShell>
        </div>
      ),
      code: `import { DashboardShell } from '@/components/layout/DashboardShell'

<DashboardShell>
  <div>Dashboard content here</div>
</DashboardShell>`,
    },
  ]

  const selected = components.find(c => c.id === selectedComponent)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">UI Component Catalog</h1>
          <p className="text-muted-foreground text-lg">
            Visual verification of golden components. All components are production-ready and follow the design system.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {components.map((comp) => (
            <Card
              key={comp.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedComponent(comp.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{comp.name}</CardTitle>
                  <Badge variant="outline">{comp.category}</Badge>
                </div>
                <CardDescription>{comp.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded p-4 bg-muted/50 min-h-[100px] flex items-center justify-center">
                  {comp.component}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
              <CardDescription>{selected.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Preview</h3>
                <div className="border rounded-lg p-6 bg-muted/30">
                  {selected.component}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Usage</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{selected.code}</code>
                </pre>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Guidelines</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Always import from the correct path (@/components/ui/... or @/components/layout/...)</li>
                  <li>Use semantic HTML and proper accessibility attributes</li>
                  <li>Follow the design system spacing and typography</li>
                  <li>Test components in both light and dark modes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

