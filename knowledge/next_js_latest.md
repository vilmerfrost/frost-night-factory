Here are the **must‑follow rules** distilled for each stack, focusing on 2024/2025 changes.

---

## Next.js (v15 → v16): Async Request APIs, Caching, Turbopack

**Core rules**

1. **All Request APIs are async-only in Next 16**[3]  
   - You **must** use `await` for:
     - **`cookies()`**, **`headers()`**, **`draftMode()`**  
     - `params` in `layout.js`, `page.js`, `route.js`, `default.js`, `generateMetadata`, `generateViewport`[3]  
     - `searchParams` in `page.js`, `layout.js`, `route.js`, `default.js`[1][3]  
   - Remove any synchronous access; wrap in `async` functions:
     ```ts
     import { cookies, headers, draftMode } from 'next/headers'

     export default async function Page({ params, searchParams }: PageProps) {
       const cookieStore = await cookies()
       const hdrs = await headers()
       const draft = await draftMode()
       const { slug } = await params
       const { q } = await searchParams
       // ...
     }
     ```

2. **New caching semantics for `fetch` and responses**[1][3]  
   - Treat `fetch` as **HTTP‑semantics aligned**:
     - Respect `Cache-Control` and `ETag` more strictly.
     - Avoid relying on legacy Next.js caching quirks.
   - Always specify an explicit cache policy for server `fetch`:
     ```ts
     await fetch(url, {
       cache: 'force-cache' | 'no-store',
       next: { revalidate: n | false, tags: ['tag'] }
     })
     ```

3. **Use new cache APIs consistently (Next 16)**[2][3]  
   - When using tag revalidation, **you must** pass a cache profile:
     ```ts
     import { revalidateTag } from 'next/cache'

     await revalidateTag('products', { cacheLife: 'short' }) // required in 16[2]
     ```
   - Prefer **Cache Components / PPR model** (`cacheComponents`), not the old `experimental.dynamicIO` or `experimental.ppr` flags (removed/renamed)[2].

4. **Turbopack is the default bundler; design for it**[2]  
   - Next 16: **Turbopack is default for all apps**; webpack is opt‑out via `next build --webpack`[2].  
   - Avoid custom webpack loaders/plugins unless absolutely necessary; keep build config Turbopack‑friendly (no dynamic Babel/webpack hacks).

5. **Server Actions: security and shape**[1]  
   - Do not depend on deterministic action IDs; IDs are **unguessable and regenerated per build**[1].  
   - Remove unused actions – dead code elimination strips them from client bundles[1].  
   - Never expose action IDs manually; call actions only through framework conventions (e.g. `form action={someAction}`).

6. **Routing and navigation constraints (Next 16)**[2][3]  
   - Every **parallel route slot** must have a `default.js` that either `return null` or calls `notFound()`; builds **fail** without it[2].  
   - Rely on **layout deduplication** and **incremental prefetching**; avoid manual prefetch hacks (custom `IntersectionObserver` prefetching usually redundant)[2][3].  
   - `sitemap` and `generateSitemaps` now use **async IDs**; treat `id` as `Promise<string | number>` and `await` it[3].

7. **`next/image` stricter defaults**[2]  
   - For local `src` with query strings, you **must** configure `images.localPatterns` to prevent enumeration attacks[2].  
   - `images.minimumCacheTTL` default is **4h**; if you need shorter TTL, override explicitly[2].

8. **Misc breaking behavior**[1][2]  
   - `ssr: false` with `next/dynamic` is **disallowed in Server Components**[1].  
   - Middleware networking boundary: move advanced proxy logic into `proxy.ts` (new Proxy entrypoint) instead of abusing `middleware.ts`[2].  
   - No auto Speed Insights; use `@vercel/speed-insights` explicitly[1].  
   - `.xml` dynamic sitemap extension removed; do not rely on `.xml` dev/prod mismatch[1].

**Linting / tooling**

- Use **ESLint 9** support in Next 15+ and fix new async rules for `cookies`/`headers` usage[1].  
- Avoid direct reliance on `size` or `First Load JS` from `next build` output; they are removed and were inaccurate for RSC architectures[3].

---

## React (targeting React 19+ features)

As of the current docs, React 19 features are in the **RC / preview** category; Next.js 15+ tracks them.

**Rules for Server Actions & `useFormStatus` (React/Next integration)**

1. **Server Actions must be marked and imported correctly**  
   - Place `"use server"` at the top of server action modules or functions.  
   - Never call server actions directly from client components; always call via:
     - Form `action` attribute (`<form action={myAction}>`)
     - Or `startTransition(() => myAction(formData))` on the client if framework supports it.

2. **Use `useFormStatus` only inside `form` boundaries**  
   - Hook must be used in a **child component** of the form whose `action` is a Server Action.  
   - Do not call `useFormStatus` outside a `<form>` context or in arbitrary components.

3. **Combine with React Compiler / memoization model**  
   - In Next 16, **React Compiler support is stable**; avoid manual `useMemo`/`useCallback` micro‑optimizations that fight the compiler[2].  
   - Prefer simple component code; let the compiler and RSC handle memoization.

---

## Python: Pydantic v2 + FastAPI latest patterns

**Pydantic v2 mandatory patterns**

