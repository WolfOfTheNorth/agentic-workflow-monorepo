import { lazy, Suspense } from 'react';
import { RequireNoAuth } from '../components/auth/AuthGuard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Lazy load individual form components for better code splitting
const LoginForm = lazy(() => import('../components/auth/SimpleLoginForm'));
const SignupForm = lazy(() => import('../components/auth/SimpleSignupForm'));
const ResetPasswordForm = lazy(() => import('../components/auth/SimpleResetPasswordForm'));

/**
 * Authentication route components
 * These are bundled together as they're related functionality
 */

export const LoginRoute = ({
  onSuccess,
  onError,
  onForgotPassword,
  onSignupClick,
  onAuthForbidden,
}) => (
  <RequireNoAuth onAuthForbidden={onAuthForbidden} redirectDelay={1500}>
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8'>
      <Suspense fallback={<LoadingSpinner message='Loading login form...' />}>
        <LoginForm
          onSuccess={onSuccess}
          onError={onError}
          onForgotPassword={onForgotPassword}
          onSignupClick={onSignupClick}
        />
      </Suspense>
    </div>
  </RequireNoAuth>
);

export const SignupRoute = ({ onSuccess, onError, onLoginClick, onAuthForbidden }) => (
  <RequireNoAuth onAuthForbidden={onAuthForbidden} redirectDelay={1500}>
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4 sm:px-6 lg:px-8'>
      <Suspense fallback={<LoadingSpinner message='Loading signup form...' />}>
        <SignupForm onSuccess={onSuccess} onError={onError} onLoginClick={onLoginClick} />
      </Suspense>
    </div>
  </RequireNoAuth>
);

export const ResetPasswordRoute = ({ onSuccess, onError, onBackToLogin, onAuthForbidden }) => (
  <RequireNoAuth onAuthForbidden={onAuthForbidden} redirectDelay={1500}>
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 px-4 sm:px-6 lg:px-8'>
      <Suspense fallback={<LoadingSpinner message='Loading reset password form...' />}>
        <ResetPasswordForm onSuccess={onSuccess} onError={onError} onBackToLogin={onBackToLogin} />
      </Suspense>
    </div>
  </RequireNoAuth>
);
