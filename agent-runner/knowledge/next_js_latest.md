Here are the **hard rules** you should follow, organized by stack. This is intentionally opinionated and oriented toward production codebases in 2024–2025.

---

## Next.js (v15 → v16)

### 1. Async Request APIs (cookies/headers/params/etc.)[1][3]

- **Never access request helpers synchronously** in the App Router:
  - `cookies()`, `headers()`, `draftMode()`, route `params`, `searchParams`, `generateMetadata`, `generateViewport`, `layout/page/route/default` params, sitemap params **must be treated as async** in v16.[1][3]
- Refactor all of these patterns:
  ```ts
  // ❌ invalid in Next 16
  import { cookies } from 'next/headers';

  export default function Page() {
    const cookieStore = cookies(); // sync
  }
  ```
  to:
  ```ts
  // ✅ valid in Next 16
  import { cookies } from 'next/headers';

  export default async function Page() {
    const cookieStore = await cookies();
  }
  ```
- Treat any API that returns request-related context as potentially asynchronous, and **make top-level components async** where required.

### 2. Caching model and `fetch` semantics[1][3]

- Default `fetch` caching changed; always **set explicit cache directives**:
  - For **SSR, non-cacheable**:
    ```ts
    await fetch(url, { cache: 'no-store' });
    ```
  - For **ISR / SWR**:
    ```ts
    await fetch(url, { next: { revalidate: 60 } });
    ```
- Use **new cache life profiles** where available (e.g. `revalidateTag(tag, 'default')` in v16).[2][3]
- Assume **stale-while-revalidate is opt-in and explicit**; do not rely on old implicit behavior.

### 3. Turbopack as default bundler (Next 16)[2]

- **Plan for Turbopack as the default**:
  - `next build` and `next dev` use Turbopack unless you explicitly opt out with `next build --webpack`.[2]
- Do not depend on Webpack-specific custom loaders/plugins unless:
  - You guard them behind a **Webpack-only path**, or
  - You explicitly set the project to use Webpack.
- Treat any custom Babel config as supported (Turbopack now auto-enables Babel if config present).[2]

### 4. Routing, Prefetching, Cache Components (PPR evolution)[2][3]

- **Use the new Cache Components model**:
  - Old `experimental.ppr` / `experimental.dynamicIO` flags and route-level `experimental_ppr` exports are removed/renamed into `cacheComponents`.[2]
- Design layout trees assuming:
  - **Layout deduplication**: shared layouts are fetched once across multiple prefetches.[2][3]
  - **Incremental prefetching**: only missing segments are prefetched; avoid heavy side effects in layout-level data loaders.[2][3]
- For parallel routes, **every slot must have an explicit `default.js`** returning `null` or `notFound()`; missing defaults fail the build.[2]

### 5. Middleware → `proxy.ts` and network boundary[2]

- For network boundary logic, prefer **`proxy.ts`** over legacy middleware:
  - Centralize request proxying, auth gateways, and edge logic there.[2]
- Use middleware only where absolutely required by legacy behaviors; new code should target the **proxy** abstraction.

### 6. `next/image` and security changes[2]

- For `next/image` with local `src` and query strings, configure **`images.localPatterns`** or the build will fail (to avoid enumeration attacks).[2]
- Default `images.minimumCacheTTL` is now **4 hours**; for frequently updated images, set a shorter TTL explicitly.[2]

### 7. Server Actions security (Next 15+)[1]

- Do **not** rely on predictable Server Action IDs; they are now **unguessable and non-deterministic**, may change between builds.[1]
- Remove unused Server Actions; they are now dead-code-eliminated and will not ship to the client bundle.[1]
- Do not reference internal action IDs manually; always use the framework-generated bindings.

### 8. Misc infra rules

- **ESLint 9** is supported; keep ESLint config compatible with v9 and Next.js’ recommended config.[1]
- Old auto-instrumentation for Speed Insights is gone; use `@vercel/speed-insights` explicitly if needed.[1]
- `.xml` dynamic sitemap route extension removed; migrate sitemap URLs to the new default format.[1]
- `next dev` vs `next build` now use **separate output dirs** with lockfiles; do not share these dirs across different build processes.[2][3]

---

## React (v19-related features in Next.js)

React 19 is integrated with Next 15+/16, but some APIs are exposed via Next wrappers.

### 1. Server Actions

- Treat Server Actions as **first-class mutations**:
  - Only call them from:
    - Server Components
    - `form` actions
    - Explicit client proxies created by Next.
- Never pass Server Actions through arbitrary props to client components unless designed as such; respect Next’s transformation rules.
- Assume **action identity is not stable across builds**; do not key or persist by function identity.

### 2. `useFormStatus`

- Use `useFormStatus` inside nested components within a `<form action={serverAction}>`:
  - Drive **loading states, disable buttons, display optimistic hints** based on form submission state.
- Avoid custom "isSubmitting" state where `useFormStatus` covers the same semantics; prefer framework-managed status.

### 3. React Compiler support (Next 16)[2]

- React Compiler is **supported and auto-integrated**:
  - Avoid hand-written `useMemo` / `useCallback` for pure components **unless** profiling shows a problem.
  - Keep component bodies **pure and deterministic**; avoid side effects in render so the compiler can optimize safely.

