# Packages CLAUDE.md

This file provides guidance for working with the shared packages in the monorepo.

## Packages Overview

The packages directory contains reusable code shared across the monorepo applications.

### Package Structure

```
packages/
├── shared/              # Common types, constants, utilities
├── api/                # Authentication system & API clients
└── ui/                 # Reusable React UI components
```

Each package follows the monorepo workspace pattern and can be independently versioned and published.

## Package: @agentic-workflow/shared

Common types, constants, and utilities used across all applications.

### Structure

```
packages/shared/
├── src/
│   ├── constants/          # Application constants
│   │   ├── config.ts      # Configuration constants
│   │   ├── endpoints.ts   # API endpoint constants
│   │   └── index.ts
│   ├── types/             # TypeScript type definitions
│   │   ├── api.ts         # API response/request types
│   │   ├── auth.ts        # Authentication types
│   │   ├── common.ts      # Common utility types
│   │   └── index.ts
│   ├── utils/             # Utility functions
│   │   ├── async.ts       # Async utility functions
│   │   ├── auth-validation.ts  # Auth validation utilities
│   │   ├── formatting.ts  # Data formatting utilities
│   │   ├── validation.ts  # General validation utilities
│   │   └── index.ts
│   └── index.ts           # Main package export
├── tests/                 # Package tests
├── package.json          # Package configuration
└── tsconfig.json         # TypeScript configuration
```

### Usage

```typescript
// Import types
import { AuthUser, ApiResponse } from '@agentic-workflow/shared';

// Import constants
import { API_ENDPOINTS, CONFIG } from '@agentic-workflow/shared';

// Import utilities
import { validateEmail, formatDate } from '@agentic-workflow/shared';
```

### Key Exports

**Types:**

- `AuthUser`, `AuthSession`, `AuthTokens` - Authentication types
- `ApiResponse<T>`, `ApiError` - API response types
- `User`, `UserProfile` - User-related types

**Constants:**

- `API_ENDPOINTS` - API endpoint URLs
- `CONFIG` - Application configuration
- `AUTH_CONFIG` - Authentication configuration

**Utilities:**

- `validateEmail()`, `validatePassword()` - Validation functions
- `formatDate()`, `formatCurrency()` - Formatting functions
- `debounce()`, `throttle()` - Async utilities

## Package: @agentic-workflow/api

Authentication system and API client functionality.

### Structure

```
packages/api/
├── src/
│   ├── adapters/          # Authentication adapters and services
│   │   ├── providers/     # OAuth and 2FA providers
│   │   ├── supabase-adapter.ts
│   │   ├── session-manager.ts
│   │   └── auth-cache.ts
│   ├── clients/           # API client implementations
│   │   ├── auth-client.ts
│   │   ├── supabase.ts
│   │   └── index.ts
│   ├── hooks/             # React hooks for API integration
│   │   ├── useAuth.ts
│   │   ├── useUsers.ts
│   │   └── index.ts
│   ├── types/             # API-specific types
│   ├── utils/             # API utilities
│   └── index.ts
├── docs/                  # API documentation
├── tests/                 # Comprehensive test suite
└── CLAUDE.md             # API-specific guidance
```

### Usage

```typescript
// Authentication hook
import { useAuth } from '@agentic-workflow/api';

// API clients
import { AuthClient, SupabaseClient } from '@agentic-workflow/api';

// Types
import { AuthUser, AuthSession } from '@agentic-workflow/api';
```

### Key Features

- **Supabase Integration**: Full authentication with Supabase
- **OAuth Providers**: Google, GitHub, and other providers
- **2FA Support**: TOTP and WebAuthn implementation
- **Session Management**: Secure token storage and refresh
- **React Hooks**: Easy integration with React components
- **Security Features**: Rate limiting, audit logging, penetration testing

## Package: @agentic-workflow/ui

Reusable React UI components with consistent design system.

### Structure

```
packages/ui/
├── src/
│   ├── components/        # React components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   └── index.ts
│   │   └── Layout/
│   │       ├── Layout.tsx
│   │       └── index.ts
│   └── index.ts          # Main package export
├── stories/              # Storybook stories
├── tests/                # Component tests
└── package.json
```

### Usage

