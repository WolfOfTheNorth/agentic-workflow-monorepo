# Contributing Guide

Welcome to the AI-First Modular Monorepo! This guide outlines our development practices, conventions, and workflows.

## Getting Started

1. **Read the [Setup Guide](setup.md)** to configure your development environment
2. **Review the [Architecture](architecture.md)** to understand the codebase structure
3. **Check existing issues** and discussions before starting work
4. **Fork and clone** the repository for contributions

## Development Workflow

### 1. Issue-Driven Development

- **Create or find an issue** before starting work
- **Discuss approach** in the issue comments
- **Link commits and PRs** to the issue number

### 2. Branch Strategy

```bash
# Create feature branch
git checkout -b feature/issue-123-add-user-auth

# Work on your changes
# ...

# Push and create PR
git push origin feature/issue-123-add-user-auth
```

**Branch Naming Conventions:**

- `feature/issue-123-short-description` - New features
- `fix/issue-456-bug-description` - Bug fixes
- `docs/update-api-documentation` - Documentation updates
- `refactor/improve-error-handling` - Code refactoring
- `chore/update-dependencies` - Maintenance tasks

### 3. Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**

```bash
git commit -m "feat(auth): add JWT token validation"
git commit -m "fix(ui): resolve button alignment issue"
git commit -m "docs: update API documentation"
git commit -m "refactor(shared): improve error handling"
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes

### 4. Pull Request Process

#### Before Creating PR

```bash
# Ensure code quality
pnpm lint
pnpm type-check
pnpm test
pnpm build

# Update from main
git checkout main
git pull origin main
git checkout your-branch
git rebase main
```

#### PR Guidelines

- **Use descriptive titles** that explain the change
- **Reference related issues** using `Closes #123` or `Fixes #456`
- **Fill out the PR template** completely
- **Keep PRs focused** - one feature/fix per PR
- **Update documentation** if needed
- **Add tests** for new functionality

#### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Related Issues

Closes #123
```

## Code Standards

### TypeScript/JavaScript

```typescript
// ✅ Good
interface UserData {
  id: string;
  name: string;
  email: string;
}

const createUser = async (userData: UserData): Promise<User> => {
  // Implementation
};

// ❌ Avoid
const createUser = (data: any) => {
  // Implementation
};
```

**Guidelines:**

- Use TypeScript for all new code
- Prefer `interface` over `type` for object shapes
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Avoid `any` type - use proper typing

### React Components

```tsx
// ✅ Good
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
}) => {
  return (
    <button className={`btn btn-${variant} btn-${size}`} onClick={onClick}>
      {children}
    </button>
  );
};
```

**Guidelines:**

- Use functional components with hooks
- Define prop interfaces
- Use default parameters for optional props
- Export components as named exports
- Keep components focused and small

### Python/Django

```python
# ✅ Good
from typing import Optional
from django.db import models

class User(models.Model):
    """User model for authentication and profile management."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.email

    def get_full_name(self) -> str:
        """Return the user's full name."""
        return self.name
```

**Guidelines:**

- Use type hints for all functions
- Add docstrings for classes and methods
- Follow PEP 8 style guidelines
- Use Django best practices
- Write unit tests for models and views

## Testing Guidelines

### Frontend Testing

```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Backend Testing

```python
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()

class UserModelTest(TestCase):
    """Test cases for User model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email='test@example.com',
            name='Test User'
        )

    def test_user_creation(self):
        """Test user creation with valid data."""
        self.assertEqual(self.user.email, 'test@example.com')
        self.assertEqual(self.user.name, 'Test User')
        self.assertTrue(self.user.is_active)
```

**Testing Principles:**

- Write tests for all new features
- Aim for high test coverage (>80%)
- Test both happy path and edge cases
- Use descriptive test names
- Keep tests independent and isolated

## Package Structure

### Adding New Packages

