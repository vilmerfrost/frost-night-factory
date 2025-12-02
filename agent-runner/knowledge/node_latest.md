# Next.js 15/16 Technical Reference: Critical Breaking Changes & Best Practices

## Async Request APIs (Breaking Change - Next.js 16)[1][3]

Next.js 16 completely removes synchronous access to request-scoped APIs. All the following must now be accessed asynchronously:

- `cookies()`
- `headers()`
- `draftMode()`
- `params` in `layout.js`, `page.js`, `route.js`, `default.js`
- `searchParams` in `page.js`
- `generateMetadata` and `generateViewport` parameters

**Implementation requirement:** Always use `await` when accessing these APIs. Next.js 15 provided temporary synchronous compatibility, but this is completely removed in v16.

```javascript
// INCORRECT - v16 will break
export default function Page({ params }) {
  const id = params.id; // ❌ Synchronous access removed
}

// CORRECT - v16 required
export default async function Page({ params }) {
  const id = (await params).id; // ✅ Async access
}
```

## Sitemap Generation: Async `id` Parameter[3]

The `id` parameter from `generateSitemaps()` is now a Promise that must be resolved:

```javascript
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
}

// v16 requirement
export default async function sitemap({ id }) {
  const resolvedId = await id; // ✅ Must await
  const start = resolvedId * 50000;
}
```

## Caching Semantics & Fetch Behavior[1]

Next.js 15+ introduces breaking changes to caching behavior:

- `fetch()` requests now respect `Cache-Control` headers by default
- Caching semantics differ from previous versions; audit all data fetching patterns
- `revalidateTag()` signature changed in v16: now requires a `cacheLife` profile as the second argument for stale-while-revalidate behavior[2]

## Default Bundler: Turbopack (v16)[2]

**Turbopack is now stable and the default bundler for all apps.** Key technical implications:

- 5-10x faster Fast Refresh
- 2-5x faster builds
- Automatic Babel integration if a babel config exists
- Opt-out requirement: `next build --webpack` to revert to Webpack

**Note:** Turbopack File System Caching (beta) provides additional performance gains for large apps.

## Server Actions Security Enhancements[1]

Server Actions now use **unguessable, non-deterministic IDs**:

- Unused Server Actions have dead code elimination applied (IDs not exposed to client-side bundle)
- Action IDs are periodically recalculated between builds for enhanced security
- Endpoints are no longer predictable

## Parallel Routes: Explicit `default.js` Requirement[2]

**Breaking change in v16:** All parallel route slots now require explicit `default.js` files. Builds fail without them.

```javascript
// Required pattern for parallel routes
// app/@slot/default.js
export default function Default() {
  return null; // or notFound()
}
```

## Routing & Navigation Optimizations (v16)[2]

**Layout deduplication:** Shared layouts are downloaded once instead of separately for each prefetch. This dramatically reduces network transfer (e.g., 50 product links now download shared layout once instead of 50 times).

**Incremental prefetching:** Only prefetch parts not already in cache:
- Cancels requests when links leave viewport
- Prioritizes prefetching on hover
- Re-prefetches on data invalidation

## Image Handling: `images.minimumCacheTTL` Default Change[2]

Default changed from **60 seconds to 4 hours (14400s)** in v16. Images without explicit cache-control headers now persist longer, reducing revalidation costs.

**Security note:** Local `src` with query strings in `next/image` now requires `images.localPatterns` config to prevent enumeration attacks.[2]

## React 19 Support[1]

Next.js 15+ includes React 19 support. Use `@next/codemod` CLI for automated upgrade paths where available.

## Metadata Image Route Parameters[2]

In v16, the `params` argument in metadata image routes is now asynchronous. The `id` from `generateImageMetadata` is now `Promise<string>`:

```javascript
// v16 requirement
export async function generateImageMetadata({ params }) {
  const id = await params.id; // ✅ Must await
}
```

## ESLint 9 Support[1]

Next.js 15 added support for ESLint 9. Update ESLint configuration if upgrading.

## Build & Development Performance[1][3]

- Improved build times and faster Fast Refresh
- Separate output directories for `next dev` and `next build` (enables concurrent execution)
- Lockfile mechanism prevents multiple instances on the same project
- Redesigned terminal output with clearer formatting and improved performance metrics

## Removed Features (v16)[2]

- Auto-instrumentation for Speed Insights (use `@vercel/speed-insights` package explicitly)
- `.xml` extension for dynamic sitemap routes
- `size` and `First Load JS` metrics from `next build` output (inaccurate in server-driven RSC architectures)

**Upgrade urgency:** Next.js 16 contains critical breaking changes. The async request API migration is mandatory and affects nearly all server-side code patterns.