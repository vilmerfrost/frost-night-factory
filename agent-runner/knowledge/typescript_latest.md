Here is a unified rulebook a coder should follow for each stack, focused on breaking changes, new features, and current best practices as of 2024/2025.

## TypeScript rules

1. **Always use strict mode and modern config**
- Enable all strict flags: `"strict": true`, plus `"noImplicitOverride"`, `"noPropertyAccessFromIndexSignature"`, `"noUncheckedIndexedAccess"`, `"exactOptionalPropertyTypes"`, and `"useUnknownInCatchVariables": true`.  
- Set `"moduleResolution": "bundler"` or `"node16"` for modern bundlers, and use `"module": "esnext"` with `"target": "es2020"` (or later) unless you have legacy constraints.

2. **Prefer precise types over `any`**
- For unknown input or external data, use `unknown` and narrow, not `any`.  
- Treat `any` as a last-resort escape hatch; consider enabling `"noImplicitAny"` and `"noUnsafeAny"` (via linters).

3. **Use modern type system features**
- Use `satisfies` to validate object shapes while preserving literal types, instead of wide annotations.  
- Use template literal types, discriminated unions, mapped types, and conditional types to model domain invariants rather than ad‑hoc runtime checks.

4. **Keep types and runtime separate but aligned**
- Avoid complex runtime branching that the type system cannot model; refactor to smaller, typed functions instead.  
- When wrapping JS libraries, provide `.d.ts` or use `declare module` stubs, but gradually replace them with accurate types.

5. **Organize projects with references and modules**
- Use project references for monorepos and large codebases and enable incremental builds.  
- Use ES modules consistently (`import`/`export`) and avoid mixing CommonJS and ESM in new code.

---

## React (v19-era) rules

1. **Adopt modern React features**
- Prefer function components with hooks; do not write new class components.  
- Use React 18/19 concurrent features and transitions for async UI work instead of manual `isLoading` state scattered across the tree.

2. **Use Server Components and Server Actions where appropriate**
- For frameworks that support React Server Components (RSC), move data fetching, heavy computation, and secure operations to server components or server actions instead of client components.  
- Keep server actions free of client-only APIs (no `window`, `document`, or browser-only libraries) and treat them as async functions with clear input/output contracts.

3. **Form handling with `useFormStatus` and related hooks**
- Use `useFormStatus` (and framework-specific helpers) inside forms to drive pending/disabled states from the submission status instead of manually tracking submission flags.  
- Prefer progressive enhancement: forms should work with standard HTML submit behavior, then use React enhancements for UX.

4. **Avoid legacy APIs**
- Do not use legacy lifecycle methods, `UNSAFE_*`, or legacy context; use hooks (`useEffect`, `useLayoutEffect`, `useContext`, `useMemo`, etc.).  
- Avoid manually managing global event listeners outside React; if needed, wrap them in custom hooks.

---

## Next.js (v15/v16 direction) rules

1. **Use the App Router and async Request APIs**
- Use the `app/` directory, React Server Components by default, and async server components for data fetching.  
- Implement route handlers (`app/api/.../route.ts`) and server actions for data mutations instead of older `pages/api` where possible.

2. **Respect caching and revalidation semantics**
- Use `fetch` with `cache`, `revalidate`, and `next` options instead of ad‑hoc in‑memory caches.  
- Mark truly dynamic routes with `dynamic = "force-dynamic"` or similar flags and avoid disabling caching globally unless strictly necessary.

3. **Use Turbopack and modern bundling**
- Prefer Turbopack (or the default modern bundler) for local dev and builds; avoid custom Webpack-only plugins for new projects.  
- Keep imports and side effects clean to enable better tree-shaking and code splitting.

4. **Co-locate logic by layer**
- Keep server-only code (database access, secrets) in server components, route handlers, or server utilities, never in client components.  
- Mark client components explicitly (`"use client"`) and keep them focused on interactivity and view logic.

