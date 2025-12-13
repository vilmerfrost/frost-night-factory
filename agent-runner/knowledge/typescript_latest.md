**TypeScript coders MUST follow these rules for 2025 compliance, emphasizing type safety, advanced features, and strict configurations.**

### Core Type Safety Rules
- **Never use `any`**: Define explicit types or rely on inference; prefer `unknown` for unsafe inputs to enforce type guards.[1][6]
- **Enable strict mode in `tsconfig.json`**: Set `"strict": true` (includes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`) to catch errors at compile time.[4][7]
- **Use type inference maximally**: Omit explicit types where context infers them accurately, reducing verbosity without sacrificing safety.[1]

### Advanced Type System Features (MANDATORY for Reusability)
- **Mapped types for transformations**: Convert properties, e.g., `type ReadOnly<T> = { readonly [K in keyof T]: T[K] };`.[1]
- **Template literal types for strings**: Create dynamic unions, e.g., `type ColorCode = `${Color}-color`;` where `Color = "red" | "green" | "blue"`.[1]
- **Conditional types for logic**: Implement checks like `type IsString<T> = T extends string ? "yes" : "no";`.[1]
- **Avoid overcomplicating**: Use interfaces/type aliases for readability; limit type assertions to third-party libs.[6]

### Configuration and Tooling Rules
- **`tsconfig.json` must include**: `"noImplicitReturns": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true` for 2025 strictness.[7]
- **Generate docs automatically**: Use TypeDoc for API extraction from types/interfaces; integrate TSDoc for standardized comments.[1][3]
- **Project structure**: Organize by feature (e.g., `src/components/`, `types/`); ensure PRs update types/docs.[1][6]

### Integration and Performance Rules
- **Framework hooks**: Type React props/hooks explicitly; leverage first-class TS support in React/Angular/Vue.[1]
- **Functions**: Type parameters/returns; use rest params, overloading, and higher-order functions with generics.[5]
- **Avoid pitfalls**: No improper overloads; use union/intersection types efficiently; structure projects consistently.[6]

Violating these yields runtime errors and unmaintainable code—enforce via CI/CD type checks.[1][4]