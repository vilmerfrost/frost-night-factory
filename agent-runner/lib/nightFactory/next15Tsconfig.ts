// agent-runner/lib/nightFactory/next15Tsconfig.ts
// Canonical, AI-proof Next.js 15 tsconfig used by the Foundation Fix.

export const NEXT15_TSCONFIG: Record<string, unknown> = {
  compilerOptions: {
    target: 'ESNext',
    lib: ['dom', 'dom.iterable', 'ESNext'],
    allowJs: false,
    skipLibCheck: true,
    strict: true,
    noImplicitAny: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'ESNext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    jsxImportSource: 'react',
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: true,
    incremental: true,
    baseUrl: '.',
    paths: {
      '@/*': ['./src/*'],
    },
    types: ['node', 'jest'], // add whatever you need
  },
  include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['node_modules', '.next', 'out'],
};

