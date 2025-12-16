Below are **implementation rules** you must follow, organized by stack. They assume you are on current stable/beta channels and using the latest major versions (Next.js 15+/React 19+/TypeScript 5+/Rust 1.8x+/Go 1.23+/Python 3.12+).

---

## Next.js (v15 / upcoming v16)

**App Router / Server Components**

- Use **App Router** (`app/`) only; do not start new code in `pages/`.
- Default to **React Server Components**; only mark boundaries with `"use client"` when you need browser-only APIs, event handlers, or stateful UI.
- Avoid mixing `pages/` data APIs (`getServerSideProps` / `getStaticProps` / `api/`) with App Router data APIs in the same route tree.

**Async Request APIs / Route Handlers**

- Implement server APIs using **Route Handlers** (`app/api/.../route.ts`) with **async functions** that return `NextResponse`.
- Use **streaming** where appropriate via `new ReadableStream()` or `NextResponse` body streaming in Server Components.
- **Do not** use `res.send` / `res.json` style handlers; always return `Response`-like objects.

**Caching / Revalidation**

- Treat **caching as opt‑in and explicit**:
  - Use `fetch(url, { cache: "force-cache" | "no-store", next: { revalidate: seconds } })`.
  - For static-ish server components, export `revalidate` or `dynamic = "force-dynamic" | "force-static"`.
- Do not rely on legacy `getStaticProps`/`getServerSideProps` caching semantics in App Router.
- Co-locate caching policy with the **data‑fetching call**, not globally.

**Turbopack / Build**

- Use **Turbopack** in dev; keep build tooling compatible (ESM, no exotic bundler plugins).
- Avoid webpack-specific config in new projects; if you must customize, use `next.config.mjs` with experimental flags that mention Turbopack compatibility.

**Server Actions**

- Define **Server Actions** only in Server Components or Route Handlers.
- Avoid mutating client state directly from actions; use actions to mutate data sources and let **React revalidate** via `revalidatePath` / `revalidateTag`.
- Never capture large objects or request-specific resources in Server Action closures that will be serialized.

**Best-practice constraints**

- Prefer **edge runtime** for low-latency, stateless APIs; avoid using Node‑only APIs in edge routes.
- All environment access must go through `process.env.*` with explicit configuration; do not read secrets in Client Components.
- Use **incremental static regeneration** (`revalidate`) for high‑traffic content; avoid fully dynamic (`no-store`) when not strictly needed.

---

## React (v19)

**Server Components / Server Actions**

- Treat **Server Components** as the default for data-bound UI; keep them **pure** (no side effects, no browser APIs).
- Use **Server Actions** instead of legacy REST POSTs for forms where possible:
  - Mark server action functions with the `"use server"` directive.
  - Pass actions as form `action` props or event handlers from a Server Component boundary.

**New hooks (e.g., `useFormStatus`)**

- Use **`useFormStatus`** **only** inside components rendered within a `<form>` that uses a Server Action; rely on it for pending/submission UI, not arbitrary global state.
- Always keep **loading / pending UI** local to where the mutation happens; do not share `useFormStatus` state across unrelated forms.

**Concurrent / Suspense / Streaming**

- Assume React is in **concurrent mode** by default:
  - Use `Suspense` boundaries around any async data (including Server Components and `use`/`await`).
  - Prefer `startTransition` for low-priority UI updates after navigations or filters.
- Avoid blocking the main thread with synchronous heavy work; offload to Web Workers or Server Components.

**Client Components**

- Minimize `"use client"` surfaces; keep them as **leaf nodes**.
- Never import a Client Component into a Server Component from within a **shared** module that also runs on the server; split entry points explicitly.

---

## Python (Pydantic v2, FastAPI latest)

**Pydantic v2 model rules**

- Use the **Pydantic v2** API (`BaseModel`, `field_validator`, `model_validator`) and avoid v1 legacy aliases.
- Prefer **`ConfigDict`** over `class Config` for configuration.
- Use `model_validate` / `model_dump` instead of `.parse_obj` / `.dict` in new code.

**FastAPI + Pydantic v2 integration**

- Always type your endpoints with **Pydantic models** (request & response) to get OpenAPI and validation for free.
- Use **dependency injection** via `Depends(...)` for shared resources (DB sessions, auth context).
- Prefer **async def** endpoints and database drivers; only use sync endpoints if calling blocking libraries (and then isolate them with threadpools / background tasks).

**Validation / performance**

- Use `FastAPI`’s native Pydantic v2 integration; avoid manual request parsing when not required.
- For performance-critical paths, enable **`validate_assignment=False`** and avoid re-validating large models; use `from_orm` / `validate_default` options carefully.
- Use **`Annotated`** types to attach metadata (Query, Path, Header) and constraints instead of custom validators whenever possible.

