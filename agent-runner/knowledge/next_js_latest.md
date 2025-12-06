Next.js 15/16, React 19, Pydantic v2/FastAPI, and recent Rust/Go patterns all push toward “async by default”, stricter typing, and explicit caching/boundaries. Below are concise rules you can treat as a checklist.

## Next.js 15/16 rules

- Treat cookies, headers, draftMode, route params, searchParams, layout/page/route/generateMetadata/generateViewport params as async-only in v16; always `await` the Request APIs and do not rely on synchronous access anywhere in the App Router.[2][4]  
- Assume Turbopack is the default bundler; do not depend on Webpack-only plugins and config unless you explicitly opt out (`next build --webpack`).[2][6]  
- Use the new caching semantics: configure caching through `fetch` options and Next.js cache APIs instead of ad‑hoc `Cache-Control` headers, and update any code that assumed older default revalidation behavior.[3][4]  
- For routing: provide explicit `default.js` for every parallel route slot, rely on layout deduplication and incremental prefetching, and design links so that prefetching benefits you (stable routes, avoid unnecessary dynamic segments).[2][4]  
- For images: configure `images.localPatterns` if you use local `next/image` sources with query strings, and assume more aggressive and longer TTL defaults; don’t rely on ultra-short image cache TTLs.[2]  
- Prefer Cache Components / PPR-style patterns and cache-aware components instead of manual “fetch in client” data loading for performance-sensitive navigation paths.[2][4]  

### Next.js versions/table

| Area         | Must-follow rule (15/16) |
|-------------|---------------------------|
| Request APIs | Always async; no sync access. [3][4] |
| Bundler      | Turbopack by default; avoid Webpack-only assumptions. [2] |
| Caching      | Use new fetch/cache APIs, not legacy implicit semantics. [3][4] |
| Routing      | Explicit `default.js` for all parallel slots; design for incremental prefetch. [2][4] |

## React 19 rules

- Use Server Actions as first-class primitives for mutations; keep them small, colocated with forms or components, and avoid exposing sensitive logic to the client boundary.[3]  
- Use `useFormStatus` for UX around pending/submitting states instead of ad‑hoc local state flags driven by manual promises.[3]  
- Treat React 19’s stricter semantics (e.g., around async/await in components and effects) as required: avoid side effects during render and keep all mutation inside actions, event handlers, or effects only.[3]  

## Python (Pydantic v2, FastAPI) rules

- For new code, use Pydantic v2-style models and validation (`BaseModel` v2, `model_validate`, `field_validator`/`model_validator`) and avoid deprecated v1 validators; configure FastAPI to use Pydantic v2 if upgrading.[3]  
- Treat models as primarily type/validation layers; keep heavy logic and I/O out of Pydantic validators and instead put it in service layers called from FastAPI endpoints.  
- Use `Annotated` types, `typing` standard-library types (e.g., `list[str]`, `dict[str, Any]`) and async def route handlers for all I/O-bound endpoints; avoid sync DB or HTTP clients inside FastAPI request paths.  

## TypeScript latest rules

- Enable strict mode (`"strict": true`) and related flags (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, etc.) for all production projects; treat type errors as build failures.  
- Prefer `satisfies` for object literals and inferred types, `as const` for fixed literals, and modern utility types (e.g., `ReturnType`, `Awaited`, template literal types) to remove `any` and reduce manual casting.  
- Use discriminated unions instead of enums for flexible domain modeling, and avoid ambient global types unless you are in a dedicated `.d.ts` file.  

## Rust async/tokio rules

- Use Rust async with a single runtime (typically `tokio`) per process; avoid mixing runtimes or blocking the async executor (e.g., no heavy CPU inside `async` without `spawn_blocking`).  
- Prefer structured concurrency: use `tokio::task::JoinSet`/`join!`/`try_join!` over ad‑hoc detached tasks, and wire cancellation via dropping tasks or using timeouts.  
- Use `&[u8]`, `Bytes`, and `Pin<Box<dyn Future<Output = _> + Send>>` patterns rather than bespoke unsafe performance tricks unless you have benchmarks that justify them.  

## Go modules, generics, concurrency rules

- Always use Go modules, semantic versioning, and minimal version selection; avoid GOPATH-era assumptions and pin dependencies via `go.mod`/`go.sum`.  
- Use generics in libraries where they remove duplication (e.g., reusable data structures or helpers) but keep public APIs simple and avoid complex type parameter hierarchies in application code.  
- For concurrency, prefer context-aware goroutines (accept `context.Context` everywhere), use buffered channels cautiously, and ensure every goroutine has a clear lifetime and cancellation path to avoid leaks.