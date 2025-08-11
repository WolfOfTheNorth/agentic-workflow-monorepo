# Authentication Components Documentation

This document provides comprehensive documentation for all authentication components, hooks, and utilities in the Agentic Workflow authentication system.

## Overview

The authentication system consists of:

- **Frontend Components**: React components for login, signup, password reset, and route protection
- **React Context**: AuthContext for state management
- **API Hooks**: useAuth hook for authentication operations
- **Utilities**: Error handling, validation, and security utilities

## Table of Contents

1. [React Components](#react-components)
2. [React Context](#react-context)
3. [API Hooks](#api-hooks)
4. [Utilities](#utilities)
5. [Integration Examples](#integration-examples)
6. [Troubleshooting](#troubleshooting)

---

## React Components

### AuthGuard

**File:** `apps/frontend/src/components/auth/AuthGuard.tsx`

A higher-order component that provides route protection based on authentication state.

#### Props

| Prop              | Type         | Default     | Description                                                            |
| ----------------- | ------------ | ----------- | ---------------------------------------------------------------------- |
| `children`        | `ReactNode`  | Required    | Content to render when authentication requirements are met             |
| `requireAuth`     | `boolean`    | `true`      | Whether authentication is required to access the content               |
| `requireNoAuth`   | `boolean`    | `false`     | Whether authentication should be forbidden (for login/signup pages)    |
| `fallback`        | `ReactNode`  | `null`      | Component to render while checking authentication status               |
| `onAuthRequired`  | `() => void` | `undefined` | Callback when authentication is required but user is not authenticated |
| `onAuthForbidden` | `() => void` | `undefined` | Callback when user is authenticated but shouldn't be                   |
| `redirectDelay`   | `number`     | `1000`      | Delay in milliseconds before calling redirect callbacks                |

#### Usage

```tsx
import { AuthGuard } from '@/components/auth/AuthGuard';

// Protect a route that requires authentication
<AuthGuard requireAuth={true} onAuthRequired={() => navigate('/login')}>
  <Dashboard />
</AuthGuard>

// Protect a route that requires no authentication (login page)
<AuthGuard requireNoAuth={true} onAuthForbidden={() => navigate('/dashboard')}>
  <LoginForm />
</AuthGuard>
```

#### Features

- **Automatic state detection**: Monitors authentication status changes
- **Flexible routing**: Supports both authenticated and non-authenticated route protection
- **Loading states**: Provides fallback content during authentication checks
- **Callback system**: Allows custom handling of authentication state changes

---

### LoginForm

**File:** `apps/frontend/src/components/auth/LoginForm.tsx`

A comprehensive login form component with validation, error handling, and accessibility features.

#### Props

| Prop               | Type                               | Default     | Description                                |
| ------------------ | ---------------------------------- | ----------- | ------------------------------------------ |
| `onSuccess`        | `(response: AuthResponse) => void` | `undefined` | Callback called when login succeeds        |
| `onError`          | `(error: string) => void`          | `undefined` | Callback called when login fails           |
| `onForgotPassword` | `() => void`                       | `undefined` | Callback for forgot password link          |
| `onSignupClick`    | `() => void`                       | `undefined` | Callback for signup link                   |
| `className`        | `string`                           | `''`        | Additional CSS classes                     |
| `autoFocus`        | `boolean`                          | `true`      | Whether to auto-focus the email field      |
| `showRememberMe`   | `boolean`                          | `true`      | Whether to show the "Remember Me" checkbox |

#### Usage

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

<LoginForm
  onSuccess={response => {
    console.log('Login successful:', response);
    navigate('/dashboard');
  }}
  onError={error => {
    console.error('Login failed:', error);
  }}
  onForgotPassword={() => navigate('/reset-password')}
  onSignupClick={() => navigate('/signup')}
  autoFocus={true}
  showRememberMe={true}
/>;
```

#### Features

- **Real-time validation**: Email and password validation with visual feedback
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA labels and keyboard navigation
- **Error handling**: User-friendly error messages with retry functionality
- **Network awareness**: Detects online/offline status and handles network errors
- **Security**: Input sanitization and CSRF protection
- **Remember Me**: Optional persistent login functionality

#### Form Validation

- **Email**: Valid email format required
- **Password**: Minimum length and complexity requirements
- **Real-time feedback**: Visual indicators for validation state
- **Error display**: Field-specific error messages

---

### SignupForm

**File:** `apps/frontend/src/components/auth/SignupForm.tsx`

A feature-rich signup form with comprehensive validation and user guidance.

#### Props

| Prop           | Type                               | Default     | Description                          |
| -------------- | ---------------------------------- | ----------- | ------------------------------------ |
| `onSuccess`    | `(response: AuthResponse) => void` | `undefined` | Callback called when signup succeeds |
| `onError`      | `(error: string) => void`          | `undefined` | Callback called when signup fails    |
| `onLoginClick` | `() => void`                       | `undefined` | Callback for login link              |
| `className`    | `string`                           | `''`        | Additional CSS classes               |
| `autoFocus`    | `boolean`                          | `true`      | Whether to auto-focus the name field |

#### Usage

```tsx
import { SignupForm } from '@/components/auth/SignupForm';

<SignupForm
  onSuccess={response => {
    console.log('Signup successful:', response);
    navigate('/verify-email');
  }}
  onError={error => {
    console.error('Signup failed:', error);
  }}
  onLoginClick={() => navigate('/login')}
/>;
```

#### Features

- **Comprehensive validation**: Name, email, password, and confirmation validation
- **Password strength indicator**: Real-time password strength feedback
- **Terms and conditions**: Required acceptance with validation
- **Newsletter opt-in**: Optional newsletter subscription
- **Accessibility**: Full keyboard navigation and screen reader support
- **Progressive enhancement**: Works without JavaScript for basic functionality

#### Form Fields

- **Name**: Required, minimum 2 characters
- **Email**: Valid email format, uniqueness checked
- **Password**: Strength requirements with visual indicator
- **Confirm Password**: Must match password field
- **Terms**: Required acceptance checkbox
- **Newsletter**: Optional subscription checkbox

---

### ResetPasswordForm

**File:** `apps/frontend/src/components/auth/ResetPasswordForm.tsx`

A simple and secure password reset form.

#### Props

| Prop            | Type                      | Default     | Description                              |
| --------------- | ------------------------- | ----------- | ---------------------------------------- |
| `onSuccess`     | `() => void`              | `undefined` | Callback called when reset email is sent |
| `onError`       | `(error: string) => void` | `undefined` | Callback called when reset fails         |
| `onBackToLogin` | `() => void`              | `undefined` | Callback for back to login link          |
| `className`     | `string`                  | `''`        | Additional CSS classes                   |

#### Usage

```tsx
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

<ResetPasswordForm
  onSuccess={() => {
    setMessage('Password reset email sent! Check your inbox.');
    navigate('/login');
  }}
  onError={error => {
    console.error('Reset failed:', error);
  }}
  onBackToLogin={() => navigate('/login')}
/>;
```

#### Features

- **Email validation**: Ensures valid email format
- **Rate limiting**: Prevents abuse with cooldown periods
- **Clear feedback**: Success and error states with helpful messages
- **Security**: No user enumeration, consistent response times

---

### ErrorDisplay

**File:** `apps/frontend/src/components/auth/ErrorDisplay.tsx`

A reusable error display component with accessibility and user experience features.

#### Props

| Prop               | Type                | Default     | Description                         |
| ------------------ | ------------------- | ----------- | ----------------------------------- |
| `error`            | `UserFriendlyError` | Required    | Error object to display             |
| `onRetry`          | `() => void`        | `undefined` | Callback for retry button           |
| `onContactSupport` | `() => void`        | `undefined` | Callback for contact support button |
| `className`        | `string`            | `''`        | Additional CSS classes              |

#### Usage

```tsx
import { ErrorDisplay } from '@/components/auth/ErrorDisplay';

<ErrorDisplay
  error={{
    title: 'Login Failed',
    message: 'Invalid email or password',
    code: 'AUTH_INVALID_CREDENTIALS',
    retry: true,
    contactSupport: false,
  }}
  onRetry={handleRetry}
  onContactSupport={handleContactSupport}
/>;
```

#### Features

- **Accessibility**: Proper ARIA labels and live regions for screen readers
- **User-friendly messages**: Converts technical errors to user-friendly language
- **Action buttons**: Configurable retry and support contact options
- **Visual hierarchy**: Clear typography and spacing for readability

---

## React Context

### AuthContext

**File:** `apps/frontend/src/contexts/AuthContext.tsx`

Provides authentication state management across the application.

#### Context Value

The AuthContext provides the same interface as the `useAuth` hook:

```tsx
interface AuthContextValue {
  // Core auth state
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  // Auth operations
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (userData: SignupData) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
  refreshSession: () => Promise<AuthResponse>;

  // Additional methods...
}
```

#### Usage

```tsx
import { AuthProvider, useAuthContextSafe } from '@/contexts/AuthContext';

// Wrap your app
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>{/* Your routes */}</Routes>
      </Router>
    </AuthProvider>
  );
}

// Use in components
function MyComponent() {
  const auth = useAuthContextSafe();

  if (auth.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>{auth.isAuthenticated ? <p>Welcome, {auth.user?.name}!</p> : <p>Please log in</p>}</div>
  );
}
```

#### Features

- **Automatic session restoration**: Restores user session on app initialization
- **Multi-tab synchronization**: Syncs auth state across browser tabs
- **Error handling**: Centralizes error state management
- **Loading states**: Manages loading states for all auth operations

---

## API Hooks

### useAuth

**File:** `packages/api/src/hooks/useAuth.ts`

The primary hook for authentication operations and state management.

#### Return Value

```tsx
interface UseAuthReturn {
  // Core auth state
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  // Auth operations
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (userData: SignupData) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
  refreshSession: () => Promise<AuthResponse>;

  // Profile operations
  updateProfile: (updates: Partial<AuthUser>) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<AuthResponse>;

  // Session management
  hasValidSession: boolean;
  isSessionExpired: boolean;
  isSessionExpiring: boolean;
  getSessionTimeRemaining: () => number;
  validateSession: () => Promise<{ isValid: boolean; user?: AuthUser; error?: any }>;

  // Utility methods
  clearState: () => void;
  clearError: () => void;
}
```

#### Usage

```tsx
import { useAuth } from '@agentic-workflow/api';

function LoginComponent() {
  const auth = useAuth();

  const handleLogin = async credentials => {
    try {
      const response = await auth.login(credentials);
      if (response.success) {
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  return <div>{/* Login form */}</div>;
}
```

#### Features

- **Complete auth lifecycle**: Handles login, signup, logout, and session management
- **Automatic token management**: Handles token refresh and storage
- **Error handling**: Provides detailed error information
- **Session monitoring**: Tracks session expiration and validity
- **Profile management**: User profile updates and password changes

---

## Utilities

### Error Handling

**File:** `apps/frontend/src/utils/authErrorHandler.ts`

#### useAuthErrorHandler

A hook that provides consistent error handling across authentication components.

```tsx
interface UseAuthErrorHandlerOptions {
  context: string;
  onRetry?: () => void;
  onForgotPassword?: () => void;
  onContactSupport?: () => void;
}

interface UseAuthErrorHandlerReturn {
  handleError: (error: any) => UserFriendlyError;
  isNetworkError: (error: any) => boolean;
  getOfflineError: () => UserFriendlyError;
}
```

#### Usage

```tsx
import { useAuthErrorHandler } from '@/utils/authErrorHandler';

const { handleError, isNetworkError } = useAuthErrorHandler({
  context: 'login',
  onRetry: handleRetry,
  onForgotPassword: () => navigate('/reset-password'),
});

const friendlyError = handleError(apiError);
```

### Validation

**File:** `packages/shared/src/utils/auth-validation.ts`

Provides validation utilities for authentication forms.

#### Functions

```tsx
// Email validation
validateEmail(email: string): ValidationResult;

// Password validation
validatePassword(password: string): PasswordValidationResult;

// Name validation
validateName(name: string): ValidationResult;

// Form validation schemas
loginSchema: ValidationSchema;
signupSchema: ValidationSchema;
```

---

## Integration Examples

### Basic Authentication Flow

```tsx
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LoginForm } from '@/components/auth/LoginForm';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path='/login'
            element={
              <AuthGuard requireNoAuth={true} onAuthForbidden={() => navigate('/dashboard')}>
                <LoginForm onSuccess={() => navigate('/dashboard')} />
              </AuthGuard>
            }
          />
          <Route
            path='/dashboard'
            element={
              <AuthGuard requireAuth={true} onAuthRequired={() => navigate('/login')}>
                <Dashboard />
              </AuthGuard>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

### Custom Authentication Hook

```tsx
import { useAuth } from '@agentic-workflow/api';

function useCustomAuth() {
  const auth = useAuth();

  const loginWithEmail = async (email: string, password: string) => {
    return auth.login({ email, password });
  };

  const signupWithProfile = async (userData: SignupData) => {
    const response = await auth.signup(userData);
    if (response.success) {
      // Additional profile setup
    }
    return response;
  };

  return {
    ...auth,
    loginWithEmail,
    signupWithProfile,
  };
}
```

### Error Boundary Integration

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorDisplay } from '@/components/auth/ErrorDisplay';

function AuthErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <ErrorDisplay
      error={{
        title: 'Authentication Error',
        message: 'Something went wrong with authentication',
        code: 'AUTH_UNEXPECTED_ERROR',
        retry: true,
      }}
      onRetry={resetErrorBoundary}
    />
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={AuthErrorFallback}>
      <AuthProvider>{/* Your app */}</AuthProvider>
    </ErrorBoundary>
  );
}
```

---

## Troubleshooting

### Common Issues

#### 1. Authentication Context Not Found

**Error:** `useAuthContextSafe must be used within an AuthProvider`

**Solution:** Ensure your component is wrapped with `AuthProvider`:

```tsx
// ❌ Wrong
function App() {
  return <LoginForm />;
}

// ✅ Correct
function App() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
```

#### 2. Session Not Persisting

**Problem:** User gets logged out when refreshing the page

**Solution:** Check that token storage is properly configured:

```tsx
// Verify environment variables
VITE_SUPABASE_URL = your - supabase - url;
VITE_SUPABASE_ANON_KEY = your - supabase - key;

// Check browser storage permissions
// Ensure cookies are enabled for persistent sessions
```

#### 3. Form Validation Errors

**Problem:** Form validation not working correctly

**Solution:** Ensure validation utilities are properly imported:

```tsx
import { validateEmail, validatePassword } from '@agentic-workflow/shared';

// Use validation in your forms
const emailError = validateEmail(email);
if (!emailError.isValid) {
  setErrors({ email: emailError.errors[0] });
}
```

#### 4. Network Errors

**Problem:** Authentication fails with network errors

**Solution:** Implement proper error handling:

```tsx
const { handleError, isNetworkError } = useAuthErrorHandler({
  context: 'login',
});

try {
  await auth.login(credentials);
} catch (error) {
  const friendlyError = handleError(error);

  if (isNetworkError(error)) {
    // Handle network-specific errors
    setError('Please check your internet connection');
  } else {
    setError(friendlyError.message);
  }
}
```

#### 5. TypeScript Errors

**Problem:** TypeScript compilation errors

**Solution:** Ensure proper type imports:

```tsx
import type {
  AuthUser,
  LoginCredentials,
  SignupData,
  AuthResponse,
} from '@agentic-workflow/shared';
```

### Performance Issues

#### 1. Slow Authentication Checks

**Problem:** AuthGuard takes too long to resolve

**Solution:** Implement proper caching and optimization:

```tsx
// Use React.memo for AuthGuard when appropriate
const AuthGuard = React.memo(({ children, ...props }) => {
  // Component implementation
});

// Implement proper loading states
if (auth.isInitializing) {
  return <AuthLoadingSkeleton />;
}
```

#### 2. Memory Leaks

**Problem:** Auth context causing memory leaks

**Solution:** Ensure proper cleanup:

```tsx
useEffect(() => {
  // Setup auth listeners
  const cleanup = setupAuthListeners();

  return () => {
    // Cleanup on unmount
    cleanup();
  };
}, []);
```

### Security Considerations

1. **Always validate on the server**: Client-side validation is for UX only
2. **Use HTTPS in production**: Ensure secure token transmission
3. **Implement proper CSRF protection**: Use CSRF tokens for state-changing operations
4. **Regular security audits**: Monitor for vulnerabilities in dependencies
5. **Rate limiting**: Implement rate limiting for auth endpoints

### Support

For additional support:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [API Documentation](./api-documentation.md)
3. Contact the development team

---

## API Reference

For detailed API documentation, see:

- [Authentication API Reference](./api-reference.md)
- [Type Definitions](../packages/shared/src/types/README.md)
- [Environment Configuration](./environment-setup.md)