---

## Python: Pydantic v2 rules

1. **Use Pydantic v2 APIs and `BaseModel` patterns**
- Use the new v2 configuration and validators (`model_config`, `field_validator`, `model_validator`) instead of v1-style decorators.  
- Prefer type-hinted `BaseModel` fields and avoid dynamic `dict`-style models for domain data.

2. **Lean on the standard library typing**
- Use standard types (`list`, `dict`, `typing.Annotated`, `Literal`, `Union`/`|`, `TypedDict`) with Pydantic integration for validation.  
- Use `Annotated` for constraints (e.g., min/max length) instead of custom validators whenever possible.

3. **Strictness and parsing**
- Prefer strict types (e.g., strict integers, strict booleans) where accepting coercions might hide bugs.  
- Use `model_validate` and `model_dump` consistently for input parsing and output serialization.

---

## Python: FastAPI latest patterns

1. **Use async-first endpoints and dependency injection**
- Declare endpoints `async def` unless there is a concrete reason not to, and keep blocking I/O in thread pools or background tasks.  
- Model inputs/outputs with Pydantic v2 models, keeping request/response schemas explicit and versioned.

2. **Structure applications modularly**
- Split routers by domain (e.g., `users`, `orders`), and register them in a central app.  
- Use dependency injection for DB sessions, authentication, and configuration instead of global state.

3. **Security and performance**
- Use standardized security dependencies for auth (OAuth2, JWT) rather than ad‑hoc header parsing.  
- Enable HTTP/2 where supported and configure uvicorn/gunicorn workers appropriately; avoid heavy work in request handlers.

---

## Rust rules (async, Tokio, perf)

1. **Use async/await with modern runtimes**
- Use `async fn` and `await` pervasively for I/O-bound work instead of manual futures chaining.  
- Use Tokio (or another modern runtime) with structured concurrency (tasks, `JoinHandle`s) and avoid spawning unbounded background tasks without cancellation.

2. **Ownership, borrowing, and ergonomics**
- Prefer passing references and slices instead of cloning large structures; only clone when necessary and explicit.  
- Use `Result` and `?` for error handling, and define domain-specific error types instead of `String` or `Box<dyn Error>` everywhere.

3. **Performance best practices**
- Avoid unnecessary allocations; use `&str`, slices, and `SmallVec`-style optimizations where appropriate.  
- Benchmark with `cargo bench`/`criterion` before micro-optimizing, and profile hot paths; avoid unsafe code unless there is a demonstrated need and it is well-audited.

---

## Go rules (modules, generics, concurrency)

1. **Use Go modules and semantic versioning correctly**
- Always use modules (`go.mod`) and semantic versioning for libraries; avoid `replace` hacks in production.  
- Keep module paths stable across major versions, and use separate module paths for breaking changes (`v2`, `v3`, etc.).

2. **Use generics thoughtfully**
- Use type parameters for collections, utilities, and reusable algorithms where it increases safety and reduces duplication.  
- Keep generic constraints simple and readable; do not over-abstract when a concrete type is clearer.

3. **Concurrency best practices**
- Use goroutines with clear ownership and lifetimes, tied to `context.Context` for cancellation.  
- Use channels for coordination, not as generic “queues” everywhere; prefer mutexes or atomics where they better express intent.

4. **Error handling and API design**
- Return `error` as the last value and check it immediately; avoid panics for expected failures.  
- Design small, focused interfaces; accept interfaces, return concrete types.

---

## How to apply this

When coding in any of these stacks:

- Turn on strictness and let the type system (TS, Pydantic, Rust, Go generics) guide designs.  
- Prefer modern, framework-endorsed patterns (React Server Components/Actions, Next.js App Router, async Rust/Tokio, async FastAPI) over legacy APIs.  
- Keep boundaries explicit: server vs client, sync vs async, domain types vs transport types.