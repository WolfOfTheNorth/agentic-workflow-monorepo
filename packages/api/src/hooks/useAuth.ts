import { AsyncState } from '@agentic-workflow/shared';
import { useCallback, useState, useEffect, useRef } from 'react';
import { getDefaultApiClient } from '../client';
import {
  LoginRequest,
  LoginResponse,
  ProfileResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/auth';

export interface UseAuthReturn {
  // Existing interface (maintained for backward compatibility)
  loginState: AsyncState<LoginResponse>;
  registerState: AsyncState<RegisterResponse>;
  logoutState: AsyncState<boolean>;
  profileState: AsyncState<ProfileResponse>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  updateProfile: (profileData: Partial<ProfileResponse>) => Promise<void>;
  clearState: () => void;

  // Enhanced features (new additions)
  isAuthenticated: boolean;
  isInitializing: boolean;
  hasValidSession: boolean;
  sessionInfo: {
    expiresAt?: number;
    lastRefreshed?: number;
    sessionId?: string;
  } | null;
  initializeSession: () => Promise<boolean>;
  checkServiceHealth: () => Promise<{
    available: boolean;
    recommendedStrategy: string;
    reason: string;
  }>;

  // Enhanced authentication state management (Task 15)
  sessionRestoreState: AsyncState<boolean>;
  isSessionExpired: boolean;
  isSessionExpiring: boolean; // Within 5 minutes of expiration
  refreshTokenState: AsyncState<boolean>;
  authError: {
    message: string;
    code: string;
    recoverable: boolean;
    lastOccurred: number;
  } | null;
  retryAuthentication: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearAuthError: () => void;
  getSessionTimeRemaining: () => number; // Returns seconds until expiration
}

export function useAuth(): UseAuthReturn {
  // Existing state (maintained for backward compatibility)
  const [loginState, setLoginState] = useState<AsyncState<LoginResponse>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [registerState, setRegisterState] = useState<AsyncState<RegisterResponse>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [logoutState, setLogoutState] = useState<AsyncState<boolean>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [profileState, setProfileState] = useState<AsyncState<ProfileResponse>>({
    data: null,
    status: 'idle',
    error: null,
  });

  // Enhanced state for session management
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<{
    expiresAt?: number;
    lastRefreshed?: number;
    sessionId?: string;
  } | null>(null);

  // Enhanced authentication state management (Task 15)
  const [sessionRestoreState, setSessionRestoreState] = useState<AsyncState<boolean>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [refreshTokenState, setRefreshTokenState] = useState<AsyncState<boolean>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [authError, setAuthError] = useState<{
    message: string;
    code: string;
    recoverable: boolean;
    lastOccurred: number;
  } | null>(null);

  // Refs for cleanup and preventing memory leaks
  const isMountedRef = useRef(true);
  const initializationRef = useRef<Promise<boolean> | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshSessionRef = useRef<(() => Promise<void>) | null>(null);
  const scheduleTokenRefreshRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const maxRetryAttempts = 3;

  // Computed state values
  const isAuthenticated = loginState.data !== null || registerState.data !== null;
  const hasValidSession =
    !!sessionInfo && !!sessionInfo.expiresAt && sessionInfo.expiresAt > Date.now();

  // Enhanced computed state values (Task 15)
  const isSessionExpired =
    !!sessionInfo && !!sessionInfo.expiresAt && sessionInfo.expiresAt <= Date.now();
  const isSessionExpiring =
    !!sessionInfo &&
    !!sessionInfo.expiresAt &&
    sessionInfo.expiresAt - Date.now() <= 300000 && // 5 minutes
    sessionInfo.expiresAt - Date.now() > 0;

  const getSessionTimeRemaining = useCallback((): number => {
    if (!sessionInfo?.expiresAt) return 0;
    return Math.max(0, Math.floor((sessionInfo.expiresAt - Date.now()) / 1000));
  }, [sessionInfo]);

  // Enhanced session initialization function (Task 15)
  const initializeSession = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;

    // Prevent multiple concurrent initializations
    if (initializationRef.current) {
      return initializationRef.current;
    }

    const initialization = (async () => {
      try {
        setIsInitializing(true);
        setSessionRestoreState({ data: null, status: 'loading', error: null });

        const client = getDefaultApiClient();
        const restored = await client.initializeSession();

        if (restored && isMountedRef.current) {
          // Get current session info
          const currentSession = client.getCurrentSession();
          if (currentSession) {
            setSessionInfo({
              expiresAt: currentSession.expires_at,
              lastRefreshed: currentSession.last_refreshed,
              sessionId: currentSession.session_id,
            });

            // Schedule automatic token refresh
            setTimeout(() => {
              scheduleTokenRefreshRef.current?.();
            }, 100); // Small delay to ensure state is updated

            // Try to get user profile if we have a valid session
            try {
              const profileResponse = await client.auth.getProfile();
              if (isMountedRef.current) {
                setProfileState({
                  data: profileResponse.data,
                  status: 'success',
                  error: null,
                });

                // Also set login state to maintain compatibility
                setLoginState({
                  data: {
                    access_token: currentSession.access_token,
                    refresh_token: currentSession.refresh_token,
                    expires_in: Math.floor((currentSession.expires_at - Date.now()) / 1000),
                    user: profileResponse.data,
                  },
                  status: 'success',
                  error: null,
                });

                // Clear any previous auth errors on successful restoration
                setAuthError(null);
                retryCountRef.current = 0;

                setSessionRestoreState({ data: true, status: 'success', error: null });
                console.info('[useAuth] Session restored successfully on initialization');
              }
            } catch (profileError) {
              const errorMsg =
                profileError instanceof Error ? profileError.message : 'Profile fetch failed';
              console.warn(
                '[useAuth] Failed to restore profile during session initialization:',
                profileError
              );

              // Set auth error for profile fetch failure
              setAuthError({
                message: 'Session restored but profile could not be loaded. Please try refreshing.',
                code: 'PROFILE_RESTORE_FAILED',
                recoverable: true,
                lastOccurred: Date.now(),
              });

              setSessionRestoreState({ data: false, status: 'error', error: errorMsg });
            }
          } else {
            setSessionRestoreState({ data: false, status: 'success', error: null });
          }
        } else {
          setSessionRestoreState({ data: false, status: 'success', error: null });
        }

        return restored;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Session initialization failed';
        console.error('[useAuth] Session initialization failed:', error);

        if (isMountedRef.current) {
          setAuthError({
            message: 'Failed to restore your session. Please log in again.',
            code: 'SESSION_INIT_FAILED',
            recoverable: true,
            lastOccurred: Date.now(),
          });

          setSessionRestoreState({ data: false, status: 'error', error: errorMsg });
        }

        return false;
      } finally {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
        initializationRef.current = null;
      }
    })();

    initializationRef.current = initialization;
    return initialization;
  }, []);

  // Service health check function
  const checkServiceHealth = useCallback(async () => {
    try {
      const client = getDefaultApiClient();
      return await client.auth.checkServiceHealth();
    } catch (error) {
      return {
        available: false,
        recommendedStrategy: 'degraded_mode',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  // Enhanced authentication state management functions (Task 15)

  /**
   * Schedule automatic token refresh based on expiration time
   * Note: This will be updated after refreshSession is defined
   */
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (!sessionInfo?.expiresAt) return;

    const timeUntilExpiry = sessionInfo.expiresAt - Date.now();
    const refreshTime = Math.max(0, timeUntilExpiry - 300000); // Refresh 5 minutes before expiry

    if (refreshTime > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && hasValidSession) {
          console.info('[useAuth] Automatically refreshing session before expiration');
          // Call refreshSession through a ref to avoid circular dependency
          refreshSessionRef.current?.().catch(error => {
            console.error('[useAuth] Automatic session refresh failed:', error);
          });
        }
      }, refreshTime);

      console.debug(
        `[useAuth] Token refresh scheduled in ${Math.floor(refreshTime / 1000 / 60)} minutes`
      );
    }
  }, [sessionInfo, hasValidSession]);

  // Set the ref to the scheduleTokenRefresh function
  scheduleTokenRefreshRef.current = scheduleTokenRefresh;

  /**
   * Refresh the current session and update tokens
   */
  const refreshSession = useCallback(async () => {
    if (!isMountedRef.current || !sessionInfo?.sessionId) return;

    setRefreshTokenState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      // Use the refreshToken method with current session data
      const refreshRequest = {
        refresh_token: sessionInfo.sessionId, // Using sessionId as refresh token identifier
      };
      const refreshResponse = await client.auth.refreshToken(refreshRequest);

      if (refreshResponse.data && isMountedRef.current) {
        const currentSession = client.getCurrentSession();
        if (currentSession) {
          setSessionInfo({
            expiresAt: currentSession.expires_at,
            lastRefreshed: currentSession.last_refreshed,
            sessionId: currentSession.session_id,
          });

          // Clear any existing auth errors on successful refresh
          setAuthError(null);
          retryCountRef.current = 0;

          setRefreshTokenState({ data: true, status: 'success', error: null });
          console.info('[useAuth] Session refreshed successfully');
        }
      } else {
        throw new Error('Failed to refresh session - invalid response');
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMsg = error instanceof Error ? error.message : 'Session refresh failed';
      setRefreshTokenState({ data: null, status: 'error', error: errorMsg });

      // Set auth error with recovery information
      setAuthError({
        message: 'Session has expired. Please log in again.',
        code: 'SESSION_REFRESH_FAILED',
        recoverable: true,
        lastOccurred: Date.now(),
      });

      console.error('[useAuth] Session refresh failed:', error);

      // Clear session if refresh fails
      setSessionInfo(null);
      setLoginState({ data: null, status: 'idle', error: null });
      setProfileState({ data: null, status: 'idle', error: null });

      const client = getDefaultApiClient();
      client.setAuthToken(null);
    }
  }, [sessionInfo]);

  // Set the ref to the refreshSession function
  refreshSessionRef.current = refreshSession;

  /**
   * Retry authentication after an error
   */
  const retryAuthentication = useCallback(async () => {
    if (!isMountedRef.current || retryCountRef.current >= maxRetryAttempts) {
      setAuthError(_prevError => ({
        message: 'Maximum retry attempts reached. Please refresh the page or log in again.',
        code: 'MAX_RETRY_REACHED',
        recoverable: false,
        lastOccurred: Date.now(),
      }));
      return;
    }

    retryCountRef.current++;

    try {
      setSessionRestoreState({ data: null, status: 'loading', error: null });

      // Attempt to restore session
      const restored = await initializeSession();

      if (restored && isMountedRef.current) {
        setAuthError(null);
        retryCountRef.current = 0;
        setSessionRestoreState({ data: true, status: 'success', error: null });
        console.info('[useAuth] Authentication retry successful');
      } else {
        throw new Error('Session restoration failed during retry');
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMsg = error instanceof Error ? error.message : 'Authentication retry failed';
      setSessionRestoreState({ data: null, status: 'error', error: errorMsg });

      // Update auth error with retry information
      setAuthError(_prevError => ({
        message: `Authentication failed (attempt ${retryCountRef.current}/${maxRetryAttempts}). ${errorMsg}`,
        code: 'AUTH_RETRY_FAILED',
        recoverable: retryCountRef.current < maxRetryAttempts,
        lastOccurred: Date.now(),
      }));

      console.warn('[useAuth] Authentication retry failed:', error);
    }
  }, [initializeSession]);

  /**
   * Clear authentication error state
   */
  const clearAuthError = useCallback(() => {
    setAuthError(null);
    retryCountRef.current = 0;
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    if (!isMountedRef.current) return;

    setLoginState({ data: null, status: 'loading', error: null });
    // Clear any existing auth errors
    setAuthError(null);

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.login(credentials);

      if (!isMountedRef.current) return;

      // Set the auth token for future requests
      client.setAuthToken(response.data.access_token);

      // Update session info
      const currentSession = client.getCurrentSession();
      if (currentSession) {
        setSessionInfo({
          expiresAt: currentSession.expires_at,
          lastRefreshed: currentSession.last_refreshed,
          sessionId: currentSession.session_id,
        });

        // Schedule automatic token refresh for new session
        setTimeout(() => {
          scheduleTokenRefreshRef.current?.();
        }, 100); // Small delay to ensure state is updated
      }

      // Clear retry count on successful login
      retryCountRef.current = 0;

      setLoginState({ data: response.data, status: 'success', error: null });

      // Also update profile state for consistency
      setProfileState({
        data: response.data.user,
        status: 'success',
        error: null,
      });

      console.info('[useAuth] Login successful, session established');
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMsg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);

      setLoginState({ data: null, status: 'error', error: errorMsg });

      // Set auth error for login failure
      setAuthError({
        message: errorMsg,
        code: 'LOGIN_FAILED',
        recoverable: true,
        lastOccurred: Date.now(),
      });

      throw error;
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest) => {
    if (!isMountedRef.current) return;

    setRegisterState({ data: null, status: 'loading', error: null });
    // Clear any existing auth errors
    setAuthError(null);

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.register(userData);

      if (!isMountedRef.current) return;

      // Set the auth token for future requests
      client.setAuthToken(response.data.access_token);

      // Update session info
      const currentSession = client.getCurrentSession();
      if (currentSession) {
        setSessionInfo({
          expiresAt: currentSession.expires_at,
          lastRefreshed: currentSession.last_refreshed,
          sessionId: currentSession.session_id,
        });

        // Schedule automatic token refresh for new session
        setTimeout(() => {
          scheduleTokenRefreshRef.current?.();
        }, 100); // Small delay to ensure state is updated
      }

      // Clear retry count on successful registration
      retryCountRef.current = 0;

      setRegisterState({ data: response.data, status: 'success', error: null });

      // Also update profile state for consistency
      setProfileState({
        data: response.data.user,
        status: 'success',
        error: null,
      });

      console.info('[useAuth] Registration successful, session established');
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMsg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);

      setRegisterState({ data: null, status: 'error', error: errorMsg });

      // Set auth error for registration failure
      setAuthError({
        message: errorMsg,
        code: 'REGISTRATION_FAILED',
        recoverable: true,
        lastOccurred: Date.now(),
      });

      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLogoutState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      await client.auth.logout();

      if (!isMountedRef.current) return;

      // Clear scheduled token refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      // Clear the auth token
      client.setAuthToken(null);

      // Clear all session and auth state
      setSessionInfo(null);
      setAuthError(null);
      retryCountRef.current = 0;

      // Reset all authentication states
      setLogoutState({ data: true, status: 'success', error: null });
      setProfileState({ data: null, status: 'idle', error: null });
      setLoginState({ data: null, status: 'idle', error: null });
      setRegisterState({ data: null, status: 'idle', error: null });
      setSessionRestoreState({ data: null, status: 'idle', error: null });
      setRefreshTokenState({ data: null, status: 'idle', error: null });

      console.info('[useAuth] Logout successful, all state cleared');
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMsg =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as any).message
          : String(error);
      setLogoutState({ data: null, status: 'error', error: errorMsg });

      // Set auth error for logout failure, but still clear local state
      setAuthError({
        message: 'Logout request failed, but local session has been cleared.',
        code: 'LOGOUT_FAILED',
        recoverable: false,
        lastOccurred: Date.now(),
      });

      // Clear local state even if logout request failed
      setSessionInfo(null);
      setProfileState({ data: null, status: 'idle', error: null });
      setLoginState({ data: null, status: 'idle', error: null });
      setRegisterState({ data: null, status: 'idle', error: null });

      throw error;
    }
  }, []);

  const getProfile = useCallback(async () => {
    setProfileState({ data: profileState.data, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.getProfile();

      setProfileState({ data: response.data, status: 'success', error: null });
    } catch (error) {
      const errorMsg =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as any).message
          : String(error);
      setProfileState({ data: null, status: 'error', error: errorMsg });
      throw error;
    }
  }, [profileState.data]);

  const updateProfile = useCallback(
    async (profileData: Partial<ProfileResponse>) => {
      setProfileState({ data: profileState.data, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        const response = await client.auth.updateProfile(profileData);

        setProfileState({ data: response.data, status: 'success', error: null });
      } catch (error) {
        const errorMsg =
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as any).message
            : String(error);
        setProfileState({ data: profileState.data, status: 'error', error: errorMsg });
        throw error;
      }
    },
    [profileState.data]
  );

  const clearState = useCallback(() => {
    // Clear scheduled token refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    // Clear all authentication states
    setLoginState({ data: null, status: 'idle', error: null });
    setRegisterState({ data: null, status: 'idle', error: null });
    setLogoutState({ data: null, status: 'idle', error: null });
    setProfileState({ data: null, status: 'idle', error: null });

    // Clear enhanced state management (Task 15)
    setSessionInfo(null);
    setSessionRestoreState({ data: null, status: 'idle', error: null });
    setRefreshTokenState({ data: null, status: 'idle', error: null });
    setAuthError(null);
    setIsInitializing(false);

    // Reset retry counter
    retryCountRef.current = 0;

    console.info('[useAuth] All state cleared');
  }, []);

  // Enhanced initialization and cleanup effect (Task 15)
  useEffect(() => {
    isMountedRef.current = true;

    // Initialize session automatically on app startup with enhanced error handling
    initializeSession().catch(error => {
      console.error('[useAuth] Auto-initialization failed:', error);

      // Set initialization error for user feedback
      if (isMountedRef.current) {
        setAuthError({
          message: 'Failed to restore your session. Please log in again.',
          code: 'STARTUP_INIT_FAILED',
          recoverable: true,
          lastOccurred: Date.now(),
        });
      }
    });

    // Enhanced cleanup function
    return () => {
      isMountedRef.current = false;

      // Clear scheduled token refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      // Cleanup API client if needed
      try {
        const client = getDefaultApiClient();
        client.cleanup();
      } catch (error) {
        console.warn('[useAuth] Cleanup warning:', error);
      }

      console.debug('[useAuth] Hook cleanup completed');
    };
  }, [initializeSession]);

  // Enhanced session monitoring and expiration handling effect (Task 15)
  useEffect(() => {
    if (!hasValidSession) return;

    // Set up a timer to check session expiration and handle automatic refresh
    const checkInterval = setInterval(() => {
      if (sessionInfo && sessionInfo.expiresAt) {
        const timeUntilExpiry = sessionInfo.expiresAt - Date.now();

        // If session will expire in less than 5 minutes, attempt automatic refresh
        if (timeUntilExpiry <= 300000 && timeUntilExpiry > 60000) {
          // Between 5 minutes and 1 minute
          console.warn(
            '[useAuth] Session will expire soon, attempting automatic refresh:',
            new Date(sessionInfo.expiresAt)
          );
          refreshSession().catch(error => {
            console.error('[useAuth] Automatic session refresh failed during monitoring:', error);
          });
        }

        // If session has expired, clear it and set appropriate error
        if (timeUntilExpiry <= 0) {
          console.info('[useAuth] Session expired, clearing state');

          setSessionInfo(null);
          setLoginState({ data: null, status: 'idle', error: null });
          setProfileState({ data: null, status: 'idle', error: null });

          // Set auth error for session expiration
          setAuthError({
            message: 'Your session has expired. Please log in again.',
            code: 'SESSION_EXPIRED',
            recoverable: true,
            lastOccurred: Date.now(),
          });

          try {
            const client = getDefaultApiClient();
            client.setAuthToken(null);
          } catch (error) {
            console.warn('[useAuth] Error clearing expired session:', error);
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [hasValidSession, sessionInfo, refreshSession]);

  // Effect to schedule automatic token refresh when session info changes (Task 15)
  useEffect(() => {
    if (hasValidSession && sessionInfo?.expiresAt) {
      scheduleTokenRefreshRef.current?.();
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [hasValidSession, sessionInfo]);

  return {
    // Existing interface (maintained for backward compatibility)
    loginState,
    registerState,
    logoutState,
    profileState,
    login,
    register,
    logout,
    getProfile,
    updateProfile,
    clearState,

    // Enhanced features (new additions)
    isAuthenticated,
    isInitializing,
    hasValidSession,
    sessionInfo,
    initializeSession,
    checkServiceHealth,

    // Enhanced authentication state management (Task 15)
    sessionRestoreState,
    isSessionExpired,
    isSessionExpiring,
    refreshTokenState,
    authError,
    retryAuthentication,
    refreshSession,
    clearAuthError,
    getSessionTimeRemaining,
  };
}
