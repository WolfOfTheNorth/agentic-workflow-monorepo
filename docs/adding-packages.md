# Adding New Packages - Best Practices Guide

This guide provides comprehensive instructions for adding new packages to the AI-First Modular Monorepo.

## Package Types and Placement

### Understanding Package Categories

| Type               | Location    | Purpose                                      | Examples                           |
| ------------------ | ----------- | -------------------------------------------- | ---------------------------------- |
| **Apps**           | `apps/`     | Full applications with their own deployments | `frontend`, `backend`, `mobile`    |
| **Packages**       | `packages/` | Shared libraries and utilities               | `shared`, `ui`, `api`              |
| **Tools**          | `tools/`    | Build tools and development utilities        | `build`, `scripts`, `lint-configs` |
| **Infrastructure** | `infra/`    | Deployment and infrastructure code           | `docker`, `terraform`, `k8s`       |

### Choosing the Right Location

**Add to `apps/`** when:

- Creating a new application (web app, mobile app, desktop app)
- The package has its own deployment pipeline
- It's a standalone service or microservice
- It has its own user interface

**Add to `packages/`** when:

- Creating reusable code shared across apps
- Building a component library
- Creating utility functions or types
- Developing API clients or SDKs

**Add to `tools/`** when:

- Creating build scripts or development utilities
- Adding custom linting or formatting tools
- Building deployment or testing utilities
- Creating development workflow helpers

**Add to `infra/`** when:

- Adding deployment configurations
- Creating infrastructure as code
- Setting up monitoring or logging
- Configuring CI/CD pipelines

## Step-by-Step Package Creation

### 1. Plan Your Package

Before creating a package, consider:

```bash
# Questions to ask:
# - What is the package's single responsibility?
# - Which other packages will depend on it?
# - What packages does it need to depend on?
# - What's the appropriate naming convention?
# - Does a similar package already exist?
```

### 2. Create Package Structure

#### For Shared Packages (`packages/`)

```bash
# Create package directory
mkdir packages/your-package-name
cd packages/your-package-name

# Create standard structure
mkdir -p src/{components,utils,types,hooks}
mkdir -p tests/{unit,integration}
mkdir -p docs

# Create essential files
touch src/index.ts
touch README.md
touch package.json
touch tsconfig.json
touch jest.config.js
```

#### For Applications (`apps/`)

```bash
# Create app directory
mkdir apps/your-app-name
cd apps/your-app-name

# For React app
npx create-vite@latest . --template react-ts

# For Node.js API
mkdir -p src/{routes,controllers,models,middleware}
mkdir -p tests/{unit,integration}
```

### 3. Configure package.json

#### Shared Package Example

```json
{
  "name": "@agentic-workflow/your-package-name",
  "version": "0.1.0",
  "description": "Brief description of your package",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@agentic-workflow/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "tsup": "^7.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "publishConfig": {
    "access": "restricted"
  }
}
```

#### Application Package Example

```json
{
  "name": "@agentic-workflow/your-app-name",
  "version": "0.1.0",
  "private": true,
  "description": "Description of your application",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@agentic-workflow/shared": "workspace:*",
    "@agentic-workflow/ui": "workspace:*",
    "@agentic-workflow/api": "workspace:*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.0.0"
  }
}
```

### 4. Configure TypeScript

#### Package TypeScript Config

```json
{
  "extends": "../../configs/typescript/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.*", "**/*.spec.*"]
}
```

#### App TypeScript Config

```json
{
  "extends": "../../configs/typescript/app.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../packages/shared/src/*"],
      "@ui/*": ["../../packages/ui/src/*"],
      "@api/*": ["../../packages/api/src/*"]
    }
  },
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

### 5. Update Root Configuration

#### Add to pnpm-workspace.yaml (if needed)

The workspace should already include the pattern, but verify:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'
  - 'infra/*'
```

#### Update Root tsconfig.json

Add your package to the project references:

```json
{
  "references": [
    { "path": "./apps/frontend" },
    { "path": "./apps/backend" },
    { "path": "./apps/your-new-app" },
    { "path": "./packages/shared" },
    { "path": "./packages/ui" },
    { "path": "./packages/api" },
    { "path": "./packages/your-new-package" }
  ]
}
```

#### Update Path Mapping (if applicable)

