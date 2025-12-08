// =============================================================================
// ESLINT CONFIGURATION - Enforce facade pattern and code quality
// =============================================================================
// Kimi K2 Pattern: Ban all imports except from @/api

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    // === FACADE PATTERN ENFORCEMENT ===
    'no-restricted-imports': [
      'warn', // Start with warn, upgrade to error later
      {
        patterns: [
          {
            group: ['**/internal/**'],
            message: '❌ Import from @/api instead of internal paths',
          },
          {
            group: ['**/types/**', '**/interfaces/**'],
            message: '❌ Import types from @/api only',
          },
        ],
      },
    ],
    
    // === CODE QUALITY ===
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // === SECURITY ===
    'no-script-url': 'error',
    
    // === BEST PRACTICES ===
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'no-return-await': 'warn',
    'require-await': 'warn',
    
    // === TYPESCRIPT ===
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    // Test files can have looser rules
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test-*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Scripts can use console
    {
      files: ['scripts/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    // Agent runner files
    {
      files: ['agent-runner/**/*.ts'],
      rules: {
        'no-console': 'off', // Agent runner needs logging
        'no-restricted-imports': 'off', // Agent runner has different import patterns
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.js',
    '*.d.ts',
    'agent-runner/workspace/**', // Ignore sandbox files
  ],
};

