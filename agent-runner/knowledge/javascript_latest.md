Here are **concrete rules** you should follow, grouped by stack. This is intentionally terse and prescriptive.

---

## Next.js (targeting v15/v16 style patterns)

**Routing & data fetching**

- Prefer **App Router** (`app/`) only; do not add new `pages/` code paths.  
- Use **async Server Components** as the default; use `"use client"` only where necessary.  
- For data fetches in RSCs, use the **new Request APIs** (`fetch`, `cookies`, `headers`, `redirect`, `notFound`) from `next/headers` or `next/navigation` as appropriate, not custom singletons.  
- Treat server code as **per-request**, *not* as a singleton process: never rely on module-level mutable state.

**Caching & revalidation**

- For **fetch**, always set an explicit cache mode:
  - Static: `fetch(url, { cache: "force-cache" })`
  - ISR: `fetch(url, { next: { revalidate: N } })`
  - Dynamic: `fetch(url, { cache: "no-store" })`
- For route handlers / RSCs, explicitly declare:
  - `export const dynamic = "force-static" | "force-dynamic";`
  - `export const revalidate = N | 0;`
- Never mix **mutable external state** with static caching without an invalidation strategy; use **tagged revalidation** and `revalidateTag`/`revalidatePath` where available instead of ad-hoc cache-busting.

**Route handlers & async APIs**

- Implement HTTP endpoints with **`app/**/route.ts`** and **async** functions; do not use `pages/api` in new code.  
- Use **Request / Response Web APIs** only; do not rely on Node-only request types in route handlers.  
- Keep handlers **pure and idempotent** where possible; avoid direct mutation of in-memory state.

**Turbopack & bundling**

- Assume **Turbopack** as the default dev bundler; do not depend on Webpack-specific config APIs for new features.  
- Avoid custom Webpack loaders/plugins unless there is a hard requirement; prefer official Next.js config surfaces.  
- Structure client code to be **tree-shakeable** (no side-effectful top-level logic; use ESM exports only).

---

## React v19

**Core constraints**

- Assume **concurrent features** and **Server Components** are available; never rely on mount-order side effects.  
- Treat all React code as **strict-mode safe**: effect functions must be **idempotent** and support double-invocation in dev.  

**Server Functions (formerly Server Actions)**[3]

- Mark server-only modules with `"use server";` at the top.  
- Export **async functions** and use them:
  - In RSCs: `<form action={serverFn}>…</form>`  
  - From client components via `useActionState(serverFn, initialState)`[3].  
- Server Functions must be **serializable**: arguments and return values must serialize over the wire; no class instances, no functions, no non-structured-clone types.

**Form handling: `useActionState` / `useFormStatus`**[2][3][6]

- Prefer **`useActionState`** over bespoke loading/error state for async actions:
  ```ts
  const [state, submit, isPending] = useActionState(actionFn, initialState);
  ```
- Use **`useFormStatus` from `react-dom`** only inside descendants of the `<form>`:
  ```ts
  import { useFormStatus } from "react-dom";
  const { pending, data } = useFormStatus();
  ```
- Do not manually track submit state for forms wired to Server Functions; rely on `pending` from `useFormStatus` and `isPending` from `useActionState`.  

**Effects & transitions**

- Use `useEffect` only for **non-render side effects**, never for deriving view-only state from props.  
- Use `useTransition` and `startTransition` for **low-priority** updates (filters, large list updates).  
- Never mutate props or context; always create new objects for state updates.

---

## Python – Pydantic v2 + FastAPI (latest patterns)

**Pydantic v2 model rules**

- Use **`pydantic.BaseModel` v2**; do *not* use v1-style `Config` or `@validator`.  
- Use:
  - `model_config = ConfigDict(...)` **inside** the model class.
  - `@field_validator("field", mode="before" | "after")` instead of `@validator`.  
  - `@model_validator(mode="before" | "after")` instead of `@root_validator`.  
- Rely on **`model_validate`** / `.model_dump()` / `.model_dump_json()` instead of `parse_obj` / `.dict()` / `.json()`.  
- Use `typing.Annotated` with `pydantic.Field` for constraints:
  ```py
  from typing import Annotated
  from pydantic import BaseModel, Field

  Age = Annotated[int, Field(ge=0, le=150)]
  ```

**FastAPI integration (v2-style)**

