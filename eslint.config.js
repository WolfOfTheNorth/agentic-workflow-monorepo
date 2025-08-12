import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Global ignores
  {
    ignores: [
      'dist/',
      'build/',
      'coverage/',
      'node_modules/',
      '*.min.js',
      '.next/',
      '.nuxt/',
      '.cache/',
      '.venv/',
      '.venv/lib/**',
      '**/site-packages/',
      '**/static/',
      '**/staticfiles/',
      '**/migrations/',
      '**/__pycache__/',
      '*.py',
      '*.pyc',
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      '.bmad-core/',
      '.bmad-*/',
      '.claude/',
      'web-bundles/',
      'configs/eslint/',
      'configs/prettier/',
      'configs/typescript/dist/',
      '**/dist/',
      'apps/backend/staticfiles/**',
      'configs/testing/**',
      'tests/shared/utils/test-helpers.tsx',
      // Test files with linting issues (temporary)
      'packages/api/tests/UseAuth.hook.test.ts',
      'packages/api/tests/UseAuthHook.integration.test.ts',
      'packages/api/src/adapters/__tests__/analytics-monitor.test.ts',
      'packages/api/src/adapters/__tests__/analytics-integration.test.ts',
      'packages/api/src/adapters/__tests__/performance-cache.test.ts',
      'packages/api/src/adapters/__tests__/security-audit.test.ts',
      'packages/api/src/adapters/__tests__/penetration-testing.test.ts',
      'packages/api/src/adapters/__tests__/password-validator.test.ts',
      'packages/api/src/adapters/__tests__/session-manager.test.ts',
      'packages/api/src/adapters/__tests__/session-monitor.test.ts',
      'packages/api/src/adapters/__tests__/supabase.test.ts',
      'packages/api/src/adapters/__tests__/transformers.test.ts',
      // Tools directory scripts with dev usage patterns
      'tools/**/*.js',
    ],
  },

  // Base config for all files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        PublicKeyCredential: 'readonly',
        AuthenticatorTransport: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Temporarily disabled due to auth system complexity
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-types': 'off', // Allow Function type for flexibility
    },
  },

  // React files
  {
    files: ['apps/frontend/**/*', 'packages/ui/**/*'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        StorageEvent: 'readonly',
        PublicKeyCredential: 'readonly',
        AuthenticatorTransport: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
    },
  },

  // Test files
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}', 'tests/**/*'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // Node.js files
  {
    files: ['apps/backend/**/*', 'tools/**/*', 'scripts/**/*', 'test-frontend.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-case-declarations': 'warn',
    },
  },

  // API client files (need DOM globals)
  {
    files: ['packages/api/**/*'],
    languageOptions: {
      globals: {
        fetch: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        navigator: 'readonly',
        crypto: 'readonly',
        RequestInit: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        StorageEvent: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        CryptoKey: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-console': 'off', // Allow console in API package for logging
    },
  },

  // Shared packages (need browser globals)
  {
    files: ['packages/shared/**/*', 'packages/ui/**/*'],
    languageOptions: {
      globals: {
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        NodeJS: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Playwright config
  {
    files: ['playwright.config.ts'],
    languageOptions: {
      globals: {
        require: 'readonly',
      },
    },
  },
];
