/**
 * Session Management Integration Tests
 *
 * Task 5.2.1: Test complete authentication flows end-to-end
 * - Test session restoration and automatic token refresh
 * - Test multi-tab synchronization scenarios
 * - Test session timeout and recovery mechanisms
 * - Requirements: 8.9
 */

import { AuthClient, Mock } from '../../clients/auth-client';
import { ApiClient } from '../../client/base';
import { createEnhancedTokenStorage } from '../../adapters/enhanced-token-storage';
import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../adapters/enhanced-token-storage');
jest.mock('../../adapters/auth-validation-service');

describe('Session Management Integration Tests', () => {
  let authClient: AuthClient;
  let apiClient: ApiClient;
  let mockSupabaseClient: Mock;
  let mockTokenStorage: Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock API client
    apiClient = {
      setAuthToken: jest.fn(),
      setTokenRefreshHandler: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as unknown as ApiClient;

    // Setup mock Supabase client
    mockSupabaseClient = {
      auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    };

    // Setup mock token storage
    mockTokenStorage = {
      storeAuthTokensWithRememberMe: jest.fn(),
      getAccessToken: jest.fn(),
      getRefreshToken: jest.fn(),
      isAccessTokenExpired: jest.fn(),
      clearAuthTokens: jest.fn(),
      getCSRFToken: jest.fn(),
      validateCSRFToken: jest.fn(),
      getEnhancedStats: jest.fn(),
    };

    // Create auth client
    authClient = new AuthClient({
      supabaseUrl: 'https://test-project.supabase.co',
      supabaseKey: 'test-anon-key',
      apiClient,
      enableDetailedLogging: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (authClient) {
      authClient.dispose();
    }
  });

  describe('Session Restoration Scenarios', () => {
    it('should restore session from secure token storage on app start', async () => {
      // Mock stored tokens
      mockTokenStorage.getAccessToken.mockResolvedValue('stored-access-token');
      mockTokenStorage.isAccessTokenExpired.mockResolvedValue(false);

      // Mock valid Supabase session
      const storedSession = {
        access_token: 'stored-access-token',
        refresh_token: 'stored-refresh-token',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'stored-user-id',
          email: 'stored@example.com',
          user_metadata: { name: 'Stored User' },
        },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: storedSession },
        error: null,
      });

      // Initialize auth client (simulates app start)
      await authClient.initialize();

      expect(mockTokenStorage.getAccessToken).toHaveBeenCalled();
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('stored-access-token');
      expect(authClient.isAuthenticated()).toBe(true);
      expect(authClient.getCurrentUser()?.email).toBe('stored@example.com');
    });

    it('should handle expired stored tokens and attempt refresh', async () => {
      // Mock expired stored token
      mockTokenStorage.getAccessToken.mockResolvedValue('expired-access-token');
      mockTokenStorage.isAccessTokenExpired.mockResolvedValue(true);
      mockTokenStorage.getRefreshToken.mockResolvedValue('valid-refresh-token');

      // Mock successful token refresh
      const refreshedSession = {
        access_token: 'refreshed-access-token',
        refresh_token: 'refreshed-refresh-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: 'refresh-user-id',
          email: 'refresh@example.com',
        },
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: refreshedSession.user },
        error: null,
      });

      await authClient.initialize();

      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('refreshed-access-token');
    });

    it('should clear invalid sessions and start fresh', async () => {
      // Mock invalid stored session
      mockTokenStorage.getAccessToken.mockResolvedValue('invalid-token');
      mockTokenStorage.isAccessTokenExpired.mockResolvedValue(false);

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid session' },
      });

      await authClient.initialize();

      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
      expect(authClient.isAuthenticated()).toBe(false);
    });
  });

  describe('Automatic Token Refresh', () => {
    beforeEach(async () => {
      // Setup authenticated user
      const loginSession = {
        access_token: 'login-access-token',
        refresh_token: 'login-refresh-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: 'auto-refresh-user',
          email: 'autorefresh@example.com',
        },
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: loginSession, user: loginSession.user },
        error: null,
      });

      await authClient.login({
        email: 'autorefresh@example.com',
        password: 'password123',
      });
    });

    it('should automatically refresh token when nearing expiration', async () => {
      const refreshedSession = {
        access_token: 'auto-refreshed-token',
        refresh_token: 'auto-refreshed-refresh',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: 'auto-refresh-user',
          email: 'autorefresh@example.com',
        },
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: refreshedSession.user },
        error: null,
      });

      // Simulate token approaching expiration
      mockTokenStorage.isAccessTokenExpired.mockResolvedValue(true);

      // Trigger TokenRefreshHandler
      const newToken = await authClient.refreshToken();

      expect(newToken).toBe('auto-refreshed-token');
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('auto-refreshed-token');
    });

    it('should handle refresh token expiration gracefully', async () => {
      const refreshError = {
        name: 'AuthError',
        message: 'Refresh token expired',
        status: 401,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: refreshError,
      });

      const newToken = await authClient.refreshToken();

      expect(newToken).toBeNull();
      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
    });

    it('should retry token refresh on network errors', async () => {
      let attempt = 0;
      mockSupabaseClient.auth.refreshSession.mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          return Promise.resolve({
            data: { session: null, user: null },
            error: { name: 'NetworkError', message: 'Network error', status: 503 },
          });
        }
        return Promise.resolve({
          data: {
            session: {
              access_token: 'retry-success-token',
              refresh_token: 'retry-refresh-token',
              expires_in: 3600,
              user: { id: 'retry-user', email: 'retry@example.com' },
            },
          },
          error: null,
        });
      });

      const result = await authClient.refreshSession();

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('retry-success-token');
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multi-Tab Session Synchronization', () => {
    it('should handle session changes from other tabs', async () => {
      // Setup initial session
      await authClient.login({
        email: 'multitab@example.com',
        password: 'password123',
      });

      expect(authClient.isAuthenticated()).toBe(true);

      // Simulate session change from another tab (e.g., logout)
      const authStateChangeCallback = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0][0];

      await authStateChangeCallback('SIGNED_OUT', null);

      // Should clear local session
      expect(authClient.isAuthenticated()).toBe(false);
      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
    });

    it('should handle session updates from other tabs', async () => {
      // Setup initial session
      await authClient.login({
        email: 'multitab@example.com',
        password: 'password123',
      });

      const updatedSession = {
        access_token: 'updated-from-another-tab',
        refresh_token: 'updated-refresh-token',
        expires_in: 3600,
        user: {
          id: 'multitab-user',
          email: 'multitab@example.com',
        },
      };

      // Simulate session update from another tab
      const authStateChangeCallback = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0][0];

      await authStateChangeCallback('TOKEN_REFRESHED', updatedSession);

      expect(apiClient.setAuthToken).toHaveBeenCalledWith('updated-from-another-tab');
    });

    it('should handle concurrent session operations across tabs', async () => {
      // Simulate multiple concurrent operations
      const operations = [
        authClient.validateSession(),
        authClient.refreshSession(),
        authClient.validateSession(),
        authClient.getCurrentUser(),
        authClient.getCurrentSession(),
      ];

      // Mock all operations to succeed
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'concurrent-token',
            expires_at: Date.now() + 3600000,
            user: { id: 'concurrent-user', email: 'concurrent@example.com' },
          },
        },
        error: null,
      });

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'concurrent-refreshed-token',
            expires_in: 3600,
            user: { id: 'concurrent-user', email: 'concurrent@example.com' },
          },
        },
        error: null,
      });

      const results = await Promise.all(operations);

      // All operations should complete successfully
      expect(results[0].isValid).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].isValid).toBe(true);
    });
  });

  describe('Session Timeout and Recovery', () => {
    it('should handle session timeout gracefully', async () => {
      // Setup session with short timeout
      const shortSession = {
        access_token: 'short-lived-token',
        refresh_token: 'short-refresh-token',
        expires_in: 1, // 1 second
        expires_at: Date.now() + 1000,
        user: {
          id: 'timeout-user',
          email: 'timeout@example.com',
        },
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: shortSession, user: shortSession.user },
        error: null,
      });

      await authClient.login({
        email: 'timeout@example.com',
        password: 'password123',
      });

      expect(authClient.isAuthenticated()).toBe(true);

      // Fast forward time to expire session
      jest.advanceTimersByTime(2000);

      // Simulate validation check
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const validation = await authClient.validateSession();

      expect(validation.isValid).toBe(false);
      expect(validation.error?.code).toBe('SESSION_EXPIRED');
    });

    it('should attempt recovery from session timeout', async () => {
      // Setup expired session with valid refresh token
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      mockTokenStorage.getRefreshToken.mockResolvedValue('valid-refresh-token');

      // Mock successful recovery
      const recoveredSession = {
        access_token: 'recovered-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        user: {
          id: 'recovery-user',
          email: 'recovery@example.com',
        },
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: recoveredSession, user: recoveredSession.user },
        error: null,
      });

      const refreshResult = await authClient.refreshSession();

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.session?.accessToken).toBe('recovered-token');
    });

    it('should handle permanent session loss and require re-authentication', async () => {
      // Setup scenario where both access and refresh tokens are expired
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { name: 'AuthError', message: 'Refresh token expired', status: 401 },
      });

      const refreshResult = await authClient.refreshSession();

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error?.code).toBe('REFRESH_TOKEN_EXPIRED');
      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
      expect(authClient.isAuthenticated()).toBe(false);
    });
  });

  describe('Session Security and Validation', () => {
    it('should validate session integrity', async () => {
      const validSession = {
        access_token: 'valid-secure-token',
        refresh_token: 'valid-refresh-token',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'secure-user',
          email: 'secure@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
        },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: validSession },
        error: null,
      });

      const validation = await authClient.validateSession();

      expect(validation.isValid).toBe(true);
      expect(validation.user?.email).toBe('secure@example.com');
    });

    it('should detect and handle session tampering', async () => {
      // Mock tampered/invalid session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid session signature' },
      });

      const validation = await authClient.validateSession();

      expect(validation.isValid).toBe(false);
      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
    });

    it('should enforce session timeout policies', async () => {
      // Test various timeout scenarios
      const timeoutScenarios = [
        {
          name: 'near_expiry',
          expiresAt: Date.now() + 250000, // 4+ minutes
          shouldBeValid: true,
        },
        {
          name: 'very_near_expiry',
          expiresAt: Date.now() + 60000, // 1 minute
          shouldBeValid: false,
        },
        {
          name: 'expired',
          expiresAt: Date.now() - 60000, // 1 minute ago
          shouldBeValid: false,
        },
      ];

      for (const scenario of timeoutScenarios) {
        const session = {
          access_token: `token-${scenario.name}`,
          expires_at: scenario.expiresAt,
          user: { id: 'timeout-test-user', email: 'timeout@example.com' },
        };

        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: scenario.shouldBeValid ? session : null },
          error: scenario.shouldBeValid ? null : { message: 'Session expired' },
        });

        const validation = await authClient.validateSession();

        expect(validation.isValid).toBe(scenario.shouldBeValid);
      }
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency session checks efficiently', async () => {
      const validSession = {
        access_token: 'performance-token',
        expires_at: Date.now() + 3600000,
        user: { id: 'perf-user', email: 'perf@example.com' },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: validSession },
        error: null,
      });

      const startTime = Date.now();

      // Perform many concurrent validation checks
      const validationPromises = Array(200)
        .fill(null)
        .map(() => authClient.validateSession());

      const results = await Promise.all(validationPromises);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // All validations should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });

      // Should complete within reasonable time (less than 1 second)
      expect(executionTime).toBeLessThan(1000);
    });

    it('should handle session refresh under concurrent load', async () => {
      const refreshedSession = {
        access_token: 'load-refreshed-token',
        refresh_token: 'load-refresh-token',
        expires_in: 3600,
        user: { id: 'load-user', email: 'load@example.com' },
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: refreshedSession, user: refreshedSession.user },
        error: null,
      });

      // Simulate concurrent refresh attempts
      const refreshPromises = Array(10)
        .fill(null)
        .map(() => authClient.refreshSession());

      const results = await Promise.all(refreshPromises);

      // All should succeed and return consistent results
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.session?.accessToken).toBe('load-refreshed-token');
      });

      // Should not cause duplicate refresh calls due to concurrency control
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });
});
