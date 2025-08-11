# Authentication Quick Reference

A quick reference guide for using authentication components in the Agentic Workflow project.

## Quick Setup

### 1. Wrap App with AuthProvider

```tsx
import { AuthProvider } from '@/contexts/AuthContext';

function App() {
  return <AuthProvider>{/* Your app content */}</AuthProvider>;
}
```

### 2. Use Authentication Hook

```tsx
import { useAuth } from '@agentic-workflow/api';

function MyComponent() {
  const auth = useAuth();

  // Check if user is authenticated
  if (auth.isAuthenticated) {
    return <div>Welcome, {auth.user?.name}!</div>;
  }

  return <div>Please log in</div>;
}
```

## Common Patterns

### Protected Routes

```tsx
import { AuthGuard } from '@/components/auth/AuthGuard';

<AuthGuard requireAuth={true} onAuthRequired={() => navigate('/login')}>
  <ProtectedComponent />
</AuthGuard>;
```

### Login Form

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

<LoginForm
  onSuccess={() => navigate('/dashboard')}
  onForgotPassword={() => navigate('/reset-password')}
  onSignupClick={() => navigate('/signup')}
/>;
```

### Signup Form

```tsx
import { SignupForm } from '@/components/auth/SignupForm';

<SignupForm onSuccess={() => navigate('/verify-email')} onLoginClick={() => navigate('/login')} />;
```

### Error Handling

```tsx
import { useAuthErrorHandler } from '@/utils/authErrorHandler';

const { handleError } = useAuthErrorHandler({
  context: 'login',
  onRetry: handleRetry,
});

try {
  await auth.login(credentials);
} catch (error) {
  const friendlyError = handleError(error);
  setError(friendlyError.message);
}
```

## Component Props Reference

### AuthGuard Props

| Prop              | Type         | Default | Description               |
| ----------------- | ------------ | ------- | ------------------------- |
| `requireAuth`     | `boolean`    | `true`  | Require authentication    |
| `requireNoAuth`   | `boolean`    | `false` | Require no authentication |
| `onAuthRequired`  | `() => void` | -       | Auth required callback    |
| `onAuthForbidden` | `() => void` | -       | Auth forbidden callback   |

### LoginForm Props

| Prop               | Type                 | Default | Description               |
| ------------------ | -------------------- | ------- | ------------------------- |
| `onSuccess`        | `(response) => void` | -       | Success callback          |
| `onForgotPassword` | `() => void`         | -       | Forgot password callback  |
| `onSignupClick`    | `() => void`         | -       | Signup link callback      |
| `showRememberMe`   | `boolean`            | `true`  | Show remember me checkbox |

### SignupForm Props

| Prop           | Type                 | Default | Description           |
| -------------- | -------------------- | ------- | --------------------- |
| `onSuccess`    | `(response) => void` | -       | Success callback      |
| `onLoginClick` | `() => void`         | -       | Login link callback   |
| `autoFocus`    | `boolean`            | `true`  | Auto-focus name field |

## Hook Methods

### useAuth Methods

```tsx
const auth = useAuth();

// Authentication
await auth.login({ email, password });
await auth.signup({ name, email, password, termsAccepted: true });
await auth.logout();

// Session management
await auth.refreshSession();
const isValid = await auth.validateSession();

// Profile management
await auth.updateProfile({ name: 'New Name' });
await auth.updatePassword('newPassword');
await auth.resetPassword('user@example.com');

// State checks
auth.isAuthenticated;
auth.isLoading;
auth.hasValidSession;
auth.isSessionExpired;
```

## Common Use Cases

### 1. Check Authentication Status

```tsx
function MyComponent() {
  const auth = useAuth();

  if (auth.isInitializing) {
    return <LoadingSpinner />;
  }

  return auth.isAuthenticated ? <Dashboard /> : <LoginPrompt />;
}
```

### 2. Handle Login

```tsx
async function handleLogin(email: string, password: string) {
  try {
    const response = await auth.login({ email, password });
    if (response.success) {
      navigate('/dashboard');
    }
  } catch (error) {
    setError('Login failed. Please try again.');
  }
}
```

### 3. Auto-redirect Based on Auth State

```tsx
function AuthWrapper({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.isInitializing) {
      if (auth.isAuthenticated) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [auth.isAuthenticated, auth.isInitializing, navigate]);

  return auth.isInitializing ? <LoadingSpinner /> : children;
}
```

### 4. Session Monitoring

```tsx
function SessionMonitor() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isSessionExpiring) {
      // Show warning to user
      showSessionExpiringWarning();
    }

    if (auth.isSessionExpired) {
      // Redirect to login
      navigate('/login');
    }
  }, [auth.isSessionExpiring, auth.isSessionExpired]);

  return null;
}
```

## Validation Examples

### Form Validation

```tsx
import { validateEmail, validatePassword } from '@agentic-workflow/shared';

function validateForm(data: { email: string; password: string }) {
  const errors: any = {};

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.errors[0];
  }

  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
```

## TypeScript Types

```tsx
import type {
  AuthUser,
  AuthSession,
  LoginCredentials,
  SignupData,
  AuthResponse
} from '@agentic-workflow/shared';

// User data
const user: AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

// Login credentials
const credentials: LoginCredentials = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

// Signup data
const signupData: SignupData = {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  newsletterOptIn?: boolean;
};
```

## Environment Variables

Required environment variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Custom configuration
VITE_AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
VITE_AUTH_SESSION_TIMEOUT=3600000
```

## Best Practices

### 1. Always Use Safe Context Hook

```tsx
// ✅ Use the safe version
import { useAuthContextSafe } from '@/contexts/AuthContext';

// ❌ Don't use raw context
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
```

### 2. Handle Loading States

```tsx
function MyComponent() {
  const auth = useAuth();

  if (auth.isInitializing) {
    return <InitializingSpinner />;
  }

  if (auth.isLoading) {
    return <LoadingSpinner />;
  }

  // Render component
}
```

### 3. Implement Error Boundaries

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary FallbackComponent={AuthErrorFallback}>
  <AuthProvider>
    <App />
  </AuthProvider>
</ErrorBoundary>;
```

### 4. Clean Up on Unmount

```tsx
useEffect(() => {
  const cleanup = setupAuthListeners();

  return () => {
    cleanup();
    auth.clearError(); // Clear any pending errors
  };
}, []);
```

## Troubleshooting

### Common Issues

1. **Context not found**: Ensure `AuthProvider` wraps your app
2. **Session not persisting**: Check browser storage and cookies
3. **TypeScript errors**: Import types from `@agentic-workflow/shared`
4. **Network errors**: Implement proper error handling with `useAuthErrorHandler`

### Debug Tips

```tsx
// Log auth state for debugging
console.log('Auth state:', {
  isAuthenticated: auth.isAuthenticated,
  isLoading: auth.isLoading,
  user: auth.user,
  error: auth.error,
});
```
