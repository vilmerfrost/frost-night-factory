Below are **non‑negotiable rules** you should follow when targeting **latest Node.js (v22–v24, npm 11)** as of 2024/2025.

---

## 1. Runtime & Language Baseline

- Target **Node.js ≥ 22 (prefer 24 for new projects)** and ensure CI runs on the same major line.[3][4]  
- Assume **V8 ≥ 13.x**: you can rely on:
  - **Top‑level await**, `import`/ESM, `WeakRef`, `FinalizationRegistry`, `Intl` updates, etc.[6]  
- Treat **CommonJS as legacy plumbing**:
  - New libraries: **export ESM first**, provide CJS only via **dual packages** with `"exports"` conditions.
  - Use `"type": "module"` per package; avoid mixed CJS/ESM in the same file.

---

## 2. Module & Package Rules

- Always define an explicit `"exports"` map in `package.json`; **never rely on deep imports** into `dist/*`.[6]  
- Use **conditional exports** for environment‑specific builds:
  - `"import"`, `"require"`, `"node"`, `"default"` conditions.
- Avoid `require()` of ESM from CJS except where Node 22+ officially supports `require()`ing ES modules.[6]  
- Prefer **`node:` specifiers** (e.g. `node:fs`, `node:crypto`) for core modules to avoid shadowing and improve tooling.[6]  

---

## 3. Network, HTTP & Fetch

- Prefer **global `fetch`, `Request`, `Response`, `Headers`, WebStreams** instead of `node-fetch` or legacy HTTP libs.[2][6]  
- Use **Undici**‑backed APIs (built‑in) for HTTP:
  - No new usage of `http.request`/`https.request` unless you have low‑level needs.[1][2]  
- Enable/expect **HTTP/2/HTTP/3** where supported via Undici 7+; avoid bespoke HTTP/2 clients.[1]  

---

## 4. Permissions & Security

- When running untrusted or semi‑trusted code, enable the **Node permission model**:
  - Use `node --experimental-permission --allow-fs=./data --allow-net=api.myservice.com app.js` style flags.[1][3]  
  - Always **default‑deny**; explicitly allow only required **fs**, **net**, **child_process**, **worker** capabilities.[1]  
- Remove/ban deprecated and unsafe crypto:
  - Do **not** use `crypto.createCipher()` / `crypto.createDecipher()`; use authenticated encryption (`createCipheriv`, AEAD) only.[1][3]  
- Assume **llhttp strict mode** semantics in HTTP parsing; do not depend on lenient handling of malformed HTTP.[2]  

---

## 5. Deprecations & Removals to Avoid

- Legacy URL parser and related APIs are **gone**:
  - Only use **WHATWG `URL`**; no `url.parse()`.[1][3]  
- Do not use deprecated HTTP parser or flags; rely on Node’s **default `llhttp`** parser.[2]  
- In worker threads, avoid `process.exit()`; use **`worker.terminate()`** or cooperative shutdown.[1]  
- Plan for removal of **old crypto APIs**; enforce lint rules to ban them.[1][3]  

---

## 6. Testing & Tooling

- Use the **built‑in Node test runner (`node:test`)** for new codebases:
  - Parallel execution is **on by default**; tests must be written to be **process‑ and file‑system‑isolated**.[1][2][3]  
  - Use **test concurrency controls** (e.g. `--test-concurrency`) where resource contention exists.[3]  
- Prefer **watch mode** via Node’s test runner for local dev; rely on its **affected test detection** instead of DIY file watchers.[1]  
- Keep test files ESM where the app is ESM; avoid mixing module formats in tests.  

---

## 7. Performance & Concurrency

- Assume **multi‑core** usage:
  - Heavy CPU work should be moved to **Worker Threads** or offloaded to native/WebAssembly modules.[2]  
- Use **optimized streams** and WebStreams:
  - Do not re‑implement buffering/flow control; rely on Node’s improved stream scheduling.[2]  
- Leverage **combined HTTP chunking**:
  - When streaming responses, structure writes as **meaningful chunks** but let Node handle coalescing; avoid micro‑writes in tight loops.[2]  

---

## 8. npm & Workspace Practices (npm 11)

- Use **lockfile v3** and commit it; never disable lockfile usage in CI.[1]  
- For monorepos:
  - Use **npm 11 workspaces** over ad‑hoc scripts or third‑party wrappers where possible.[1]  
  - Run commands via workspace‑aware npm (`npm run <script> -w <pkg>`); avoid custom invokers.  
- Avoid `npm link`/global linking in CI; use workspaces + `file:` or proper versioned packages.  
- Periodically run **dependency impact analysis** (npm 11 feature) and remove unused deps; do not keep unused or transitive‑only packages in `dependencies`.[1]  

---

## 9. Observability & Ops

- Use structured logging (`JSON`) with stable field names; avoid ad‑hoc `console.log` in production paths.  
- Rely on **diagnostic reports, heap snapshots, and perf hooks** built into Node for performance investigation instead of 3rd‑party native profilers as default choice.  
- For long‑running services:
  - Enforce **unhandled rejection** and **uncaught exception** policies (either terminate and let orchestrator restart or central error handler); never silently ignore.  

---

## 10. Migration‑Specific Rules (v22 → v24)

When upgrading existing services:

- Run the official **v22→v24 migration checks and codemods** where available.[3]  
- Enable **deprecation warnings in CI** and fail builds on new runtime deprecations until code is updated.  
- Explicitly test:
  - URL handling (legacy vs WHATWG).  
  - Crypto flows (replacement of deprecated APIs).  
  - Worker lifecycle (no `process.exit()` inside workers).  

These rules are aimed at **green‑field or actively‑maintained backends** on modern Node; legacy compatibility code should be quarantined and clearly labeled.