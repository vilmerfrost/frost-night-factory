**Node.js 24 (latest as of late 2025) mandates these rules for production code:**

### **Breaking Changes - MUST migrate immediately:**
- Replace deprecated `url.parse()` and `tls.createSecurePair()`; use modern `URL` constructor and `tls.connect()` equivalents.[2][3]
- Remove legacy HTTP parser reliance; default `llhttp` parser is now enforced with strict mode enabled for security.[1][2]
- Avoid `process.exit()` in worker threads; use `worker.terminate()` instead.[2]
- Stop using insecure `crypto.createCipher()`/`crypto.createDecipher()`; migrate to `crypto.createCipheriv()`/`crypto.createDecipheriv()` with explicit IVs.[2]
- On Windows builds, MSVC compiler removed; require ClangCL toolchain (affects native module compilation).[3]
- Internal `node:module` namespace restructured; update imports relying on legacy module resolution.[2]
- Review v22-to-v24 migration guide for full codemods (e.g., ESM `require()` support changes).[4]

### **New Features - MUST leverage for performance/security:**
- Enable **permission model** with flags like `--allow-net=domain` or `--allow-fs=/path` to sandbox dependencies and prevent supply-chain attacks.[2]
- Use global **URLPattern API** without imports: `new URLPattern({ pathname: '/users/:id' }).test(url)` for routing/pattern matching.[2]
- Adopt built-in **test runner** with parallel execution by default: `node --test` for multi-core speedups and coverage reporting.[1][2]
- Integrate **Undici 7.0+** HTTP client (default fetch): supports HTTP/2, HTTP/3 natively for efficient API calls.[2]
- Utilize stable **fetch()** and **WebStreams** for streaming data: `const reader = response.body.getReader();` without polyfills.[1]
- Leverage **npm 11** workspace commands with parallelization, Lockfile v3, auto-cleanup, and dependency impact analysis in monorepos.[2]

### **Best Practices - MUST follow for 2025 compliance:**
- Target **Node.js 24 LTS** (post-v22 Maintenance LTS ending Oct 2025); avoid EOL versions like v21.[5][7]
- Default to **ESM modules** (`"type": "module"`); phase out CommonJS with top-level `await` and `require()` ESM support.[1][6]
- Optimize streams with combined HTTP chunking and reduced buffering for low-latency I/O.[1]
- Run with **V8 13.6+** features: faster startup, lower memory, WebAssembly acceleration.[1][2]
- Enforce **strict mode** (llhttp 9.1.2) to reject malformed HTTP data, preventing DoS vectors.[1]
- Update dependencies via npm 11's smarter resolution; audit for bundle size impacts.[2]
- For microservices/serverless: use enhanced WebSocket client and V8 updates for concurrency.[1][6]

**Upgrade path:** Test v22 → v24 via official codemods; benchmark streams/fetch for 20-50% perf gains.[1][4][8]