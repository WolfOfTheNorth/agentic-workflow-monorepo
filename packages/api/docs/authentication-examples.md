# Authentication Integration Examples

This document provides practical examples for integrating authentication components into your application.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Route Protection](#route-protection)
3. [Form Integration](#form-integration)
4. [Custom Hooks](#custom-hooks)
5. [Error Handling](#error-handling)
6. [Advanced Patterns](#advanced-patterns)

## Basic Setup

### App-Level Integration

```tsx
// apps/frontend/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { AuthErrorFallback } from './components/auth/AuthErrorFallback';

function App() {
  return (
    <ErrorBoundary FallbackComponent={AuthErrorFallback}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route
              path='/login'
              element={
                <AuthGuard
                  requireNoAuth={true}
                  onAuthForbidden={() => <Navigate to='/dashboard' replace />}
                >
                  <LoginPage />
                </AuthGuard>
              }
            />

            <Route
              path='/signup'
              element={
                <AuthGuard
                  requireNoAuth={true}
                  onAuthForbidden={() => <Navigate to='/dashboard' replace />}
                >
                  <SignupPage />
                </AuthGuard>
              }
            />

            {/* Protected routes */}
            <Route
              path='/dashboard'
              element={
                <AuthGuard
                  requireAuth={true}
                  onAuthRequired={() => <Navigate to='/login' replace />}
                >
                  <DashboardPage />
                </AuthGuard>
              }
            />

            {/* Default redirect */}
            <Route path='/' element={<Navigate to='/dashboard' replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
```

### Environment Configuration

```typescript
// apps/frontend/src/config/env.ts
export const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  auth: {
    redirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL || 'http://localhost:3000/auth/callback',
    sessionTimeout: parseInt(import.meta.env.VITE_AUTH_SESSION_TIMEOUT || '3600000', 10),
  },
  app: {
    baseUrl: import.meta.env.VITE_APP_BASE_URL || 'http://localhost:3000',
    environment: import.meta.env.MODE || 'development',
  },
};

// Validate required environment variables
if (!config.supabase.url || !config.supabase.anonKey) {
  throw new Error('Missing required Supabase environment variables');
}
```

## Route Protection

### Advanced Route Protection

```tsx
// components/auth/ProtectedRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@agentic-workflow/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = '/login',
}: ProtectedRouteProps) {
  const auth = useAuth();
  const location = useLocation();

  // Show loading while initializing
  if (auth.isInitializing) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!auth.isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location.pathname }} replace />;
  }

  // Check role-based access if required
  if (requiredRole && auth.user?.role !== requiredRole) {
    return <Navigate to='/unauthorized' state={{ requiredRole }} replace />;
  }

  return <>{children}</>;
}

// Usage example
<ProtectedRoute requiredRole='admin'>
  <AdminPanel />
</ProtectedRoute>;
```

### Public Route Guard

```tsx
// components/auth/PublicRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@agentic-workflow/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface PublicRouteProps {
  children: ReactNode;
  redirectIfAuthenticated?: string;
}

export function PublicRoute({
  children,
  redirectIfAuthenticated = '/dashboard',
}: PublicRouteProps) {
  const auth = useAuth();

  if (auth.isInitializing) {
    return <LoadingSpinner />;
  }

  if (auth.isAuthenticated) {
    return <Navigate to={redirectIfAuthenticated} replace />;
  }

  return <>{children}</>;
}

// Usage
<PublicRoute redirectIfAuthenticated='/dashboard'>
  <LoginPage />
</PublicRoute>;
```

## Form Integration

### Custom Login Page

```tsx
// pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string>('');

  // Get the intended destination from navigation state
  const from = (location.state as any)?.from || '/dashboard';

  const handleLoginSuccess = () => {
    setMessage('Login successful! Redirecting...');
    setTimeout(() => {
      navigate(from, { replace: true });
    }, 1000);
  };

  const handleLoginError = (error: string) => {
    setMessage(`Login failed: ${error}`);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Sign in to your account
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Or{' '}
            <Link to='/signup' className='font-medium text-indigo-600 hover:text-indigo-500'>
              create a new account
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader>
            <h3 className='text-lg font-medium'>Login</h3>
          </CardHeader>
          <CardContent>
            {message && (
              <Alert
                className='mb-4'
                variant={message.includes('successful') ? 'success' : 'error'}
              >
                {message}
              </Alert>
            )}

            <LoginForm
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              onForgotPassword={() => navigate('/reset-password')}
              onSignupClick={() => navigate('/signup')}
              autoFocus={true}
              showRememberMe={true}
            />
          </CardContent>
        </Card>

        <div className='text-center'>
          <Link to='/reset-password' className='text-sm text-indigo-600 hover:text-indigo-500'>
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Custom Signup Page with Enhanced Validation

```tsx
// pages/SignupPage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SignupForm } from '@/components/auth/SignupForm';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

export function SignupPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSignupSuccess = () => {
    setMessage('Account created successfully! Please check your email for verification.');
    setTimeout(() => {
      navigate('/login');
    }, 3000);
  };

  const handleSignupError = (error: string) => {
    setMessage(`Signup failed: ${error}`);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Create your account
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Or{' '}
            <Link to='/login' className='font-medium text-indigo-600 hover:text-indigo-500'>
              sign in to your existing account
            </Link>
          </p>
        </div>

        <Card>
          <CardHeader>
            <h3 className='text-lg font-medium'>Sign Up</h3>
          </CardHeader>
          <CardContent>
            {message && (
              <Alert
                className='mb-4'
                variant={message.includes('successful') ? 'success' : 'error'}
              >
                {message}
              </Alert>
            )}

            <SignupForm
              onSuccess={handleSignupSuccess}
              onError={handleSignupError}
              onLoginClick={() => navigate('/login')}
              autoFocus={true}
            />

            {password && (
              <div className='mt-4'>
                <PasswordStrengthIndicator password={password} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className='text-center text-xs text-gray-500'>
          By signing up, you agree to our{' '}
          <Link to='/terms' className='text-indigo-600 hover:text-indigo-500'>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to='/privacy' className='text-indigo-600 hover:text-indigo-500'>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
```

## Custom Hooks

### Enhanced Authentication Hook

```tsx
// hooks/useEnhancedAuth.ts
import { useAuth } from '@agentic-workflow/api';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { toast } from '@/components/ui/Toast';

export function useEnhancedAuth() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Enhanced login with navigation and notifications
  const enhancedLogin = useCallback(
    async (credentials: { email: string; password: string }, redirectTo: string = '/dashboard') => {
      try {
        const response = await auth.login(credentials);

        if (response.success) {
          toast.success(`Welcome back, ${response.user?.name || 'User'}!`);
          navigate(redirectTo);
          return response;
        } else {
          toast.error(response.error?.message || 'Login failed');
          throw new Error(response.error?.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        toast.error(message);
        throw error;
      }
    },
    [auth.login, navigate]
  );

  // Enhanced signup with email verification flow
  const enhancedSignup = useCallback(
    async (userData: SignupData, redirectTo: string = '/verify-email') => {
      try {
        const response = await auth.signup(userData);

        if (response.success) {
          toast.success('Account created! Please check your email for verification.');
          navigate(redirectTo);
          return response;
        } else {
          toast.error(response.error?.message || 'Signup failed');
          throw new Error(response.error?.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Signup failed';
        toast.error(message);
        throw error;
      }
    },
    [auth.signup, navigate]
  );

  // Enhanced logout with confirmation
  const enhancedLogout = useCallback(
    async (showConfirmation: boolean = true) => {
      if (showConfirmation) {
        const confirmed = window.confirm('Are you sure you want to sign out?');
        if (!confirmed) return;
      }

      try {
        await auth.logout();
        toast.success('Signed out successfully');
        navigate('/login');
      } catch (error) {
        toast.error('Failed to sign out');
        throw error;
      }
    },
    [auth.logout, navigate]
  );

  // Session monitoring with warnings
  useEffect(() => {
    if (auth.isSessionExpiring) {
      toast.warning('Your session will expire soon. Please save your work.');
    }

    if (auth.isSessionExpired && auth.isAuthenticated) {
      toast.error('Your session has expired. Please sign in again.');
      navigate('/login');
    }
  }, [auth.isSessionExpiring, auth.isSessionExpired, auth.isAuthenticated, navigate]);

  return {
    ...auth,
    enhancedLogin,
    enhancedSignup,
    enhancedLogout,
  };
}
```

### Form State Management Hook

```tsx
// hooks/useAuthForm.ts
import { useState, useCallback } from 'react';
import { validateEmail, validatePassword, validateName } from '@agentic-workflow/shared';

interface FormField {
  value: string;
  error: string;
  touched: boolean;
}

interface AuthFormState {
  [key: string]: FormField;
}

export function useAuthForm<T extends Record<string, string>>(initialValues: T) {
  const [formState, setFormState] = useState<AuthFormState>(() => {
    const state: AuthFormState = {};
    Object.keys(initialValues).forEach(key => {
      state[key] = {
        value: initialValues[key],
        error: '',
        touched: false,
      };
    });
    return state;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((field: string, value: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        touched: true,
        error: validateField(field, value),
      },
    }));
  }, []);

  const setError = useCallback((field: string, error: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        error,
      },
    }));
  }, []);

  const validateField = useCallback(
    (field: string, value: string): string => {
      switch (field) {
        case 'email':
          const emailValidation = validateEmail(value);
          return emailValidation.isValid ? '' : emailValidation.errors[0] || '';

        case 'password':
          const passwordValidation = validatePassword(value);
          return passwordValidation.isValid ? '' : passwordValidation.errors[0] || '';

        case 'name':
          const nameValidation = validateName(value);
          return nameValidation.isValid ? '' : nameValidation.errors[0] || '';

        case 'confirmPassword':
          const password = formState.password?.value || '';
          return value === password ? '' : 'Passwords do not match';

        default:
          return '';
      }
    },
    [formState]
  );

  const validateForm = useCallback((): boolean => {
    let isValid = true;
    const newState = { ...formState };

    Object.keys(formState).forEach(field => {
      const error = validateField(field, formState[field].value);
      newState[field] = {
        ...newState[field],
        error,
        touched: true,
      };
      if (error) isValid = false;
    });

    setFormState(newState);
    return isValid;
  }, [formState, validateField]);

  const getFormData = useCallback((): T => {
    const data = {} as T;
    Object.keys(formState).forEach(key => {
      (data as any)[key] = formState[key].value;
    });
    return data;
  }, [formState]);

  const resetForm = useCallback(() => {
    const state: AuthFormState = {};
    Object.keys(initialValues).forEach(key => {
      state[key] = {
        value: initialValues[key],
        error: '',
        touched: false,
      };
    });
    setFormState(state);
    setIsSubmitting(false);
  }, [initialValues]);

  const hasErrors = Object.values(formState).some(field => field.error);
  const isFormValid = !hasErrors && Object.values(formState).every(field => field.touched);

  return {
    formState,
    setValue,
    setError,
    validateForm,
    getFormData,
    resetForm,
    isSubmitting,
    setIsSubmitting,
    hasErrors,
    isFormValid,
  };
}
```

## Error Handling

### Global Error Handler

```tsx
// utils/globalErrorHandler.ts
import { toast } from '@/components/ui/Toast';
import { logger } from '@/utils/logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: Date;
}

export class GlobalErrorHandler {
  static handle(error: any, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: {
        ...context,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
    };

    // Log error for debugging
    logger.error('Application Error', errorInfo);

    // Show user-friendly message
    this.showUserMessage(error, context);

    // Report to error tracking service
    this.reportError(errorInfo);
  }

  private static showUserMessage(error: any, context: ErrorContext) {
    if (this.isNetworkError(error)) {
      toast.error('Network error. Please check your connection and try again.');
    } else if (this.isAuthError(error)) {
      toast.error('Authentication error. Please sign in again.');
    } else if (this.isValidationError(error)) {
      toast.error('Please check your input and try again.');
    } else {
      toast.error('Something went wrong. Please try again later.');
    }
  }

  private static reportError(errorInfo: any) {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(errorInfo);
    }
  }

  private static isNetworkError(error: any): boolean {
    return error.name === 'NetworkError' || error.code === 'NETWORK_ERROR';
  }

  private static isAuthError(error: any): boolean {
    return error.code?.startsWith('AUTH_') || error.status === 401;
  }

  private static isValidationError(error: any): boolean {
    return error.code?.startsWith('VALIDATION_') || error.status === 422;
  }
}

// React Error Boundary with global handler
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        GlobalErrorHandler.handle(error, {
          component: 'AuthErrorBoundary',
          action: 'render_error',
          ...errorInfo,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Retry Logic Hook

```tsx
// hooks/useRetry.ts
import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/Toast';

interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
  onRetry?: (attempt: number) => void;
  onMaxAttemptsReached?: () => void;
}

export function useRetry<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: RetryOptions = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = true, onRetry, onMaxAttemptsReached } = options;

  const [attempts, setAttempts] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const executeWithRetry = useCallback(
    async (...args: Parameters<T>) => {
      let currentAttempt = 0;

      while (currentAttempt < maxAttempts) {
        try {
          setAttempts(currentAttempt + 1);

          if (currentAttempt > 0) {
            setIsRetrying(true);
            onRetry?.(currentAttempt);

            const currentDelay = backoff ? delay * Math.pow(2, currentAttempt - 1) : delay;
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }

          const result = await operation(...args);
          setIsRetrying(false);
          setAttempts(0);
          return result;
        } catch (error) {
          currentAttempt++;

          if (currentAttempt >= maxAttempts) {
            setIsRetrying(false);
            onMaxAttemptsReached?.();
            throw error;
          }
        }
      }
    },
    [operation, maxAttempts, delay, backoff, onRetry, onMaxAttemptsReached]
  );

  const reset = useCallback(() => {
    setAttempts(0);
    setIsRetrying(false);
  }, []);

  return {
    executeWithRetry,
    attempts,
    isRetrying,
    reset,
  };
}

// Usage example
function LoginComponent() {
  const auth = useAuth();

  const { executeWithRetry, isRetrying, attempts } = useRetry(auth.login, {
    maxAttempts: 3,
    onRetry: attempt => toast.info(`Retrying login... (${attempt}/${3})`),
    onMaxAttemptsReached: () => toast.error('Login failed after multiple attempts'),
  });

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      await executeWithRetry(credentials);
    } catch (error) {
      // Handle final error
    }
  };

  return (
    <LoginForm
      onSubmit={handleLogin}
      isLoading={isRetrying}
      helperText={isRetrying ? `Attempt ${attempts}/3` : undefined}
    />
  );
}
```

## Advanced Patterns

### Multi-Step Authentication Flow

```tsx
// components/auth/MultiStepAuth.tsx
import React, { useState, useCallback } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';
import { EmailVerificationForm } from '@/components/auth/EmailVerificationForm';
import { useAuth } from '@agentic-workflow/api';

type AuthStep = 'login' | 'two-factor' | 'email-verification' | 'complete';

export function MultiStepAuth() {
  const auth = useAuth();
  const [currentStep, setCurrentStep] = useState<AuthStep>('login');
  const [authData, setAuthData] = useState<any>(null);

  const handleLoginSuccess = useCallback((response: any) => {
    if (response.requiresTwoFactor) {
      setAuthData(response);
      setCurrentStep('two-factor');
    } else if (response.requiresEmailVerification) {
      setAuthData(response);
      setCurrentStep('email-verification');
    } else {
      setCurrentStep('complete');
    }
  }, []);

  const handleTwoFactorSuccess = useCallback(
    async (token: string) => {
      try {
        const response = await auth.verifyTwoFactor(authData.sessionId, token);

        if (response.requiresEmailVerification) {
          setCurrentStep('email-verification');
        } else {
          setCurrentStep('complete');
        }
      } catch (error) {
        // Handle error
      }
    },
    [auth, authData]
  );

  const handleEmailVerificationSuccess = useCallback(() => {
    setCurrentStep('complete');
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case 'login':
        return <LoginForm onSuccess={handleLoginSuccess} showRememberMe={false} />;

      case 'two-factor':
        return (
          <TwoFactorForm
            onSuccess={handleTwoFactorSuccess}
            onBack={() => setCurrentStep('login')}
          />
        );

      case 'email-verification':
        return (
          <EmailVerificationForm
            email={authData?.email}
            onSuccess={handleEmailVerificationSuccess}
            onBack={() => setCurrentStep('login')}
          />
        );

      case 'complete':
        return (
          <div className='text-center'>
            <h2>Welcome!</h2>
            <p>Authentication completed successfully.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className='max-w-md mx-auto'>
      <div className='mb-8'>
        <StepIndicator currentStep={currentStep} />
      </div>

      {renderStep()}
    </div>
  );
}
```

### Session Management with Persistence

```tsx
// hooks/useSessionPersistence.ts
import { useEffect, useCallback } from 'react';
import { useAuth } from '@agentic-workflow/api';

export function useSessionPersistence() {
  const auth = useAuth();

  // Save session state to localStorage
  const saveSession = useCallback(() => {
    if (auth.session && auth.user) {
      const sessionData = {
        user: auth.user,
        session: auth.session,
        timestamp: Date.now(),
      };
      localStorage.setItem('auth_session', JSON.stringify(sessionData));
    }
  }, [auth.session, auth.user]);

  // Load session state from localStorage
  const loadSession = useCallback(async () => {
    try {
      const saved = localStorage.getItem('auth_session');
      if (saved) {
        const sessionData = JSON.parse(saved);
        const age = Date.now() - sessionData.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (age < maxAge) {
          // Validate session with server
          const validation = await auth.validateSession();
          if (!validation.isValid) {
            localStorage.removeItem('auth_session');
          }
        } else {
          localStorage.removeItem('auth_session');
        }
      }
    } catch (error) {
      localStorage.removeItem('auth_session');
    }
  }, [auth.validateSession]);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    localStorage.removeItem('auth_session');
  }, []);

  // Auto-save session when it changes
  useEffect(() => {
    if (auth.isAuthenticated) {
      saveSession();
    } else {
      clearSession();
    }
  }, [auth.isAuthenticated, saveSession, clearSession]);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return {
    saveSession,
    loadSession,
    clearSession,
  };
}
```

These examples provide comprehensive patterns for integrating authentication into your application with proper error handling, state management, and user experience considerations.
