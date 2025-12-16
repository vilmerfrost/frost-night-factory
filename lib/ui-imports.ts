// lib/ui-imports.ts
// Centralized import hub for all UI components
// This ensures consistent imports across the codebase

import type React from 'react';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';

// UI Components
export { Badge, badgeVariants } from '@/components/ui/badge';
export { Button, buttonVariants } from '@/components/ui/button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from '@/components/ui/table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Re-export types - use exported types where available, otherwise use React.ComponentProps
export type { BadgeProps } from '@/components/ui/badge';
export type { ButtonProps } from '@/components/ui/button';
export type { InputProps } from '@/components/ui/input';
export type CardProps = React.ComponentProps<typeof Card>;
export type TableProps = React.ComponentProps<typeof Table>;
export type TabsProps = React.ComponentProps<typeof Tabs>;

