Here is a compact “must follow” rule set, grouped by stack. It is opinionated and assumes you are targeting 2024/2025-era tooling.

---

## Next.js 15/16 rules

- Treat all request-bound APIs as async only (`cookies()`, `headers()`, `draftMode()`, `params`, `searchParams`, etc.); always `await` them inside server components, route handlers, and metadata functions.  
- Adopt the new caching model: be explicit with `fetch` cache options, tag-based revalidation, and any higher-level cache helpers; never rely on legacy implicit caching semantics.  
- Use Turbopack as the default bundler; keep custom Webpack configs minimal and plan to migrate any non-trivial loader/plugin logic to Turbopack-compatible equivalents.  
- Prefer the App Router with server components for all new routes; use server actions for mutations and avoid `api/` routes unless you truly need a separate HTTP API surface.  
- Treat middleware as legacy and move cross-cutting network logic (auth, rewrites, proxies) to the new proxy-style / boundary mechanisms when available in your version.  
- Make routing and layouts “cache-aware”: design layouts that can be shared and prefetch-friendly, avoid overly nested client components that defeat streaming and prefetch optimizations.  
- Always provide `default` slots for parallel routes when required by your version, and keep route conventions (sitemaps, metadata, image routes) updated to the latest async signatures.

---

## React 19-era rules

- Prefer React Server Components when supported by your framework; keep client components as small leaf nodes responsible only for interactivity.  
- Use Server Actions for mutations instead of client-side data posting where possible; treat them as part of your data layer and centralize validation/authorization there.  
- Use `useFormStatus` and related helpers for in-flight UI states when wiring forms to server actions; never hand-roll status flags when the framework provides them.  
- Avoid legacy patterns like `useEffect`-driven data fetching for initial render; use framework-level data fetching primitives and server components instead.  
- Keep components pure and props-driven; avoid global mutable singletons in React land, preferring context or framework-level dependency injection.

---

## Python: Pydantic v2 & FastAPI

- Use Pydantic v2 models and validators only; avoid legacy v1-style `@validator` usage in new code and migrate to the v2 pattern (e.g., `field_validators`, `model_validators`).  
- Configure Pydantic v2’s serialization and validation settings explicitly (e.g., strict modes, `from_attributes`) rather than relying on defaults.  
- In FastAPI, type everything: request bodies, responses, dependencies, and path/query params with proper Pydantic models and standard Python types.  
- Use async endpoints by default (`async def`) and ensure that I/O inside them is also async; never block the event loop with CPU-heavy or sync I/O.  
- Centralize configuration, security, and observability (logging, metrics, tracing) via dependency injection rather than ad-hoc globals.  
- Use background tasks, lifespan events, and dependency overrides for cross-cutting concerns (open/close DB connections, caches, etc.).

---

## TypeScript latest rules

- Always enable strict mode (`strict: true`) and treat all type errors as build-breaking; no `skipLibCheck` unless you have an explicit, documented exception.  
- Avoid `any`; prefer `unknown` plus proper narrowing or generics; if `any` is unavoidable, confine it to well-documented boundaries.  
- Use modern type features (e.g., satisfies operator, template literal types, discriminated unions, `infer` in conditional types) to encode invariants in the type system instead of runtime checks when practical.  
- Maintain strict null checking: never assume values are present without explicit checks or provable invariants.  
- Export reusable types for API contracts and domain objects, and use them end-to-end (backend, frontend, tests) to prevent type drift.  
- Prefer `as const` and readonly types for configuration-like data to avoid accidental mutation.

---

## Rust (async, Tokio, perf)

- Use async Rust with Tokio (or your chosen runtime) consistently; do not mix blocking I/O with async code except behind explicit `spawn_blocking`-style isolation.  
- Structure async code around clear boundaries: top-level `main` sets up the runtime; services and handlers expose async functions; avoid deeply nested `.await` in business logic by factoring into smaller async helpers.  
- Use structured concurrency patterns (e.g., `select!`, cancellation, timeouts) rather than unbounded tasks that live “forever”.  
- Favor zero-cost abstractions: avoid unnecessary heap allocations (e.g., `String` vs `&str`) and cloning; use borrowing where possible.  
- Use `#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]` and similar traits as needed for core types; implement `Send`/`Sync` expectations via type choices rather than `unsafe`.  
- Benchmark and profile critical paths; prefer simple, predictable code over clever tricks unless measurements prove the need.

---

## Go (modules, generics, concurrency)

- Use Go modules exclusively; each repository is a module with semantic versioning and tidy `go.mod` / `go.sum`; never vendor manually unless policy demands it.  
- Apply generics sparingly and only where they reduce duplication without harming clarity (e.g., repository helpers, utility data structures); avoid over-abstracting business logic.  
- Treat goroutines as a managed resource: always have a clear ownership and cancellation strategy (contexts, wait groups) and avoid fire-and-forget unless truly one-shot.  
- Pass `context.Context` as the first parameter to any function that does I/O, RPC, or significant work; always honor cancellation and deadlines.  
- Use channels for coordination, not as general-purpose queues when a simpler mutex or atomic variable would suffice.  
- Keep packages small and cohesive; avoid cyclic dependencies and keep public APIs minimal and well-documented.

---

## Cross-stack “musts”

- Prefer explicitness over magic: configuration and behavior should be discoverable from code and documented conventions.  
- Enforce formatting, linting, type-checking, and tests in CI; no merging with failing static checks.  
- Treat deprecations and breaking-change notes in release docs as hard requirements; update patterns proactively rather than leaving compatibility shims in place.