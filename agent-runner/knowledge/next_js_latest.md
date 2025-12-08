Next.js 15 and 16 introduce a stricter, more explicit model around **async rendering, caching, and Turbopack**. Below are implementation rules you should follow when writing or reviewing code in a modern Next.js codebase (2024–2025).

---

## Core upgrade constraints (v15 → v16)

- **Use React 19+ and App Router only.** No new Pages Router features; treat `/app` as mandatory for new work.[3]
- **Assume async by default for request APIs and route params.** Many framework-provided arguments are now async (v15) and extended further in v16 (“everything is async now”).[3][5]
- **Target Turbopack, not webpack.** Turbopack is the **default bundler** in v16 for dev and prod; only opt out with `next build --webpack` when you have proven incompatibilities.[1][2]
- **Adopt the new explicit caching model.** v15 introduces breaking changes in fetch/caching semantics; v16 completes this with **Cache Components** and an explicit `"use cache"` model.[1][2][3]

---

## Async Request APIs & “everything is async”

1. **Assume all server entrypoints can be `async`:**  
   - Route handlers (`app/**/route.ts`)  
   - Server Components and layouts where you do data fetching  
   - Metadata and image routes

2. **Handle async `params` in v16:**
   - Metadata routes' `params` argument is now **async**, and values like `id` from `generateImageMetadata` are `Promise<string>`.[1]  
   - Rule: Always `await` `params` if you destructure, and type them as `Promise<Params>` in TS when necessary.

3. **Async Request APIs in v15 (breaking):**
   - v15 introduces **Async Request APIs** as a breaking change in the rendering/caching model.[3][6]  
   - Rule: Do not rely on older sync assumptions around `request`, `params`, and streaming; audit all custom helpers that previously assumed sync access to these.

4. **Do not block the event loop with expensive sync work in any server entry.** With everything async, large CPU work should go to background jobs or workers; keep route handlers I/O‑bound.

---

## Caching, PPR, and Cache Components

### v15: New caching semantics (breaking)

- `fetch` semantics changed; caching and revalidation are part of a new “simplified rendering and caching model.”[3]  
- Rule: Treat all `fetch` calls in server components/handlers as **explicitly configured**:
  - Always specify `cache`, `next: { revalidate }`, or tags; do not depend on old implicit defaults.
  - Audit all legacy `fetch` usages when upgrading to v15.

### v16: Cache Components (PPR completion)

- v16 **formalizes caching with Cache Components** and a `"use cache"` directive (PPR evolved into this model).[1][2]
- Key rules:

  - **Dynamic by default, static when opted-in:**
    - In v15, dynamic behavior could “infect” the whole route.  
    - In v16, the model is **explicit**:
      - Components/functions are dynamic unless you mark cacheable via `"use cache"`.[2]
      - Route-level `experimental.ppr`/`experimental_ppr` flags are removed; use Cache Components instead.[1][2]

  - **Use `"use cache"` at the component/function level** to:
    - Opt into static caching
    - Let the compiler automatically derive cache keys and PPR behavior[2]
    - Avoid ad-hoc manual cache key schemes

  - **Use tag-based revalidation with the new signature:**
    - `revalidateTag()` now requires a **`cacheLife` profile** as the second argument for stale‑while‑revalidate behavior, e.g. `revalidateTag('products', 'swr')`.[1]
    - Use `updateTag(tag)` within Actions for “read-your-writes” semantics instead of misusing revalidateTag.[1]

  - **Cache invalidation rules:**
    - On mutations, always:
      - Call `updateTag` from your Server Action (React Actions) to keep local reads consistent  
      - Or call `revalidateTag(tag, profile)` when you want SWR semantics visible to all users[1][2]

---

## Routing, navigation, and prefetching

- **Enhanced routing in v16:** Layout-deduped prefetching and incremental prefetching.[1][2]
- Rules for Links and layouts:

  - **Assume prefetch cache is smarter but stricter:**
    - Prefetch downloads **shared layouts once**; don’t code around repeated layout loads.[1][2]
    - Incremental prefetching:
      - Only fetches parts not in cache
      - Cancels requests when links leave the viewport
      - Re-prefetches when data is invalidated[1][2]

  - **Do not rely on prefetch side effects.**
    - Prefetch cache can cancel or reprioritize requests; all logic must tolerate prefetch not completing.

  - **Parallel routes must have explicit `default.tsx`/`default.js`:**
    - In v16, all parallel slots must have a `default` file; builds fail if missing.[1]
    - If you previously relied on implicit behavior, create `default` that calls `notFound()` or returns `null` for the old UX.[1]

