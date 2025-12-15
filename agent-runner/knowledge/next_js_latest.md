**Next.js 16 (latest as of late 2025) mandates these rules for all new/existing projects:**

### **Breaking Changes - MUST Update Code**
- **Async Request APIs (fully enforced):** Access `cookies()`, `headers()`, `draftMode()`, `params` (in `layout.js`/`page.js`/`route.js`/`default.js`/`generateMetadata`/`generateViewport`), and `searchParams` **only asynchronously**. Synchronous access removed; await all calls.[1][2][3]
  ```ts
  // WRONG (Next.js 15 compat removed)
  export default function Page({ params }) { /* fails */ }
  
  // CORRECT
  export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
  }
  ```
- **Sitemap `id` async:** In `sitemap({ id })`, `id` is `Promise<string>`; always `await id` before use.[3]
- **Parallel routes:** All slots require explicit `default.js` (return `notFound()` or `null`); builds fail otherwise.[2]
- **Server Actions:** Use unguessable IDs (auto-generated, recalculated per build); unused actions auto-eliminated from client bundles.[1]
- **Image local src:** Query strings require `images.localPatterns` config to block enumeration attacks.[2]
- **PPR flags removed:** Delete `experimental.dynamicIO` (→ `cacheComponents`), `experimental.ppr`, `export const experimental_ppr`.[2]

### **New Features - MUST Adopt for Optimal Perf**
- **Turbopack default:** Auto-used for `next dev`/`build` (5-10x faster Fast Refresh, 2-5x builds); opt-out only via `next build --webpack`.[2][5]
- **Cache Components:** Use Partial Pre-Rendering (PPR) model with `use cache`/`cache()` for instant nav; replaces old PPR flags.[2][6]
- **Routing overhaul:**
  - Layout deduplication: Shared layouts prefetch once (e.g., 50 links → 1 layout DL).[2][3]
  - Incremental prefetch: Cache-aware, viewport-prioritized, auto-cancels/re-fetches on invalidation/hover.[2]
- **Caching updates:**
  - `images.minimumCacheTTL` default: 4h (14400s) vs 60s.[2]
  - `revalidateTag(tag, { cacheLife: 'stale-while-revalidate' })` (new sig).[2]
- **Proxy:** Replace Middleware with `proxy.ts` for clear network boundary.[2]

### **Best Practices - MUST Follow**
- **Upgrade CLI:** `npx @next/codemod@canary upgrade` for React 19/Next.js 16; handles async APIs.[1][2]
- **React 19:** Full support (Server Actions secure by default); enable React Compiler for auto-memoization.[1][4]
- **Security:** Rely on auto dead-code elim + secure Action IDs; no manual ID exposure.[1]
- **Config:** ESLint 9 supported; bundle external pkgs via new App/Pages options; Sass v16 modern API.[1][2]
- **DX:** Separate `dev`/`build` output dirs; lockfile prevents concurrent runs; improved logs/metrics (no `size`/`First Load JS`).[2][3]
- **Caching semantics:** `fetch` respects `Cache-Control`; static pages honor `staleTime` post-load.[1]

**Verify post-upgrade:** Run `next build` (Turbopack) + test async APIs/routing; use `unstable_rethrow` for App Router error debugging.[1]