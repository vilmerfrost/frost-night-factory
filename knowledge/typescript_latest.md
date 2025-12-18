**Upgrade to TypeScript 7.0 (preview as of December 2025) or at minimum 5.8 for production; enable `strict: true` in `tsconfig.json` mandatorily.**[1][2][7]

### Breaking Changes (Migrate Immediately)
- **Promise.resolve**: Uses `Awaited<T>` to unwrap promises precisely; prior `any`/`unknown` assumptions fail—annotate explicitly or use type guards.[1]
- **Unconstrained generics**: No longer assignable to `{}`/`object` under `strictNullChecks`; constrain as `unknown` and narrow before use (e.g., `T extends unknown ? NonNullable<T> : never`).[1]
- **JSX spreads**: Reject `unknown`/`never`; ensure object types only (e.g., `{...obj as Record<string, any>}`).[1]
- **Template strings**: Ban `symbol`-constrained generics; convert via `String()` or `.toString()`.[1]
- **Generator yields**: Enforce explicit typing on `yield` results (e.g., `const value: string = yield 1;`) to avoid implicit `any`.[1]
- **Logical AND/OR**: Return `unknown` (not `any`) for right operand on `unknown` inputs; add type assertions.[1]
- **Conditional types**: Block assignability to `infer`/distributive conditionals to prevent perf regressions; refactor to non-distributive forms.[1]
- **By 5.5**: Intersections of type vars + primitives reduce aggressively—test edge cases like `T & string`.[5]

### New Features (Leverage in 2024/2025 Code)
- **TypeScript 7.0**: Native Go compiler (`tsgo`) with shared-memory parallelism; use `--build`/`--incremental` for 10x+ faster multi-project builds. LSP protocol standardizes LS (completions, refactoring); reset VS Code TS extension caches post-upgrade.[2]
- **5.7/5.8**: `--target es2024` + `--lib es2024` for Promise.withResolvers, RegExp advancements; monomorphization cuts property access overhead by 20-50%.[3][4][7]
- **5.5**: Enhanced type precision (e.g., template literals, inference); perf gains in large codebases.[3]

### Strict Mode Requirements (Enforce Always)
```
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "target": "es2024",
    "lib": ["es2024"]
  }
}
```
- **Narrow aggressively**: Use `in`/`instanceof`/`type guards` over `any`/`unknown`; prefer `satisfies` for inference preservation.
- **Avoid distro conditionals**: Rewrite as unions (e.g., `T extends U ? X : Y` → `[X, Y][T extends U ? 0 : 1]`).[1]
- **Refactor safely**: Exploit LS features (Go-to-Def, Rename, Quick Fixes) enabled by static types—no raw JS interop without declarations.[6]

**Test all generics/JSX/promises post-upgrade; run `tsc --extendedDiagnostics` for perf baselines.**[2]