---

## TypeScript (TS 5.x+, strict)

**Compiler / project configuration**

- Always enable **`"strict": true`** and:
  - `"noImplicitAny": true`
  - `"strictNullChecks": true`
  - `"noUncheckedIndexedAccess": true`
  - `"noImplicitOverride": true`
  - `"exactOptionalPropertyTypes": true`
- Target at least **ES2020**; use module `"NodeNext"` / `"ESNext"` depending on environment.

**Type system features**

- Represent discriminated unions with **literal tag fields** and narrow via `switch` / `if` on that tag.
- Use **`satisfies`** for object literals that need to conform to a type without widening:
  ```ts
  const config = {
    cache: "force-cache",
    revalidate: 60,
  } as const satisfies FetchConfig;
  ```
- Use **template literal types** and **mapped types** for strongly-typed keys and route params; avoid `string`/`any` for keys.

**Error handling / `unknown`**

- Treat all external data (`JSON.parse`, request bodies, environment) as **`unknown`**; narrow via user-defined type predicates or schema libraries.
- Avoid top-level `any`; wrap dynamic data with Zod / Pydantic-style schemas or TS `asserts` functions.

**Interop with React / Next**

- Type **Server Actions** and Route Handlers explicitly with request / response types; avoid `any` for `FormData`, search params, etc.
- For React components, use functional components with **typed props**; no implicit `children: ReactNode` unless truly generic.

---

## Rust (latest stable 1.8x+, async/tokio)

**Async fundamentals**

- Only introduce **async** where you have I/O concurrency or structured parallelism; async brings overhead when no concurrency is present.[1][5]
- Do not block inside async tasks:
  - No `std::thread::sleep`, `std::fs::File::read`, or heavy CPU work in async contexts.
  - Use `tokio::time::sleep`, `tokio::fs`, and spawn blocking CPU work via `tokio::task::spawn_blocking`.

**Tokio runtime**

- Use a **single, process-wide** Tokio runtime (`#[tokio::main(flavor = "multi_thread")]` for servers).
- Never create nested runtimes or call `block_on` from inside an async context.
- Use async-aware synchronization (`tokio::sync::Mutex`, `RwLock`) **only when** you must hold the guard across `.await`; otherwise prefer `std::sync::Mutex` / `RwLock` for lower overhead.[5]

**Cancellation / timeouts**

- Always assume **tasks can be cancelled at any `await`**; ensure cleanup and idempotency.[5]
- Use `tokio::time::timeout` or `tokio::select!` for explicit timeouts and races.[1]
- Avoid storing `JoinHandle`s that you never await; either detach intentionally or join for error handling.

**Async patterns (2024–2025)**

- Prefer **`async fn` in traits** once stabilized over `async-trait` proc macros for better perf and ergonomics.[3]
- Use `tokio::select!` / `futures::future::select` for fan-in, `join!` / `try_join!` for structured concurrency.
- Encapsulate long-lived background tasks as **actors** (message channels + select loops) instead of ad-hoc `spawn`s.[6]

**Performance best practices**

- Avoid allocating per-packet; reuse buffers and leverage `bytes::Bytes`.
- Minimize `Arc`/`Mutex` use; pass ownership and use message passing (channels) where possible.[5]
- Benchmark with realistic loads; async only improves performance when you remove blocking and exploit concurrency.[1]

---

## Go (1.22 / 1.23+)

**Modules / project layout**

- Use **Go modules** exclusively; no GOPATH-based projects.
- Keep one main module per repo; use internal packages under `/internal` for non-public APIs.
- Version your modules semantically; avoid breaking changes without major version bumps.

**Generics**

- Use **type parameters** for reusable data structures (e.g., generic repositories, utilities), but avoid over-abstracting:
  - Prefer simple constraints (e.g., `~int | ~string`) or `constraints.Ordered`.
  - Avoid deeply nested type parameter graphs; keep generic APIs narrow and specific.

**Concurrency**

- Treat goroutines as **cheap but not free**; always pair with:
  - Explicit cancellation via **`context.Context`**.
  - Bounded worker pools when fans of goroutines could explode.
- Never ignore `ctx.Done()` in long-running loops or I/O; always propagate context down your call stack.
- Prefer channels for signalling and ownership transfer; use mutexes/rwmutexes for protecting in-memory shared state.

**Best practices**

- Never leak goroutines: ensure each goroutine eventually returns when its context is cancelled or its channel is closed.
- Avoid shared mutable state when possible; design APIs around **immutability + message passing**.
- Always handle errors explicitly; avoid panics except for truly unrecoverable states.

---

If you tell me which subset you are actively using in your current codebase (e.g., “Next 15 + React 19 + TS + Rust microservices”), I can collapse this into a single integrated “ruleset” you can paste into a project README.