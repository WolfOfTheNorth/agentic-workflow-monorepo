/**
 * Comprehensive Unit Tests for useAuth Hook
 *
 * Task 18: Create useAuth hook tests with various authentication scenarios
 * - Test useAuth hook with various authentication scenarios
 * - Add error handling tests for UI error display
 * - Test session persistence and restoration in hook
 * - Verify proper state management and loading indicators
 */

import { AuthApiClient } from '../src/client/auth';
import { ApiClient } from '../src/client/base';
import { SupabaseAdapter } from '../src/adapters/supabase';
import { ConfigurationManager } from '../src/config/supabase';
import { LoginRequest, RegisterRequest } from '../src/types/auth';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock useAuth hook
const useAuth = jest.fn();
const wrapper = ({ children }: { children: React.ReactNode }) => children;

// Mock environment variables
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

// Mock useAuth hook implementation
const createMockUseAuth = (authClient: AuthApiClient) => {
  let state = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,
  };

  const setState = (newState: any) => {
    state = { ...state, ...newState };
  };

  return {
    get user() {
      return state.user;
    },
    get isLoading() {
      return state.isLoading;
    },
    get isAuthenticated() {
      return state.isAuthenticated;
    },
    get error() {
      return state.error;
    },

    login: async (credentials: LoginRequest) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await authClient.login(credentials);
        if (result.success) {
          setState({
            user: result.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        }
        return result;
      } catch (error: any) {
        setState({
          error: error.message || 'Login failed',
          isLoading: false,
        });
        throw error;
      }
    },

    register: async (userData: RegisterRequest) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await authClient.register(userData);
        if (result.success && result.data.user) {
          setState({
            user: result.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState({ isLoading: false });
        }
        return result;
      } catch (error: any) {
        setState({
          error: error.message || 'Registration failed',
          isLoading: false,
        });
        throw error;
      }
    },

    logout: async () => {
      setState({ isLoading: true, error: null });
      try {
        await authClient.logout();
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } catch (error: any) {
        setState({
          error: error.message || 'Logout failed',
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        throw error;
      }
    },

    updateProfile: async (profileData: any) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await authClient.updateProfile(profileData);
        if (result.success) {
          setState({
            user: result.data,
            isLoading: false,
          });
        }
        return result;
      } catch (error: any) {
        setState({
          error: error.message || 'Profile update failed',
          isLoading: false,
        });
        throw error;
      }
    },

    changePassword: async (passwordData: any) => {
      try {
        return await authClient.changePassword(passwordData);
      } catch (error: any) {
        setState({ error: error.message || 'Password change failed' });
        throw error;
      }
    },

    forgotPassword: async (email: string) => {
      try {
        return await authClient.forgotPassword(email);
      } catch (error: any) {
        setState({ error: error.message || 'Forgot password failed' });
        throw error;
      }
    },

    resetPassword: async (token: string, newPassword: string) => {
      try {
        return await authClient.resetPassword(token, newPassword);
      } catch (error: any) {
        setState({ error: error.message || 'Password reset failed' });
        throw error;
      }
    },

    verifyEmail: async (token: string, type?: string) => {
      try {
        return await authClient.verifyEmail(token, type as any);
      } catch (error: any) {
        setState({ error: error.message || 'Email verification failed' });
        throw error;
      }
    },

    refreshToken: async (refreshData: any) => {
      try {
        return await authClient.refreshToken(refreshData);
      } catch (error: any) {
        setState({ error: error.message || 'Token refresh failed' });
        throw error;
      }
    },

    clearError: () => {
      setState({ error: null });
    },

    // Test helpers
    _setState: setState,
    _restoreSession: async () => {
      try {
        const restored = await authClient.initializeSession();
        if (restored && authClient.hasValidSession()) {
          const profileResult = await authClient.getProfile();
          if (profileResult.success) {
            setState({
              user: profileResult.data,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } else {
          setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error: any) {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    },
  };
};

// Helper to create auth client
const createTestAuthClient = (): AuthApiClient => {
  const configManager = new ConfigurationManager();
  const supabaseAdapter = new SupabaseAdapter(configManager);
  const apiClient = new ApiClient({ baseUrl: 'https://api.example.com' }) as jest.Mocked<ApiClient>;
  return new AuthApiClient(apiClient, supabaseAdapter);
};

describe('useAuth Hook Unit Tests', () => {
  let authClient: AuthApiClient;
  let mockUseAuth: ReturnType<typeof createMockUseAuth>;

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

    // Create auth client and mock hook
    authClient = createTestAuthClient();
    mockUseAuth = createMockUseAuth(authClient);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default responses
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: testSession.user },
      error: null,
    });
  });

  afterEach(() => {
    // Clean up environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });

    authClient.cleanup();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      expect(mockUseAuth.user).toBeNull();
      expect(mockUseAuth.isAuthenticated).toBe(false);
      expect(mockUseAuth.isLoading).toBe(false);
      expect(mockUseAuth.error).toBeNull();
    });

    it('should provide all required methods', () => {
      expect(typeof mockUseAuth.login).toBe('function');
      expect(typeof mockUseAuth.register).toBe('function');
      expect(typeof mockUseAuth.logout).toBe('function');
      expect(typeof mockUseAuth.refreshToken).toBe('function');
      expect(typeof mockUseAuth.updateProfile).toBe('function');
      expect(typeof mockUseAuth.changePassword).toBe('function');
      expect(typeof mockUseAuth.forgotPassword).toBe('function');
      expect(typeof mockUseAuth.resetPassword).toBe('function');
      expect(typeof mockUseAuth.verifyEmail).toBe('function');
      expect(typeof mockUseAuth.clearError).toBe('function');
    });

    it('should restore session on mount when valid session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: testSession },
        error: null,
      });

      // Create a mock that simulates successful session restoration
      jest.spyOn(authClient, 'initializeSession').mockResolvedValue(true);
      jest.spyOn(authClient, 'hasValidSession').mockReturnValue(true);
      jest.spyOn(authClient, 'getProfile').mockResolvedValue({
        data: testUser,
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(testUser);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle session restoration failure gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: {
          name: 'AuthError',
          message: 'session_expired',
          status: 401,
          code: 'session_expired',
        },
      });

      jest.spyOn(authClient, 'initializeSession').mockResolvedValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull(); // Restoration failure shouldn't set error
      });
    });
  });

  describe('Authentication Methods', () => {
    describe('login', () => {
      it('should handle successful login', async () => {
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: {
            user: testSession.user,
            session: testSession,
          },
          error: null,
        });

        jest.spyOn(authClient, 'login').mockResolvedValue({
          data: {
            access_token: testSession.access_token,
            refresh_token: testSession.refresh_token,
            expires_in: testSession.expires_in,
            user: testUser,
          },
          status: 200,
          success: true,
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        const credentials: LoginRequest = {
          email: testUser.email,
          password: 'password123',
        };

        await act(async () => {
          await result.current.login(credentials);
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(true);
          expect(result.current.user).toEqual(testUser);
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
        });
      });

      it('should handle login failure', async () => {
        const loginError = new Error('Invalid credentials');

        jest.spyOn(authClient, 'login').mockRejectedValue(loginError);

        const { result } = renderHook(() => useAuth(), { wrapper });

        const credentials: LoginRequest = {
          email: 'invalid@example.com',
          password: 'wrongpassword',
        };

        await act(async () => {
          try {
            await result.current.login(credentials);
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBe('Invalid credentials');
        });
      });

      it('should show loading state during login', async () => {
        let resolveLogin: (value: any) => void;
        const loginPromise = new Promise(resolve => {
          resolveLogin = resolve;
        });

        jest.spyOn(authClient, 'login').mockReturnValue(loginPromise);

        const { result } = renderHook(() => useAuth(), { wrapper });

        // Start login
        act(() => {
          result.current.login({
            email: testUser.email,
            password: 'password123',
          });
        });

        // Should be loading
        expect(result.current.isLoading).toBe(true);
        expect(result.current.error).toBeNull();

        // Resolve login
        act(() => {
          resolveLogin!({
            data: {
              access_token: testSession.access_token,
              user: testUser,
            },
            status: 200,
            success: true,
          });
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });
    });

    describe('register', () => {
      it('should handle successful registration with immediate session', async () => {
        jest.spyOn(authClient, 'register').mockResolvedValue({
          data: {
            access_token: testSession.access_token,
            refresh_token: testSession.refresh_token,
            expires_in: testSession.expires_in,
            user: testUser,
          },
          status: 201,
          success: true,
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        await act(async () => {
          await result.current.register(userData);
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(true);
          expect(result.current.user).toEqual(testUser);
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
        });
      });

      it('should handle registration requiring email verification', async () => {
        jest.spyOn(authClient, 'register').mockResolvedValue({
          data: {
            message: 'Please check your email for verification',
          },
          status: 201,
          success: true,
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        await act(async () => {
          await result.current.register(userData);
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
        });
      });

      it('should handle registration errors', async () => {
        const registrationError = new Error('Email already exists');

        jest.spyOn(authClient, 'register').mockRejectedValue(registrationError);

        const { result } = renderHook(() => useAuth(), { wrapper });

        const userData: RegisterRequest = {
          email: testUser.email,
          password: 'password123',
          name: testUser.name,
        };

        await act(async () => {
          try {
            await result.current.register(userData);
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBe('Email already exists');
        });
      });
    });

    describe('logout', () => {
      it('should handle successful logout', async () => {
        // First login
        jest.spyOn(authClient, 'login').mockResolvedValue({
          data: {
            access_token: testSession.access_token,
            user: testUser,
          },
          status: 200,
          success: true,
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
          await result.current.login({
            email: testUser.email,
            password: 'password123',
          });
        });

        expect(result.current.isAuthenticated).toBe(true);

        // Mock logout
        jest.spyOn(authClient, 'logout').mockResolvedValue({
          data: undefined,
          status: 200,
          success: true,
        });

        // Logout
        await act(async () => {
          await result.current.logout();
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
          expect(result.current.isLoading).toBe(false);
          expect(result.current.error).toBeNull();
        });
      });

      it('should handle logout errors gracefully', async () => {
        // First login
        jest.spyOn(authClient, 'login').mockResolvedValue({
          data: {
            access_token: testSession.access_token,
            user: testUser,
          },
          status: 200,
          success: true,
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        await act(async () => {
          await result.current.login({
            email: testUser.email,
            password: 'password123',
          });
        });

        // Mock logout failure
        const logoutError = new Error('Logout failed');
        jest.spyOn(authClient, 'logout').mockRejectedValue(logoutError);

        // Logout should still clear local state
        await act(async () => {
          try {
            await result.current.logout();
          } catch (error) {
            // Expected error
          }
        });

        await waitFor(() => {
          expect(result.current.isAuthenticated).toBe(false);
          expect(result.current.user).toBeNull();
          expect(result.current.error).toBe('Logout failed');
        });
      });
    });
  });

  describe('Profile Management', () => {
    beforeEach(async () => {
      // Login before profile operations
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'password123',
        });
      });
    });

    it('should update user profile', async () => {
      const updatedUser = {
        ...testUser,
        name: 'Updated Name',
      };

      jest.spyOn(authClient, 'updateProfile').mockResolvedValue({
        data: updatedUser,
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.updateProfile({ name: 'Updated Name' });
      });

      await waitFor(() => {
        expect(result.current.user?.name).toBe('Updated Name');
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle profile update errors', async () => {
      const updateError = new Error('Profile update failed');

      jest.spyOn(authClient, 'updateProfile').mockRejectedValue(updateError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.updateProfile({ name: 'Failed Update' });
        } catch (error) {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Profile update failed');
      });
    });
  });

  describe('Password Management', () => {
    it('should handle forgot password', async () => {
      jest.spyOn(authClient, 'forgotPassword').mockResolvedValue({
        data: { message: 'Password reset email sent' },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.forgotPassword(testUser.email);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(authClient.forgotPassword).toHaveBeenCalledWith(testUser.email);
    });

    it('should handle password reset', async () => {
      jest.spyOn(authClient, 'resetPassword').mockResolvedValue({
        data: { message: 'Password reset successfully' },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.resetPassword('reset-token', 'newpassword123');
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(authClient.resetPassword).toHaveBeenCalledWith('reset-token', 'newpassword123');
    });

    it('should handle password change', async () => {
      // Login first
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'oldpassword',
        });
      });

      jest.spyOn(authClient, 'changePassword').mockResolvedValue({
        data: { message: 'Password changed successfully' },
        status: 200,
        success: true,
      });

      await act(async () => {
        await result.current.changePassword({
          current_password: 'oldpassword',
          new_password: 'newpassword123',
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Email Verification', () => {
    it('should handle email verification', async () => {
      jest.spyOn(authClient, 'verifyEmail').mockResolvedValue({
        data: { message: 'Email verified successfully' },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.verifyEmail('verification-token', 'signup');
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(authClient.verifyEmail).toHaveBeenCalledWith('verification-token', 'signup');
    });
  });

  describe('Error Handling and UI Error Display', () => {
    it('should clear error state on successful operation after error', async () => {
      // First trigger an error
      const loginError = new Error('Invalid credentials');
      jest.spyOn(authClient, 'login').mockRejectedValueOnce(loginError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Failed login
      await act(async () => {
        try {
          await result.current.login({
            email: 'invalid@example.com',
            password: 'wrongpassword',
          });
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Invalid credentials');

      // Now successful login
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'password123',
        });
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('should provide clearError method', async () => {
      // First trigger an error
      const loginError = new Error('Test error');
      jest.spyOn(authClient, 'login').mockRejectedValue(loginError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login({
            email: 'invalid@example.com',
            password: 'wrongpassword',
          });
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Test error');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle network errors properly', async () => {
      const networkError = new Error('Network error');

      jest.spyOn(authClient, 'login').mockRejectedValue(networkError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.login({
            email: testUser.email,
            password: 'password123',
          });
        } catch (error) {
          // Expected
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle different error types appropriately', async () => {
      const errorScenarios = [
        { error: new Error('Validation failed'), expectedMessage: 'Validation failed' },
        { error: 'String error', expectedMessage: 'String error' },
        { error: { message: 'Object error' }, expectedMessage: 'Object error' },
        { error: null, expectedMessage: 'An unexpected error occurred' },
      ];

      const { result } = renderHook(() => useAuth(), { wrapper });

      for (const scenario of errorScenarios) {
        jest.spyOn(authClient, 'login').mockRejectedValue(scenario.error);

        await act(async () => {
          try {
            await result.current.login({
              email: testUser.email,
              password: 'password123',
            });
          } catch (error) {
            // Expected
          }
        });

        await waitFor(() => {
          expect(result.current.error).toBe(scenario.expectedMessage);
        });

        // Clear error for next test
        act(() => {
          result.current.clearError();
        });
      }
    });
  });

  describe('Token Refresh', () => {
    it('should handle token refresh', async () => {
      // Login first
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'password123',
        });
      });

      jest.spyOn(authClient, 'refreshToken').mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          expires_in: 3600,
        },
        status: 200,
        success: true,
      });

      await act(async () => {
        await result.current.refreshToken({ refresh_token: testSession.refresh_token });
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Session Persistence and Restoration', () => {
    it('should restore user state from persisted session', async () => {
      // Mock session restoration
      jest.spyOn(authClient, 'initializeSession').mockResolvedValue(true);
      jest.spyOn(authClient, 'hasValidSession').mockReturnValue(true);
      jest.spyOn(authClient, 'getProfile').mockResolvedValue({
        data: testUser,
        status: 200,
        success: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(testUser);
      });
    });

    it('should handle session restoration errors gracefully', async () => {
      jest
        .spyOn(authClient, 'initializeSession')
        .mockRejectedValue(new Error('Session restoration failed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.error).toBeNull(); // Restoration errors shouldn't set user-visible errors
      });
    });

    it('should maintain state consistency with AuthApiClient', async () => {
      // Login
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      jest.spyOn(authClient, 'hasValidSession').mockReturnValue(true);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'password123',
        });
      });

      // Verify state consistency
      expect(result.current.isAuthenticated).toBe(true);
      expect(authClient.hasValidSession()).toBe(true);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const { unmount } = renderHook(() => useAuth(), { wrapper });

      expect(() => unmount()).not.toThrow();
    });

    it('should handle component re-renders gracefully', () => {
      const { result, rerender } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);

      rerender();

      expect(result.current.isAuthenticated).toBe(false);
      expect(() => rerender()).not.toThrow();
    });
  });

  describe('Hook State Management', () => {
    it('should maintain proper loading states for all operations', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Test login loading state
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise(resolve => {
        resolveLogin = resolve;
      });

      jest.spyOn(authClient, 'login').mockReturnValue(loginPromise);

      act(() => {
        result.current.login({ email: testUser.email, password: 'password123' });
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        resolveLogin!({
          data: { access_token: testSession.access_token, user: testUser },
          status: 200,
          success: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not lose state between re-renders', async () => {
      jest.spyOn(authClient, 'login').mockResolvedValue({
        data: {
          access_token: testSession.access_token,
          user: testUser,
        },
        status: 200,
        success: true,
      });

      const { result, rerender } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: testUser.email,
          password: 'password123',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(testUser);

      rerender();

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(testUser);
    });
  });
});
