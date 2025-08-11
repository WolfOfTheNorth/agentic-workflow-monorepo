import {
  AsyncState,
  AuthUser,
  AuthSession,
  LoginCredentials,
  SignupData,
  AuthResponse,
} from '@agentic-workflow/shared';
import { useCallback, useState, useEffect, useRef } from 'react';
import { AuthClient, createAuthClientWithDefaults } from '../clients/auth-client';
import { getDefaultApiClient } from '../client';
import { LoginResponse, ProfileResponse, RegisterResponse } from '../types/auth';

export interface UseAuthReturn {
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

  // Service health and monitoring
  getSessionStatistics: () => any;
  checkHealth: () => Promise<any>;
  addAuthStateListener: (event: string, callback: (data: any) => void) => () => void;

  // Utility functions
  clearState: () => void;
  clearError: () => void;
  isRememberMeEnabled: () => boolean;

  // Validation methods
  validateEmail: (email: string) => any;
  validatePassword: (password: string) => any;
  validateName: (name: string) => any;
  generateCSRFToken: () => string;
  validateCSRFToken: (token: string) => boolean;
  checkRateLimit: (ip?: string, email?: string) => any;

  // Legacy compatibility (maintained for existing code)
  loginState: AsyncState<LoginResponse>;
  registerState: AsyncState<RegisterResponse>;
  logoutState: AsyncState<boolean>;
  profileState: AsyncState<ProfileResponse>;
  sessionInfo: {
    expiresAt?: number;
    lastRefreshed?: number;
    sessionId?: string;
  } | null;
}

