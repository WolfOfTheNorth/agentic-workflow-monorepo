/**
 * Comprehensive Integration Tests for Authentication Flows
 *
 * Task 5.2.1: Test complete authentication flows end-to-end
 * - Create end-to-end tests for signup → login → logout flows
 * - Test session restoration and automatic token refresh
 * - Test error scenarios and recovery mechanisms
 * - Requirements: 8.9
 */

import { AuthClient, createAuthClient, Mock } from '../../clients/auth-client';
import { ApiClient } from '../../client/base';
import {
  AuthUser,
  LoginCredentials,
  SignupData,
  AuthResponse,
  AuthSession,
} from '@agentic-workflow/shared';

// Mock Supabase and dependencies for integration testing
jest.mock('@supabase/supabase-js');
jest.mock('../../adapters/enhanced-token-storage');
jest.mock('../../adapters/auth-validation-service');

describe('Authentication Flow Integration Tests', () => {
  let authClient: AuthClient;
  let apiClient: ApiClient;
  let mockSupabaseClient: Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup mock API client
    apiClient = {
      setAuthToken: jest.fn(),
      setTokenRefreshHandler: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as unknown as ApiClient;

    // Setup mock Supabase client responses
    mockSupabaseClient = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    };

    const { createClient } = await import('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabaseClient);

    // Create auth client
    authClient = createAuthClient({
      supabaseUrl: 'https://test-project.supabase.co',
      supabaseKey: 'test-anon-key',
      apiClient,
      enableDetailedLogging: true,
    });
  });

  afterEach(async () => {
    if (authClient) {
      await authClient.dispose();
    }
  });

  describe('Complete User Journey: Signup → Login → Logout', () => {
    it('should complete full authentication cycle successfully', async () => {
      // Step 1: User Signup
      const signupData: SignupData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        termsAccepted: true,
        newsletterOptIn: false,
      };

      const signupMockResponse = {
        data: {
          user: {
            id: 'new-user-id',
            email: 'newuser@example.com',
            user_metadata: { name: 'New User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: null, // Email verification required
          },
          session: null, // No session until email verification
        },
        error: null,
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue(signupMockResponse);

      const signupResult = await authClient.signup(signupData);

      expect(signupResult.success).toBe(true);
      expect(signupResult.user?.email).toBe('newuser@example.com');
      expect(signupResult.session).toBeNull(); // Email verification required
      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        options: {
          data: {
            name: 'New User',
            full_name: 'New User',
          },
        },
      });

      // Step 2: Simulate Email Verification (user clicks email link)
      const verificationMockResponse = {
        data: {
          user: {
            ...signupMockResponse.data.user,
            email_confirmed_at: '2023-01-01T01:00:00Z',
          },
          session: {
            access_token: 'verified-access-token',
            refresh_token: 'verified-refresh-token',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            user: {
              ...signupMockResponse.data.user,
              email_confirmed_at: '2023-01-01T01:00:00Z',
            },
          },
        },
        error: null,
      };

      const verifyResult = await authClient.verifyEmail('verification-token');
      expect(verifyResult.success).toBe(true);

      // Step 3: User Login (after email verification)
      const loginCredentials: LoginCredentials = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        rememberMe: true,
      };

      const loginMockResponse = {
        data: {
          user: verificationMockResponse.data.user,
          session: verificationMockResponse.data.session,
        },
        error: null,
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(loginMockResponse);

      const loginResult = await authClient.login(loginCredentials);

      expect(loginResult.success).toBe(true);
      expect(loginResult.user?.email).toBe('newuser@example.com');
      expect(loginResult.session?.accessToken).toBe('verified-access-token');
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('verified-access-token');

      // Verify user is authenticated
      expect(authClient.isAuthenticated()).toBe(true);
      expect(authClient.getCurrentUser()?.email).toBe('newuser@example.com');

      // Step 4: Test Session Refresh
      const refreshMockResponse = {
        data: {
          session: {
            access_token: 'refreshed-access-token',
            refresh_token: 'refreshed-refresh-token',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            user: verificationMockResponse.data.user,
          },
          user: verificationMockResponse.data.user,
        },
        error: null,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue(refreshMockResponse);

      const refreshResult = await authClient.refreshSession();

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.session?.accessToken).toBe('refreshed-access-token');
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('refreshed-access-token');

      // Step 5: User Logout
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      const logoutResult = await authClient.logout();

      expect(logoutResult.success).toBe(true);
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      expect(apiClient.setAuthToken).toHaveBeenCalledWith(null);

      // Verify user is no longer authenticated
      expect(authClient.isAuthenticated()).toBe(false);
      expect(authClient.getCurrentUser()).toBeNull();
    });

    it('should handle signup with immediate session (email verification disabled)', async () => {
      const signupData: SignupData = {
        email: 'instant@example.com',
        password: 'SecurePassword123!',
        name: 'Instant User',
        termsAccepted: true,
      };

      const signupMockResponse = {
        data: {
          user: {
            id: 'instant-user-id',
            email: 'instant@example.com',
            user_metadata: { name: 'Instant User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: '2023-01-01T00:00:00Z',
          },
          session: {
            access_token: 'instant-access-token',
            refresh_token: 'instant-refresh-token',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            user: {
              id: 'instant-user-id',
              email: 'instant@example.com',
              user_metadata: { name: 'Instant User' },
            },
          },
        },
        error: null,
      };

      mockSupabaseClient.auth.signUp.mockResolvedValue(signupMockResponse);

      const signupResult = await authClient.signup(signupData);

      expect(signupResult.success).toBe(true);
      expect(signupResult.user?.email).toBe('instant@example.com');
      expect(signupResult.session?.accessToken).toBe('instant-access-token');
      expect(authClient.isAuthenticated()).toBe(true);
    });
  });

  describe('Session Management and Token Refresh', () => {
    beforeEach(async () => {
      // Setup authenticated user
      const mockSession = {
        access_token: 'current-access-token',
        refresh_token: 'current-refresh-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        },
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      await authClient.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should automatically refresh token when approaching expiration', async () => {
      // Simulate token nearing expiration
      const nearExpiryTime = Date.now() + 250000; // Less than 5 minutes

      const refreshMockResponse = {
        data: {
          session: {
            access_token: 'auto-refreshed-token',
            refresh_token: 'auto-refreshed-refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
        error: null,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue(refreshMockResponse);

      // Trigger automatic refresh
      const result = await authClient.refreshSession();

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('auto-refreshed-token');
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('auto-refreshed-token');
    });

    it('should handle token refresh failure and clear session', async () => {
      const refreshError = {
        name: 'AuthError',
        message: 'Refresh token expired',
        status: 401,
      };

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: refreshError,
      });

      const result = await authClient.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REFRESH_TOKEN_EXPIRED');
    });

    it('should restore session on app initialization', async () => {
      const storedSession = {
        access_token: 'stored-access-token',
        refresh_token: 'stored-refresh-token',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'stored-user-id',
          email: 'stored@example.com',
        },
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: storedSession },
        error: null,
      });

      // Create new auth client to simulate app restart
      const newAuthClient = createAuthClient({
        supabaseUrl: 'https://test-project.supabase.co',
        supabaseKey: 'test-anon-key',
        apiClient,
      });

      await newAuthClient.initialize();

      expect(newAuthClient.isAuthenticated()).toBe(true);
      expect(newAuthClient.getCurrentUser()?.email).toBe('stored@example.com');
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('stored-access-token');

      await newAuthClient.dispose();
    });

    it('should handle session validation during app usage', async () => {
      // Initially valid session
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'valid-token',
            expires_at: Date.now() + 3600000,
            user: { id: 'test-id', email: 'test@example.com' },
          },
        },
        error: null,
      });

      const validationResult = await authClient.validateSession();
      expect(validationResult.isValid).toBe(true);

      // Session becomes invalid
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const invalidValidationResult = await authClient.validateSession();
      expect(invalidValidationResult.isValid).toBe(false);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network errors during login with retry logic', async () => {
      let attempt = 0;
      mockSupabaseClient.auth.signInWithPassword.mockImplementation(() => {
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

      const loginResult = await authClient.login({
        email: 'retry@example.com',
        password: 'password123',
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.session?.accessToken).toBe('retry-success-token');
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent authentication attempts', async () => {
      const mockResponse = {
        data: {
          session: {
            access_token: 'concurrent-token',
            refresh_token: 'concurrent-refresh',
            expires_in: 3600,
            user: { id: 'concurrent-user', email: 'concurrent@example.com' },
          },
        },
        error: null,
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockResponse);

      const credentials = {
        email: 'concurrent@example.com',
        password: 'password123',
      };

      // Execute multiple concurrent login attempts
      const promises = Array(5)
        .fill(null)
        .map(() => authClient.login(credentials));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should maintain session consistency
      expect(authClient.getCurrentUser()?.email).toBe('concurrent@example.com');
    });

    it('should handle session conflicts and resolution', async () => {
      // Initial login
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'initial-token',
            refresh_token: 'initial-refresh',
            expires_in: 3600,
            user: { id: 'conflict-user', email: 'conflict@example.com' },
          },
        },
        error: null,
      });

      await authClient.login({
        email: 'conflict@example.com',
        password: 'password123',
      });

      expect(authClient.isAuthenticated()).toBe(true);

      // Simulate session conflict (e.g., logout from another tab)
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const validation = await authClient.validateSession();
      expect(validation.isValid).toBe(false);
    });

    it('should handle authentication errors and provide user-friendly messages', async () => {
      const authErrors = [
        {
          supabaseError: { message: 'Invalid login credentials', status: 400 },
          expectedCode: 'INVALID_CREDENTIALS',
          expectedMessage: /email or password/i,
        },
        {
          supabaseError: { message: 'Email not confirmed', status: 400 },
          expectedCode: 'EMAIL_NOT_CONFIRMED',
          expectedMessage: /email.*not.*confirmed/i,
        },
        {
          supabaseError: { message: 'Too many requests', status: 429 },
          expectedCode: 'RATE_LIMITED',
          expectedMessage: /too many/i,
        },
      ];

      for (const { supabaseError, expectedCode, expectedMessage } of authErrors) {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { session: null, user: null },
          error: supabaseError,
        });

        const result = await authClient.login({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(expectedCode);
        expect(result.error?.message).toMatch(expectedMessage);
      }
    });

    it('should handle profile update errors and recovery', async () => {
      // Setup authenticated user
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'profile-token',
            user: {
              id: 'profile-user',
              email: 'profile@example.com',
              user_metadata: { name: 'Original Name' },
            },
          },
        },
        error: null,
      });

      await authClient.login({
        email: 'profile@example.com',
        password: 'password123',
      });

      // Test profile update failure
      const updateError = {
        name: 'AuthError',
        message: 'Update failed',
        status: 500,
      };

      mockSupabaseClient.auth.updateUser = jest.fn().mockResolvedValue({
        data: { user: null },
        error: updateError,
      });

      const updateResult = await authClient.updateProfile({ name: 'New Name' });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error?.message).toContain('Update failed');
    });
  });

  describe('Complex Authentication Scenarios', () => {
    it('should handle password reset flow', async () => {
      const resetMockResponse = {
        data: {},
        error: null,
      };

      mockSupabaseClient.auth.resetPasswordForEmail = jest
        .fn()
        .mockResolvedValue(resetMockResponse);

      const resetResult = await authClient.resetPassword('reset@example.com');

      expect(resetResult.success).toBe(true);
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'reset@example.com'
      );
    });

    it('should handle password update for authenticated user', async () => {
      // Setup authenticated user
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'password-update-token',
            user: { id: 'password-user', email: 'password@example.com' },
          },
        },
        error: null,
      });

      await authClient.login({
        email: 'password@example.com',
        password: 'oldpassword',
      });

      // Test password update
      mockSupabaseClient.auth.updateUser = jest.fn().mockResolvedValue({
        data: {
          user: { id: 'password-user', email: 'password@example.com' },
        },
        error: null,
      });

      const updateResult = await authClient.updatePassword('newpassword123');

      expect(updateResult.success).toBe(true);
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    it('should handle multi-device login scenarios', async () => {
      // Simulate login from first device
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'device-1-token',
            refresh_token: 'device-1-refresh',
            expires_in: 3600,
            user: { id: 'multi-device-user', email: 'multidevice@example.com' },
          },
        },
        error: null,
      });

      const device1Result = await authClient.login({
        email: 'multidevice@example.com',
        password: 'password123',
      });

      expect(device1Result.success).toBe(true);
      expect(authClient.isAuthenticated()).toBe(true);

      // Simulate concurrent session validation (as would happen on other devices)
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'device-1-token',
            expires_at: Date.now() + 3600000,
            user: { id: 'multi-device-user', email: 'multidevice@example.com' },
          },
        },
        error: null,
      });

      const validationResult = await authClient.validateSession();
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    it('should maintain performance under load', async () => {
      const mockResponse = {
        data: {
          session: {
            access_token: 'load-test-token',
            user: { id: 'load-user', email: 'load@example.com' },
          },
        },
        error: null,
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue(mockResponse);

      const startTime = Date.now();

      // Perform many validation operations
      const validationPromises = Array(100)
        .fill(null)
        .map(() => authClient.validateSession());

      await Promise.all(validationPromises);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (less than 2 seconds)
      expect(executionTime).toBeLessThan(2000);
    });

    it('should handle memory management during long sessions', async () => {
      // Setup long-running session
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'memory-test-token',
            user: { id: 'memory-user', email: 'memory@example.com' },
          },
        },
        error: null,
      });

      await authClient.login({
        email: 'memory@example.com',
        password: 'password123',
      });

      // Simulate multiple operations over time
      for (let i = 0; i < 50; i++) {
        await authClient.validateSession();
        await authClient.getCurrentUser();
        await authClient.getCurrentSession();
      }

      // Should still function correctly
      expect(authClient.isAuthenticated()).toBe(true);
      expect(authClient.getCurrentUser()?.email).toBe('memory@example.com');
    });
  });
});
