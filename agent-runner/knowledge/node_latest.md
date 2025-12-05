Here is a concise, opinionated rule set you can drop into a team “engineering standards” doc. It focuses on Node.js and then adds the language/framework rules you asked for.

## Node.js runtime rules

- Target active LTS or latest current (Node 22+ / 24+) only; do not support EOL majors.  
- Use native ESM (`"type": "module"`) for all new services; treat CommonJS as legacy and isolate behind adapters.  
- Use the built‑in `fetch`, Web Streams, WebSocket client, `URL`, and `URLPattern`; do not pull `node-fetch`, `axios`, or custom URL parsers unless you have a hard requirement.  
- Turn on the permission model in production (`--experimental-permission` / newer flags as available) and explicitly scope FS, child process, and network access; no service runs with full system access.  
- Prefer the built‑in test runner (`node:test`) over external test frameworks for unit/integration tests unless a specific missing feature is documented.  
- Treat all deprecated core APIs as forbidden; add lint rules or codemods to block them and replace legacy crypto, legacy URL parser, and old HTTP parser usage.  
- Default to HTTP/2+ capable clients/servers where supported; validate that your HTTP stack is using the modern parser and Undici‑based client.

## Next.js (v15/v16 style) rules

- Prefer the app router and React Server Components for new routes; do not create new pages in the old pages router.  
- Use the new async Request APIs (`request`, `Response`, `headers`, `cookies`) in route handlers; avoid legacy `NextApiRequest` / `NextApiResponse` in new code.  
- Treat data fetching as server‑first: use server components and route handlers for async data, and keep client components lean.  
- Make caching explicit with the new caching primitives (`revalidate`, `cache`, route segment config); do not rely on implicit caching semantics.  
- Use Turbopack (or the recommended bundler for the current major) in dev by default; only fall back to Webpack if a blocking issue is documented.

## React (v19 style) rules

- Treat React’s server features as first‑class: use Server Components and Server Actions where appropriate in frameworks that support them.  
- Use Server Actions for mutations and form handling instead of ad‑hoc fetch calls from the client when the framework supports it.  
- Use `useFormStatus` (and related hooks) to wire form pending/error UI; do not reimplement loading flags with ad‑hoc local state when using Server Actions.  
- Avoid legacy patterns (UNSAFE lifecycle methods, string refs, context misuse); use modern hooks, context, and suspense patterns only.

## Python: Pydantic v2 & FastAPI

- Use Pydantic v2 only for new services; do not introduce new Pydantic v1 models.  
- Rely on Pydantic v2’s new validation and serialization APIs (`model_validate`, `model_dump`, etc.); avoid deprecated v1 aliases and behaviors.  
- In FastAPI, use type‑hint‑first design: path/query/body models are Pydantic v2 models or builtin types, and every endpoint is fully annotated.  
- Use async def endpoints and async database/drivers by default; synchronous endpoints must be explicitly justified.  
- Centralize settings/configuration in Pydantic `BaseSettings` (v2 style), wired through environment variables; no ad‑hoc `os.getenv` scattering in business logic.

## TypeScript rules

- Enable strict mode (`"strict": true`) and treat it as non‑negotiable for all new projects.  
- Enable modern strictness flags: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, etc.  
- Use `unknown` instead of `any`; `any` requires explicit justification and code review approval.  
- Prefer discriminated unions, template literal types, and `satisfies` to model complex domains rather than `string | number | …` catch‑alls.  
- Treat type‑only imports/exports correctly (`import type`) and ensure `verbatimModuleSyntax` and modern module resolution are enabled for ESM interop.  
- Do not use namespace/`/// <reference` style patterns in new code; prefer modules and project references.

## Rust & Tokio rules

- Use async Rust with Tokio for IO‑bound servers; do not mix multiple runtimes in a single binary.  
- Use `tokio::main` and structured tasks with `tokio::spawn`; avoid unbounded task spawning and ensure task lifetimes are explicit.  
- Use `tracing` (with structured fields) rather than ad‑hoc `println!` logging; propagate spans through async boundaries.  
- Prefer `async fn` plus `impl Trait` returns over boxing futures unless you have a specific performance or API reason.  
- Use `#[derive(Clone)]`/`Arc` for cheap shared state across tasks instead of global mutables; avoid `unsafe` unless reviewed and contained.  
- Keep `Send`/`Sync` correctness explicit at boundaries (e.g., in trait objects used across tasks) and avoid custom `unsafe impl` unless absolutely required.

## Go rules

- Use Go modules exclusively; no new GOPATH‑based projects.  
- Organize modules with clear boundaries; avoid giant mono‑module repos unless there is an explicit, agreed‑upon reason.  
- Use generics for reusable data structures and helper logic, but avoid over‑abstracting; prefer clear concrete APIs for most business logic.  
- Use `context.Context` in all public APIs that may block (IO, RPC, DB); cancellations and timeouts must propagate through goroutines.  
- Treat goroutine ownership as explicit: every spawned goroutine must have a clear lifetime and cancellation path; no fire‑and‑forget without justification.  
- Prefer channels and structured worker patterns over ad‑hoc global state; but when simple, prefer mutexes/RWMutex over “clever” channel architectures.  

These are “must‑follow” defaults: deviations should be rare, documented, and code‑reviewed.