export function useAuth(): UseAuthReturn {
  // Core authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Legacy state for backward compatibility
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

  const [sessionInfo, setSessionInfo] = useState<{
    expiresAt?: number;
    lastRefreshed?: number;
    sessionId?: string;
  } | null>(null);

  // Refs for cleanup and state management
  const authClientRef = useRef<AuthClient | null>(null);
  const isMountedRef = useRef(true);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Computed values
  const isAuthenticated = user !== null && session !== null;
  const hasValidSession =
    session !== null && (!session.expiresAt || session.expiresAt > Date.now());
  const isSessionExpired = session !== null && session.expiresAt && session.expiresAt <= Date.now();
  const isSessionExpiring =
    session !== null &&
    session.expiresAt &&
    session.expiresAt - Date.now() <= 300000 && // 5 minutes
    session.expiresAt - Date.now() > 0;

  // Initialize AuthClient
  const initializeAuthClient = useCallback(async () => {
    if (authClientRef.current) {
      return authClientRef.current;
    }

    try {
      const apiClient = getDefaultApiClient();
      const authClient = await createAuthClientWithDefaults(apiClient);
      authClientRef.current = authClient;
      return authClient;
    } catch (error) {
      console.error('Failed to initialize AuthClient:', error);
      throw error;
    }
  }, []);

  // Update state from AuthClient
  const updateStateFromAuthClient = useCallback((authClient: AuthClient) => {
    const currentUser = authClient.getCurrentUser();
    const currentSession = authClient.getCurrentSession();

    setUser(currentUser);
    setSession(currentSession);

    // Update legacy session info
    if (currentSession) {
      setSessionInfo({
        expiresAt: currentSession.expiresAt,
        lastRefreshed: Date.now(),
        sessionId: currentSession.id,
      });

      // Update legacy profile state for compatibility
      if (currentUser) {
        setProfileState({
          data: currentUser as unknown as ProfileResponse,
          status: 'success',
          error: null,
        });
      }
    } else {
      setSessionInfo(null);
      setProfileState({
        data: null,
        status: 'idle',
        error: null,
      });
    }
  }, []);

  // Session time remaining calculation
  const getSessionTimeRemaining = useCallback((): number => {
    if (!session?.expiresAt) return 0;
    return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  }, [session]);

  // Check if remember me is enabled
  const isRememberMeEnabled = useCallback((): boolean => {
    const authClient = authClientRef.current;
    if (!authClient) return false;
    // This would typically check the token storage
    return (
      typeof localStorage !== 'undefined' && localStorage.getItem('auth_remember_me') === 'true'
    );
  }, []);

  // Auth operations
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      if (!isMountedRef.current)
        return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

      setIsLoading(true);
      setError(null);
      setLoginState({ data: null, status: 'loading', error: null });

      try {
        const authClient = await initializeAuthClient();

        // Gather client information for security checks
        const clientInfo = {
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          // IP would typically be provided by server-side middleware
        };

        const result = await authClient.login(credentials, clientInfo);

        if (isMountedRef.current) {
          if (result.success) {
            updateStateFromAuthClient(authClient);

            // Update legacy login state
            if (result.user && result.session) {
              setLoginState({
                data: {
                  access_token: result.session.accessToken,
                  refresh_token: result.session.refreshToken,
                  expires_in: Math.floor((result.session.expiresAt - Date.now()) / 1000),
                  user: result.user as unknown as any,
                },
                status: 'success',
                error: null,
              });
            }
          } else {
            const errorMsg = result.error?.message || 'Login failed';
            setError(errorMsg);
            setLoginState({ data: null, status: 'error', error: errorMsg });
          }
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Login failed';
        if (isMountedRef.current) {
          setError(errorMsg);
          setLoginState({ data: null, status: 'error', error: errorMsg });
        }
        return { success: false, error: { code: 'LOGIN_ERROR', message: errorMsg } };
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [initializeAuthClient, updateStateFromAuthClient]
  );

  const signup = useCallback(
    async (userData: SignupData): Promise<AuthResponse> => {
      if (!isMountedRef.current)
        return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

      setIsLoading(true);
      setError(null);
      setRegisterState({ data: null, status: 'loading', error: null });

      try {
        const authClient = await initializeAuthClient();

        // Gather client information for security checks
        const clientInfo = {
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          // IP would typically be provided by server-side middleware
        };

        const result = await authClient.signup(userData, clientInfo);

        if (isMountedRef.current) {
          if (result.success) {
            updateStateFromAuthClient(authClient);

            // Update legacy register state
            if (result.user) {
              setRegisterState({
                data: {
                  user: result.user as unknown as any,
                  access_token: result.session?.accessToken || '',
                  refresh_token: result.session?.refreshToken || '',
                  expires_in: result.session
                    ? Math.floor((result.session.expiresAt - Date.now()) / 1000)
                    : 0,
                },
                status: 'success',
                error: null,
              });
            }
          } else {
            const errorMsg = result.error?.message || 'Signup failed';
            setError(errorMsg);
            setRegisterState({ data: null, status: 'error', error: errorMsg });
          }
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Signup failed';
        if (isMountedRef.current) {
          setError(errorMsg);
          setRegisterState({ data: null, status: 'error', error: errorMsg });
        }
        return { success: false, error: { code: 'SIGNUP_ERROR', message: errorMsg } };
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [initializeAuthClient, updateStateFromAuthClient]
  );

  const logout = useCallback(async (): Promise<AuthResponse> => {
    if (!isMountedRef.current)
      return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

    setIsLoading(true);
    setLogoutState({ data: null, status: 'loading', error: null });

    try {
      const authClient = authClientRef.current;
      if (authClient) {
        const result = await authClient.logout();

        if (isMountedRef.current) {
          // Clear all state regardless of logout result
          setUser(null);
          setSession(null);
          setSessionInfo(null);
          setError(null);

          // Clear legacy states
          setLoginState({ data: null, status: 'idle', error: null });
          setRegisterState({ data: null, status: 'idle', error: null });
          setProfileState({ data: null, status: 'idle', error: null });
          setLogoutState({ data: true, status: 'success', error: null });
        }

        return result;
      } else {
        // Clear state even if no auth client
        if (isMountedRef.current) {
          setUser(null);
          setSession(null);
          setSessionInfo(null);
          setError(null);
          setLogoutState({ data: true, status: 'success', error: null });
        }
        return { success: true, message: 'Logged out locally' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Logout failed';
      if (isMountedRef.current) {
        setError(errorMsg);
        setLogoutState({ data: null, status: 'error', error: errorMsg });

        // Still clear local state on logout error
        setUser(null);
        setSession(null);
        setSessionInfo(null);
      }
      return { success: false, error: { code: 'LOGOUT_ERROR', message: errorMsg } };
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthResponse> => {
    if (!isMountedRef.current)
      return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

    const authClient = authClientRef.current;
    if (!authClient) {
      return {
        success: false,
        error: { code: 'NO_AUTH_CLIENT', message: 'Auth client not initialized' },
      };
    }

    try {
      const result = await authClient.refreshSession();

      if (isMountedRef.current && result.success) {
        updateStateFromAuthClient(authClient);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Session refresh failed';
      return { success: false, error: { code: 'REFRESH_ERROR', message: errorMsg } };
    }
  }, [updateStateFromAuthClient]);

  // Profile operations
  const updateProfile = useCallback(
    async (updates: Partial<AuthUser>): Promise<AuthResponse> => {
      if (!isMountedRef.current)
        return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

      const authClient = authClientRef.current;
      if (!authClient) {
        return {
          success: false,
          error: { code: 'NO_AUTH_CLIENT', message: 'Auth client not initialized' },
        };
      }

      setIsLoading(true);
      try {
        const result = await authClient.updateProfile(updates);

        if (isMountedRef.current && result.success) {
          updateStateFromAuthClient(authClient);
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Profile update failed';
        return { success: false, error: { code: 'PROFILE_UPDATE_ERROR', message: errorMsg } };
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [updateStateFromAuthClient]
  );

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResponse> => {
    if (!isMountedRef.current)
      return { success: false, error: { code: 'UNMOUNTED', message: 'Component unmounted' } };

    const authClient = authClientRef.current;
    if (!authClient) {
      return {
        success: false,
        error: { code: 'NO_AUTH_CLIENT', message: 'Auth client not initialized' },
      };
    }

    setIsLoading(true);
    try {
      const result = await authClient.updatePassword(newPassword);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Password update failed';
      return { success: false, error: { code: 'PASSWORD_UPDATE_ERROR', message: errorMsg } };
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    const authClient = authClientRef.current;
    if (!authClient) {
      throw new Error('Auth client not initialized');
    }

    await authClient.resetPassword(email);
  }, []);

  const verifyEmail = useCallback(async (token: string): Promise<AuthResponse> => {
    const authClient = authClientRef.current;
    if (!authClient) {
      return {
        success: false,
        error: { code: 'NO_AUTH_CLIENT', message: 'Auth client not initialized' },
      };
    }

    try {
      const result = await authClient.verifyEmail(token);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Email verification failed';
      return { success: false, error: { code: 'EMAIL_VERIFY_ERROR', message: errorMsg } };
    }
  }, []);

  // Session management
  const validateSession = useCallback(async () => {
    const authClient = authClientRef.current;
    if (!authClient) {
      return { isValid: false, error: 'Auth client not initialized' };
    }

    try {
      return await authClient.validateSession();
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Session validation failed',
      };
    }
  }, []);

  // Service health and monitoring
  const getSessionStatistics = useCallback(() => {
    const authClient = authClientRef.current;
    return authClient ? authClient.getSessionStatistics() : null;
  }, []);

  const checkHealth = useCallback(async () => {
    const authClient = authClientRef.current;
    return authClient
      ? await authClient.checkHealth()
      : { healthy: false, error: 'Auth client not initialized' };
  }, []);

  const addAuthStateListener = useCallback((event: string, callback: (data: any) => void) => {
    const authClient = authClientRef.current;
    return authClient ? authClient.addAuthStateListener(event, callback) : () => {};
  }, []);

  // Utility functions
  const clearState = useCallback(() => {
    setUser(null);
    setSession(null);
    setSessionInfo(null);
    setError(null);
    setIsLoading(false);

    // Clear legacy states
    setLoginState({ data: null, status: 'idle', error: null });
    setRegisterState({ data: null, status: 'idle', error: null });
    setLogoutState({ data: null, status: 'idle', error: null });
    setProfileState({ data: null, status: 'idle', error: null });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Validation methods
  const validateEmail = useCallback((email: string) => {
    const authClient = authClientRef.current;
    return authClient
      ? authClient.validateEmail(email)
      : { isValid: false, errors: ['Auth client not initialized'] };
  }, []);

  const validatePassword = useCallback((password: string) => {
    const authClient = authClientRef.current;
    return authClient
      ? authClient.validatePassword(password)
      : { isValid: false, errors: ['Auth client not initialized'] };
  }, []);

  const validateName = useCallback((name: string) => {
    const authClient = authClientRef.current;
    return authClient
      ? authClient.validateName(name)
      : { isValid: false, errors: ['Auth client not initialized'] };
  }, []);

  const generateCSRFToken = useCallback((): string => {
    const authClient = authClientRef.current;
    return authClient ? authClient.generateCSRFToken() : '';
  }, []);

  const validateCSRFToken = useCallback((token: string): boolean => {
    const authClient = authClientRef.current;
    return authClient ? authClient.validateCSRFTokenFromService(token) : false;
  }, []);

  const checkRateLimit = useCallback((ip?: string, email?: string) => {
    const authClient = authClientRef.current;
    if (!authClient) {
      return { allowed: true, remainingAttempts: 0, resetTime: 0, blocked: false };
    }
    return authClient.checkRateLimit(ip || 'unknown', email);
  }, []);

  // Initialize auth client and restore session on mount
  useEffect(() => {
    isMountedRef.current = true;

    const initialize = async () => {
      try {
        setIsInitializing(true);
        const authClient = await initializeAuthClient();

        if (isMountedRef.current) {
          // Try to restore existing session
          const validation = await authClient.validateSession();
          if (validation.isValid) {
            updateStateFromAuthClient(authClient);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (isMountedRef.current) {
          setError(error instanceof Error ? error.message : 'Initialization failed');
        }
      } finally {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    };

    initialize();

    return () => {
      isMountedRef.current = false;

      // Clear session timeout
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }

      // Dispose auth client
      if (authClientRef.current) {
        authClientRef.current.dispose().catch(console.error);
        authClientRef.current = null;
      }
    };
  }, [initializeAuthClient, updateStateFromAuthClient]);

  // Session expiration monitoring
  useEffect(() => {
    if (!session || !session.expiresAt) return;

    // Clear existing timeout
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    // Set timeout for when session expires
    const timeUntilExpiry = session.expiresAt - Date.now();
    if (timeUntilExpiry > 0) {
      sessionTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setError('Session expired');
          clearState();
        }
      }, timeUntilExpiry);
    }

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [session, clearState]);

  return {
    // Core auth state
    user,
    session,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,

    // Auth operations
    login,
    signup,
    logout,
    refreshSession,

    // Profile operations
    updateProfile,
    updatePassword,
    resetPassword,
    verifyEmail,

    // Session management
    hasValidSession,
    isSessionExpired,
    isSessionExpiring,
    getSessionTimeRemaining,
    validateSession,

    // Service health and monitoring
    getSessionStatistics,
    checkHealth,
    addAuthStateListener,

    // Utility functions
    clearState,
    clearError,
    isRememberMeEnabled,

    // Validation methods
    validateEmail,
    validatePassword,
    validateName,
    generateCSRFToken,
    validateCSRFToken,
    checkRateLimit,

    // Legacy compatibility
    loginState,
    registerState,
    logoutState,
    profileState,
    sessionInfo,
  };
}
