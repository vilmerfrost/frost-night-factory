**TypeScript coders MUST follow these rules for 2025 compliance, focusing on type safety, advanced features, and strict tooling.**

### Strict Mode and Type Safety
- Enable `"strict": true` in `tsconfig.json` (includes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`); never disable[1][4][7].
- Ban `any`; use `unknown` for unsafe inputs, then narrow with checks (e.g., `if (typeof x === 'string')`)[1][7].
- Rely on type inference for locals (e.g., `const x = 42`); add explicit annotations only for params/returns/interfaces[1].

### Advanced Type System Features (TS 5.9+ RC)
- Use **template literal types** for dynamic strings: `type ColorCode = `${Color}-color`;` where `Color = "red" | "green"`[1].
- Apply **mapped types** for transformations: `type ReadOnlyUser = { readonly [K in keyof User]: User[K] }`[1].
- Leverage **conditional types**: `type IsString<T> = T extends string ? true : false;` for flexible utilities[1].
- Prefer interfaces for objects; use `type` aliases for unions/intersections/mapped/conditionals[7].

### Functions and Utilities
- Type functions explicitly: `(input: string) => Promise<User>`; use overloads for multiple signatures[6].
- Implement rest params with tuples: `function log(...args: [string, number?]) {}`[6].
- Avoid type assertions (`as T`); limit to third-party libs; prefer `unknown` + guards[7].

### Project and Tooling Rules
- Structure with modules: export/import explicitly; use `tsconfig.json` paths for aliases[4][7].
- Generate docs with **TypeDoc** from source + TSDoc comments (`/** @param x desc */`); output HTML/Markdown[1][3].
- Follow PR rules: include type updates; run `tsc --noEmit` in CI for checks[1].

### Common Pitfalls to Avoid
| Mistake                  | Rule                              |
|--------------------------|-----------------------------------|
| Overusing `as` casts     | Use only for libs; narrow instead[7] |
| Skipping `unknown`       | Always over `any` for safety[7]   |
| Poor structure           | Enforce consistent modules[7]     |
| Advanced misuse          | Use unions/mapped/intersections correctly[7] |

Violating these risks runtime errors and unmaintainable code; align with TS Handbook for edge cases[4][5].