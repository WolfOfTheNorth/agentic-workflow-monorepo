import { lazy } from 'react';

// Route-level code splitting
// Each route is loaded only when needed, reducing initial bundle size

/**
 * Lazy-loaded route components
 * These components are split into separate chunks and loaded on demand
 */

// Authentication routes - loaded when user navigates to auth pages
export const LoginRoute = lazy(() =>
  import('./AuthRoutes').then(module => ({ default: module.LoginRoute }))
);

export const SignupRoute = lazy(() =>
  import('./AuthRoutes').then(module => ({ default: module.SignupRoute }))
);

export const ResetPasswordRoute = lazy(() =>
  import('./AuthRoutes').then(module => ({ default: module.ResetPasswordRoute }))
);

// Main application routes - loaded for authenticated users
export const DashboardRoute = lazy(() =>
  import('./DashboardRoutes').then(module => ({ default: module.DashboardRoute }))
);

export const HomeRoute = lazy(() =>
  import('./PublicRoutes').then(module => ({ default: module.HomeRoute }))
);

// Enhanced preloading strategies for better UX and performance

// Preload critical routes for better UX
export const preloadCriticalRoutes = () => {
  // Preload login route as it's commonly accessed
  import('./AuthRoutes');

  // Preload home route for quick navigation
  import('./PublicRoutes');

  // Preload auth guard since it's used across routes
  import('../components/auth/AuthGuard');
};

// Preload routes based on user state
export const preloadAuthenticatedRoutes = () => {
  // Preload dashboard when user is authenticated
  import('./DashboardRoutes');

  // Preload UI components commonly used in authenticated state
  import('../components/ui/LoadingSpinner');
  import('../components/feedback');
};

export const preloadUnauthenticatedRoutes = () => {
  // Preload auth routes when user is not authenticated
  import('./AuthRoutes');

  // Preload individual auth forms for faster navigation
  import('../components/auth/SimpleLoginForm');
  import('../components/auth/SimpleSignupForm');
};

// Preload specific auth components on user interaction
export const preloadLoginForm = () => {
  import('../components/auth/SimpleLoginForm');
};

export const preloadSignupForm = () => {
  import('../components/auth/SimpleSignupForm');
};

export const preloadResetForm = () => {
  import('../components/auth/SimpleResetPasswordForm');
};

// Intelligent preloading based on route transitions
export const preloadRelatedRoutes = currentRoute => {
  switch (currentRoute) {
    case 'home':
      // From home, users likely go to login or signup
      preloadLoginForm();
      preloadSignupForm();
      break;
    case 'login':
      // From login, users might go to signup or reset password
      preloadSignupForm();
      preloadResetForm();
      break;
    case 'signup':
      // From signup, users might go back to login
      preloadLoginForm();
      break;
    case 'reset-password':
      // From reset, users likely go back to login
      preloadLoginForm();
      break;
    default:
      break;
  }
};
