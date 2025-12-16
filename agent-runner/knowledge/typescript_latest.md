For a 2024/2025 codebase, treat **TypeScript ≥5.5+** as baseline and enforce a “types-first, JS-last” stance. Below are **non‑negotiable rules** organized by theme.

---

### 1. Toolchain & Project Configuration

- Use **`"strict": true`** in `tsconfig.json` and do not disable sub‑flags except with a written rationale in the repo. Common strict flags that must remain on:
  - `strictNullChecks`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`
  - `noImplicitOverride`, `noPropertyAccessFromIndexSignature`
- Target **ESNext** or at least a modern baseline (e.g. `target: "ES2022"`), and use `module: "NodeNext"` or `"ESNext"` depending on runtime.[4]
- Maintain **separate configs**:
  - `tsconfig.base.json` for shared compiler options
  - `tsconfig.app.json`, `tsconfig.test.json`, `tsconfig.build.json` extending base
- Enable **incremental + composite** for large monorepos:
  - `"incremental": true`, `"composite": true`, `"declaration": true`, `"declarationMap": true`
- Use **project references** for multi‑package repos instead of path hacks; prefer `paths` over relative import chains.[4]

---

### 2. Type System Usage Rules

- **Never use `any`** in new code; if unavoidable for interop, isolate it behind:
  - narrow typed façade (`unknown` → parsed/validated type)
  - well‑documented `// TODO: eliminate any` with ticket reference.[1][7]
- Prefer **`unknown` over `any`** at trust boundaries (IO, JSON, 3rd‑party APIs), and immediately refine via:
  - user‑defined type predicates
  - schema validators (e.g. Zod, Pydantic‑style validation libs) to return typed values.
- Use **type inference** aggressively for locals and returns when obvious; use explicit annotations only for:
  - public APIs (exported functions, classes, types)
  - complex generic functions where inference is non‑obvious.[1][7]
- Prefer **`type` aliases + utility types** for data modelling; use **`interface`** only when you need:
  - declaration merging
  - extension in consumer code.
- Use **modern utility types** to express transformations instead of writing ad‑hoc helpers:
  - `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `ReturnType`, `InstanceType`
  - mapped types with key remapping and modifiers (`+readonly`, `-?`).
- Use **template literal types** for string protocols (event names, route keys, CSS vars, tag unions).[1]
- Use **conditional types** + inference in helpers, but keep them readable; avoid type‑level Turing‑complete constructs for business logic.[1]

---

### 3. Latest TypeScript 5.x Features (Adoption Rules)

Track the official TS blog and enable **new language features as they stabilize**.[8]

- Use **decorators** only via the standardized 2023 decorator model (no legacy `experimentalDecorators` in new code).
- Prefer **`satisfies`** for constraining object literals without widening or losing literal information.
- Adopt newer control‑flow / narrowing improvements:
  - exhaustive `switch` with `never` checks on discriminated unions
  - `in` checks and optional property handling, avoiding pervasive `!` non‑null assertions.
- Where available in your TS minor version, use:
  - **`using` / `Disposable`** patterns for deterministic cleanup only behind runtime support.
  - New **`import type` / `export type`** consistently to separate type‑only imports and avoid runtime cycles.

---

### 4. Runtime Interop & Modules

- Use **ESM** as default; avoid legacy `require` in TypeScript sources.
- For Node:
  - Use `"moduleResolution": "node16"` or `"nodenext"` with `"module": "NodeNext"`.[4]
  - Prefer **`node:`**-prefixed core module imports (`import fs from "node:fs"`).
- For browser/tooling:
  - Ensure bundler (Vite, Turbopack, webpack) is configured to respect `tsconfig.paths` and TS module resolution semantics.
- Do not rely on TS‑only constructs at runtime; maintain **runtime equivalents** for:
  - enums (prefer `as const` objects + union types instead of `enum`)
  - reflection assumptions (no type metadata without explicit runtime data).

---

### 5. Strict Nullability & Control Flow

- Treat **`null` and `undefined` explicitly**:
  - avoid unioning them casually (`string | null | undefined`) except at boundaries
  - normalize internally (e.g. choose `null` only, or `undefined` only) and convert at edges.
- Disallow global non‑null assertions (`!`) except:
  - in narrow scopes with preceding guards
  - in integration “glue” code with strong invariants and comments.
- For discriminated unions:
  - always pattern‑match with exhaustive `switch`
  - use `assertNever` helper:
    ```ts
    function assertNever(x: never): never {
      throw new Error(`Unexpected: ${x}`);
    }
    ```

---

### 6. Code Organization & API Design

- Enforce **clear layering**:
  - domain types & services (no framework imports)
  - adapters (HTTP, DB, message bus), then
  - UI/transport layers (React, Next.js, etc.).
- All **public exports must be typed** and stable:
  - no leaking of framework‑specific internals in domain layer signatures.
- Prefer **functional style** for stateless logic; minimize mutation:
  - mark fields `readonly` where applicable
  - avoid sharing mutable objects across async boundaries.

---

### 7. Documentation & DX

- Use **TypeDoc** (or similar) to auto‑generate **API docs directly from TypeScript types and JSDoc**.[3][1]
- Standardize on **TSDoc‑style** comments for public APIs to keep docs tool‑friendly.[3]
- In PRs:
  - any new exported symbol must have type annotations + TSDoc
  - any changed externally visible type must mention breaking/behavioral changes in the changelog.

---

### 8. Testing & Types

- Maintain a **type‑test suite**:
  - use `tsd`, `expect-type`, or similar to lock down important public type behavior.
- Treat all **type errors as build failures** in CI:
  - `tsc --noEmit` (or equivalent) must be part of the pipeline.
- Do not use `// @ts-ignore` except with:
  - local scope
  - explicit reason and issue link
  - prefer `// @ts-expect-error` so obsolete suppressions fail builds.

---

These rules should be codified in a **TypeScript style guide** and enforced via `tsconfig`, ESLint (`@typescript-eslint`), and CI so that no type‑unsafe or non‑strict code is merged.