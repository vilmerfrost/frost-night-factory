**Node.js 24 (latest as of 2025) mandates these rules for coders:**

### **Breaking Changes - MUST Update Immediately**
- Replace deprecated legacy URL parser with default **llhttp** parser; `url.parse()` is removed[2][3].
- Avoid `crypto.createCipher()` and `crypto.createDecipher()`; use secure `createCipheriv()`/`createDecipheriv()` equivalents[2].
- Deprecate `process.exit()` in worker threads; use `worker.terminate()`[2].
- On Windows: Switch builds to **ClangCL** (no MSVC support); update toolchains for faster builds and LLVM alignment[3].
- Remove `tls.createSecurePair()` and legacy HTTP chunking; adopt combined HTTP chunking for efficiency[1][3].
- Phase out internal `node:module` namespace and outdated APIs; run `node --check` before upgrading[2][4].

### **New Features - MUST Leverage for Performance/Security**
- Enable **permission model**: Run with flags like `node --allow-net=api.example.com --allow-fs=/safe/dir app.js` to sandbox dependencies[2].
- Use built-in **fetch/WebStreams** (stable), **WebSocket client**, and **Undici 7.0** for HTTP/2+HTTP/3 (no external deps)[1][2].
- Adopt **npm 11**: Leverage lockfile v3, workspace parallelization, auto-cleanup, and dependency impact analysis in monorepos[2].
- Utilize **V8 13.6** features: **Float16Array** for memory-efficient numerics (ML/graphics); faster startup/memory[1][2][3].
- Optimize streams: Fewer checks, smarter scheduling via Robert Nagy's updates[1].

### **Best Practices - MUST Follow in 2025 Code**
- Default to **ESM modules**; smoother transitions, no conditional imports for `URLPattern` (now global, cross-platform)[1][2].
- Test with enhanced runner: Multi-file runs, better coverage; use `node --test`[1][2].
- Secure with **llhttp 9.1.2 strict mode**: Rejects malformed web data to prevent attacks[1].
- Upgrade from v22: Use official codemods for migrations; check EOL (v22 Maintenance until Oct 2025)[4][5][8].
- Performance: Multi-core/WebAssembly, V8 optimizations; avoid deprecated crypto[1][2].

**Verify compatibility:** `nvm install 24 && node --version`; test thoroughly per [nodejs.org migrations][4].