**Node.js coders MUST upgrade to v24 (latest as of 2025) or v22 LTS (Maintenance until Oct 2025), avoiding EOL versions like v21.[4][5]**

### Breaking Changes (Migrate from v22+ per official guide[3])
- **llhttp 9.1.2 strict mode default**: Rejects malformed HTTP data with errors (no auto-fixes); test servers for malformed inputs to prevent crashes.[1]
- **Legacy URL parser removed**: Use default llhttp parser only.[2]
- **crypto.createCipher()/createDecipher() deprecated**: Replace with secure `createCipheriv()`/`createDecipheriv()` variants immediately.[2]
- **process.exit() in worker threads deprecated**: Use `worker.terminate()`.[2]
- **node:module namespace cleanup**: Update imports relying on internal restructuring.[2]

### New Features (Leverage in v24)
- **Global URLPattern API**: Use `new URLPattern({ pathname: '/users/:id' })` without imports for routing/pattern matching.[2]
- **Mature permission model**: Run with `--allow-net=domain` or `--allow-fs=/path` to sandbox deps (e.g., `node --allow-net=api.example.com app.js`).[2]
- **Stable Fetch API & WebStreams**: Use `fetch(url).body.getReader()` for streaming HTTP data natively.[1]
- **Undici 7.0 HTTP/2 & HTTP/3**: Built-in via fetch; no extra deps for efficient APIs.[2]
- **Test runner upgrades**: Parallel execution default, watch mode (re-runs changed tests), 40% faster runs.[2]
- **npm v11**: Lockfile v3, auto-cleanup unused deps, monorepo support, smarter resolution.[2]
- **V8 13.6 & performance**: Optimized streams (less validation/scheduling), combined HTTP chunking, smarter GC (fewer pauses).[1][2]

### Best Practices (2024/2025)
- **ESM transition**: Prefer ESM (`import`/`type: "module"`); `require()` ES modules now stable in v22+.[6]
- **Security**: Always use permission flags for untrusted code; strict mode prevents HTTP attacks.[1][2]
- **Testing**: Rely on built-in runner (`node --test`); enable watch (`--watch`) and parallel for CI speed.[2]
- **Performance**: Use multi-core streams/WebAssembly; benchmark V8 gains for high-load apps.[1]
- **Dependency mgmt**: Leverage npm v11 workspaces/lockfile v3; audit for deprecated crypto APIs.[2]
- **Migration**: Follow official v22→v24 codemods; test streams/HTTP strictly post-upgrade.[3]

**Verify app with `node --test` and permission flags before prod deploy.[2][3]**