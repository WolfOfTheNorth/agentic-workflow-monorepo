import React, { ReactNode, useEffect, useState } from 'react';
import { useAuthContextSafe } from '../../contexts/MockAuthContext';

export interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireNoAuth?: boolean;
  fallback?: ReactNode;
  onAuthRequired?: () => void;
  onAuthForbidden?: () => void;
  redirectDelay?: number;
}

interface AuthGuardState {
  isChecking: boolean;
  shouldRender: boolean;
  redirectReason: string | null;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireAuth = true,
  requireNoAuth = false,
  fallback,
  onAuthRequired,
  onAuthForbidden,
  redirectDelay = 1000,
}) => {
  const auth = useAuthContextSafe();
  const [state, setState] = useState<AuthGuardState>({
    isChecking: true,
    shouldRender: false,
    redirectReason: null,
  });

  // Validate props - moved outside the component or handle differently
  const hasInvalidProps = requireAuth && requireNoAuth;

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (hasInvalidProps) {
      console.error('AuthGuard: Cannot require both auth and no auth simultaneously');
      return cleanup;
    }

    if (!auth) {
      setState({
        isChecking: false,
        shouldRender: false,
        redirectReason: 'Authentication service unavailable',
      });
      return cleanup;
    }

    // Wait for auth initialization to complete
    if (auth.isInitializing) {
      setState(prev => ({ ...prev, isChecking: true }));
      return cleanup;
    }

    const isAuthenticated = auth.isAuthenticated;
    const hasValidSession = auth.hasValidSession;

    let shouldRender = true;
    let redirectReason: string | null = null;

    if (requireAuth) {
      if (!isAuthenticated || !hasValidSession) {
        shouldRender = false;
        redirectReason = !isAuthenticated
          ? 'Authentication required'
          : 'Session expired or invalid';

        // Trigger auth required callback after a delay
        const timer = setTimeout(() => {
          onAuthRequired?.();
        }, redirectDelay);

        cleanup = () => clearTimeout(timer);
      }
    }

    if (requireNoAuth) {
      if (isAuthenticated && hasValidSession) {
        shouldRender = false;
        redirectReason = 'Already authenticated';

        // Trigger auth forbidden callback after a delay
        const timer = setTimeout(() => {
          onAuthForbidden?.();
        }, redirectDelay);

        cleanup = () => clearTimeout(timer);
      }
    }

    setState({
      isChecking: false,
      shouldRender,
      redirectReason,
    });

    return cleanup;
  }, [
    auth,
    requireAuth,
    requireNoAuth,
    onAuthRequired,
    onAuthForbidden,
    redirectDelay,
    hasInvalidProps,
  ]);

  // Handle invalid props
  if (hasInvalidProps) {
    return null;
  }

  // Show loading state while checking authentication
  if (state.isChecking || auth?.isInitializing) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'
        role='main'
        aria-label='Loading authentication state'
      >
        <div className='text-center'>
          <div
            className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'
            aria-hidden='true'
          />
          <p className='text-gray-600 text-lg'>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show auth loading state if auth operations are in progress
  if (auth?.isLoading) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'
        role='main'
        aria-label='Authentication in progress'
      >
        <div className='text-center'>
          <div
            className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'
            aria-hidden='true'
          />
          <p className='text-gray-600 text-lg'>Please wait...</p>
        </div>
      </div>
    );
  }

  // Show custom fallback if provided and auth check failed
  if (!state.shouldRender && fallback) {
    return <>{fallback}</>;
  }

  // Show default fallback for auth required
  if (!state.shouldRender && requireAuth) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100'
        role='main'
        aria-label='Authentication required'
      >
        <div className='max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center'>
          <div className='mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4'>
            <svg
              className='h-8 w-8 text-red-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              />
            </svg>
          </div>

          <h2 className='text-2xl font-bold text-gray-900 mb-2'>Access Restricted</h2>

          <p className='text-gray-600 mb-6'>
            {state.redirectReason || 'You need to be signed in to access this page.'}
          </p>

          <div className='space-y-4'>
            <button
              onClick={onAuthRequired}
              className='w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors'
            >
              Sign In
            </button>

            <p className='text-sm text-gray-500'>Redirecting you to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show default fallback for no auth required (already authenticated)
  if (!state.shouldRender && requireNoAuth) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100'
        role='main'
        aria-label='Already authenticated'
      >
        <div className='max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center'>
          <div className='mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4'>
            <svg
              className='h-8 w-8 text-green-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M5 13l4 4L19 7'
              />
            </svg>
          </div>

          <h2 className='text-2xl font-bold text-gray-900 mb-2'>Already Signed In</h2>

          <p className='text-gray-600 mb-6'>
            You&apos;re already authenticated. Redirecting you to the dashboard...
          </p>

          <div className='space-y-4'>
            <button
              onClick={onAuthForbidden}
              className='w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors'
            >
              Go to Dashboard
            </button>

            <p className='text-sm text-gray-500'>Redirecting automatically...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle authentication service unavailable
  if (!auth) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100'
        role='main'
        aria-label='Service unavailable'
      >
        <div className='max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center'>
          <div className='mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
            <svg
              className='h-8 w-8 text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>

          <h2 className='text-2xl font-bold text-gray-900 mb-2'>Service Unavailable</h2>

          <p className='text-gray-600 mb-6'>
            Authentication service is currently unavailable. Please try again later.
          </p>

          <button
            onClick={() => window.location.reload()}
            className='w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors'
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Render children if all checks pass
  return <>{children}</>;
};

// Higher-order component version for easier usage
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<AuthGuardProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => (
    <AuthGuard {...options}>
      <Component {...props} />
    </AuthGuard>
  );

  WrappedComponent.displayName = `withAuthGuard(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Convenience components for specific use cases
export const RequireAuth: React.FC<
  Omit<AuthGuardProps, 'requireAuth' | 'requireNoAuth'>
> = props => <AuthGuard {...props} requireAuth={true} requireNoAuth={false} />;

export const RequireNoAuth: React.FC<
  Omit<AuthGuardProps, 'requireAuth' | 'requireNoAuth'>
> = props => <AuthGuard {...props} requireAuth={false} requireNoAuth={true} />;

export default AuthGuard;
