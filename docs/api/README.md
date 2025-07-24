# API Documentation

This directory contains comprehensive API documentation for all packages in the monorepo.

## Package Documentation

### Shared Packages

- [**@monorepo/shared**](shared.md) - Common types, utilities, and constants
- [**@monorepo/ui**](ui.md) - React component library
- [**@monorepo/api**](api-client.md) - API client library

### Applications

- [**Frontend API**](frontend.md) - React application interfaces
- [**Backend API**](backend.md) - Django REST API endpoints

## Documentation Generation

API documentation is automatically generated from TypeScript interfaces and JSDoc comments using:

- **TypeDoc** for TypeScript packages
- **Sphinx** for Python/Django backend
- **Storybook** for UI components

### Updating Documentation

```bash
# Generate all API documentation
pnpm run docs:generate

# Generate specific package docs
pnpm --filter shared docs:generate
pnpm --filter ui docs:generate
pnpm --filter api docs:generate
```

### Local Development

```bash
# Serve documentation locally
pnpm run docs:serve

# Watch for changes and rebuild
pnpm run docs:watch
```

## Documentation Standards

### TypeScript/JavaScript

Use JSDoc comments for all public APIs:

````typescript
/**
 * Validates an email address format.
 *
 * @param email - The email address to validate
 * @returns True if the email format is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = validateEmail('user@example.com');
 * console.log(isValid); // true
 * ```
 */
export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
````

### React Components

Document component props and usage:

````typescript
/**
 * A reusable button component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export interface ButtonProps {
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Button content */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
}
````

### API Endpoints

Document REST API endpoints with examples:

```python
class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user accounts.

    Provides CRUD operations for user management with authentication.

    **Endpoints:**
    - GET /api/users/ - List all users
    - POST /api/users/ - Create a new user
    - GET /api/users/{id}/ - Retrieve a specific user
    - PUT /api/users/{id}/ - Update a user
    - DELETE /api/users/{id}/ - Delete a user

    **Authentication:** JWT token required

    **Permissions:**
    - List/Create: Authenticated users
    - Retrieve/Update/Delete: User owner or admin
    """
```

## Navigation

- [Back to Documentation Index](../README.md)
- [Setup Guide](../setup.md)
- [Contributing Guide](../contributing.md)
- [Architecture Overview](../architecture.md)
