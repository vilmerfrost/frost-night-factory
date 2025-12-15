Here are **implementation rules** you should follow, grouped by stack. This is intentionally terse and prescriptive.

---

## React 19 (incl. Server Functions, Actions, `useFormStatus` / `useActionState`)

**Server Functions / Actions**

- Prefer **Server Functions** (new name for *Server Actions*) only in **Server Components** for mutations that need server authority (DB writes, secrets, etc.).[3]  
- Mark server entrypoints with `"use server"` at the file or function boundary as required by your framework.[3]  
- Keep Server Functions **pure in signature**: `(formData | plain args) => Promise<serializable>`; never close over request-specific mutable state.[3]  
- Return **structured error objects**, not thrown errors, where you want to surface validation back into the UI via `useActionState`.[3]

**`useActionState`**

- Use **`useActionState` instead of ad‑hoc `useState + useTransition`** for form submits and async actions:  
  ```ts
  const [state, submitAction, isPending] = useActionState(serverFn, initialState);
  // <form action={submitAction}>...</form>
  ```[2][6]  
- Always assume the first argument of the action is the **previous state**, second is `FormData` when used as a form action.[6]  
- Treat the returned `state` as **single source of truth** for server‑side validation messages and last result; do not duplicate into other state atoms unless you need denormalization.[6][7]  
- Use the third tuple element (`isPending`) for **loading UI**, not your own boolean flag.[2][7]

**`useFormStatus` (from `react-dom`)**

- Use **`useFormStatus` only in descendants of a `<form>`**; colocate your submit button in a child component and use `pending` there.[2][6]  
  ```ts
  import {useFormStatus} from 'react-dom';
  const SubmitButton = () => {
    const {pending, data} = useFormStatus();
    return <button type="submit" disabled={pending}>Save</button>;
  };
  ```[2][6]  
- Treat `pending` as authoritative for **disabling controls** and showing progress; do *not* recompute from your own async logic.[6][7]  
- Use `data` from `useFormStatus` only for ephemeral UX (e.g., “Submitting {username}…”), never as durable state.[6]  

**General React 19 rules**

- Prefer new hooks (`useActionState`, `useFormStatus`, `useOptimistic`) over custom async state wrappers where applicable.[2][6][7]  
- Keep client components lean: **trigger server work via Server Functions and read data via RSC**, not `useEffect` fetch chains for initial loads.[3]  

---

## Next.js 15/16 (App Router, Async Request APIs, Caching, Turbopack)

*(No official 15/16 docs in results; rules below follow 2024+ App Router patterns extrapolated from current Next.js RFCs and stable 14–15 behavior.)*

**Async Request APIs**

- Implement **route handlers** (`app/api/**/route.ts`) as `export async function GET/POST(...)` and always return `NextResponse` or `Response`.  
- Use **`Request` streaming APIs** (`request.body`, `ReadableStream`) only when necessary; otherwise prefer `request.json()` / `request.formData()` for clarity.  
- For server mutations from UI, prefer **Server Functions + route handlers** over ad‑hoc REST fetches from the client.

**Caching & Data Fetching**

- Use **`fetch` with Next’s cache options** instead of legacy `getServerSideProps`/`getStaticProps` in the App Router:
  - `fetch(url, { cache: "force-cache" })` for static.
  - `fetch(url, { cache: "no-store" })` for per‑request.
  - `fetch(url, { next: { revalidate: N } })` for ISR.  
- Avoid manual in‑memory caches in server components; rely on **Next’s fetch memoization** and route segment caching semantics.  
- Treat `cookies()`/`headers()` in server components as **cache‑breaking signals**; call them only where necessary to avoid unintended cache disabling.

**Turbopack**

- Run dev with **Turbopack** (Next’s new dev bundler) by default when stable; ensure all custom webpack config is migrated to supported Next config options.
- Avoid webpack‑specific loaders/plugins where possible; favor **Next.js built‑ins** (image, font, CSS, MDX integration).

**Server Components & Boundaries**

- Prefer **Server Components** by default; annotate client components with `"use client"` at the file top.  
- Pass only **serializable props** across the server/client boundary; never pass class instances, functions, or non‑JSON objects through props.

---

## Python: Pydantic v2 + FastAPI latest

**Pydantic v2 usage rules**

- Use **v2 APIs** (`from pydantic import BaseModel, field_validator, model_validator`) and avoid deprecated v1 aliases (`@validator`, `Config` patterns without `model_config`).  
- Configure models with `model_config = ConfigDict(...)` instead of `class Config:`.  
- Use **`field_validator` / `model_validator`** with explicit `mode="before" | "after"`; avoid v1 magic ordering assumptions.  
- Prefer `model_validate`, `model_dump`, `TypeAdapter` for low‑level validation instead of v1 `parse_obj`, `json()`, etc.  
- Enable `from_attributes=True` when validating from ORM objects instead of relying on v1’s `orm_mode=True`.

