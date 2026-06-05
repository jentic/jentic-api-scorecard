// Carried verbatim from jentic/jentic-arazzo-tools for cross-repo consistency.
// React, JSX-a11y, and Mocha blocks have no matching files in this repo today —
// keep them so a future React/test surface lands without re-deriving the config.
// `npm run lint` delegates via `lerna run lint`, so this file isn't itself linted
// (would otherwise trip no-unused-vars on the eslintPluginReact / eslintPluginJsxA11y
// imports below). Don't "clean up" the unused imports.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginMocha from 'eslint-plugin-mocha';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  // Global ignores (consolidated from all .eslintignore files)
  {
    ignores: [
      '**/dist/**',
      '**/types/**',
      '**/node_modules/**',
      '**/config/**',
      '**/.nyc_output/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      // Keep the config file itself lintable
      '!eslint.config.js',
    ],
  },

  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript source files configuration
  {
    files: ['packages/*/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      // Use 'import' name for backwards compatibility with existing inline disable comments
      import: eslintPluginImportX,
    },
    rules: {
      // Quotes
      quotes: ['error', 'single', { avoidEscape: true }],

      // Disable rules that conflict with TypeScript
      'no-return-await': 'off',
      'no-unused-vars': 'off',

      // Import rules (using 'import/' prefix for backwards compatibility)
      'import/extensions': [
        'error',
        'always',
        {
          ts: 'always',
          tsx: 'always',
          js: 'always',
          jsx: 'never',
          ignorePackages: true,
        },
      ],
      'import/no-extraneous-dependencies': ['error', {
        devDependencies: [
          'packages/*/test/**/*.ts',
          'packages/*/test/**/*.tsx',
          '**/config/**',
          '**/*.config.js',
          '**/*.config.ts',
        ],
        peerDependencies: true,
        optionalDependencies: false,
      }],
      'import/no-mutable-exports': 'off',
      'import/order': [
        'error',
        {
          groups: [
            ['builtin', 'external', 'internal'],
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
        },
      ],

      // General rules
      'no-labels': 'off',
      'no-restricted-syntax': 'off',
      'no-nested-ternary': 'off',

      // TypeScript rules
      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off', // Empty interfaces are intentional for type extension patterns
    },
  },

  // Test files configuration
  {
    files: ['packages/*/test/**/*.ts'],
    plugins: {
      mocha: eslintPluginMocha,
      import: eslintPluginImportX,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.mocha,
        document: true,
      },
    },
    rules: {
      // Relaxed rules for tests
      'no-void': 'off',
      'no-underscore-dangle': 'off',
      'func-names': 'off',
      'prefer-arrow-callback': 'off',
      'no-array-constructor': 'off',
      'prefer-rest-params': 'off',
      'no-new-wrappers': 'off',
      'max-classes-per-file': 'off',

      // Mocha rules
      'mocha/no-pending-tests': 'error',
      'mocha/handle-done-callback': 'error',
      'mocha/valid-suite-title': 'error',
      'mocha/no-mocha-arrows': 'error',
      'mocha/no-hooks-for-single-case': 'error',
      'mocha/no-sibling-hooks': 'error',
      'mocha/no-top-level-hooks': 'error',
      'mocha/no-identical-title': 'error',
      'mocha/no-nested-tests': 'error',
      'mocha/no-exclusive-tests': 'error',

      // Import rules
      'import/no-relative-packages': 'off',

      // TypeScript rules for tests
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off', // Chai assertions like expect(x).to.be.true

      // TypeScript naming convention for __dirname and __filename
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          format: null,
          filter: {
            regex: '^__dirname$',
            match: true,
          },
        },
        {
          selector: 'variable',
          format: null,
          filter: {
            regex: '^__filename$',
            match: true,
          },
        },
      ],
    },
  },

  // Performance test files (same as test but in perf subdirectory)
  {
    files: ['packages/*/test/perf/**/*.ts'],
    plugins: {
      mocha: eslintPluginMocha,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.mocha,
        document: true,
      },
    },
    rules: {
      'no-void': 'off',
      'no-underscore-dangle': 'off',
      'func-names': 'off',
      'prefer-arrow-callback': 'off',
      'no-array-constructor': 'off',
      'prefer-rest-params': 'off',
      'no-new-wrappers': 'off',
      'max-classes-per-file': 'off',
      'mocha/no-pending-tests': 'error',
      'mocha/handle-done-callback': 'error',
      'mocha/valid-suite-title': 'error',
      'mocha/no-mocha-arrows': 'error',
      'mocha/no-hooks-for-single-case': 'error',
      'mocha/no-sibling-hooks': 'error',
      'mocha/no-top-level-hooks': 'error',
      'mocha/no-identical-title': 'error',
      'mocha/no-nested-tests': 'error',
      'mocha/no-exclusive-tests': 'error',
    },
  },

  // arazzo-ui uses Vite which resolves imports without file extensions
  {
    files: ['packages/jentic-arazzo-ui/src/**/*.ts', 'packages/jentic-arazzo-ui/src/**/*.tsx'],
    rules: {
      'import/extensions': 'off',
    },
  },

  // formatter-html's React SPA under src/app/ is a Vite project, type-checked via
  // tsconfig.app.json (the package tsconfig.json scopes itself to the Node format()
  // entry). Point the parser at the app project and keep the explicit .ts/.tsx import
  // suffixes the rest of the repo uses — rewriteRelativeImportExtensions handles them.
  {
    files: ['packages/formatter-html/src/app/**/*.ts', 'packages/formatter-html/src/app/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: false,
        project: './packages/formatter-html/tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Prettier must be last to override other configs
  eslintPluginPrettierRecommended,
);