- Use **Pydantic v2** by ensuring current FastAPI and pydantic versions; do not pin to v1 compatibility mode.  
- Define request/response schemas as **Pydantic v2 models**, not bare dicts.  
- For performance:
  - Enable **`uvicorn` with `--loop uvloop --http httptools`** in production.  
  - Use **`async def`** endpoints for I/O-bound handlers; use threadpool (`run_in_threadpool`) for heavy CPU sync code.  
- Always set **response models** explicitly on routes to control serialization and OpenAPI.  
- Use **dependency injection** (`Depends`) for DB sessions and configuration; never use global mutable state.

---

## TypeScript – latest strictness & type system features

**Compiler options (`tsconfig.json`)**

- Enable **full strictness**:
  - `"strict": true`
  - `"noUncheckedIndexedAccess": true`
  - `"noImplicitOverride": true`
  - `"noPropertyAccessFromIndexSignature": true`
  - `"exactOptionalPropertyTypes": true`
- Target at least **ES2020**; use `"module": "esnext"` for modern bundlers.  
- For libraries, use `"declaration": true` and `"isolatedModules": true`.

**Type system usage**

- Prefer **`unknown` over `any`**; `any` requires explicit justification.  
- Use **satisfies** to lock value shape without widening:
  ```ts
  const routes = {
    home: "/",
    user: "/user/:id",
  } as const satisfies Record<string, string>;
  ```
- Use **template literal types**, **discriminated unions**, and **mapped types** for APIs instead of ad-hoc untyped objects.  
- Avoid **namespace** and **triple-slash reference** features; use ESM modules only.  
- Never rely on deprecated non-null assertions; prefer **narrowing** (`if`, `in`, `typeof`, `instanceof`, custom predicates).

---

## Rust – async, Tokio, performance

**Async & Tokio**

- Use **`tokio` as the async runtime** (`[dependencies] tokio = { version = "...", features = ["full"] }` only as needed; minimize features).  
- Declare main as:
  ```rust
  #[tokio::main(flavor = "multi_thread")]
  async fn main() { ... }
  ```
- Never `block_on` inside async contexts; avoid blocking calls in async functions. For blocking I/O / CPU:
  ```rust
  tokio::task::spawn_blocking(move || { /* blocking work */ });
  ```
- Prefer **`tokio::sync`** primitives (`Mutex`, `RwLock`, `mpsc`, `oneshot`, `Notify`) over std versions in async code.  

**Futures & lifetimes**

- Keep async functions **owned-data oriented**; avoid returning references tied to stack frames.  
- Avoid `async fn` in traits; use `async-trait` only when necessary or implement manual state machines / GAT patterns.  

**Performance rules**

- Compile with **`[profile.release]`** tuned: `lto = "fat"`, `codegen-units = 1`, and `opt-level = "z"` or `3` based on size vs speed.  
- Minimize allocations: use `SmallVec`, `Bytes`, or `Arc<str>` where appropriate.  
- Use `cargo bench` and `criterion` for benchmarks; do not guess about performance.  
- Avoid unnecessary `clone()`; prefer borrowing and lifetimes; use `Arc` only when cross-thread sharing is required.

---

## Go – modules, generics, concurrency

**Modules & layout**

- Always use **Go modules** (`go.mod`), even for small projects; no GOPATH-based layout.  
- Follow:
  - `cmd/<binary-name>/main.go`
  - `internal/` for non-public packages
  - `pkg/` only for intentional public libraries.
- Keep `go.mod` clean: use `go mod tidy` regularly; no unused requirements.

**Generics**

- Use **type parameters** for reusable containers and algorithmic code, but avoid over-generic APIs in business logic.  
- Constrain type params with **interfaces** or `~` type approximations where necessary; avoid `any`:
  ```go
  func Keys[K comparable, V any](m map[K]V) []K { ... }
  ```
- Do not use reflection (`reflect`) where generics can express the same logic safely.

**Concurrency**

- Never spawn goroutines without ownership and lifecycle; always have a **cancellation path** via `context.Context`.  
- Use **`context.Context`** as first param for operations that may block or be canceled:
  ```go
  func (s *Service) Do(ctx context.Context, ...) error
  ```
- Prefer **channel** patterns and `sync.WaitGroup` for coordination; avoid busy loops and unbounded goroutine creation.  
- Avoid sharing mutable state; if necessary, use `sync.Mutex` or `sync.RWMutex`, not ad-hoc `chan struct{}` hacks for protection.  
- Ensure all `time.Ticker` and `time.Timer` instances are **stopped** to avoid leaks.

---

If you tell me which subset of stacks you are actively using in one codebase, I can turn this into a concrete checklist (or `.md` guideline) with example configs and lints.