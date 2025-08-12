import { useState, useCallback, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/MockAuthContext';
import { AuthErrorBoundary } from './components/error/AuthErrorBoundary';
import { ToastProvider, useToast } from './components/feedback';
import LoadingSpinner from './components/ui/LoadingSpinner';
import {
  HomeRoute,
  LoginRoute,
  SignupRoute,
  ResetPasswordRoute,
  DashboardRoute,
  preloadCriticalRoutes,
  preloadAuthenticatedRoutes,
  preloadUnauthenticatedRoutes,
  preloadRelatedRoutes,
} from './routes';
import './App.css';

// Simple routing states
const ROUTES = {
  HOME: 'home',
  LOGIN: 'login',
  SIGNUP: 'signup',
  RESET_PASSWORD: 'reset-password',
  DASHBOARD: 'dashboard',
};

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState(ROUTES.HOME);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showSuccess, showError } = useToast();

  // Preload routes based on authentication state
  useEffect(() => {
    // Preload critical routes immediately
    preloadCriticalRoutes();

    // Preload routes based on auth state
    if (isAuthenticated) {
      preloadAuthenticatedRoutes();
    } else {
      preloadUnauthenticatedRoutes();
    }
  }, [isAuthenticated]);

  // Navigation functions
  const navigateTo = useCallback((route, options = {}) => {
    setCurrentRoute(route);
    if (options.redirectAfterAuth) {
      setRedirectAfterAuth(options.redirectAfterAuth);
    }

    // Preload related routes for better UX
    preloadRelatedRoutes(route);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    const destination = redirectAfterAuth || ROUTES.DASHBOARD;
    setRedirectAfterAuth(null);

    // Show success toast
    if (currentRoute === ROUTES.LOGIN) {
      showSuccess('Welcome back!', 'You have been successfully signed in.');
    } else if (currentRoute === ROUTES.SIGNUP) {
      showSuccess('Account created!', 'Welcome to Agentic Workflow. You are now signed in.');
    }

    navigateTo(destination);
  }, [redirectAfterAuth, navigateTo, showSuccess, currentRoute]);

  const handleAuthError = useCallback(
    error => {
      console.error('Authentication error:', error);
      showError('Authentication Failed', error);
    },
    [showError]
  );

  const handleDashboardRedirect = useCallback(() => {
    navigateTo(ROUTES.DASHBOARD);
  }, [navigateTo]);

  const handleAuthRequired = useCallback(() => {
    setRedirectAfterAuth(currentRoute);
    navigateTo(ROUTES.LOGIN);
  }, [currentRoute, navigateTo]);

  const handleAuthForbidden = useCallback(() => {
    navigateTo(ROUTES.DASHBOARD);
  }, [navigateTo]);

  const handleSignOut = useCallback(() => {
    // This would typically use the auth context to logout
    setIsAuthenticated(false);
    navigateTo(ROUTES.HOME);
  }, [navigateTo]);

  // Render current route with Suspense for lazy loading
  const renderCurrentRoute = () => {
    switch (currentRoute) {
      case ROUTES.HOME:
        return (
          <Suspense fallback={<LoadingSpinner message='Loading home...' />}>
            <HomeRoute
              onLoginClick={() => navigateTo(ROUTES.LOGIN)}
              onSignupClick={() => navigateTo(ROUTES.SIGNUP)}
              onDashboardRedirect={handleDashboardRedirect}
              onAuthForbidden={handleAuthForbidden}
            />
          </Suspense>
        );

      case ROUTES.LOGIN:
        return (
          <Suspense fallback={<LoadingSpinner message='Loading login form...' />}>
            <LoginRoute
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
              onForgotPassword={() => navigateTo(ROUTES.RESET_PASSWORD)}
              onSignupClick={() => navigateTo(ROUTES.SIGNUP)}
              onAuthForbidden={handleAuthForbidden}
            />
          </Suspense>
        );

      case ROUTES.SIGNUP:
        return (
          <Suspense fallback={<LoadingSpinner message='Loading signup form...' />}>
            <SignupRoute
              onSuccess={handleAuthSuccess}
              onError={handleAuthError}
              onLoginClick={() => navigateTo(ROUTES.LOGIN)}
              onAuthForbidden={handleAuthForbidden}
            />
          </Suspense>
        );

      case ROUTES.RESET_PASSWORD:
        return (
          <Suspense fallback={<LoadingSpinner message='Loading reset form...' />}>
            <ResetPasswordRoute
              onSuccess={() => {
                // Stay on reset password form to show success state
              }}
              onError={handleAuthError}
              onBackToLogin={() => navigateTo(ROUTES.LOGIN)}
              onAuthForbidden={handleAuthForbidden}
            />
          </Suspense>
        );

      case ROUTES.DASHBOARD:
        return (
          <Suspense fallback={<LoadingSpinner message='Loading dashboard...' />}>
            <DashboardRoute onAuthRequired={handleAuthRequired} onSignOut={handleSignOut} />
          </Suspense>
        );

      default:
        return (
          <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100'>
            <div className='text-center'>
              <h1 className='text-2xl font-bold text-gray-900 mb-4'>404 - Page Not Found</h1>
              <button
                onClick={() => navigateTo(ROUTES.HOME)}
                className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
              >
                Go Home
              </button>
            </div>
          </div>
        );
    }
  };

  return <div className='App'>{renderCurrentRoute()}</div>;
}

function App() {
  return (
    <AuthErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Auth Error Boundary:', error, errorInfo);
      }}
      maxRetries={3}
    >
      <AuthProvider>
        <ToastProvider position='top-right' maxToasts={5}>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}

export default App;