```typescript
// Import components
import { Button, Input, Layout } from '@agentic-workflow/ui';

// Use in React components
function MyComponent() {
  return (
    <Layout>
      <Input placeholder="Enter text" />
      <Button variant="primary" onClick={handleClick}>
        Submit
      </Button>
    </Layout>
  );
}
```

### Key Components

- **Button**: Configurable button with variants and states
- **Input**: Form input with validation styling
- **Layout**: Application layout components

## Development Guidelines

### Adding New Packages

1. Create package directory in `packages/`
2. Initialize with `package.json`:
   ```json
   {
     "name": "@agentic-workflow/package-name",
     "version": "0.0.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "test": "jest"
     }
   }
   ```
3. Add to workspace in root `package.json`
4. Configure TypeScript with `tsconfig.json`
5. Add build and test scripts

### Package Development

1. **TypeScript First**: All packages use TypeScript
2. **Export Everything**: Use barrel exports from `index.ts`
3. **Testing**: Each package has its own test suite
4. **Documentation**: Include README and CLAUDE.md files
5. **Type Safety**: Export proper TypeScript definitions

### Cross-Package Dependencies

```bash
# Add dependency between packages
pnpm add --filter @agentic-workflow/api @agentic-workflow/shared

# Add external dependency to specific package
pnpm add --filter @agentic-workflow/shared lodash
```

### Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @agentic-workflow/shared build

# Watch mode for development
pnpm --filter @agentic-workflow/shared build --watch
```

### Testing Packages

```bash
# Test all packages
pnpm test

# Test specific package
pnpm --filter @agentic-workflow/api test

# Test with coverage
pnpm --filter @agentic-workflow/shared test --coverage
```

## Package Versioning

### Version Management

Each package is independently versioned:

```bash
# Version a specific package
cd packages/shared
npm version patch

# Publish to npm (if configured)
npm publish
```

### Dependency Updates

```bash
# Update dependencies in specific package
pnpm --filter @agentic-workflow/api update

# Check outdated dependencies
pnpm --filter @agentic-workflow/shared outdated
```

## Best Practices

### Code Organization

1. **Single Responsibility**: Each package has a clear purpose
2. **Minimal Dependencies**: Keep external dependencies minimal
3. **Tree Shaking**: Support tree shaking with named exports
4. **Type Exports**: Export types separately from implementations

### API Design

1. **Consistent Interfaces**: Use consistent patterns across packages
2. **Error Handling**: Standardized error handling
3. **Documentation**: Comprehensive JSDoc comments
4. **Backwards Compatibility**: Maintain API compatibility

### Performance

1. **Bundle Size**: Monitor and optimize bundle sizes
2. **Lazy Loading**: Support code splitting where applicable
3. **Caching**: Implement appropriate caching strategies
4. **Memory Management**: Avoid memory leaks in long-running apps

## Common Tasks

### Adding Shared Types

1. Define types in `packages/shared/src/types/`
2. Export from appropriate index file
3. Update package version
4. Use in other packages with import

### Creating Utility Functions

1. Add function to `packages/shared/src/utils/`
2. Write comprehensive tests
3. Add JSDoc documentation
4. Export from utils index

### Building UI Components

1. Create component in `packages/ui/src/components/`
2. Follow existing component patterns
3. Add Storybook story
4. Write component tests
5. Export from main index

### API Client Updates

1. Modify client in `packages/api/src/clients/`
2. Update related types
3. Add integration tests
4. Update documentation
5. Version the API package

## Troubleshooting

### Common Issues

1. **Circular Dependencies**: Use dependency graph tools to detect
2. **Type Resolution**: Ensure proper TypeScript configuration
3. **Build Failures**: Check for missing dependencies
4. **Version Conflicts**: Use pnpm's resolution features

### Debugging

1. **Package Linking**: Use `pnpm link` for local development
2. **Build Analysis**: Check generated `dist/` folders
3. **Type Checking**: Run `tsc --noEmit` for type validation
4. **Dependency Tree**: Use `pnpm list` to check dependencies

### Performance Issues

1. **Bundle Analysis**: Use webpack-bundle-analyzer
2. **Build Times**: Profile TypeScript compilation
3. **Runtime Performance**: Profile with React DevTools
4. **Memory Usage**: Check for memory leaks in utilities
