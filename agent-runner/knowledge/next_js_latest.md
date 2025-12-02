# Next.js v15/v16 Technical Implementation Rules

## Async Request APIs (Critical Breaking Change)

Starting with **Next.js 16**, all request-related APIs must be accessed asynchronously.[3] This is a mandatory breaking change that removes synchronous compatibility introduced in v15.

The following APIs now require `async` access exclusively:[3]

- `cookies()`
- `headers()`
- `draftMode()`
- `params` in `layout.js`, `page.js`, `route.js`, `default.js`
- `searchParams` in `page.js`
- `generateMetadata()` parameters
- `generateViewport()` parameters

**Implementation requirement:** All component signatures accessing these APIs must be declared as `async`, and callers must use `await`.[3]

```typescript
// ❌ INVALID in Next.js 16
export default function Layout({ params }) {
  const id = params.id;
  return <div>{id}</div>;
}

// ✅ VALID in Next.js 16
export default async function Layout({ params }) {
  const id = (await params).id;
  return <div>{id}</div>;
}
```

## Caching Semantics Overhaul

**Default fetch caching behavior has changed significantly.[1]** The new caching model affects how `fetch` requests are handled. Carefully audit all fetch patterns in your application, as implicit caching assumptions from v14 no longer apply.[1]

## Turbopack Migration (Default Bundler)

**Turbopack is now the mandatory default bundler in Next.js 16.[2]** This represents a fundamental shift from webpack:

- **Performance gains:** 2–5× faster production builds and up to 10× faster Fast Refresh[2]
- **Opt-out mechanism:** Use `next build --webpack` to revert temporarily, but plan full migration[2]
- **Babel configuration:** Turbopack now automatically enables Babel if a configuration file exists (previously failed hard)[2]

## Parallel Routes `default.js` Requirement

All parallel route slots now **require explicit `default.js` files.[2]** Builds will fail without them:

```typescript
// app/dashboard/@sidebar/default.js
export default function SidebarDefault() {
  return null; // or notFound()
}
```

This change ensures predictable behavior when slots have no matching route segment.

## Enhanced Routing & Prefetching Strategy

Next.js 16 implements intelligent prefetching with two critical optimizations:[2][4]

**Layout deduplication:** When prefetching multiple URLs sharing a layout, the layout downloads once instead of per-URL. This dramatically reduces network overhead for pages with many links.[2]

**Incremental prefetching:** Only cache-missing page segments are prefetched, not entire pages. The system cancels requests when links leave the viewport and reprioritizes on hover or re-entry.[2][4]

## Caching APIs & `revalidateTag()` Signature Change

The `revalidateTag()` function signature has changed fundamentally in Next.js 16:[2]

```typescript
// ❌ INVALID in Next.js 16
revalidateTag('products');

// ✅ VALID in Next.js 16
revalidateTag('products', { cacheLife: 'minutes' }); // requires cacheLife profile
```

The second parameter now **requires** a `cacheLife` profile argument for stale-while-revalidate behavior specification.[2]

## Cache Components & Partial Pre-Rendering (PPR)

Next.js 16 introduces **Cache Components** using `use cache` directive for fine-grained, explicit caching within Server Components.[2][6]

```typescript
import { cache } from 'react';

export default function Page() {
  'use cache'; // Enable caching for this component tree
  
  return <ExpensiveComponent />;
}
```

This completes the PPR model, enabling instant navigation for cached regions.[6]

## Dead Code Elimination & Server Action Security

Unused Server Actions no longer expose their IDs to the client-side JavaScript bundle.[1] Next.js generates **unguessable, non-deterministic IDs** for Server Actions that are recalculated between builds for enhanced security.[1]

## Breaking Changes Checklist

- [ ] Convert all `cookies()`, `headers()`, `params`, and `searchParams` access to async patterns
- [ ] Audit all `fetch()` caching assumptions against new semantics
- [ ] Add `default.js` to all parallel route slots
- [ ] Update `revalidateTag()` calls with required `cacheLife` parameter
- [ ] Plan Turbopack migration or document webpack retention requirement
- [ ] Update `generateSitemaps()` to pass `id` as Promise-resolved parameter
- [ ] Test incremental prefetching behavior with `Link` components
- [ ] Verify `@next/codemod` compatibility for automated migration assistance

## Output Directory Separation

**Critical for concurrent development:** `next dev` and `next build` now use separate output directories with lockfile mechanisms to prevent concurrent execution conflicts on the same project.[2]

## Modern Sass API (v16+)

Sass loader bumped to v16, requiring modern Sass syntax and supporting new language features.[2] Legacy Sass patterns may need updates.