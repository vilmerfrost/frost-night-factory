# Next.js v15/v16 Technical Implementation Requirements

## Async Request APIs (Critical Breaking Change)

As of Next.js 16, all request-related APIs are **fully asynchronous** with no synchronous fallback.[3] The following APIs must be accessed asynchronously:

- `cookies()`
- `headers()`
- `draftMode()`
- `params` in `layout.js`, `page.js`, `route.js`, `default.js`
- `searchParams` in page components
- `generateMetadata()` and `generateViewport()` parameters

**Implementation Pattern:**

```javascript
// ✅ CORRECT - Next.js 16
export default async function Page({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  // ...
}

// ❌ INCORRECT - Will fail in Next.js 16
export default function Page({ params }) {
  const id = params.id; // Runtime error
}
```

For dynamic sitemaps, the `id` parameter from `generateSitemaps()` is now a Promise:[3]

```javascript
// ✅ CORRECT - Next.js 16
export default async function sitemap({ id }) {
  const resolvedId = await id; // Must await
  const start = resolvedId * 50000;
  // ...
}
```

## Caching Semantics & Server Actions Security

**Caching Changes:**[1]
- `fetch()` request caching behavior modified with explicit `Cache-Control` header requirements
- `revalidateTag()` signature now requires a `cacheLife` profile as the second argument for stale-while-revalidate behavior[2]
- `images.minimumCacheTTL` default changed from 60s to 4 hours (14400s)[2]

**Server Actions Security Enhancements:**[1]
- Server Action IDs are now **unguessable and non-deterministic**
- IDs are periodically recalculated between builds
- Dead code elimination removes unused Server Actions from client bundles
- The `@next/codemod` CLI assists with upgrades

## Routing Architecture Overhaul

**Parallel Routes `default.js` Requirement:**[2]
All parallel route slots now **require explicit `default.js` files**. Builds fail without them:

```javascript
// ✅ REQUIRED in Next.js 16
export default function Default() {
  return notFound(); // or return null for previous behavior
}
```

**Layout Deduplication & Incremental Prefetching:**[2]
- Shared layouts are downloaded once across multiple prefetches instead of separately per URL
- Prefetching only fetches cache misses, not entire pages
- Requests cancel when links leave viewport
- Re-prefetching occurs when link data invalidates

## Bundler & Build Configuration

**Turbopack is Now Default:**[2]
- Turbopack is the default bundler for all apps (5-10x faster Fast Refresh, 2-5x faster builds)
- Opt out with `next build --webpack` if needed
- Babel configuration automatically enables if `babel.config.js` exists (previously hard error)

**Concurrent Execution:**[2]
- `next dev` and `next build` now use separate output directories
- Added lockfile mechanism preventing multiple concurrent instances on same project

**Development & Build Performance:**[1]
- Improved Fast Refresh speeds
- Enhanced build times with Turbopack file system caching (beta)
- `NODE_ENV=development` can be used with `next build` for debugging

## Metadata & Image Route Changes

**Dynamic Image Metadata:**[2]
- `metadata` image route `params` argument changed to async
- `id` from `generateImageMetadata()` now returns `Promise<string>`

**Local Image Patterns:**[2]
- `next/image` local `src` with query strings now requires `images.localPatterns` config to prevent enumeration attacks

## Feature Deprecations & Removals

**Next.js 16 Removals:**[2]
- `experimental.dynamicIO` flag → renamed to `cacheComponents`
- `experimental.ppr` flag and `export const experimental_ppr` removed (evolving into Cache Components model)
- Automatic `scroll-behavior: smooth` removed; use `data-scroll-behavior="smooth"` on HTML document to opt-in
- Speed Insights auto-instrumentation removed; use dedicated `@vercel/speed-insights` package
- `.xml` extension for dynamic sitemap routes removed; align URLs between dev/prod

**Build Output Changes:**[3]
- Removed `size` and `First Load JS` metrics from `next build` output (deemed inaccurate for React Server Components architecture)

## React 19 Compatibility

Next.js 15+ provides React 19 support with stable **React Compiler** integration for automatic memoization.[2] Use `@next/codemod` CLI for seamless version upgrades.

## Developer Experience Improvements

**New Debugging & Logging:**[2]
- Next.js Devtools with Model Context Protocol (MCP) integration
- Redesigned terminal output with clearer formatting and improved performance metrics
- Better error messages for build and development failures

**Middleware Replacement:**[2]
- `proxy.ts` clarifies network boundaries (replacing middleware pattern)

---

**Summary:** The transition from v15 to v16 requires comprehensive async/await adoption across all request APIs, explicit parallel route configurations, and adaptation to the new caching model with `cacheLife` profiles. Turbopack becomes mandatory unless explicitly opted out, and all architectural decisions must account for React Server Components as the default rendering paradigm.