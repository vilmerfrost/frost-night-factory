Use **TypeScript 5.6+ with `strict: true` as a non‑negotiable baseline** and treat the type system as the source of truth for your API surface and invariants.

---

### 1. `tsconfig` / strictness rules

The coder must:

- Enable **full strict mode** and keep it on for the entire codebase:
  - `strict: true`
  - Do not selectively disable `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess`, etc., except for very narrow legacy shims.
- Use **ESM** with modern module resolution:
  - `"module": "NodeNext"` or `"Bundler"` depending on toolchain.
  - `"moduleResolution": "NodeNext"` or `"Bundler"`.
- Target modern JS:
  - `"target": "ES2020"` or newer; lean on native async/await, `Promise.allSettled`, etc.
- Use incremental and composite builds for large repos:
  - `"incremental": true`, `"composite": true` for libraries and multi‑project setups.[4]
- Treat **`noEmit` + separate bundler** (tsup, esbuild, Vite, Turbopack) as the default for apps.

---

### 2. Type system usage rules

The coder must:

- **Avoid `any`**:
  - Prefer `unknown` at boundaries and refine via type guards.
  - If `any` is unavoidable, isolate it and document why.
- Prefer **type inference** over redundant annotations:
  - Let TS infer local variables and returns where obvious; annotate public APIs, exports, and boundaries.
- Use **`never`** to model impossible states and exhaustiveness:
  - Exhaustive `switch` on discriminated unions must fall through to `const _exhaustive: never = value`.
- Treat **discriminated unions** as the default for domain modeling:
  - Define tagged unions for state machines, API variants, and UI states.
- Use **`as const`** for literal types, configuration objects, and discriminants.
- Prefer **interfaces for object shapes**, **type aliases for unions, conditional types, mapped types**, and utility compositions.
- Avoid over‑nested types; introduce **named helper types** instead of unreadable inline mapped/conditional monstrosities.

---

### 3. Advanced / newer TS features to rely on

The coder must:

- Use **template literal types**, **key remapping in mapped types**, and **intrinsic string manipulation types** (`Uppercase`, `Lowercase`, etc.) for strongly typed keys and DSLs.[4]
- Use **satisfies** (TS 4.9+) for config objects:
  - `const config = { ... } satisfies SomeConfigSpec;` to keep narrow values but check shape.
- Use **`in` and control‑flow narrowing** aggressively:
  - Rely on TS’s *control flow analysis* instead of manual casts.
- Prefer **utility types** (`Partial`, `Pick`, `Omit`, `Record`, `Awaited`, `ReturnType`, `Parameters`, etc.) for transformation of models instead of re‑declaring shapes.[5][8]
- For async code:
  - Use `Awaited<T>` for promise unwrapping.
  - Strongly type async boundaries and handlers; never rely on `Promise<any>`.

---

### 4. Interop, libraries, and ecosystem

The coder must:

- For **JS interop**:
  - Use `.d.ts` or `declare module` shims with proper types; avoid `require`/CJS unless constrained.[4]
  - For JS codebases, use `// @ts-check` with JSDoc and progressively add `.d.ts` files.[4]
- For **library authors**:
  - Use `"declaration": true`, `"declarationMap": true`, `"stripInternal": true`.
  - Avoid exporting internal helper generics; keep public API minimal and documented.
- For **React/Next.js**:
  - Treat TS types as the canonical contract:
    - Strongly type `props`, `loader` data, `actions`, and server components.
    - Use `React.FC` only when you need `children` typed generically; otherwise use plain function components with typed props.

---

### 5. Error handling / safety rules

The coder must:

- Never throw or accept **untyped errors**:
  - In boundaries, type thrown/returned errors (e.g., `Result<T, E>` patterns).
- Use **narrow exception types** in wrappers and expose typed error unions to callers.
- Validate untrusted data at edges and **encode the result in types**:
  - Use schema validators (Zod, Valibot, etc.) with inferred TS types, or TS 5+ `satisfies` + runtime checks.

---

### 6. Project structure and maintenance

The coder must:

- Use **path aliases** via `baseUrl` / `paths` only when needed; keep them shallow and mirror physical layout.
- Keep **`tsconfig.json` minimal but strict**; avoid piling experimental flags without a concrete need.
- Enforce rules with **ESLint + `@typescript-eslint`**:
  - Ban `any` (with explicit escape hatches).
  - Enforce `no-floating-promises`, `no-misused-promises`, and consistent type import/export style.
- Regularly track **TypeScript release notes and breaking changes** from the official docs and blog, and upgrade with `--noErrorTruncation` CI runs to catch regressions early.[4][9]

These rules are intended as *must‑follow* constraints: deviations require a documented justification in code review.