For packages that should be importable via path mapping:

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./packages/shared/src/*"],
      "@ui/*": ["./packages/ui/src/*"],
      "@api/*": ["./packages/api/src/*"],
      "@your-package/*": ["./packages/your-package/src/*"]
    }
  }
}
```

## Package Development Guidelines

### 1. Naming Conventions

#### Package Names

- Use kebab-case for directory names: `user-management`
- Use scoped names in package.json: `@agentic-workflow/user-management`
- Be descriptive but concise
- Follow domain-driven design principles

#### Export Structure

```typescript
// src/index.ts - Main export file
export { Button, Input } from './components';
export { validateEmail, formatDate } from './utils';
export type { User, ApiResponse } from './types';
export { API_ENDPOINTS } from './constants';
```

### 2. Dependencies Management

#### Internal Dependencies

```json
{
  "dependencies": {
    "@agentic-workflow/shared": "workspace:*",
    "@agentic-workflow/ui": "workspace:*"
  }
}
```

#### External Dependencies

- Add to the specific package that needs them
- Use exact versions for critical dependencies
- Consider peer dependencies for shared libraries

#### Development Dependencies

```json
{
  "devDependencies": {
    "@agentic-workflow/eslint-config": "workspace:*",
    "@agentic-workflow/typescript-config": "workspace:*"
  }
}
```

### 3. Build Configuration

#### Using tsup for Libraries

```javascript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
});
```

#### Using Vite for Applications

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
```

### 4. Testing Configuration

#### Jest for Unit Tests

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

## Best Practices

### 1. Code Quality

#### Consistent Exports

```typescript
// ✅ Good - Clear, explicit exports
export { Button } from './Button';
export { Input } from './Input';
export type { ButtonProps, InputProps } from './types';

// ❌ Avoid - Barrel exports that re-export everything
export * from './components';
```

#### Type Safety

```typescript
// ✅ Good - Proper typing
interface CreateUserParams {
  name: string;
  email: string;
  role?: UserRole;
}

export const createUser = async (params: CreateUserParams): Promise<User> => {
  // Implementation
};

// ❌ Avoid - Any types
export const createUser = (params: any): any => {
  // Implementation
};
```

### 2. Documentation

#### Package README Template

```markdown
# @agentic-workflow/package-name

Brief description of what this package does.

## Installation

\`\`\`bash
pnpm add @agentic-workflow/package-name
\`\`\`

## Usage

\`\`\`typescript
import { SomeFunction } from '@agentic-workflow/package-name';

const result = SomeFunction({ param: 'value' });
\`\`\`

## API Reference

### Functions

#### \`SomeFunction(params: Params): Result\`

Description of the function.

**Parameters:**

- \`params\` - Description of parameters

**Returns:**

- \`Result\` - Description of return value

**Example:**
\`\`\`typescript
const result = SomeFunction({ param: 'value' });
\`\`\`

## Contributing

See the main [Contributing Guide](../../docs/contributing.md).

## License

See the main [License](../../LICENSE).
```

#### JSDoc Comments

````typescript
/**
 * Validates and creates a new user account.
 *
 * @param userData - The user data to validate and create
 * @param options - Additional options for user creation
 * @returns Promise that resolves to the created user
 *
 * @example
 * ```typescript
 * const user = await createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 * ```
 *
 * @throws {ValidationError} When user data is invalid
 * @throws {DuplicateError} When user already exists
 */
export const createUser = async (
  userData: UserData,
  options?: CreateUserOptions
): Promise<User> => {
  // Implementation
};
````

### 3. Version Management

#### Semantic Versioning

- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, backward compatible

#### Changelog Maintenance

```markdown
# Changelog

## [Unreleased]

### Added

- New feature X

### Changed

- Improved feature Y

### Fixed

- Bug in feature Z

## [0.2.0] - 2024-01-15

### Added

- Feature A
- Feature B
```

### 4. Performance Considerations

#### Bundle Size

```typescript
// ✅ Good - Tree-shakeable exports
export { Button } from './Button';
export { Input } from './Input';

// ❌ Avoid - Large barrel exports
export * from './components'; // May include unused code
```

#### Lazy Loading

```typescript
// For heavy components or utilities
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// For optional dependencies
const optionalDependency = async () => {
  const module = await import('./optional-feature');
  return module.default;
};
```

## Testing Your New Package

### 1. Local Testing

```bash
# Build your package
pnpm --filter your-package-name build

# Test in isolation
pnpm --filter your-package-name test

# Test with dependents
pnpm build
pnpm test
```

### 2. Integration Testing

```bash
# Add your package as dependency in another package
cd packages/consuming-package
pnpm add @agentic-workflow/your-package-name

# Test the integration
pnpm dev
pnpm test
```

### 3. End-to-End Testing

```bash
# Start all development servers
pnpm dev

# Run E2E tests
pnpm test:e2e
```

## Common Patterns

### 1. Shared Utilities Package

```typescript
// packages/utils/src/index.ts
export { validateEmail, formatDate } from './validation';
export { debounce, throttle } from './performance';
export { createLogger } from './logging';
export type { Logger, LogLevel } from './types';
```

### 2. UI Component Library

```typescript
// packages/ui/src/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';
export type { ButtonProps, InputProps, ModalProps } from './types';

// packages/ui/src/Button/Button.tsx
import React from 'react';
import { ButtonProps } from './types';

export const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return <button {...props}>{children}</button>;
};
```

### 3. API Client Package

```typescript
// packages/api/src/index.ts
export { ApiClient } from './client';
export { createApiClient } from './factory';
export type { ApiResponse, ApiError, ClientConfig } from './types';

// packages/api/src/client.ts
export class ApiClient {
  constructor(private config: ClientConfig) {}

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    // Implementation
  }
}
```

## Troubleshooting

### Common Issues

#### Module Resolution Errors

```bash
# Clear cache and rebuild
pnpm clean
pnpm build

# Check TypeScript path mapping
pnpm type-check
```

#### Circular Dependencies

```bash
# Use dependency visualization
pnpm list --depth=0

# Check for circular imports
npx madge --circular packages/your-package/src
```

#### Version Conflicts

```bash
# Check for version mismatches
pnpm why package-name

# Update all workspace dependencies
pnpm update --recursive
```

## Checklist for New Packages

Before submitting your new package:

- [ ] Package follows naming conventions
- [ ] Proper TypeScript configuration
- [ ] Comprehensive test coverage (>80%)
- [ ] Documentation (README + JSDoc)
- [ ] Build configuration works
- [ ] No circular dependencies
- [ ] Follows code quality standards
- [ ] Integration tested with consuming packages
- [ ] Added to root TypeScript references (if needed)
- [ ] Updated workspace documentation

## Resources

- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

Remember: A well-designed package is focused, testable, and easy to integrate. Take time to plan your package structure before implementation!
