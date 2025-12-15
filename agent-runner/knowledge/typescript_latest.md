**TypeScript Coders MUST Follow These Rules (2025 Edition, TS 5.9+):**

- **Enable strict mode in tsconfig.json**: Set `"strict": true` (includes `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`); never disable for production[1][4][6].
- **Ban `any` entirely**: Replace with `unknown` + type guards (e.g., `if (typeof x === 'string')`); use explicit interfaces/types for all params/returns[1][6].
- **Rely on type inference**: Omit explicit types where context suffices (e.g., `const users = [{name: 'Alice'}]; // inferred User[]`); add only for clarity[1].
- **Master advanced types**:
  | Feature | Rule | Example |
  |---------|------|---------|
  | **Mapped Types** | Transform keys/values immutably | `type ReadonlyUser = { readonly [K in keyof User]: User[K] }`[1] |
  | **Template Literals** | Build string unions dynamically | `type ColorCode = `${Color}-color`; // "red-color" \| "green-color"`[1] |
  | **Conditional Types** | Distribute logic | `type IsString<T> = T extends string ? true : false`[1] |
- **Structure projects modularly**: Use ES modules (`"module": "esnext"`); organize with `src/types/`, `src/components/`; avoid global namespaces[1][6].
- **Type all React/Next.js props/hooks**: Define `interface Props { user: User }`; use `React.FC<Props>` or `function Component(props: Props)`; infer hooks where possible[1].
- **Generate docs automatically**: Annotate with TSDoc (`/** @param x desc */`); run TypeDoc for HTML/MD output on every PR[1][3].
- **Avoid type assertions (`as`) except third-party libs**: Prefer guards; never `as any`[6].
- **Configure tsconfig optimally**:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noEmit": true,
      "moduleResolution": "node16",
      "verbatimModuleSyntax": true  // TS 5.9+: exact emit
    }
  }
  ```
  [4][8]
- **Lint with ESLint + typescript-eslint**: Enforce `no-explicit-any`, `@typescript-eslint/prefer-unknown`; run pre-commit[1][6].