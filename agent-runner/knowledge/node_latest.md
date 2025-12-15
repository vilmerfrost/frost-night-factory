Here are **mandatory rules** you should follow for **Node.js in 2024/2025**, distilled from the latest docs and migration notes for v22–v24.[3][8][1][2]

---

### 1. Versioning, support, and runtime assumptions

- Target **Node 22+ for production**; treat anything below 20 as legacy, and plan migration paths to ≥22 now.[8]  
- When adopting **Node 24**, validate all build pipelines, native addons, and CI images against its **breaking changes** (especially on Windows and deprecated APIs).[2][3]  
- Assume **V8 13.6+** features (e.g. `Float16Array`, `RegExp.escape`, explicit resource management) are available when on Node 24.[1][2]  

---

### 2. Security & permissions

- For Node 24, **enable and lock down the permission model in production**; default to *deny* and whitelist only what is required:[1]  
  - Use `node --allow-fs-read=...`, `--allow-fs-write=...`, `--allow-net=...`, etc., in runtime scripts.  
  - Treat any library that needs filesystem or network access as **least-privilege**; never run with fully open permissions in multi-tenant or untrusted-plugin scenarios.[1]  

---

### 3. HTTP, networking, and URL APIs

- Standardize on **Undici 7+** (`globalThis.fetch`, `undici` HTTP client) as the default HTTP stack for all new code in Node 22–24.[1][2]  
- Remove any reliance on the **legacy HTTP parser**; rely on the default `llhttp`-based implementation only.[1]  
- Do **not** use `url.parse`; migrate to the **WHATWG URL API** (`new URL()`, `URLSearchParams`).[2]  
- Use **global `URLPattern`** instead of polyfills or conditional imports; Node 24 exposes it globally, matching modern browsers.[1]  

---

### 4. Crypto and TLS

- Remove all usage of **deprecated crypto APIs**, including `crypto.createCipher()` and `crypto.createDecipher()`; use the `createCipheriv`/`createDecipheriv` family or higher-level libs instead.[1]  
- Remove any usage of **`tls.createSecurePair`**; replace with modern TLS APIs (`tls.connect`, `tls.TLSSocket`, etc.).[2]  

---

### 5. Testing and diagnostics

- Use the **built-in test runner (`node:test`) as the project default** unless you have critical Jest/mocha features you cannot yet replicate.[1]  
  - Rely on **parallel test execution** and watch mode to keep suites fast; avoid ad hoc concurrency handling inside tests unless strictly necessary.[1]  
- For Node 24+, configure CI to **run tests in parallel by default** and examine runner output for flaky-test patterns (racy globals, unawaited promises, etc.).[1]  

---

### 6. Performance, memory, and resource management

- For performance-sensitive or long-running services on Node 24, **use new explicit resource management APIs** (e.g., `using` blocks/finalization) where available to avoid leaks and reduce GC pressure.[2]  
- For numeric-heavy workloads (ML, analytics, graphics), prefer **`Float16Array`** and other new typed arrays when reduced precision is acceptable, to cut memory footprint and improve throughput.[2]  
- Treat GC pauses and memory spikes as configuration/code issues, not “normal” behavior; profile allocations and consider streaming, backpressure, and pooling as first-class design constraints.  

---

### 7. Build, native modules, and tooling

- On Windows, **build Node 24 and native addons with ClangCL, not MSVC**; update all build scripts, `binding.gyp`, and CI images accordingly.[2]  
- For internal tooling, assume **npm 11** behavior in Node 24:  
  - Respect **lockfile v3** semantics; never hand-edit lockfiles.[1]  
  - Design monorepos around **npm workspaces** and their parallel-execution model instead of ad hoc scripts.[1]  
  - Treat npm’s **dependency impact analysis and advanced caching** as required for CI performance; no custom caching that fights npm’s own cache.[1]  

---

### 8. Deprecations and migration rules

- Before moving to Node 24, **run official codemods and deprecation checks for v22→v24** and fix all listed issues.[3]  
- For any deprecated API in the v22→v24 migration guide, enforce **“no new usages”** via ESLint/TypeScript rules and gradually remove all existing call sites.[3]  
- Explicitly test:  
  - Core modules that interacted with the removed/changed Windows toolchain.[2]  
  - Any code that previously depended on legacy URL or crypto behavior.[2][1]  

---

If you specify that you’re targeting **Next.js / React / Python / TypeScript / Rust / Go**, I can give a similarly strict “MUST follow” rule set for that stack at Node-runtime boundaries (SSR, tooling, monorepo layout, etc.).