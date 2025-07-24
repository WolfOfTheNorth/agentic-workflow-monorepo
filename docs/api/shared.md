# @monorepo/shared API Documentation

The shared package provides common types, utilities, and constants used across all applications and packages in the monorepo.

## Installation

```bash
pnpm add @monorepo/shared
```

## Usage

```typescript
import { ApiResponse, validateEmail, API_ENDPOINTS } from '@monorepo/shared';
```

## Types

### ApiResponse<T>

Standard API response wrapper for consistent data handling.

```typescript
interface ApiResponse<T> {
  /** The actual response data */
  data: T;
  /** Optional success message */
  message?: string;
  /** Optional error message */
  error?: string;
  /** HTTP status code */
  status?: number;
  /** Request timestamp */
  timestamp?: string;
}
```

**Example:**

```typescript
const userResponse: ApiResponse<User> = {
  data: {
    id: '123',
    email: 'user@example.com',
    name: 'John Doe',
  },
  message: 'User retrieved successfully',
  status: 200,
  timestamp: '2023-12-01T10:00:00Z',
};
```

### User

User account information interface.

```typescript
interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Account creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Whether the user account is active */
  isActive: boolean;
  /** User role */
  role: 'admin' | 'user' | 'moderator';
}
```

**Example:**

```typescript
const user: User = {
  id: 'user_123',
  email: 'john.doe@example.com',
  name: 'John Doe',
  createdAt: '2023-01-15T10:00:00Z',
  updatedAt: '2023-12-01T10:00:00Z',
  isActive: true,
  role: 'user',
};
```

### AuthToken

Authentication token information.

```typescript
interface AuthToken {
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
}
```

### PaginatedResponse<T>

Paginated API response for list endpoints.

```typescript
interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Total number of items */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}
```

## Utilities

### Validation Functions

#### validateEmail(email: string): boolean

Validates email address format using RFC-compliant regex.

**Parameters:**

- `email` (string) - Email address to validate

**Returns:**

- `boolean` - True if email format is valid

**Example:**

```typescript
const isValid = validateEmail('user@example.com'); // true
const isInvalid = validateEmail('invalid-email'); // false
```

#### validatePassword(password: string): ValidationResult

Validates password strength according to security requirements.

**Parameters:**

- `password` (string) - Password to validate

**Returns:**

- `ValidationResult` - Validation result with details

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}
```

**Example:**

```typescript
const result = validatePassword('MyStr0ngP@ssw0rd');
// {
//   isValid: true,
//   errors: [],
//   strength: 'strong'
// }
```

#### validateUrl(url: string): boolean

Validates URL format.

**Parameters:**

- `url` (string) - URL to validate

**Returns:**

- `boolean` - True if URL format is valid

**Example:**

```typescript
const isValid = validateUrl('https://example.com'); // true
const isInvalid = validateUrl('not-a-url'); // false
```

### Formatting Functions

#### formatDate(date: Date | string, format?: string): string

Formats date according to specified format.

**Parameters:**

- `date` (Date | string) - Date to format
- `format` (string, optional) - Format string (default: 'YYYY-MM-DD')

**Returns:**

- `string` - Formatted date string

**Example:**

```typescript
const formatted = formatDate(new Date(), 'MM/DD/YYYY'); // '12/01/2023'
const isoDate = formatDate('2023-12-01T10:00:00Z'); // '2023-12-01'
```

#### formatCurrency(amount: number, currency?: string): string

Formats number as currency.

**Parameters:**

- `amount` (number) - Amount to format
- `currency` (string, optional) - Currency code (default: 'USD')

**Returns:**

- `string` - Formatted currency string

**Example:**

```typescript
const price = formatCurrency(1234.56); // '$1,234.56'
const euro = formatCurrency(1234.56, 'EUR'); // '€1,234.56'
```

#### slugify(text: string): string

Converts text to URL-friendly slug.

**Parameters:**

- `text` (string) - Text to slugify

**Returns:**

- `string` - URL-friendly slug

**Example:**

```typescript
const slug = slugify('Hello World! 123'); // 'hello-world-123'
```

### Array Utilities

#### groupBy<T>(array: T[], key: keyof T): Record<string, T[]>

Groups array items by specified key.

**Parameters:**

- `array` (T[]) - Array to group
- `key` (keyof T) - Key to group by

**Returns:**

- `Record<string, T[]>` - Grouped items

**Example:**

```typescript
const users = [
  { name: 'John', role: 'admin' },
  { name: 'Jane', role: 'user' },
  { name: 'Bob', role: 'admin' },
];

const grouped = groupBy(users, 'role');
// {
//   admin: [{ name: 'John', role: 'admin' }, { name: 'Bob', role: 'admin' }],
//   user: [{ name: 'Jane', role: 'user' }]
// }
```

#### debounce<T extends (...args: any[]) => any>(func: T, delay: number): T

Creates a debounced version of a function.

**Parameters:**

- `func` (T) - Function to debounce
- `delay` (number) - Delay in milliseconds

**Returns:**

- `T` - Debounced function

**Example:**

```typescript
const debouncedSearch = debounce((query: string) => {
  console.log('Searching for:', query);
}, 300);

debouncedSearch('test'); // Will execute after 300ms if no more calls
```

## Constants

### API_ENDPOINTS

Centralized API endpoint definitions.

```typescript
const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/profile',
  },
  USERS: {
    LIST: '/api/users',
    DETAIL: '/api/users/:id',
    CREATE: '/api/users',
    UPDATE: '/api/users/:id',
    DELETE: '/api/users/:id',
  },
  SETTINGS: {
    GET: '/api/settings',
    UPDATE: '/api/settings',
  },
} as const;
```

**Example:**

```typescript
const loginUrl = API_ENDPOINTS.AUTH.LOGIN; // '/api/auth/login'
const userDetail = API_ENDPOINTS.USERS.DETAIL.replace(':id', '123'); // '/api/users/123'
```

### HTTP_STATUS

HTTP status code constants.

```typescript
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
```

### VALIDATION_RULES

Validation rule constants.

```typescript
const VALIDATION_RULES = {
  EMAIL: {
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MAX_LENGTH: 254,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: true,
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    REGEX: /^[a-zA-Z0-9_-]+$/,
  },
} as const;
```

## Error Classes

### AppError

Base error class for application errors.

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### ValidationError

Error class for validation failures.

```typescript
class ValidationError extends AppError {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}
```

### NetworkError

Error class for network-related failures.

```typescript
class NetworkError extends AppError {
  constructor(
    message: string,
    public url: string,
    public method: string
  ) {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}
```

**Example:**

```typescript
try {
  validateEmail('invalid-email');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation failed for ${error.field}: ${error.message}`);
  }
}
```

## TypeScript Configuration

To use this package with proper type checking:

```json
{
  "compilerOptions": {
    "types": ["@monorepo/shared"]
  }
}
```

## Contributing

When adding new utilities or types to the shared package:

1. **Add comprehensive JSDoc comments**
2. **Include usage examples**
3. **Write unit tests**
4. **Update this documentation**
5. **Consider backward compatibility**

See the [Contributing Guide](../contributing.md) for more details.