---

## Python: Pydantic v2 + FastAPI

### 1. Pydantic v2 core rules

- Always use **Pydantic v2-style** APIs:
  - Prefer `model_validate`, `model_dump`, and `field_validators` / `model_validator` decorators.
  - Avoid deprecated v1 aliases (`parse_obj`, `dict`, `@validator`, etc.) in new code.
- Enable **strict typing**:
  - Set `model_config = ConfigDict(strict=True)` or equivalent to enforce strict input coercion.
- Do not rely on implicit type coercion; always validate/convert explicitly at the API boundary if you accept flexible inputs.

### 2. FastAPI with Pydantic v2

- Ensure FastAPI is **v0.111+** (or the latest v2-compatible) with native Pydantic v2 support.
- Use:
  - **`Annotated[...]`** for parameter metadata (e.g. `Query`, `Path`, `Body`).
  - Shared schemas as Pydantic v2 models; use `ConfigDict` for JSON encoders, orm_mode-style behavior.
- Prefer **dependency injection** over global state:
  - DB sessions via dependencies
  - Settings via `@lru_cache` singletons or similar.

- For performance:
  - Use `uvicorn` or `hypercorn` with `uvloop` where appropriate.
  - Keep async endpoints **fully async**; avoid blocking I/O inside `async def` routes.

---

## TypeScript (latest, strict-first)

### 1. Strictness as non-negotiable

- Always enable **`"strict": true`** in `tsconfig.json` and treat any relaxation as a temporary exception that must be documented.
  - Keep `noImplicitAny`, `strictNullChecks`, `noImplicitThis`, `alwaysStrict` all enabled.
- Turn on:
  - `"noUncheckedIndexedAccess": true`
  - `"exactOptionalPropertyTypes": true`
  - `"noPropertyAccessFromIndexSignature": true`
  - `"verbatimModuleSyntax": true` for modern module semantics where feasible.

### 2. Modern type system features

- Prefer **template literal types** and **satisfies** for config objects:
  ```ts
  const routes = {
    home: '/',
    dashboard: '/dashboard',
  } as const satisfies Record<string, `/${string}`>;
  ```
- Use **discriminated unions** with explicit tags; never rely on “open” unions without a discriminant for control flow.
- Replace `enum` with:
  - `as const` literal unions
  - Or `const enum` only when using a bundler that supports inlining and you are sure about the tradeoffs.

### 3. React/Next TypeScript patterns

- Use typed `Route` helpers (e.g. `Route` from `next` typings where available) to avoid invalid links.
- Never use `any` in Server Components; where unavoidable, use `unknown` and narrow.

---

## Rust: Async, Tokio, performance

### 1. Async and Tokio

- Standardize on **Tokio 1.x** with the **multi-threaded runtime** for server workloads.
- Mark **all async boundaries as `Send`** where possible:
  - Avoid non-`Send` futures in public APIs; do not capture `Rc`, `RefCell`, or raw pointers in async tasks.
- Use `tokio::spawn` for fire-and-forget tasks with explicit error logging, and `JoinHandle` awaited in structured concurrency contexts.

### 2. Concurrency and cancellation

- Prefer **structured concurrency** patterns:
  - `tokio::select!` with explicit cancellation branches.
  - Scoped tasks (`tokio::task::scope` or crates providing structured concurrency) for lifetimes tied to parent tasks.
- Always make **timeouts explicit** using `tokio::time::timeout` for network and I/O calls.

### 3. Performance rules

- Avoid **`clone()` on hot paths** for large structs; prefer `Arc` with clear ownership semantics.
- Use **`tracing`** for structured logging; configure span-based instrumentation around critical sections.
- For high-throughput HTTP, use hyper/axum or actix-web with **zero-copy body handling** when possible.

---

## Go: Modules, generics, concurrency

### 1. Modules and versions

- Always use Go modules (`go.mod`); **no GOPATH-centric builds**.
- Keep `go` version in `go.mod` updated to the current stable major.minor you target; treat this as a compatibility contract.

### 2. Generics usage

- Use **generics only for reusable library-like code**, not application business logic where interfaces or concrete types are clearer.
- Prefer:
  - `constraints.Ordered` or custom constraints for generic algorithms.
  - Avoid **complex nested type parameters** that make error messages unreadable.

### 3. Concurrency and context

- Every goroutine performing I/O must accept and honor a `context.Context`:
  - Use `ctx` for cancellation and timeouts; never ignore `ctx.Done()`.
- Avoid “goroutine leaks”:
  - Ensure every spawned goroutine has a well-defined lifetime and exit condition.
- Do not rely on global mutable state; use channels, `sync.Mutex`, or `sync.RWMutex` with clear ownership.

### 4. Performance and safety

- Avoid `panic` in library code; return `error` and handle centrally.
- Measure allocations with `pprof` and `-benchmem`; optimize only after you have profiler data.

---

If you tell me which of these stacks you’re actively using together (e.g. Next 16 + FastAPI backend + Rust services), I can turn this into a concrete “project-level ruleset” you can drop into your CONTRIBUTING.md.