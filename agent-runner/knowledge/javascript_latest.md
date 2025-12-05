Here is a compact, “rules-only” checklist you can adopt as of late‑2024/2025. It is opinionated toward safety, performance, and long‑term maintainability.

---

## General JavaScript / TypeScript

- Prefer ESM (`import` / `export`) everywhere; avoid mixing CommonJS and ESM in the same module graph.
- Enable strictness: `"strict": true` in `tsconfig.json` and treat `any` as a code smell unless carefully justified.
- Never rely on ambient `this` in functions; use arrow functions or explicit `.bind` when passing callbacks.
- Treat all I/O and network calls as async; never block the event loop with CPU‑heavy work (offload to workers or a backend).

---

## React (v19 era)

- Use the new form Actions pattern: put `action={yourAction}` on `<form>` and model async state via `useActionState` instead of home‑rolled `isSubmitting` flags.
- Use `useFormStatus` (from `react-dom`) inside descendent components (e.g. buttons) to read pending/validation status rather than passing “loading” props through many layers.
- Treat Server Functions/Server Actions as the primary way to mutate backend state from React Server Components; keep them small, stateless, and side‑effect‑only.
- Prefer React Server Components for data‑fetching UI where possible; keep client components lean and focused on interactivity.

---

## Next.js (v15/v16 assumptions)

- Use the app router as the default; avoid mixing legacy pages router and app router for new code.
- Use the new async Request APIs in Server Components and route handlers; prefer `async function GET/POST` with the framework’s `Request`/`Response` wrappers over raw `fetch` from Node.
- Treat caching as explicit: set caching behavior via route segment configuration or response helpers; avoid relying on default implicit caching.
- Use data cache and full‑page revalidation carefully; never store per‑user or highly dynamic data in static caches.
- When using Turbopack, keep imports clean and side‑effect‑free at module top‑level to maximize incremental bundling performance; avoid dynamic `require` and unbounded glob imports.

---

## Python – Pydantic v2 & FastAPI

- Write models using Pydantic v2 style: `model_config = ConfigDict(...)` and validators via the new decorator APIs; avoid deprecated v1 config/validator patterns in new code.
- Treat Pydantic models as the single source of truth for request/response schemas; never duplicate field definitions in FastAPI route decorators.
- Use type hints everywhere; configure FastAPI to depend on those types for validation and OpenAPI generation.
- Keep FastAPI path operations thin: move business logic into services; use dependency injection (`Depends`) for DB sessions, auth, and configuration instead of global state.
- Prefer async endpoints (`async def`) and async drivers; avoid mixing sync DB/HTTP clients inside async routes without running them in dedicated threadpools.

---

## TypeScript – Types & Strict Mode

- Enable at least: `strict`, `noImplicitAny`, `noImplicitThis`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`.
- Use discriminated unions instead of `string | number | …` blobs; always model domain variants with tagged unions.
- Prefer `unknown` over `any` for untyped inputs, and narrow with type guards or schema validators before use.
- Avoid `!` (non‑null assertion) in new code; use explicit runtime checks and refined types instead.
- Use `satisfies` to ensure objects match interfaces without widening literal types; avoid excessive use of `as` casts to silence the compiler.

---

## Rust – Async, Tokio, Performance

- Use `async`/`await` pervasively with Tokio or an equivalent runtime; avoid manually polling futures except in low‑level libraries.
- Use structured concurrency: spawn tasks in well‑scoped contexts and always handle `JoinHandle` results; never fire‑and‑forget critical tasks.
- Prefer `tokio::sync` primitives (e.g. `Mutex`, `RwLock`, `mpsc`) over `std::sync` inside async code to avoid blocking the runtime.
- Avoid `Arc<Mutex<T>>` as the default; design ownership and message‑passing so contention is minimized and data is mostly immutable.
- Profile before optimizing; but in libraries, avoid unnecessary allocations in hot paths and use `&str`/slices over `String`/`Vec` when possible.

---

## Go – Modules, Generics, Concurrency

- Use Go modules exclusively; pin dependencies with semantic versions and avoid `replace` hacks in long‑lived branches.
- Use generics for reusable data structures and algorithms where it meaningfully reduces duplication; avoid over‑generic APIs that hurt readability.
- Keep concurrency structured: limit goroutine creation, always handle error and cancellation via `context.Context`, and avoid leaking goroutines waiting on never‑closed channels.
- Use buffered channels only when capacity is clearly defined; avoid using channels as unbounded queues.
- Prefer `sync.Mutex`/`RWMutex` or higher‑level concurrency patterns over low‑level atomic fiddling unless clear performance needs justify it.

---

## Summary “Must‑Follow” Rules Table

| Area        | Non‑negotiable rules to follow                                          |
|-------------|-------------------------------------------------------------------------|
| React       | Use form Actions + `useActionState`; read status via `useFormStatus`; prefer Server Components + Server Actions for data flows. |
| Next.js     | Use app router; new async Request APIs; explicit caching; Turbopack‑friendly, side‑effect‑free modules. |
| Pydantic    | Use v2 configs/validators; models as schema source of truth; fully typed; no legacy v1 patterns in new code. |
| FastAPI     | Async everywhere; dependency injection for infra; thin route handlers; avoid sync I/O in async endpoints. |
| TypeScript  | Full strict mode; discriminated unions; `unknown` not `any`; avoid `!` and unsafe casts. |
| Rust/Tokio  | Structured async; no blocking in async; prefer async‑aware sync primitives; minimize shared mutable state. |
| Go          | Modules only; disciplined generics; context‑aware concurrency; never leak goroutines; avoid unbounded channels. |