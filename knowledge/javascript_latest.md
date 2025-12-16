Below are **implementation rules** you should follow, organized by stack. This is intentionally terse and prescriptive.

---

## Next.js 15 → 16 (App Router, Async Request APIs, Caching, Turbopack)

**Async Request APIs – mandatory async access (v16)**  
- Treat all Request helpers as **async-only** in App Router: `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` in `layout.tsx`, `page.tsx`, `route.ts`, `default.ts`, `generateMetadata`, `generateViewport` **must be awaited** or used in async context.[3][1]  
- Do **not** rely on temporary sync compatibility from v15; in v16 the sync access layer is gone.[3]  
- Refactor existing code like:
  ```ts
  // ❌ invalid in v16
  const cookieStore = cookies();
  const token = cookieStore.get("token");
  ```

  ```ts
  // ✅ v16
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  ```
- `generateSitemaps` → `sitemap`: `id` parameter is now a `Promise<string>`; always `await id` in `sitemap`.[3]

**Caching semantics / Request caching**  
- Always assume `fetch` is **cached by default** on the server; explicitly configure using Next.js cache options or `Cache-Control` headers.[1]  
- Use **cache profiles** and explicit invalidation:
  - Prefer `revalidateTag(tag, { cacheLife })` (v16 signature requires a `cacheLife` profile).[2]
  - Use `revalidatePath`/`revalidateTag` instead of ad-hoc cache busting.
- Do **not** depend on legacy `First Load JS` / size metrics; v16 removes them from `next build` output.[3]

**Cache Components & routing model (v16)**  
- Adopt **Cache Components** (PPR evolution) instead of relying on experimental `ppr` flags; `experimental.ppr`, `experimental.dynamicIO`, `experimental_ppr` route export are removed/renamed to `cacheComponents`.[2][3]  
- Design RSC trees assuming **partial pre-rendering and cached layout segments**; avoid hidden reliance on per-request recomputation in shared layouts.

**Routing, navigation, and parallel routes**  
- Expect **overhauled routing/prefetch**: layout deduplication and incremental prefetching are default; do not implement custom link prefetching that assumes whole-page fetches.[2][3]  
- For **parallel routes**, every slot must have an explicit `default.tsx`; missing `default` is a build error. If no UI, create `default.tsx` returning `null` or `notFound()`.[2]

**Middleware → `proxy.ts` (network boundary)**  
- Safely move cross-cutting network concerns to **`proxy.ts`** (v16) instead of abuse of middleware; `proxy.ts` defines a clearer network boundary for rewrites/proxying.[2]

**Turbopack & bundling**  
- Assume **Turbopack is the default bundler** for all apps; only opt-out with `next build --webpack`.[2]  
- Do not rely on Turbopack’s previous hard failure for Babel configs; v16 auto-enables Babel if a config is present.[2]  
- Use `outputFileTracing` behavior defaults; old tracing options are removed in v15+.[1]

**Server Actions security**  
- Do not depend on **deterministic action IDs**; v15+ uses **unguessable, non-deterministic IDs** that can change between builds.[1]  
- Assume unused Server Actions are **tree-shaken** and IDs not exposed; never reference action IDs manually or through string hacks.[1]

**next/image behavior**  
- For `next/image` with local `src` and query strings, you **must** configure `images.localPatterns` to avoid enumeration attacks.[2]  
- Expect `images.minimumCacheTTL` default of **4 hours**, not 60s; tune explicitly if you need shorter TTLs.[2]

**Misc**  
- Remove reliance on auto Speed Insights instrumentation; use `@vercel/speed-insights` explicitly.[1]  
- Ensure `sass-loader` usage is compatible with v16 (modern Sass API, loader v16).[2]

---

## React 19 (Server Actions, `useFormStatus`)

*(React 19 features are still under active evolution; below reflects current public design docs and beta behavior.)*

**Server Components + Actions**  
- Treat **Server Actions** as **pure server functions**:
  - Never capture non-serializable values in closures (DOM nodes, class instances, cyclical objects).
  - Only pass **structured-cloneable** arguments and return values.
- Bind actions directly to form `action` or button `formAction`; do not wrap server actions in client-only handlers that break streaming.

**`useFormStatus`**  
- Use `useFormStatus` **only inside a form’s subtree** for per-submit state (pending, data, method).
- Do not implement custom global “form pending” state for a single action; derive **button disabled state** and optimistic UI from `useFormStatus`.

