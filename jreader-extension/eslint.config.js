// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

export default tseslint.config(
  // Base JS rules (non type-aware)
  eslint.configs.recommended,

  // ---- Type-aware TS & stylistic (apply only to your TS source) ----
  { files: ['src/**/*.{ts,tsx}'], ...tseslint.configs.strictTypeChecked[0] },
  { files: ['src/**/*.{ts,tsx}'], ...tseslint.configs.stylisticTypeChecked[0] },

  // ---- Typed rules (source only) ----
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        browser: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import-x': importX,
      'unused-imports': unusedImports,
    },
    rules: {
      // Turn off base rule; use TS-aware version so "_" is respected
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // TS safety & hygiene
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/consistent-type-exports': ['warn', { fixMixedExportsWithInlineTypeSpecifier: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // React
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Imports
      'import-x/order': ['warn', {
        groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index', 'object']],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],

      // Unused imports (autofixable)
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['off'],
    },
  },

  // ---- Tests (TS parser, Vitest globals, TS unused-vars with "_") ----
  {
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/__tests__/**',
      'src/test/**/*.{ts,tsx}', // covers src/test/setup.ts
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: false }, // typed info not required for tests
      globals: { ...globals.vitest },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // Ensure base rule is off; use TS rule with "_" convention
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'import-x/order': ['warn', {
        groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index', 'object']],
        'newlines-between': 'always-and-inside-groups',
        alphabetize: { order: 'asc', caseInsensitive: true },
        warnOnUnassignedImports: false,
      }],

      // turn off typed-only rules in tests (since project:false)
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',

      // turn off no-undef since TypeScript handles type checking
      'no-undef': 'off',

      'no-useless-escape': 'off', // regex readability in tests
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // ---- Config/build scripts (non type-aware) ----
  {
    files: [
      '*.config.{js,cjs,mjs,ts}',
      'vitest.config.ts',
      'vite.config.ts',
      'tsup.config.ts',
      'scripts/**/*.{js,ts}',
      'build.{js,ts}',
      'build.mjs',
    ],
    languageOptions: {
      parserOptions: { project: false },
      globals: { ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // Not typed; turn off typed-only rules here
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      // Build scripts often scratchy — optional:
      'no-unused-vars': 'off',
    },
  },

  // ---- Ignores ----
  {
    ignores: [
      'dist*/',
      'node_modules/',
      'coverage/',
      '**/*.d.ts',
      'eslint.config.js',
      'src/wasm-pkg/**', // generated wasm glue
    ],
  },
);
