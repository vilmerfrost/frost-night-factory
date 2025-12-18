Here are **rules you MUST follow when writing Node.js in 2024/2025**, based on current Node 22+/24 docs and migration notes.[2][3][4][6][7]

---

### 1. Targeted Node versions / runtime assumptions

- **Target Node 22+ for new projects; plan migration to Node 24** as it becomes stable and LTS.[6][7]  
- **Assume ESM-first and Web‑platform APIs built in** (fetch, WebStreams, URLPattern, WebSocket client, test runner, etc.).[1][2][6]  
- **Do not support Node <18** unless explicitly required; many new features and security models depend on 18+.

---

### 2. Modules, packaging, and runtime features

- **Use ESM by default** (`"type": "module"` or `.mjs` files).  
  - Prefer `import` / `export` and **avoid new CommonJS code**.  
  - If you *must* interop with CJS, isolate it in compatibility layers.

- **Do not use legacy URL or HTTP parsers**:  
  - **Never use `url.parse()`** or other legacy URL APIs; they are deprecated/removed in Node 24.[2][3][4]  
  - Use the standard **`URL`** and **`URLPattern`** globals instead (no imports required in Node 24).[2]  

- **Use built-in Web APIs instead of polyfills**:  
  - Use global **`fetch`**, **`Request`**, **`Response`**, **`Headers`** for HTTP client calls.[1][2][6]  
  - Use **WebStreams** (WHATWG streams) for streaming, not legacy Node streams where possible.[1]  
  - Use the **built-in WebSocket client** from Node 22+ instead of external packages where feasible.[1][6]  

- Prefer the **`node:test`** built‑in test runner for new tests; avoid adding new frameworks unless justified.[1][2]

---

### 3. Permissions & security (Node 24+)

- **Opt into the Node 24 permission model for untrusted or plugin-like code.**[2][3]  
  - When running untrusted code, run `node` with explicit `--allow-*` flags (e.g. `--allow-fs`, `--allow-net=host`, etc.) and deny everything else.[2]  
  - Design CLIs and build tools such that they still work under restricted permissions:  
    - Avoid implicit filesystem scans outside project root.  
    - Make paths and network targets explicit, not discovered.

- **Stop using deprecated/weak crypto APIs**:  
  - **Do not use `crypto.createCipher()` / `crypto.createDecipher()`** or other legacy crypto APIs removed/deprecated in Node 24.[2][3]  
  - Use modern alternatives with IV/AEAD (`crypto.createCipheriv`, `subtle.crypto` where available).

---

### 4. HTTP client, HTTP parsers, and Undici

- **Use Undici-based HTTP client (built-in `fetch`) for all new HTTP calls**; do not introduce new usages of `request`/`http` legacy patterns unless you need low-level control.[2]  
- Be aware that **Node now uses `llhttp` in strict mode for HTTP parsing**; never rely on lenient parsing of invalid HTTP.[1][2]  
  - Validate and normalize any upstream services that previously depended on “forgiving” request parsing.

- For performance-sensitive HTTP clients:  
  - **Prefer Undici 7+** (bundled in Node 24) with HTTP/2/HTTP/3 support over third-party clients.[2]

---

### 5. Tooling: npm 11, workspaces, monorepos

- When on Node 24+, **standardize on npm 11+** and its new behaviors.[2]  
  - Expect **different dependency resolution** behavior vs npm 8/9; always commit lockfile.  
  - Use **lockfile v3** and do not downgrade lockfiles across toolchains.[2]

- For monorepos, **use native npm workspaces** instead of ad‑hoc tooling when possible.[2]  
  - Run cross-workspace commands via npm’s redesigned workspace manager.  
  - Rely on npm’s **built-in monorepo support and dependency impact analysis**; do not re-implement workspace graph logic.[2]

---

### 6. Deprecations / breaking changes to avoid

- **Node 24 removes or hard-deprecates several behaviors; DO NOT rely on them**:[2][3][4]  
  - **MSVC-based Windows builds are removed** – all Windows CI/build toolchains must use **ClangCL**.[3]  
  - Legacy HTTP parser is deprecated; do not depend on it.[2][3]  
  - `process.exit()` in worker threads is deprecated; use **`worker.terminate()`** instead.[2]  
  - Legacy `url.parse()` and other legacy URL/crypto APIs must not appear in new code.[2][3][4]

- For any **Node 22 → 24 migration**, you MUST:  
  - Run the official migration codemods where available.[4]  
  - Turn **`--trace-deprecation`** on in CI to surface remaining uses of deprecated APIs.

---

### 7. Performance & architecture expectations

- **Exploit V8 13.6+ improvements** by avoiding micro-optimizations that fight the engine.[3]  
  - Write idiomatic modern JS: `const`/`let`, `class`, `async/await`, `for..of`, `Map`/`Set`.  
  - Avoid nonstandard JS patterns or monkey‑patching globals that may deopt.

- For concurrency and scaling:  
  - Use **Worker Threads** for CPU-bound tasks; avoid `child_process` for pure compute.  
  - Use **`AbortController`** for cancellable async workflows (HTTP calls, timeouts, queues).  
  - Prefer **structured cloning** for worker message passing over custom serialization.

- For streaming and backpressure:  
  - Favor **WebStreams** or properly handled Node streams with explicit backpressure management.  
  - Never ignore `drain` events on writable streams or unbounded buffering.

---

### 8. Coding standards & lint-level constraints (Node-specific)

- **Assume strict mode and strict TypeScript configs for Node libraries** (when TS is used):  
  - No use of deprecated Node globals or modules.  
  - All filesystem/network/child-process operations must go through a thin abstraction that can be mocked and constrained by the permission model.

- **Error handling**:  
  - All top-level async code must be wrapped to avoid unhandled rejections; enable `--unhandled-rejections=strict`-compatible patterns.  
  - Never swallow errors in `process.on('uncaughtException')` or `'unhandledRejection'`; log and crash, or escalate appropriately.

If you tell me which of the other stacks (Next.js/React/Python/TS/Rust/Go) you are targeting in addition to Node, I can generate a unified “MUST follow” rule set across them.