**React Compiler / memoization**  
- Code must be **side-effect free** in render; React Compiler assumes referential transparency for automatic memoization.  
- Avoid derived state duplication; let compiler optimize pure derivations in render or selectors.

---

## Python – Pydantic v2 + FastAPI

**Pydantic v2 core rules**  
- Use **`BaseModel` from Pydantic v2** only; do **not** mix v1-style config/behaviors.
- Prefer **`field_validator`** and `model_validator` over deprecated v1 validators:
  ```py
  from pydantic import BaseModel, field_validator

  class User(BaseModel):
      name: str

      @field_validator("name")
      @classmethod
      def normalize(cls, v: str) -> str:
          return v.strip()
  ```
- Use **`ConfigDict`** via `model_config` instead of inner `class Config` in new code.
- Keep validation strictly data-centric; heavy I/O in validators is an anti-pattern.

**FastAPI with Pydantic v2**  
- Ensure compatible FastAPI version with **Pydantic v2 backend**; no mixing of `pydantic.v1`.  
- Always annotate dependencies and route models with **standard Python typing**; avoid `Any` in request/response models.  
- For background tasks and streaming responses, treat them as **separate concerns** from Pydantic models; models should not embed async I/O.

---

## TypeScript (latest strict mode and type system)

**Strictness defaults**  
- Enable **full strict mode** in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitOverride": true,
      "noPropertyAccessFromIndexSignature": true
    }
  }
  ```
- Treat all implicit `any` and loose index signatures as errors; explicitly type everything crossing module boundaries.

**Modern type features (usage rules)**  
- Use **satisfies** instead of widening:
  ```ts
  const routes = {
    home: "/",
    profile: "/profile"
  } as const satisfies Record<string, `/${string}`>;
  ```
- Use **template literal types** for stringly-typed APIs (paths, IDs, events) instead of raw `string`.  
- Prefer discriminated unions instead of `enum`/magic numbers for state machines and protocol-like APIs.  
- Prefer **`unknown` over `any`** at boundaries; refine with user-defined type guards.

---

## Rust – async, Tokio, performance

**Async patterns**  
- Use **`tokio` 1.x** as the default runtime; avoid mixing runtimes in one process.  
- Mark *top-level* async entry only at binary/CLI boundaries (`#[tokio::main]`); internal libraries should be **runtime-agnostic** (no direct `tokio` deps in public API).  
- Avoid `.block_on` inside an async context; **never block the executor threads** with sync I/O.

**Tokio usage**  
- Use **`tokio::spawn` only for truly concurrent tasks**; prefer structured concurrency:
  - Use `tokio::task::JoinSet` or `FuturesUnordered` for task groups with explicit cancellation.
- Use **`tokio::sync::Mutex` / `RwLock` only for async-only data**; do not use `std::sync::Mutex` inside async execution paths.

**Performance rules**  
- Prefer **`&[u8]` over `String`** for binary/IO-heavy APIs.  
- Avoid `.clone()` on large data; implement borrowing APIs (`&T`) and reference-counting (`Arc<T>`) when needed.  
- Use `tracing` for instrumentation; avoid heavy logging in tight loops.

---

## Go – modules, generics, concurrency

**Modules & layout**  
- Always build with **Go modules**, no GOPATH-based projects.  
- Use semantic import paths and **major version suffixes** (`module github.com/org/pkg/v2`) when breaking changes occur.

**Generics usage**  
- Use generics for **data structures and small reusable algorithms**, not across the entire codebase:
  - Avoid over-generalizing APIs with deep type parameter lists.
  - Prefer constraint interfaces (`~int | ~string`) for numeric/string operations; keep constraints minimal.

**Concurrency rules**  
- Treat **goroutine lifetime as scoped to a parent context**:
  - Every goroutine must select on `ctx.Done()` (or equivalent) and exit promptly on cancellation.
- Never ignore `<-time.After(...)` leaks; use `time.NewTimer` and `defer timer.Stop()` for hot paths.  
- Use buffered channels only where bounded queues are required; otherwise prefer unbuffered with clear ownership.

---

If you tell me which of these stacks you’re actively using in one codebase (e.g., Next 16 + React 19 + TS), I can collapse the above into a single **lint-style rule set** tuned to that environment.