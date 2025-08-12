import { RequireNoAuth } from '../components/auth/AuthGuard';
import HomeScreen from '../components/HomeScreen.tsx';

/**
 * Public route components
 * Components that don't require authentication
 */

export const HomeRoute = ({
  onLoginClick,
  onSignupClick,
  onDashboardRedirect,
  onAuthForbidden,
}) => (
  <RequireNoAuth onAuthForbidden={onAuthForbidden} redirectDelay={1500}>
    <HomeScreen
      onLoginClick={onLoginClick}
      onSignupClick={onSignupClick}
      onDashboardRedirect={onDashboardRedirect}
    />
  </RequireNoAuth>
);
