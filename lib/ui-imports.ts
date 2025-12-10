// lib/ui-imports.ts
// Centralized import hub for all UI components
// This ensures consistent imports across the codebase

// UI Components
export { Badge, badgeVariants } from '@/components/ui/badge';
export { Button, buttonVariants } from '@/components/ui/button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from '@/components/ui/table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Re-export types if available
export type { BadgeProps } from '@/components/ui/badge';
export type { ButtonProps } from '@/components/ui/button';
export type { CardProps } from '@/components/ui/card';
export type { InputProps } from '@/components/ui/input';
export type { TableProps } from '@/components/ui/table';
export type { TabsProps } from '@/components/ui/tabs';

