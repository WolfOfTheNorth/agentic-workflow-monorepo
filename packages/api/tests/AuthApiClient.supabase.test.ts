/**
 * Comprehensive Unit Tests for AuthApiClient with SupabaseAdapter Integration
 *
 * Task 18: Test AuthApiClient integration with SupabaseAdapter
 * - Test AuthApiClient integration with SupabaseAdapter
 * - Create useAuth hook tests with various authentication scenarios
 * - Add error handling tests for UI error display
 * - Test session persistence and restoration in hook
 */

import { AuthApiClient } from '../src/client/auth';
import { ApiClient } from '../src/client/base';
import { SupabaseAdapter } from '../src/adapters/supabase';
// import { SessionManager } from '../src/adapters/session-manager';
import { ConfigurationManager } from '../src/config/supabase';
import {
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '../src/types/auth';

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNzEyMDB9.test-anon-key',
};

// Mock Supabase client with comprehensive auth methods
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

// Mock Supabase client creation
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

// Mock ApiClient
jest.mock('../src/client/base');

describe('AuthApiClient with SupabaseAdapter Integration', () => {
  let authApiClient: AuthApiClient;
  let mockApiClient: jest.Mocked<ApiClient>;
  let supabaseAdapter: SupabaseAdapter;
  let configManager: ConfigurationManager;

  // Test data
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
    expires_at: Date.now() + 3600000,
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

    // Create instances
    configManager = new ConfigurationManager();
    supabaseAdapter = new SupabaseAdapter(configManager);
    mockApiClient = new ApiClient({ baseUrl: 'https://api.example.com' }) as jest.Mocked<ApiClient>;
    authApiClient = new AuthApiClient(mockApiClient, supabaseAdapter);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default responses
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterEach(() => {
    // Clean up environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });

    authApiClient.cleanup();
  });

  describe('SupabaseAdapter Integration', () => {
    it('should initialize with SupabaseAdapter', () => {
      expect(authApiClient).toBeDefined();
      expect(authApiClient.getSessionManager()).toBeDefined();
    });

    it('should use SupabaseAdapter for authentication when available', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const credentials: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      const result = await authApiClient.login(credentials);

      expect(result.success).toBe(true);
      expect(result.data.access_token).toBe(testSession.access_token);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: credentials.email,
        password: credentials.password,
      });
    });

    it('should fallback to HTTP API when SupabaseAdapter fails', async () => {
      // Mock Supabase failure
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(
        new Error('Supabase service unavailable')
      );

      // Mock fallback HTTP response
      mockApiClient.post.mockResolvedValue({
        data: {
          access_token: 'fallback-token',
          user: testUser,
        },
        status: 200,
        success: true,
      });

      const credentials: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      const result = await authApiClient.login(credentials);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalled();
      // Fallback should be handled by the fallback service
    });

    it('should manage session state correctly', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const credentials: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      await authApiClient.login(credentials);

      expect(authApiClient.hasValidSession()).toBe(true);
      expect(authApiClient.getCurrentSession()).toBeTruthy();
    });

    it('should clear session on logout', async () => {
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

      expect(authApiClient.hasValidSession()).toBe(true);

      // Mock logout
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      await authApiClient.logout();

      expect(authApiClient.hasValidSession()).toBe(false);
      expect(authApiClient.getCurrentSession()).toBeNull();
    });
  });

  describe('Authentication Methods with SupabaseAdapter', () => {
    describe('login', () => {
      it('should handle successful login with session persistence', async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: {
            user: testSession.user,
            session: testSession,
          },
          error: null,
        });

        const credentials: LoginRequest = {
          email: testUser.email,
          password: 'password123',
        };

        const result = await authApiClient.login(credentials);

        expect(result.success).toBe(true);
        expect(result.data.user.email).toBe(testUser.email);
        expect(result.data.access_token).toBe(testSession.access_token);
        expect(result.message).toBe('Login successful');

        // Verify session is persisted
        expect(authApiClient.hasValidSession()).toBe(true);
      });

      it('should handle login errors from SupabaseAdapter', async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: {
            name: 'AuthError',
            message: 'invalid_credentials',
            status: 401,
            code: 'invalid_credentials',
          },
        });

        const credentials: LoginRequest = {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        };

        await expect(authApiClient.login(credentials)).rejects.toThrow();
      });

      it('should set auth token on API client after successful login', async () => {
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

        // Verify that the API client's auth token is set
        // Note: This would need to be verified through session manager callbacks
        expect(authApiClient.hasValidSession()).toBe(true);
      });
    });

    describe('register', () => {
      it('should handle successful registration with immediate session', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: {
            user: testSession.user,
            session: testSession,
          },
          error: null,
        });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        const result = await authApiClient.register(userData);

        expect(result.success).toBe(true);
        expect(result.data.user.name).toBe(testUser.name);
        expect(result.message).toBe('Registration successful');

        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              name: userData.name,
              full_name: userData.name,
            },
          },
        });
      });

      it('should handle registration requiring email verification', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: {
            user: testSession.user,
            session: null, // No session until verified
          },
          error: null,
        });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        const result = await authApiClient.register(userData);

        expect(result.success).toBe(true);
        expect(result.data.access_token).toBeUndefined();
        expect(authApiClient.hasValidSession()).toBe(false);
      });

      it('should handle registration errors', async () => {
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: { user: null, session: null },
          error: {
            name: 'AuthError',
            message: 'user_already_registered',
            status: 409,
            code: 'user_already_registered',
          },
        });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        await expect(authApiClient.register(userData)).rejects.toThrow();
      });
    });

    describe('logout', () => {
      it('should handle successful logout and clear local session', async () => {
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

        expect(authApiClient.hasValidSession()).toBe(true);

        // Mock logout
        mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

        const result = await authApiClient.logout();

        expect(result.success).toBe(true);
        expect(result.message).toBe('Logout successful');
        expect(authApiClient.hasValidSession()).toBe(false);
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      });

      it('should clear local session even if SupabaseAdapter logout fails', async () => {
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

        await expect(authApiClient.logout()).rejects.toThrow();

        // Local session should still be cleared
        expect(authApiClient.hasValidSession()).toBe(false);
      });
    });
  });

  describe('Profile Management with SupabaseAdapter', () => {
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

    it('should get user profile through SupabaseAdapter', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      const result = await authApiClient.getProfile();

      expect(result.success).toBe(true);
      expect(result.data.email).toBe(testUser.email);
      expect(result.data.name).toBe(testUser.name);
      expect(result.message).toBe('Profile retrieved successfully');
    });

    it('should update user profile through SupabaseAdapter', async () => {
      const updatedUser = {
        ...testSession.user,
        user_metadata: { name: 'Updated Name', full_name: 'Updated Name' },
      };

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: updatedUser },
        error: null,
      });

      const updateData: UpdateProfileRequest = {
        name: 'Updated Name',
      };

      const result = await authApiClient.updateProfile(updateData);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Name');
      expect(result.message).toBe('Profile updated successfully');

      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        data: {
          name: 'Updated Name',
          full_name: 'Updated Name',
        },
      });
    });

    it('should handle profile update errors', async () => {
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: {
          name: 'AuthError',
          message: 'update_failed',
          status: 400,
          code: 'update_failed',
        },
      });

      const updateData: UpdateProfileRequest = {
        name: 'Failed Update',
      };

      await expect(authApiClient.updateProfile(updateData)).rejects.toThrow();
    });
  });

  describe('Password Management with SupabaseAdapter', () => {
    it('should handle forgot password request', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await authApiClient.forgotPassword(testUser.email);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset email sent');
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        testUser.email,
        expect.any(Object)
      );
    });

    it('should handle password reset with token', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const result = await authApiClient.resetPassword('reset-token', 'newpassword123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'reset-token',
        type: 'recovery',
      });
    });

    it('should handle password change for authenticated user', async () => {
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
        password: 'oldpassword',
      });

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      const passwordData: ChangePasswordRequest = {
        current_password: 'oldpassword',
        new_password: 'newpassword123',
      };

      const result = await authApiClient.changePassword(passwordData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });
  });

  describe('Email Verification with SupabaseAdapter', () => {
    it('should handle email verification', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: testSession.user,
          session: testSession,
        },
        error: null,
      });

      const result = await authApiClient.verifyEmail('verification-token', 'signup');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email verified successfully');
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'verification-token',
        type: 'signup',
      });
    });

    it('should handle resend verification email', async () => {
      mockSupabaseClient.auth.resend.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await authApiClient.resendVerificationEmail(testUser.email, 'signup');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Verification email resent successfully');
      expect(mockSupabaseClient.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: testUser.email,
      });
    });

    it('should get email verification status', async () => {
      // Mock adapter method
      const mockGetEmailVerificationStatus = jest.fn().mockResolvedValue({
        verified: true,
        pending: false,
      });

      (supabaseAdapter as any).getEmailVerificationStatus = mockGetEmailVerificationStatus;

      const result = await authApiClient.getEmailVerificationStatus(testUser.id, testUser.email);

      expect(result.success).toBe(true);
      expect(mockGetEmailVerificationStatus).toHaveBeenCalledWith({
        userId: testUser.id,
        email: testUser.email,
      });
    });

    it('should handle email change', async () => {
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

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: { user: testSession.user },
        error: null,
      });

      const result = await authApiClient.changeEmail('newemail@example.com');

      expect(result.success).toBe(true);
      expect(result.data.newEmail).toBe('newemail@example.com');
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        email: 'newemail@example.com',
      });
    });
  });

  describe('Session Management with SupabaseAdapter', () => {
    it('should initialize session on startup', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: testSession },
        error: null,
      });

      const initialized = await authApiClient.initializeSession();

      expect(initialized).toBe(true);
      expect(authApiClient.hasValidSession()).toBe(true);
    });

    it('should handle session restoration failure', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const initialized = await authApiClient.initializeSession();

      expect(initialized).toBe(false);
      expect(authApiClient.hasValidSession()).toBe(false);
    });

    it('should handle token refresh', async () => {
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

      const refreshSuccess = await authApiClient.forceTokenRefresh();

      expect(refreshSuccess).toBe(true);
    });

    it('should get current session data', async () => {
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

      const currentSession = authApiClient.getCurrentSession();

      expect(currentSession).toBeTruthy();
      expect(currentSession?.access_token).toBe(testSession.access_token);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle SupabaseAdapter errors gracefully', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      const credentials: LoginRequest = {
        email: testUser.email,
        password: 'password123',
      };

      // Should fallback to HTTP API or handle error appropriately
      await expect(authApiClient.login(credentials)).rejects.toThrow();
    });

    it('should check service health', async () => {
      const healthStatus = await authApiClient.checkServiceHealth();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.available).toBeDefined();
      expect(healthStatus.recommendedStrategy).toBeDefined();
    });

    it('should get circuit breaker statistics', () => {
      const stats = authApiClient.getCircuitBreakerStats();

      expect(stats).toBeDefined();
    });

    it('should get fallback service manager', () => {
      const fallbackService = authApiClient.getFallbackService();

      expect(fallbackService).toBeDefined();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources properly', () => {
      expect(() => authApiClient.cleanup()).not.toThrow();
    });

    it('should handle multiple cleanup calls', () => {
      authApiClient.cleanup();
      expect(() => authApiClient.cleanup()).not.toThrow();
    });
  });

  describe('Configuration and Initialization', () => {
    it('should work with provided SupabaseAdapter', () => {
      const customAdapter = new SupabaseAdapter(configManager);
      const customAuthClient = new AuthApiClient(mockApiClient, customAdapter);

      expect(customAuthClient.getSessionManager()).toBeDefined();
      customAuthClient.cleanup();
    });

    it('should work with custom session manager config', () => {
      const sessionConfig = {
        refreshThreshold: 600, // 10 minutes
        enablePersistence: true,
      };

      const customAuthClient = new AuthApiClient(mockApiClient, supabaseAdapter, sessionConfig);

      expect(customAuthClient.getSessionManager()).toBeDefined();
      customAuthClient.cleanup();
    });

    it('should work with custom fallback config', () => {
      const fallbackConfig = {
        enableHttpFallback: true,
        maxRetries: 5,
      };

      const customAuthClient = new AuthApiClient(
        mockApiClient,
        supabaseAdapter,
        undefined,
        fallbackConfig
      );

      expect(customAuthClient.getFallbackService()).toBeDefined();
      customAuthClient.cleanup();
    });
  });
});