---

## Turbopack and build system rules

- **Turbopack is the default bundler in v16:** 2–5× faster builds, up to 10× faster Fast Refresh.[1][2]
- Rules:

  - **Run Turbopack unless you have a known plugin that only works on webpack.**
    - If so, use `next build --webpack` explicitly and document the reason, with an issue to remove it.[1]

  - **Babel configuration under Turbopack:**
    - Turbopack now **auto-enables Babel if it finds a Babel config**, instead of erroring out.[1]
    - Rule: Keep any Babel config minimal and intentional; if present, it will be honored and can affect perf.

  - **Dev/build directories and lockfile behavior:**
    - `next dev` and `next build` now use **separate output directories**, allowing concurrent runs.[1]
    - There is a **lockfile** to prevent multiple dev/build instances on the same project.[1]  
    - Rule: Do not hack around the lockfile; instead, use separate working copies or dedicated commands.

  - **React Compiler support (stable in Turbopack):**
    - v16 has **built-in React Compiler integration** (automatic memoization).[1][2]
    - Avoid manual `useMemo`/`useCallback` micro-optimizations that fight the compiler; follow React Compiler’s constraints (no side effects in render, pure components).

---

## Image, metadata, and security changes

- **`next/legacy/image` is deprecated:** Use the modern `next/image` only.[1][2]
- **Security-related config changes:**
  - `images.domains` is deprecated; use **`images.remotePatterns`** for remote domains.[1]
  - Local `next/image` sources with query strings now require **`images.localPatterns`** to prevent enumeration attacks.[1]
  - Rule: Never “open up” remotePatterns or localPatterns too broadly; constrain patterns precisely to expected hosts and paths.

- **Image caching defaults:**
  - `images.minimumCacheTTL` default changed from 60 seconds to **4 hours**, reducing revalidation cost for images without cache-control headers.[1]  
  - Rule: For frequently-changing images, explicitly override TTL or use cache-control on the origin.

- **Metadata image route params async in v16:**
  - `generateImageMetadata` `id` is now `Promise<string>`; handle as async.[1]  
  - Rule: Refactor any sync metadata-generation code to async and ensure all external I/O is awaited.

---

## Middleware → `proxy.ts` and network boundary

- **`middleware.ts` is deprecated** in favor of **`proxy.ts`**.[1]
- Rules:

  - Move cross-cutting network logic (auth, redirects, header rewriting) into `proxy.ts` at the project root or relevant segment.
  - Treat `proxy.ts` as the **network boundary**, not as a general-purpose application layer. Do not put app-level business logic there.

---

## DevX and misc behavior changes

- **Terminal output and logging in v16:**
  - Redesigned dev/build output with clearer formatting and performance metrics.[1]
  - Rule: Treat warnings and perf hints as actionable; don’t mute them by default.

- **Automatic smooth scroll is removed by default:**
  - To re-enable, add `data-scroll-behavior="smooth"` on the HTML document.[1]

- **Modern Sass:**
  - `sass-loader` bumped to v16 with modern Sass API.[1]  
  - Rule: Update any custom Sass config; stop relying on deprecated Sass patterns.

---

## Practical coding rules checklist

When touching a Next.js 15/16 codebase:

- Use **App Router**, React 19+, and Turbopack; no new Pages Router code.  
- Treat **all request/route/metadata params as potentially async**; refactor sync helpers.  
- For caching:
  - Always specify caching behavior on `fetch` and **use `"use cache"`** where you want static/PPR behavior.
  - Use `revalidateTag(tag, profile)` and `updateTag(tag)` correctly; never rely on legacy single-arg `revalidateTag()`.[1]
- For routing:
  - Provide `default.tsx/js` in every parallel route slot; handle `notFound()` explicitly when needed.[1]
- For images:
  - Use `next/image` only with `remotePatterns`/`localPatterns` configured; no `images.domains` or `next/legacy/image`.[1]
- For infra:
  - Keep Babel configs minimal under Turbopack.
  - Do not work around build/dev lockfiles; separate invocations or repos instead.  

If you want, I can next produce equivalent MUST‑follow rule sets for React 19, Pydantic v2/FastAPI, TypeScript, Rust, and Go.