**FastAPI patterns (with Pydantic v2)**

- Define request/response models using **Pydantic v2 models only**; do not mix `attrs` or custom dicts except at edges.  
- Use `response_model` for **schema + response casting**; avoid returning raw ORM models or arbitrary dicts.  
- For performance:
  - Use **lifespan context managers** instead of deprecated `startup/shutdown` events for app lifecycle.
  - Use **dependency injection** with `@lru_cache` or `async contextmanager` for DB/session factories, not globals.
- Prefer **async path functions** with real async drivers (e.g., async SQLAlchemy, async httpx) to avoid thread pool saturation.

---

## TypeScript: latest type system + strict mode

**Compilation / config**

- Always enable **full strict mode** in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitOverride": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noFallthroughCasesInSwitch": true
    }
  }
  ```
- Target the **minimum runtime you support** (e.g. `"target": "ES2022"`) and avoid polyfills when possible.

**Type system features**

- Use **satisfies** instead of explicit annotations to keep inference:
  ```ts
  const routes = {
    home: "/",
    profile: "/profile"
  } as const satisfies Record<string, `/${string}`>;
  ```
- Prefer **discriminated unions** with literal tags over enums for domain modeling.  
- Use **template literal types** for strongly‑typed route patterns, env keys, and event names.  
- Avoid `any`; use **`unknown` + narrows** or **branded types** for strongly validated primitives.  
- Use **utility types** (`ReturnType`, `Parameters`, `Awaited`) and **conditional types** for DRYing reusable inference instead of duplicating signature shapes.

**Interop & ergonomics**

- Model external JSON APIs with **`zod`/`valibot` + `z.infer`** or Pydantic‑style validators, not raw interfaces, to keep runtime and static contracts aligned.  
- Avoid namespace and triple‑slash reference patterns; use **ESM `import type`** and project references for multi‑package workspaces.

---

## Rust: async, Tokio, performance

**Async & Tokio**

- Use **Tokio** (current stable) as the default async runtime; avoid mixing multiple runtimes in the same binary.  
- Use `#[tokio::main(flavor = "multi_thread")]` for servers and `current_thread` only for specialized cases.  
- Wrap `async fn` in traits using **`async-trait`** only when unavoidable; prefer **GAT‑based patterns** and manual futures for hot paths.  
- Never block inside async: use `spawn_blocking` or dedicated blocking thread pools for CPU‑bound work and legacy sync IO.

**Concurrency patterns**

- Use **`tokio::spawn`** for fire‑and‑forget tasks and **`JoinHandle`** when you need results.  
- Use **`tokio::sync`** primitives (`mpsc`, `oneshot`, `watch`, `RwLock`) instead of `std::sync` in async contexts.  
- Avoid `Arc<Mutex<T>>` in async code; prefer `Arc<RwLock<T>>` or lock‑free designs; never hold locks across `.await` unless using async locks.  
- Use **structured concurrency**: tie tasks to parent lifetimes via `tokio::task::scope` and cancellation tokens.

**Performance rules**

- Prefer **`&str` over `String`** and **slices over Vec** in APIs; allocate only at boundaries.  
- Use **`tracing`** for structured, low‑overhead instrumentation; avoid println in hot paths.  
- Codegen‑based serializers (e.g., `serde` with `#[derive(Serialize, Deserialize)]`) for wire formats; avoid manual JSON building.

---

## Go: modules, generics, concurrency

**Modules & layout**

- Use **Go modules** exclusively; no GOPATH‑style setups.  
- Versioned modules only when you need breaking APIs (e.g., `module example.com/foo/v2`).  
- Standard layout:
  - `cmd/<app>/main.go` for binaries.
  - `internal/` for non‑public packages.
  - `pkg/` for shared public libraries only when you intentionally export.

**Generics**

- Use generics for **data structures and algorithmic utilities**, not for domain‑specific types where plain interfaces are clearer.  
- Keep type parameter lists minimal and **avoid complex constraint hierarchies**; prefer small, focused constraint interfaces.  
- Use `comparable` and simple union constraints for maps/sets; avoid constraint cycles and non‑obvious type inference.

**Concurrency**

- Treat goroutines as **scoped to a context**; always pass `context.Context` and respect cancellation/timeout.  
- Never leak goroutines:
  - Every `go f()` must either return on context cancel or be explicitly joined via channels/WaitGroups.  
- Use buffered channels only when you’ve explicitly reasoned about capacity; otherwise prefer unbuffered + backpressure.  
- Never use `time.Sleep` for coordination; use channels, context, or sync primitives.

---

If you tell me which of these stacks you’re actively using, I can turn this into a concrete “project checklist” with code patterns and lints per repo.