1. **Use `BaseModel` from Pydantic v2 and the new config API**  
   - No `Config` inner class; use model config via `model_config`:
     ```py
     from pydantic import BaseModel, ConfigDict

     class User(BaseModel):
         model_config = ConfigDict(strict=True, extra='forbid')
         id: int
         name: str
     ```
   - Do not rely on v1 style validators; use the new API:
     ```py
     from pydantic import field_validator, model_validator

     class User(BaseModel):
         email: str

         @field_validator('email')
         @classmethod
         def check_email(cls, v): ...
     ```

2. **Validation is no longer on attribute set by default**  
   - Treat models as **validated at construction**, not at mutation time.  
   - If you need runtime validation on mutations, implement explicit methods or `model_copy(update=...)`.

3. **Use native `typing` and `Annotated` instead of `pydantic`-specific hints**  
   - Prefer `typing.Annotated` and standard collections; avoid legacy Pydantic container types.

**FastAPI latest best practices**

1. **Align with Pydantic v2 / `pydantic-core`**  
   - Ensure `fastapi` is on a version compiled for Pydantic v2; do not mix with v1 code paths.  
   - All request/response models must be v2‐style; do not import `BaseModel` from `pydantic.v1`.

2. **Use dependency injection consistently**  
   - For DB/session: **never** create sessions at module import; always use `Depends` factories (e.g. yield‑based session dependencies with proper teardown).  
   - For background work: use proper background tasks or a task queue; do not block the event loop with sync I/O.

3. **Async rules**  
   - Route handlers are **`async def`** when performing any I/O.  
   - Any blocking DB client or HTTP client must run via `run_in_threadpool` or use their async equivalents.

---

## TypeScript: Latest features & strictness

**Strict mode is non‑optional**

1. **Always enable full strictness in `tsconfig.json`:**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "noUncheckedIndexedAccess": true,
       "exactOptionalPropertyTypes": true,
       "noImplicitOverride": true,
       "noPropertyAccessFromIndexSignature": true,
       "useUnknownInCatchVariables": true
     }
   }
   ```

2. **Never disable type‑checking for performance in app code**  
   - Avoid `skipLibCheck: false` in libs you control; only consider `true` for third‑party heavy typings.

**Newer type system patterns**

1. **Use `satisfies` for configuration objects**  
   - Prefer `const config = { ... } satisfies SomeConfig;` to ensure excess property checking without explicit annotation.

2. **Prefer template literal types, mapped types, and discriminated unions**  
   - Use narrow string unions and template literal types for API routes/params to avoid `string` abuse.

3. **Eliminate `any` and wide `unknown`**  
   - Use generics + conditional types where necessary.  
   - Wrap unsafe boundaries (e.g. JSON parsing) in narrow, validated helpers, not global `any`.

---

## Rust: Latest async, Tokio, performance

**Async/Tokio rules**

1. **Single runtime; no nested runtimes**  
   - Use **one `tokio::main`** entry; do not spawn extra runtimes inside libraries.  
   - All async libraries must accept an executor‑agnostic interface where possible, but if targeting Tokio:
     - Use `tokio::spawn`, `tokio::time::sleep`, `tokio::sync` primitives.

2. **Structured concurrency & cancellation**  
   - Group tasks with `tokio::task::JoinSet` or `FuturesUnordered`; always `await` or cancel joins cleanly.  
   - Do not `tokio::spawn` and ignore `JoinHandle`; handle errors and panics explicitly.

3. **I/O and backpressure**  
   - Use `tokio::io::{AsyncRead, AsyncWrite}` traits for I/O abstraction.  
   - Avoid unbounded channels for high‑throughput paths; prefer bounded `mpsc` with well‑chosen capacities.

**Performance & ergonomics**

1. **Minimize allocations, clone, and `Arc`**  
   - Prefer `&T` and lifetimes over `Arc<T>` when single‑threaded.  
   - Use `SmallVec`, `Bytes`, and other zero‑copy abstractions in hot paths.

2. **Feature‑gated dependencies**  
   - Enable only necessary features per crate (`default-features = false`); keep compile times and binary size in check.

---

## Go: Modules, generics, concurrency

**Modules & layout**

1. **Go modules are mandatory**  
   - Always use `go.mod` with semantic versions; never use GOPATH layout for new code.  
   - Keep module boundaries coarse‑grained; avoid many tiny modules for a single service.

2. **Versioning**  
   - For breaking changes, create `/v2`+ module paths following Go module semantics.

**Generics usage**

1. **Use generics for reusable data structures and helpers, not everything**  
   - Good: generic repositories, generic HTTP client wrappers, generic map/filter helpers on slices.  
   - Bad: over‑generic business logic that becomes unreadable and harder to infer.

2. **Constrain type parameters precisely**  
   - Use interface constraints that model capabilities (e.g. `interface{ ~int | ~string }`), not `any`.

**Concurrency best practices**

1. **Never leak goroutines**  
   - Every long‑lived goroutine must:
     - Accept `context.Context`  
     - Check `ctx.Done()`  
     - Exit on cancellation.
   - Always `defer cancel()` on contexts you create, and ensure channels are closed or listeners exit.

2. **Use `errgroup` / structured concurrency**  
   - Group related goroutines with `errgroup.Group`; propagate first error and cancel siblings via context.

3. **Channel discipline**  
   - Avoid unbounded producers to unbuffered channels without consumers; size buffers appropriately.  
   - Keep ownership clear: the sender closes the channel; receivers must not close it.

---

If you tell me which stack you’re targeting first (Next.js vs backend vs language), I can turn this into a concrete checklist plus example snippets aligned with your codebase style.