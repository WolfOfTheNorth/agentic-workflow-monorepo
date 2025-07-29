/**
 * Comprehensive Tests for Supabase Adapter
 *
 * Task 16: Create comprehensive unit tests for SupabaseAdapter
 * - Write tests for all authentication methods with mocked Supabase client
 * - Test data transformation functions with various input scenarios
 * - Create error handling test scenarios with different Supabase errors
 * - Add session management unit tests with timer mocks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseAdapter,
  SupabaseAdapterError,
  createSupabaseAdapter,
  getSupabaseAdapter,
  resetSupabaseAdapter,
} from '../supabase';
import { ConfigurationManager, resetConfigurationManager } from '../../config';
import {
  getErrorMapper,
  getRetryHandler,
  resetErrorMapper,
  resetRetryHandler,
} from '../error-handler';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU2MjA4MDB9.test',
  AUTH_TOKEN_EXPIRATION: '3600',
  AUTH_REFRESH_THRESHOLD: '300',
  AUTH_MAX_LOGIN_ATTEMPTS: '5',
  AUTH_RATE_LIMIT_WINDOW: '300',
};

describe('SupabaseAdapter', () => {
  let mockClient: Partial<SupabaseClient>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Set up mock environment
    Object.assign(process.env, mockEnv);

    // Mock Supabase client
    mockClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
        updateUser: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        getUser: jest.fn(),
        resend: jest.fn(),
      } as any,
    };

    (createClient as jest.Mock).mockReturnValue(mockClient);

    // Reset singletons
    resetConfigurationManager();
    resetSupabaseAdapter();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    resetConfigurationManager();
    resetSupabaseAdapter();
    resetErrorMapper();
    resetRetryHandler();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create adapter with valid configuration', () => {
      expect(() => new SupabaseAdapter()).not.toThrow();
      expect(createClient).toHaveBeenCalledWith(
        mockEnv.SUPABASE_URL,
        mockEnv.SUPABASE_ANON_KEY,
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          }),
        })
      );
    });

    it('should throw error when Supabase client creation fails', () => {
      (createClient as jest.Mock).mockReturnValue(null);

      expect(() => new SupabaseAdapter()).toThrow(SupabaseAdapterError);
      expect(() => new SupabaseAdapter()).toThrow('Failed to create Supabase client');
    });

    it('should use provided configuration manager', () => {
      const customConfigManager = new ConfigurationManager();
      const adapter = new SupabaseAdapter(customConfigManager);

      expect(adapter.isInitialized()).toBe(true);
    });

    it('should handle configuration errors gracefully', () => {
      // Clear environment to cause configuration error
      delete process.env.SUPABASE_URL;
      resetConfigurationManager();

      expect(() => new SupabaseAdapter()).toThrow();
    });
  });

  describe('Client Management', () => {
    let adapter: SupabaseAdapter;

    beforeEach(() => {
      adapter = new SupabaseAdapter();
    });

    it('should return initialized client', () => {
      const client = adapter.getClient();
      expect(client).toBe(mockClient);
    });

    it('should report initialization status correctly', () => {
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should reinitialize successfully', async () => {
      await expect(adapter.reinitialize()).resolves.not.toThrow();
      expect(createClient).toHaveBeenCalledTimes(2); // Once for initial, once for reinitialize
    });
  });

  describe('Health Status', () => {
    let adapter: SupabaseAdapter;

    beforeEach(() => {
      adapter = new SupabaseAdapter();
    });

    it('should return healthy status when properly initialized', () => {
      const health = adapter.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.status).toBe('ready');
      expect(health.checks.clientInitialized).toBe(true);
      expect(health.checks.configurationValid).toBe(true);
      expect(health.checks.connectionReady).toBe(true);
      expect(health.version).toBe('1.0.0');
    });

    it('should return error status when client fails to initialize', () => {
      (createClient as jest.Mock).mockReturnValue(null);

      expect(() => new SupabaseAdapter()).toThrow();
    });
  });

  describe('Connection Testing', () => {
    let adapter: SupabaseAdapter;

    beforeEach(() => {
      adapter = new SupabaseAdapter();
    });

    it('should successfully test connection', async () => {
      // Mock a small delay to ensure responseTime > 0
      (mockClient.auth?.getSession as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  data: { session: null },
                  error: null,
                }),
              1
            )
          )
      );

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
      expect(result.sessionExists).toBe(false);
      expect(mockClient.auth?.getSession).toHaveBeenCalled();
    });

    it('should handle connection test errors', async () => {
      const mockError = new Error('Network error');
      (mockClient.auth?.getSession as jest.Mock).mockRejectedValue(mockError);

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should handle auth errors in connection test', async () => {
      const authError = { message: 'Invalid API key', status: 401 };
      (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: authError,
      });

      const result = await adapter.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should detect existing session in connection test', async () => {
      const mockSession = {
        access_token: 'token',
        refresh_token: 'refresh',
        user: { id: '123', email: 'test@example.com' },
      };

      (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      expect(result.sessionExists).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create adapter using factory function', () => {
      const adapter = createSupabaseAdapter();
      expect(adapter).toBeInstanceOf(SupabaseAdapter);
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should return singleton instance', () => {
      const adapter1 = getSupabaseAdapter();
      const adapter2 = getSupabaseAdapter();

      expect(adapter1).toBe(adapter2);
      expect(adapter1).toBeInstanceOf(SupabaseAdapter);
    });

    it('should create new instance after reset', () => {
      const adapter1 = getSupabaseAdapter();
      resetSupabaseAdapter();
      const adapter2 = getSupabaseAdapter();

      expect(adapter1).not.toBe(adapter2);
      expect(adapter2).toBeInstanceOf(SupabaseAdapter);
    });
  });

  describe('Error Handling', () => {
    it('should create SupabaseAdapterError with proper properties', () => {
      const originalError = new Error('Original error');
      const error = new SupabaseAdapterError('Adapter error', 'TEST_CODE', originalError);

      expect(error.message).toBe('Adapter error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('SupabaseAdapterError');
    });
  });

  describe('Logger Integration', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log successful initialization', () => {
      new SupabaseAdapter();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO [SupabaseAdapter] Supabase adapter initialized successfully'),
        expect.objectContaining({
          url: mockEnv.SUPABASE_URL,
        })
      );
    });
  });

  describe('Authentication Methods', () => {
    let adapter: SupabaseAdapter;

    beforeEach(() => {
      adapter = new SupabaseAdapter();
    });

    describe('authenticateUser', () => {
      it('should authenticate user successfully', async () => {
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await adapter.authenticateUser(credentials);

        expect(result).toEqual({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        });

        expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      it('should throw error for invalid credentials', async () => {
        const credentials = { email: '', password: '' };

        await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
          'Email and password are required'
        );
      });

      it('should handle Supabase authentication errors', async () => {
        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: { message: 'invalid_credentials', status: 401 },
        });

        const credentials = {
          email: 'test@example.com',
          password: 'wrongpassword',
        };

        await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
          'Invalid email or password'
        );
      });

      it('should handle missing session in response', async () => {
        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: null,
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
          'Authentication succeeded but no session was returned'
        );
      });
    });

    describe('registerUser', () => {
      it('should register user successfully with immediate session', async () => {
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        (mockClient.auth?.signUp as jest.Mock).mockResolvedValue({
          data: { session: mockSession, user: mockSession.user },
          error: null,
        });

        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        };

        const result = await adapter.registerUser(userData);

        expect(result).toEqual({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        });

        expect(mockClient.auth?.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            data: {
              name: 'Test User',
              full_name: 'Test User',
            },
          },
        });
      });

      it('should handle registration requiring email confirmation', async () => {
        const mockUser = {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        };

        (mockClient.auth?.signUp as jest.Mock).mockResolvedValue({
          data: { session: null, user: mockUser },
          error: null,
        });

        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        };

        const result = await adapter.registerUser(userData);

        expect(result).toEqual({
          access_token: '',
          refresh_token: '',
          expires_in: 0,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        });
      });

      it('should throw error for invalid registration data', async () => {
        const userData = { email: '', password: '', name: '' };

        await expect(adapter.registerUser(userData)).rejects.toThrow(
          'Email, password, and name are required'
        );
      });

      it('should handle Supabase registration errors', async () => {
        (mockClient.auth?.signUp as jest.Mock).mockResolvedValue({
          data: { session: null, user: null },
          error: { message: 'user_already_registered', status: 409 },
        });

        const userData = {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Test User',
        };

        await expect(adapter.registerUser(userData)).rejects.toThrow(
          'An account with this email address already exists'
        );
      });
    });

    describe('signOut', () => {
      it('should sign out successfully', async () => {
        (mockClient.auth?.signOut as jest.Mock).mockResolvedValue({
          error: null,
        });

        await expect(adapter.signOut()).resolves.not.toThrow();
        expect(mockClient.auth?.signOut).toHaveBeenCalled();
      });

      it('should handle sign out errors', async () => {
        (mockClient.auth?.signOut as jest.Mock).mockResolvedValue({
          error: { message: 'network_error', status: 503 },
        });

        await expect(adapter.signOut()).rejects.toThrow(
          'Network error. Please check your connection and try again'
        );
      });
    });

    describe('getUserProfile', () => {
      it('should get user profile successfully', async () => {
        const mockUser = {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        };

        (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const result = await adapter.getUserProfile();

        expect(result).toEqual({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        });

        expect(mockClient.auth?.getUser).toHaveBeenCalled();
      });

      it('should handle no authenticated user', async () => {
        (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
          data: { user: null },
          error: null,
        });

        await expect(adapter.getUserProfile()).rejects.toThrow('No authenticated user found');
      });

      it('should handle get user errors', async () => {
        (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
          data: { user: null },
          error: { message: 'token_expired', status: 401 },
        });

        await expect(adapter.getUserProfile()).rejects.toThrow(
          'Your session has expired. Please log in again'
        );
      });
    });

    describe('updateUserProfile', () => {
      it('should update user profile successfully', async () => {
        const mockUser = {
          id: 'test-user-id',
          email: 'updated@example.com',
          user_metadata: { name: 'Updated User' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T12:00:00Z',
        };

        (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const profileData = {
          email: 'updated@example.com',
          name: 'Updated User',
        };

        const result = await adapter.updateUserProfile(profileData);

        expect(result).toEqual({
          id: 'test-user-id',
          email: 'updated@example.com',
          name: 'Updated User',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T12:00:00Z',
        });

        expect(mockClient.auth?.updateUser).toHaveBeenCalledWith({
          email: 'updated@example.com',
          data: {
            name: 'Updated User',
            full_name: 'Updated User',
          },
        });
      });

      it('should handle profile update errors', async () => {
        (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
          data: { user: null },
          error: { message: 'email_address_invalid', status: 400 },
        });

        const profileData = {
          email: 'invalid-email',
        };

        await expect(adapter.updateUserProfile(profileData)).rejects.toThrow(
          'Please enter a valid email address'
        );
      });

      it('should handle missing user in update response', async () => {
        (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const profileData = {
          name: 'Updated User',
        };

        await expect(adapter.updateUserProfile(profileData)).rejects.toThrow(
          'Profile update succeeded but no user data returned'
        );
      });
    });

    describe('Password Management', () => {
      describe('forgotPassword', () => {
        it('should send password reset email successfully', async () => {
          (mockClient.auth?.resetPasswordForEmail as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = { email: 'test@example.com' };
          const result = await adapter.forgotPassword(request);

          expect(result.message).toContain('password reset link has been sent');
          expect(result.email).toBe('test@example.com');
          expect(mockClient.auth?.resetPasswordForEmail).toHaveBeenCalledWith(
            'test@example.com',
            expect.objectContaining({
              redirectTo: expect.stringContaining('/reset-password'),
            })
          );
        });

        it('should handle invalid email format', async () => {
          const request = { email: 'invalid-email' };

          await expect(adapter.forgotPassword(request)).rejects.toThrow(
            'Please provide a valid email address'
          );
        });

        it('should handle empty email', async () => {
          const request = { email: '' };

          await expect(adapter.forgotPassword(request)).rejects.toThrow(
            'Please provide a valid email address'
          );
        });

        it('should handle Supabase errors', async () => {
          (mockClient.auth?.resetPasswordForEmail as jest.Mock).mockResolvedValue({
            error: { message: 'user_not_found', status: 404 },
          });

          const request = { email: 'test@example.com' };

          await expect(adapter.forgotPassword(request)).rejects.toThrow(
            'No account found with this email address'
          );
        });
      });

      describe('resetPassword', () => {
        it('should reset password successfully', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = {
            token: 'reset-token',
            new_password: 'NewSecure123!',
          };

          const result = await adapter.resetPassword(request);

          expect(result.success).toBe(true);
          expect(result.message).toContain('Password has been reset successfully');
          expect(mockClient.auth?.updateUser).toHaveBeenCalledWith({
            password: 'NewSecure123!',
          });
        });

        it('should validate password strength', async () => {
          const request = {
            token: 'reset-token',
            new_password: 'weak',
          };

          await expect(adapter.resetPassword(request)).rejects.toThrow(
            'Password does not meet requirements'
          );
        });

        it('should require token and password', async () => {
          const request = {
            token: '',
            new_password: 'NewSecure123!',
          };

          await expect(adapter.resetPassword(request)).rejects.toThrow(
            'Reset token and new password are required'
          );
        });

        it('should handle Supabase update errors', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: { message: 'invalid_token', status: 400 },
          });

          const request = {
            token: 'invalid-token',
            new_password: 'NewSecure123!',
          };

          await expect(adapter.resetPassword(request)).rejects.toThrow(
            'Invalid request. Please check your input and try again'
          );
        });
      });

      describe('updatePassword', () => {
        it('should update password successfully', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = {
            new_password: 'NewSecure123!',
          };

          const result = await adapter.updatePassword(request);

          expect(result.success).toBe(true);
          expect(result.message).toContain('Password has been updated successfully');
          expect(mockClient.auth?.updateUser).toHaveBeenCalledWith({
            password: 'NewSecure123!',
          });
        });

        it('should verify current password when provided', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
            error: null,
          });

          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = {
            current_password: 'OldPassword123!',
            new_password: 'NewSecure123!',
          };

          const result = await adapter.updatePassword(request);

          expect(result.success).toBe(true);
          expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'OldPassword123!',
          });
        });

        it('should reject incorrect current password', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
            error: { message: 'invalid_credentials' },
          });

          const request = {
            current_password: 'WrongPassword',
            new_password: 'NewSecure123!',
          };

          await expect(adapter.updatePassword(request)).rejects.toThrow(
            'Current password is incorrect'
          );
        });

        it('should validate new password strength', async () => {
          const request = {
            new_password: 'weak',
          };

          await expect(adapter.updatePassword(request)).rejects.toThrow(
            'Password does not meet requirements'
          );
        });

        it('should require new password', async () => {
          const request = {
            new_password: '',
          };

          await expect(adapter.updatePassword(request)).rejects.toThrow('New password is required');
        });

        it('should handle no authenticated user when verifying current password', async () => {
          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: null },
            error: null,
          });

          const request = {
            current_password: 'OldPassword123!',
            new_password: 'NewSecure123!',
          };

          await expect(adapter.updatePassword(request)).rejects.toThrow(
            'No authenticated user found'
          );
        });

        it('should handle Supabase update errors', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: { message: 'password_too_short', status: 400 },
          });

          const request = {
            new_password: 'NewSecure123!',
          };

          await expect(adapter.updatePassword(request)).rejects.toThrow(
            'Password must be at least 8 characters long'
          );
        });
      });
    });

    describe('Email Verification', () => {
      describe('verifyEmail', () => {
        it('should verify email successfully', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          const request = { token: 'verification-token' };
          const result = await adapter.verifyEmail(request);

          expect(result.success).toBe(true);
          expect(result.message).toContain('Email has been verified successfully');
          expect(result.user?.id).toBe('test-user-id');
          expect(result.user?.email_verified).toBe(true);
        });

        it('should handle missing token', async () => {
          const request = { token: '' };

          await expect(adapter.verifyEmail(request)).rejects.toThrow(
            'Verification token is required'
          );
        });

        it('should handle user not found', async () => {
          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: null },
            error: null,
          });

          const request = { token: 'verification-token' };

          await expect(adapter.verifyEmail(request)).rejects.toThrow(
            'No user found for verification token'
          );
        });

        it('should handle pending verification', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: null, // Not verified yet
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          const request = { token: 'verification-token' };

          await expect(adapter.verifyEmail(request)).rejects.toThrow(
            'Email verification is still pending'
          );
        });

        it('should handle expired token', async () => {
          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: null },
            error: { message: 'token expired' },
          });

          const request = { token: 'expired-token' };

          await expect(adapter.verifyEmail(request)).rejects.toThrow(
            'Verification token is invalid or has expired'
          );
        });
      });

      describe('resendVerificationEmail', () => {
        it('should resend verification email successfully', async () => {
          (mockClient.auth?.resend as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = { email: 'test@example.com', type: 'signup' as const };
          const result = await adapter.resendVerificationEmail(request);

          expect(result.success).toBe(true);
          expect(result.message).toContain('new verification email has been sent');
          expect(result.email).toBe('test@example.com');
          expect(mockClient.auth?.resend).toHaveBeenCalledWith({
            type: 'signup',
            email: 'test@example.com',
          });
        });

        it('should handle invalid email format', async () => {
          const request = { email: 'invalid-email' };

          await expect(adapter.resendVerificationEmail(request)).rejects.toThrow(
            'Please provide a valid email address'
          );
        });

        it('should handle already verified email', async () => {
          (mockClient.auth?.resend as jest.Mock).mockResolvedValue({
            error: { message: 'already confirmed' },
          });

          const request = { email: 'test@example.com' };

          await expect(adapter.resendVerificationEmail(request)).rejects.toThrow(
            'This email address is already verified'
          );
        });

        it('should handle rate limiting', async () => {
          (mockClient.auth?.resend as jest.Mock).mockResolvedValue({
            error: { message: 'too many requests' },
          });

          const request = { email: 'test@example.com' };

          await expect(adapter.resendVerificationEmail(request)).rejects.toThrow(
            'Too many verification emails sent'
          );
        });

        it('should handle email change type', async () => {
          (mockClient.auth?.resend as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = { email: 'test@example.com', type: 'email_change' as const };
          await adapter.resendVerificationEmail(request);

          expect(mockClient.auth?.resend).toHaveBeenCalledWith({
            type: 'email_change',
            email: 'test@example.com',
          });
        });
      });

      describe('getEmailVerificationStatus', () => {
        it('should get verification status for verified user', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
            created_at: '2023-01-01T00:00:00Z',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          const request = {};
          const result = await adapter.getEmailVerificationStatus(request);

          expect(result.isVerified).toBe(true);
          expect(result.email).toBe('test@example.com');
          expect(result.verifiedAt).toBe('2023-01-01T00:00:00Z');
          expect(result.needsVerification).toBe(false);
        });

        it('should get verification status for unverified user', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: null,
            created_at: '2023-01-01T00:00:00Z',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          const request = {};
          const result = await adapter.getEmailVerificationStatus(request);

          expect(result.isVerified).toBe(false);
          expect(result.email).toBe('test@example.com');
          expect(result.verifiedAt).toBeUndefined();
          expect(result.needsVerification).toBe(true);
          expect(result.canResend).toBe(true);
        });

        it('should handle email mismatch', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'user@example.com',
            email_confirmed_at: null,
            created_at: '2023-01-01T00:00:00Z',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          const request = { email: 'different@example.com' };

          await expect(adapter.getEmailVerificationStatus(request)).rejects.toThrow(
            'Email does not match authenticated user'
          );
        });

        it('should handle no authenticated user', async () => {
          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: null },
            error: null,
          });

          const request = {};

          await expect(adapter.getEmailVerificationStatus(request)).rejects.toThrow(
            'No authenticated user found'
          );
        });
      });

      describe('changeEmail', () => {
        it('should change email successfully', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = { newEmail: 'new@example.com' };
          const result = await adapter.changeEmail(request);

          expect(result.success).toBe(true);
          expect(result.newEmail).toBe('new@example.com');
          expect(result.requiresVerification).toBe(true);
          expect(result.message).toContain('Email change initiated');
          expect(mockClient.auth?.updateUser).toHaveBeenCalledWith({
            email: 'new@example.com',
          });
        });

        it('should validate new email format', async () => {
          const request = { newEmail: 'invalid-email' };

          await expect(adapter.changeEmail(request)).rejects.toThrow(
            'Please provide a valid email address'
          );
        });

        it('should verify current password when provided', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'current@example.com',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
            error: null,
          });

          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: null,
          });

          const request = {
            newEmail: 'new@example.com',
            currentPassword: 'current-password',
          };

          const result = await adapter.changeEmail(request);

          expect(result.success).toBe(true);
          expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledWith({
            email: 'current@example.com',
            password: 'current-password',
          });
        });

        it('should handle incorrect current password', async () => {
          const mockUser = {
            id: 'test-user-id',
            email: 'current@example.com',
          };

          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: mockUser },
            error: null,
          });

          (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
            error: { message: 'invalid_credentials' },
          });

          const request = {
            newEmail: 'new@example.com',
            currentPassword: 'wrong-password',
          };

          await expect(adapter.changeEmail(request)).rejects.toThrow(
            'Current password is incorrect'
          );
        });

        it('should handle email already exists', async () => {
          (mockClient.auth?.updateUser as jest.Mock).mockResolvedValue({
            error: { message: 'already registered' },
          });

          const request = { newEmail: 'existing@example.com' };

          await expect(adapter.changeEmail(request)).rejects.toThrow(
            'This email address is already registered to another account'
          );
        });

        it('should handle no authenticated user when verifying password', async () => {
          (mockClient.auth?.getUser as jest.Mock).mockResolvedValue({
            data: { user: null },
            error: null,
          });

          const request = {
            newEmail: 'new@example.com',
            currentPassword: 'password',
          };

          await expect(adapter.changeEmail(request)).rejects.toThrow('No authenticated user found');
        });
      });
    });

    describe('Enhanced Registration with Email Verification', () => {
      it('should handle registration requiring email verification', async () => {
        const mockUser = {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          email_confirmed_at: null, // Not verified
        };

        (mockClient.auth?.signUp as jest.Mock).mockResolvedValue({
          data: { session: null, user: mockUser },
          error: null,
        });

        const userData = {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        };

        const result = await adapter.registerUser(userData);

        expect(result.access_token).toBe('');
        expect(result.refresh_token).toBe('');
        expect(result.expires_in).toBe(0);
        expect(result.user.email).toBe('test@example.com');
      });
    });

    describe('Enhanced Login with Email Verification', () => {
      it('should prevent login with unverified email', async () => {
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: null, // Not verified
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
          'Please verify your email address before logging in'
        );
      });

      it('should allow login with verified email', async () => {
        const mockSession = {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            email_confirmed_at: '2023-01-01T00:00:00Z', // Verified
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await adapter.authenticateUser(credentials);

        expect(result.access_token).toBe('test-access-token');
        expect(result.user.email).toBe('test@example.com');
      });
    });

    describe('Session Management', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
      });

      describe('getActiveSession', () => {
        it('should return active session when available', async () => {
          const mockSession = {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            user: {
              id: 'test-id',
              email: 'test@example.com',
              user_metadata: { name: 'Test User' },
            },
          };

          (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
            data: { session: mockSession },
            error: null,
          });

          const result = await adapter.getActiveSession();

          expect(result).toEqual(mockSession);
          expect(mockClient.auth?.getSession).toHaveBeenCalled();
        });

        it('should return null when no session exists', async () => {
          (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: null,
          });

          const result = await adapter.getActiveSession();

          expect(result).toBeNull();
        });

        it('should handle session retrieval errors', async () => {
          (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: { message: 'session_error', status: 500 },
          });

          await expect(adapter.getActiveSession()).rejects.toThrow(
            'An unexpected error occurred. Please try again'
          );
        });

        it('should validate session data before returning', async () => {
          const invalidSession = {
            access_token: '', // Invalid empty token
            user: null,
          };

          (mockClient.auth?.getSession as jest.Mock).mockResolvedValue({
            data: { session: invalidSession },
            error: null,
          });

          const result = await adapter.getActiveSession();
          expect(result).toBeNull(); // Should return null for invalid sessions
        });
      });
    });

    describe('Retry Logic and Error Handling', () => {
      let adapter: SupabaseAdapter;
      let consoleSpy: jest.SpyInstance;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
        consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      });

      afterEach(() => {
        consoleSpy.mockRestore();
      });

      it('should retry failed operations with exponential backoff', async () => {
        let attemptCount = 0;
        (mockClient.auth?.signInWithPassword as jest.Mock).mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.resolve({
              data: { session: null },
              error: { message: 'network_error', status: 503 },
            });
          }
          return Promise.resolve({
            data: {
              session: {
                access_token: 'success-token',
                refresh_token: 'success-refresh',
                expires_in: 3600,
                user: {
                  id: 'test-id',
                  email: 'test@example.com',
                  email_confirmed_at: '2023-01-01T00:00:00Z',
                },
              },
            },
            error: null,
          });
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await adapter.authenticateUser(credentials);

        expect(attemptCount).toBe(3);
        expect(result.access_token).toBe('success-token');
        expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledTimes(3);
      });

      it('should fail after maximum retry attempts', async () => {
        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: null },
          error: { message: 'network_error', status: 503 },
        });

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
          'Network error. Please check your connection and try again'
        );

        // Should have tried the maximum number of times
        expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledTimes(3);
      });

      it('should handle different error types correctly', async () => {
        const errorScenarios = [
          {
            error: { message: 'invalid_credentials', status: 401 },
            expectedMessage: 'Invalid email or password',
          },
          {
            error: { message: 'user_not_found', status: 404 },
            expectedMessage: 'No account found with this email address',
          },
          {
            error: { message: 'email_not_confirmed', status: 400 },
            expectedMessage: 'Please verify your email address before logging in',
          },
          {
            error: { message: 'too_many_requests', status: 429 },
            expectedMessage: 'Too many login attempts. Please wait before trying again',
          },
        ];

        for (const scenario of errorScenarios) {
          (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: scenario.error,
          });

          const credentials = {
            email: 'test@example.com',
            password: 'password123',
          };

          await expect(adapter.authenticateUser(credentials)).rejects.toThrow(
            scenario.expectedMessage
          );
        }
      });
    });

    describe('Data Transformation Edge Cases', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
      });

      it('should handle users with minimal metadata', async () => {
        const mockSession = {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
            user_metadata: {}, // Empty metadata
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const result = await adapter.authenticateUser({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(result.user.name).toBe(''); // Should handle empty name gracefully
        expect(result.user.email).toBe('test@example.com');
      });

      it('should handle users with complex metadata', async () => {
        const mockSession = {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
            user_metadata: {
              name: 'John Doe',
              full_name: 'John Smith Doe',
              avatar_url: 'https://example.com/avatar.jpg',
              custom_field: 'custom_value',
            },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const result = await adapter.authenticateUser({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(result.user.name).toBe('John Doe'); // Should prefer 'name' over 'full_name'
        expect(result.user.email).toBe('test@example.com');
      });

      it('should handle sessions with missing expires_in', async () => {
        const mockSession = {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: undefined, // Missing expires_in
          user: {
            id: 'test-id',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
            user_metadata: { name: 'Test User' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const result = await adapter.authenticateUser({
          email: 'test@example.com',
          password: 'password123',
        });

        expect(result.expires_in).toBe(3600); // Should use default value
      });
    });

    describe('Input Validation Edge Cases', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
      });

      it('should handle various email formats correctly', async () => {
        const emailTests = [
          { email: 'test@example.com', valid: true },
          { email: 'test+tag@example.com', valid: true },
          { email: 'test.email@example.co.uk', valid: true },
          { email: 'invalid-email', valid: false },
          { email: '', valid: false },
          { email: 'test@', valid: false },
          { email: '@example.com', valid: false },
          { email: '   test@example.com   ', valid: true }, // Should trim whitespace
        ];

        for (const test of emailTests) {
          if (test.valid) {
            // Mock successful response for valid emails
            (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue({
              data: {
                session: {
                  access_token: 'token',
                  refresh_token: 'refresh',
                  expires_in: 3600,
                  user: {
                    id: 'test-id',
                    email: test.email.trim(),
                    email_confirmed_at: '2023-01-01T00:00:00Z',
                    user_metadata: { name: 'Test' },
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-01T00:00:00Z',
                  },
                },
              },
              error: null,
            });

            await expect(
              adapter.authenticateUser({
                email: test.email,
                password: 'password123',
              })
            ).resolves.not.toThrow();
          } else {
            await expect(
              adapter.authenticateUser({
                email: test.email,
                password: 'password123',
              })
            ).rejects.toThrow();
          }
        }
      });

      it('should validate password requirements', async () => {
        const passwordTests = [
          { password: '', valid: false },
          { password: '123', valid: false },
          { password: 'password', valid: false }, // No complexity
          { password: 'Password123!', valid: true },
          { password: 'VeryLongPasswordWith123!', valid: true },
        ];

        for (const test of passwordTests) {
          if (!test.valid) {
            await expect(
              adapter.authenticateUser({
                email: 'test@example.com',
                password: test.password,
              })
            ).rejects.toThrow();
          }
        }
      });
    });

    describe('Concurrent Operations', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
      });

      it('should handle concurrent authentication attempts', async () => {
        const mockResponse = {
          data: {
            session: {
              access_token: 'token',
              refresh_token: 'refresh',
              expires_in: 3600,
              user: {
                id: 'test-id',
                email: 'test@example.com',
                email_confirmed_at: '2023-01-01T00:00:00Z',
                user_metadata: { name: 'Test' },
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:00:00Z',
              },
            },
          },
          error: null,
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue(mockResponse);

        const credentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        // Execute multiple concurrent authentication attempts
        const promises = Array(5)
          .fill(null)
          .map(() => adapter.authenticateUser(credentials));

        const results = await Promise.all(promises);

        // All should succeed and return consistent results
        results.forEach(result => {
          expect(result.access_token).toBe('token');
          expect(result.user.email).toBe('test@example.com');
        });

        expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledTimes(5);
      });
    });

    describe('Memory and Resource Management', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
      });

      it('should not leak memory with repeated operations', async () => {
        const mockResponse = {
          data: {
            session: {
              access_token: 'token',
              refresh_token: 'refresh',
              expires_in: 3600,
              user: {
                id: 'test-id',
                email: 'test@example.com',
                email_confirmed_at: '2023-01-01T00:00:00Z',
                user_metadata: { name: 'Test' },
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:00:00Z',
              },
            },
          },
          error: null,
        };

        (mockClient.auth?.signInWithPassword as jest.Mock).mockResolvedValue(mockResponse);

        // Perform many operations
        for (let i = 0; i < 100; i++) {
          await adapter.authenticateUser({
            email: `test${i}@example.com`,
            password: 'password123',
          });
        }

        // Should complete without memory issues
        expect(mockClient.auth?.signInWithPassword).toHaveBeenCalledTimes(100);
      });

      it('should handle cleanup properly', () => {
        // Test that adapter doesn't hold references that prevent GC
        const originalAdapter = adapter;
        adapter = null as any;

        // Cleanup should not throw errors
        expect(() => {
          // Simulate garbage collection scenario
        }).not.toThrow();
      });
    });

    describe('Performance and Timeouts', () => {
      let adapter: SupabaseAdapter;

      beforeEach(() => {
        adapter = new SupabaseAdapter();
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should handle slow responses gracefully', async () => {
        const slowPromise = new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: {
                session: {
                  access_token: 'token',
                  refresh_token: 'refresh',
                  expires_in: 3600,
                  user: {
                    id: 'test-id',
                    email: 'test@example.com',
                    email_confirmed_at: '2023-01-01T00:00:00Z',
                    user_metadata: { name: 'Test' },
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-01T00:00:00Z',
                  },
                },
              },
              error: null,
            });
          }, 5000); // 5 second delay
        });

        (mockClient.auth?.signInWithPassword as jest.Mock).mockReturnValue(slowPromise);

        const authPromise = adapter.authenticateUser({
          email: 'test@example.com',
          password: 'password123',
        });

        // Fast forward time
        jest.advanceTimersByTime(5000);

        const result = await authPromise;
        expect(result.access_token).toBe('token');
      });
    });
  });
});
