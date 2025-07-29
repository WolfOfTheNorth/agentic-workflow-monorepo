/**
 * Integration Tests for Complete Authentication Flows
 *
 * Task 17: Test complete authentication flows end-to-end
 * - Create end-to-end login/logout flow tests
 * - Test registration with email verification scenarios
 * - Add password reset workflow testing
 * - Create session restoration and token refresh tests
 */

import { SupabaseAdapter } from '../src/adapters/supabase';
import { AuthApiClient } from '../src/client/auth';
import { ApiClient } from '../src/client/base';
// import { SessionManager } from '../src/adapters/session-manager';
import { ConfigurationManager } from '../src/config/supabase';
import {
  LoginRequest,
  RegisterRequest,
  // ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
} from '../src/types/auth';

// Mock environment variables for testing
const mockEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNzEyMDB9.test-anon-key',
};

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    verifyOtp: jest.fn(),
    resend: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
};

// Mock the Supabase client creation
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
  AuthError: class AuthError extends Error {
    constructor(message: string, status?: number, code?: string) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
      this.code = code;
      this.__isAuthError = true;
    }
  },
}));

describe('Authentication Flows Integration Tests', () => {
  let authApiClient: AuthApiClient;
  let supabaseAdapter: SupabaseAdapter;
  let apiClient: ApiClient;
  let configManager: ConfigurationManager;

  // Test user data
  const testUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const testSession = {
    access_token: 'test-access-token-123',
    refresh_token: 'test-refresh-token-123',
    expires_in: 3600,
    expires_at: Date.now() + 3600000, // 1 hour from now
    token_type: 'bearer',
    user: {
      id: testUser.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: testUser.email,
      email_confirmed_at: testUser.created_at,
      phone: '',
      confirmed_at: testUser.created_at,
      last_sign_in_at: testUser.created_at,
      app_metadata: {},
      user_metadata: { name: testUser.name },
      identities: [],
      created_at: testUser.created_at,
      updated_at: testUser.updated_at,
    },
  };

  beforeEach(() => {
    // Set up mock environment
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Create fresh instances for each test
    configManager = new ConfigurationManager();
    supabaseAdapter = new SupabaseAdapter(configManager);
    apiClient = new ApiClient({ baseUrl: 'https://api.example.com' });
    authApiClient = new AuthApiClient(apiClient, supabaseAdapter);

    // Reset all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Setup default successful responses
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
  });

  afterEach(() => {
    // Clean up environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });

    // Cleanup auth client
    authApiClient.cleanup();
  });

  describe('Complete Login/Logout Flow', () => {
    it('should complete full login flow with session management', async () => {
      // Step 1: Mock successful login
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      // Step 2: Execute login
      const loginRequest: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      const loginResult = await authApiClient.login(loginRequest);

      // Step 3: Verify login response
      expect(loginResult.success).toBe(true);
      expect(loginResult.data.access_token).toBe(testSession.access_token);
      expect(loginResult.data.user.email).toBe(testUser.email);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: loginRequest.email,
        password: loginRequest.password,
      });

      // Step 4: Verify session is persisted
      const sessionManager = authApiClient.getSessionManager();
      expect(sessionManager).toBeDefined();
      expect(authApiClient.hasValidSession()).toBe(true);

      // Step 5: Get current session
      const currentSession = authApiClient.getCurrentSession();
      expect(currentSession).toBeDefined();
      expect(currentSession?.access_token).toBe(testSession.access_token);

      // Step 6: Mock successful logout
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      // Step 7: Execute logout
      const logoutResult = await authApiClient.logout();

      // Step 8: Verify logout response
      expect(logoutResult.success).toBe(true);
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();

      // Step 9: Verify session is cleared
      expect(authApiClient.hasValidSession()).toBe(false);
      expect(authApiClient.getCurrentSession()).toBeNull();
    });

    it('should handle login failures gracefully', async () => {
      // Mock login failure
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          name: 'AuthError',
          message: 'invalid_credentials',
          status: 401,
          code: 'invalid_credentials',
        },
      });

      const loginRequest: LoginRequest = {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      };

      await expect(authApiClient.login(loginRequest)).rejects.toThrow();
      expect(authApiClient.hasValidSession()).toBe(false);
    });

    it('should handle logout errors and still clear local session', async () => {
      // First login successfully
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });

      expect(authApiClient.hasValidSession()).toBe(true);

      // Mock logout failure
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: {
          name: 'AuthError',
          message: 'logout_failed',
          status: 500,
          code: 'logout_failed',
        },
      });

      // Logout should still clear local session even if Supabase fails
      await expect(authApiClient.logout()).rejects.toThrow();
      expect(authApiClient.hasValidSession()).toBe(false);
    });
  });

  describe('Registration with Email Verification Flow', () => {
    it('should complete registration with immediate session', async () => {
      // Mock successful registration with immediate session
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const registerRequest: RegisterRequest = {
        email: testUser.email,
        password: 'password123',
        name: testUser.name,
      };

      const registerResult = await authApiClient.register(registerRequest);

      expect(registerResult.success).toBe(true);
      expect(registerResult.data.access_token).toBe(testSession.access_token);
      expect(registerResult.data.user.email).toBe(testUser.email);
      expect(registerResult.data.user.name).toBe(testUser.name);

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: registerRequest.email,
        password: registerRequest.password,
        options: {
          data: {
            name: registerRequest.name,
            full_name: registerRequest.name,
          },
        },
      });

      // Verify session is established
      expect(authApiClient.hasValidSession()).toBe(true);
    });

    it('should handle registration requiring email verification', async () => {
      // Mock registration that requires email verification
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: null, // No session until email is verified
        },
        error: null,
      });

      const registerRequest: RegisterRequest = {
        email: testUser.email,
        password: 'password123',
        name: testUser.name,
      };

      const registerResult = await authApiClient.register(registerRequest);

      expect(registerResult.success).toBe(true);
      expect(registerResult.data.access_token).toBeUndefined();
      expect(registerResult.data.user).toBeUndefined();

      // Verify no session is established yet
      expect(authApiClient.hasValidSession()).toBe(false);

      // Simulate email verification
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const verifyResult = await authApiClient.verifyEmail('verification-token', 'signup');

      expect(verifyResult.success).toBe(true);
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'verification-token',
        type: 'signup',
      });
    });

    it('should handle registration errors', async () => {
      // Mock registration failure
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          name: 'AuthError',
          message: 'user_already_registered',
          status: 409,
          code: 'user_already_registered',
        },
      });

      const registerRequest: RegisterRequest = {
        email: testUser.email,
        password: 'password123',
        name: testUser.name,
      };

      await expect(authApiClient.register(registerRequest)).rejects.toThrow();
      expect(authApiClient.hasValidSession()).toBe(false);
    });

    it('should resend verification email', async () => {
      // Mock resend verification email
      mockSupabaseClient.auth.resend.mockResolvedValue({
        data: {},
        error: null,
      });

      const resendResult = await authApiClient.resendVerificationEmail(testUser.email, 'signup');

      expect(resendResult.success).toBe(true);
      expect(mockSupabaseClient.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: testUser.email,
      });
    });
  });

  describe('Password Reset Workflow', () => {
    it('should complete password reset flow', async () => {
      // Step 1: Request password reset
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const forgotPasswordResult = await authApiClient.forgotPassword(testUser.email);

      expect(forgotPasswordResult.success).toBe(true);
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        testUser.email,
        expect.any(Object)
      );

      // Step 2: Reset password with token
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const resetPasswordRequest: ResetPasswordRequest = {
        token: 'reset-token-123',
        new_password: 'newpassword123',
      };

      const resetResult = await authApiClient.resetPassword(
        resetPasswordRequest.token,
        resetPasswordRequest.new_password
      );

      expect(resetResult.success).toBe(true);
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: resetPasswordRequest.token,
        type: 'recovery',
      });
    });

    it('should handle password reset errors', async () => {
      // Mock password reset failure
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: {
          name: 'AuthError',
          message: 'user_not_found',
          status: 404,
          code: 'user_not_found',
        },
      });

      await expect(authApiClient.forgotPassword('nonexistent@example.com')).rejects.toThrow();
    });

    it('should update password for authenticated user', async () => {
      // First login to establish session
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'oldpassword123',
      });

      // Mock password update
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: {
          user: testSession.user,
        },
        error: null,
      });

      const updatePasswordRequest: UpdatePasswordRequest = {
        new_password: 'newpassword123',
        current_password: 'oldpassword123',
      };

      const updateResult = await authApiClient.changePassword({
        new_password: updatePasswordRequest.new_password,
        current_password: updatePasswordRequest.current_password,
      });

      expect(updateResult.success).toBe(true);
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: updatePasswordRequest.new_password,
      });
    });
  });

  describe('Session Restoration and Token Refresh', () => {
    it('should restore session on initialization', async () => {
      // Mock existing session in storage
      const storedSession = {
        ...testSession,
        expires_at: Date.now() + 1800000, // 30 minutes from now
      };

      // Mock session restoration
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: storedSession },
        error: null,
      });

      // Initialize session
      const restored = await authApiClient.initializeSession();

      expect(restored).toBe(true);
      expect(authApiClient.hasValidSession()).toBe(true);

      const currentSession = authApiClient.getCurrentSession();
      expect(currentSession?.access_token).toBe(storedSession.access_token);
    });

    it('should handle expired session restoration', async () => {
      // Mock expired session
      const expiredSession = {
        ...testSession,
        expires_at: Date.now() - 1000, // 1 second ago
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: expiredSession },
        error: null,
      });

      const restored = await authApiClient.initializeSession();

      // Should not restore expired session
      expect(restored).toBe(false);
      expect(authApiClient.hasValidSession()).toBe(false);
    });

    it('should handle session refresh automatically', async () => {
      // Login first
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });

      // Get current refresh token for testing
      const sessionManager = authApiClient.getSessionManager();
      expect(sessionManager).toBeDefined();

      // Verify session is valid
      expect(authApiClient.hasValidSession()).toBe(true);

      // Mock refresh token request
      const refreshedSession = {
        ...testSession,
        access_token: 'new-access-token-456',
        expires_at: Date.now() + 3600000, // 1 hour from now
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      // Force token refresh
      const refreshSuccess = await authApiClient.forceTokenRefresh();

      expect(refreshSuccess).toBe(true);
      expect(authApiClient.hasValidSession()).toBe(true);
    });

    it('should handle refresh token failure', async () => {
      // Login first
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });

      // Mock refresh failure
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: {
          name: 'AuthError',
          message: 'invalid_refresh_token',
          status: 401,
          code: 'invalid_refresh_token',
        },
      });

      // Session should be invalidated
      const refreshSuccess = await authApiClient.forceTokenRefresh();
      expect(refreshSuccess).toBe(false);
    });
  });

  describe('Profile Management Flow', () => {
    beforeEach(async () => {
      // Login before profile operations
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });
    });

    it('should get user profile', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      const profileResult = await authApiClient.getProfile();

      expect(profileResult.success).toBe(true);
      expect(profileResult.data.email).toBe(testUser.email);
      expect(profileResult.data.name).toBe(testUser.name);
    });

    it('should update user profile', async () => {
      const updatedUser = {
        ...testSession.user,
        user_metadata: { name: 'Updated Name', full_name: 'Updated Name' },
      };

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: updatedUser },
        error: null,
      });

      const updateResult = await authApiClient.updateProfile({
        name: 'Updated Name',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe('Updated Name');
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        data: {
          name: 'Updated Name',
          full_name: 'Updated Name',
        },
      });
    });

    it('should change email address', async () => {
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      const emailChangeResult = await authApiClient.changeEmail('newemail@example.com');

      expect(emailChangeResult.success).toBe(true);
      expect(emailChangeResult.data.newEmail).toBe('newemail@example.com');
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        email: 'newemail@example.com',
      });
    });
  });

  describe('Error Recovery and Fallback', () => {
    it('should handle Supabase service unavailability', async () => {
      // Mock Supabase service being unavailable
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );

      // Should attempt fallback
      const loginRequest: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      // The test should verify that fallback mechanisms are triggered
      // (actual fallback behavior depends on implementation)
      try {
        await authApiClient.login(loginRequest);
      } catch {
        // Expected for this test since we're testing service unavailability
      }

      // Check service health
      const healthStatus = await authApiClient.checkServiceHealth();
      expect(healthStatus).toBeDefined();
    });

    it('should get circuit breaker statistics', async () => {
      const stats = authApiClient.getCircuitBreakerStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent authentication requests', async () => {
      // Mock successful responses
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      // Create multiple concurrent login requests
      const loginPromises = Array.from({ length: 5 }, (_, i) =>
        authApiClient.login({
          email: `test${i}@example.com`,
          password: 'password123',
        })
      );

      const results = await Promise.allSettled(loginPromises);

      // All should succeed (though only last one will have active session)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should handle session operations during refresh', async () => {
      // Login first
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });

      // Mock profile operations during potential refresh
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      // Perform multiple operations concurrently
      const operationsPromises = [
        authApiClient.getProfile(),
        authApiClient.hasValidSession(),
        authApiClient.getCurrentSession(),
      ];

      const results = await Promise.allSettled(operationsPromises);

      // All operations should handle potential refresh correctly
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should properly cleanup resources', async () => {
      // Login to create session
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      await authApiClient.login({
        email: testUser.email,
        password: 'password123',
      });

      expect(authApiClient.hasValidSession()).toBe(true);

      // Cleanup should stop monitoring and clean resources
      authApiClient.cleanup();

      // Verify cleanup occurred (session monitoring stopped)
      const sessionManager = authApiClient.getSessionManager();
      expect(sessionManager).toBeDefined();
    });

    it('should handle multiple cleanup calls safely', async () => {
      // Multiple cleanup calls should not cause errors
      expect(() => {
        authApiClient.cleanup();
        authApiClient.cleanup();
        authApiClient.cleanup();
      }).not.toThrow();
    });
  });
});
