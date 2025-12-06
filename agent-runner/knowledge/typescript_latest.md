TypeScript’s latest documentation emphasizes strict type safety by default, modern module patterns, and avoiding legacy or non‑strict constructs.[4][8] A 2025 best‑practices focus is: turn on strict mode, lean on inference, avoid `any`, model data precisely, and keep configuration and project structure consistent.[7]

## Compiler and strict mode

- Enable strictness globally: `"strict": true` in `tsconfig.json`, and avoid selectively disabling checks like `noImplicitAny` and `strictNullChecks` unless there is an explicit migration plan.[4][8]  
- Prefer `unknown` over `any` for unsafe inputs, require runtime refinement (type guards, schema validation) before use, and treat any remaining `any` as technical debt to be removed.[7]  

## Types and annotations

- Allow the compiler to infer local types and only annotate where it improves clarity (public APIs, function boundaries, generics, and complex objects).[4][5]  
- Use unions, intersections, discriminated unions, and mapped/conditional types to model domain states precisely instead of encoding them in comments or loosely typed objects.[5][7]  

## Advanced type system features

- Represent reusable shapes with `type` aliases and `interface`, preferring simple, composable types over highly nested conditional types that harm readability or performance.[5][7]  
- Use utility types (built‑in or project‑local) to avoid repeating patterns such as partials, readonly projections, and pick/omit views of core domain types.[4][5]  

## Modules, structure, and tooling

- Use ES modules consistently (`"module": "esnext"` or similar) and avoid mixing module systems in the same project; configure path aliases in `tsconfig.json` instead of deep relative imports.[8][6]  
- Maintain a clear project structure (domain‑oriented folders, separate `types` or `schema` modules) and use project references or multiple `tsconfig` files for large monorepos.[8][7]  

## Interop and assertions

- When interoperating with untyped or loosely typed libraries, introduce minimal, accurate `.d.ts` or local wrapper types rather than relying on broad `any` or unsafe casts.[8][6]  
- Use type assertions (`as`) sparingly and only when a stronger static type is actually guaranteed at runtime; prefer narrowing with checks to convince the compiler instead of forcing it.[7]  

## Best‑practice “must follow” rules

- Always compile with strict type checking, fail builds on type errors, and treat the TypeScript compiler as a gatekeeper, not a hinting tool.[4][7]  
- Avoid global state and implicit `any`, keep types close to the code they describe, regularly refactor types as the domain evolves, and document public APIs with a consistent comment standard (such as TSDoc) to keep generated docs accurate.[3][7]