1. **Choose the right location:**
   - `apps/` - Full applications (frontend, backend)
   - `packages/` - Shared libraries and utilities
   - `tools/` - Build tools and scripts
   - `infra/` - Infrastructure and deployment

2. **Follow naming conventions:**
   - Use kebab-case for directories
   - Use scoped packages: `@monorepo/package-name`
   - Be descriptive but concise

3. **Create proper package.json:**
   ```json
   {
     "name": "@monorepo/new-package",
     "version": "0.1.0",
     "description": "Package description",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch",
       "test": "jest",
       "lint": "eslint src --ext .ts,.tsx",
       "type-check": "tsc --noEmit"
     },
     "dependencies": {},
     "devDependencies": {}
   }
   ```

### Cross-Package Dependencies

```json
// In a package's package.json
{
  "dependencies": {
    "@monorepo/shared": "workspace:*",
    "@monorepo/ui": "workspace:*"
  }
}
```

## Documentation Standards

### Code Documentation

````typescript
/**
 * Validates user input and creates a new user account.
 *
 * @param userData - The user data to validate and store
 * @param options - Additional options for user creation
 * @returns Promise that resolves to the created user
 *
 * @example
 * ```typescript
 * const user = await createUser({
 *   email: 'user@example.com',
 *   name: 'John Doe'
 * });
 * ```
 */
export const createUser = async (
  userData: UserData,
  options?: CreateUserOptions
): Promise<User> => {
  // Implementation
};
````

### README Files

Each package should have a README.md with:

```markdown
# Package Name

Brief description of the package.

## Installation

\`\`\`bash
pnpm add @monorepo/package-name
\`\`\`

## Usage

\`\`\`typescript
import { functionName } from '@monorepo/package-name';
\`\`\`

## API Reference

### Functions

#### `functionName(param: Type): ReturnType`

Description of the function.

## Contributing

See the main [Contributing Guide](../../docs/contributing.md).
```

## CI/CD and Automation

### Pre-commit Hooks

Hooks run automatically on commit:

- **Linting** - ESLint and Prettier
- **Type checking** - TypeScript compilation
- **Testing** - Unit tests for changed files
- **Commit message validation** - Conventional commits

### CI Pipeline

Our CI runs on:

- **Pull requests** - Full test suite
- **Main branch pushes** - Full test suite + deployment
- **Changed packages only** - Optimized builds

### Manual Quality Checks

```bash
# Before committing
pnpm lint --fix
pnpm type-check
pnpm test
pnpm build

# Check all packages
pnpm -r lint
pnpm -r test
pnpm -r build
```

## Performance Guidelines

### Bundle Size

- Keep bundle sizes small
- Use tree shaking
- Lazy load components when possible
- Monitor bundle analyzer reports

### Build Performance

- Leverage TypeScript project references
- Use caching strategies
- Optimize dependency resolution
- Profile build times regularly

### Runtime Performance

- Use React.memo for expensive components
- Implement proper error boundaries
- Optimize database queries
- Monitor performance metrics

## Security Guidelines

### Code Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs
- Keep dependencies up to date
- Run security audits regularly

### Data Protection

- Follow privacy best practices
- Implement proper authentication
- Use HTTPS everywhere
- Sanitize user inputs
- Log security events

## Getting Help

### Resources

1. **Documentation** - Check the `docs/` directory
2. **Architecture** - Review the [Architecture Guide](architecture.md)
3. **Setup Issues** - See the [Setup Guide](setup.md)
4. **API Reference** - Browse the [API Documentation](api/)

### Communication

- **Issues** - Use GitHub Issues for bugs and features
- **Discussions** - Use GitHub Discussions for questions
- **Code Review** - Participate in PR reviews
- **Documentation** - Improve docs when you find gaps

## Recognition

We appreciate all contributions! Contributors will be:

- Listed in the project README
- Mentioned in release notes
- Invited to maintainer discussions (for regular contributors)

Thank you for contributing to the AI-First Modular Monorepo! 🚀
