/**
 * Comprehensive Tests for AuthClient
 *
 * Task 5.1.2: Test AuthClient and authentication logic
 * - Create tests for auth-client.ts with mocked dependencies
 * - Test session management and token refresh logic
 * - Test error handling and retry mechanisms
 * - Requirements: 8.9
 */

import { AuthClient, AuthClientConfig } from '../auth-client';
import { ApiClient } from '../../client/base';
import {
  AuthUser,
  LoginCredentials,
  SignupData,
  AuthResponse,
  AuthSession,
} from '@agentic-workflow/shared';

// Mock dependencies
jest.mock('../supabase');
jest.mock('../../adapters/supabase-adapter');
jest.mock('../../adapters/enhanced-token-storage');
jest.mock('../../adapters/auth-validation-service');

// Mock API client
const mockApiClient = {
  setAuthToken: jest.fn(),
  setTokenRefreshHandler: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
} as unknown as ApiClient;

// Mock Supabase adapter
const mockSupabaseAdapter = {
  initialize: jest.fn(),
  login: jest.fn(),
  signup: jest.fn(),
  logout: jest.fn(),
  validateSession: jest.fn(),
  refreshToken: jest.fn(),
  requestPasswordReset: jest.fn(),
  updateProfile: jest.fn(),
  updatePassword: jest.fn(),
  verifyEmail: jest.fn(),
  getCurrentEnhancedSession: jest.fn(),
  addSessionEventListener: jest.fn(),
  dispose: jest.fn(),
  getSessionStatistics: jest.fn(),
  checkHealth: jest.fn(),
};

// Mock token storage
const mockTokenStorage = {
  storeAuthTokensWithRememberMe: jest.fn(),
  getAccessToken: jest.fn(),
  isAccessTokenExpired: jest.fn(),
  clearAuthTokens: jest.fn(),
  getCSRFToken: jest.fn(),
  validateCSRFToken: jest.fn(),
  getEnhancedStats: jest.fn(),
};

// Mock validation service
const mockValidationService = {
  validateLoginData: jest.fn(),
  validateRegistrationData: jest.fn(),
  checkRateLimit: jest.fn(),
  validateOrigin: jest.fn(),
  validateUserAgent: jest.fn(),
  recordSuccessfulAttempt: jest.fn(),
  recordFailedAttempt: jest.fn(),
  validateEmail: jest.fn(),
  validatePassword: jest.fn(),
  validateName: jest.fn(),
  generateCSRFToken: jest.fn(),
  validateCSRFToken: jest.fn(),
  getSecurityHeaders: jest.fn(),
  getRateLimitStats: jest.fn(),
  validateHTTPS: jest.fn(),
};

// Mock constructors
jest.mock('../../adapters/supabase-adapter', () => ({
  SupabaseAuthAdapter: jest.fn(() => mockSupabaseAdapter),
}));

jest.mock('../../adapters/enhanced-token-storage', () => ({
  createEnhancedTokenStorage: jest.fn(() => mockTokenStorage),
}));

jest.mock('../../adapters/auth-validation-service', () => ({
  AuthValidationService: jest.fn(() => mockValidationService),
  DEFAULT_AUTH_VALIDATION_CONFIG: {
    security: {
      requireHTTPS: false,
      allowedOrigins: [],
    },
  },
}));

describe('AuthClient', () => {
  let authClient: AuthClient;
  let config: AuthClientConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    config = {
      supabaseUrl: 'https://test-project.supabase.co',
      supabaseKey: 'test-anon-key',
      apiClient: mockApiClient,
      enableDetailedLogging: true,
    };

    // Setup default mock responses
    mockSupabaseAdapter.initialize.mockResolvedValue(undefined);
    mockValidationService.validateLoginData.mockReturnValue({
      isValid: true,
      sanitizedData: { email: 'test@example.com' },
      errors: [],
    });
    mockValidationService.checkRateLimit.mockReturnValue({
      allowed: true,
      remainingAttempts: 5,
      resetTime: Date.now() + 3600000,
      blocked: false,
    });
    mockValidationService.validateOrigin.mockReturnValue(true);
    mockValidationService.validateUserAgent.mockReturnValue(true);
    mockTokenStorage.isAccessTokenExpired.mockResolvedValue(false);
    mockSupabaseAdapter.validateSession.mockResolvedValue({
      isValid: false,
      session: null,
      error: null,
    });
  });

  afterEach(async () => {
    if (authClient) {
      await authClient.dispose();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create AuthClient with valid configuration', async () => {
      authClient = new AuthClient(config);

      expect(authClient).toBeInstanceOf(AuthClient);
      expect(mockApiClient.setTokenRefreshHandler).toHaveBeenCalledWith(authClient);
    });

    it('should initialize Supabase adapter and restore session', async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();

      expect(mockSupabaseAdapter.initialize).toHaveBeenCalled();
      expect(mockSupabaseAdapter.validateSession).toHaveBeenCalled();
    });

    it('should setup session event listeners', () => {
      authClient = new AuthClient(config);

      expect(mockSupabaseAdapter.addSessionEventListener).toHaveBeenCalledWith(
        'session_restored',
        expect.any(Function)
      );
      expect(mockSupabaseAdapter.addSessionEventListener).toHaveBeenCalledWith(
        'session_refreshed',
        expect.any(Function)
      );
      expect(mockSupabaseAdapter.addSessionEventListener).toHaveBeenCalledWith(
        'session_cleared',
        expect.any(Function)
      );
      expect(mockSupabaseAdapter.addSessionEventListener).toHaveBeenCalledWith(
        'session_expired',
        expect.any(Function)
      );
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    describe('login', () => {
      it('should login successfully with valid credentials', async () => {
        const mockUser: AuthUser = {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };

        const mockSession: AuthSession = {
          id: 'session-id',
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000,
          createdAt: '2023-01-01T00:00:00Z',
          lastActivityAt: '2023-01-01T00:00:00Z',
        };

        mockSupabaseAdapter.login.mockResolvedValue({
          success: true,
          user: mockUser,
          session: mockSession,
        });

        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await authClient.login(credentials);

        expect(result.success).toBe(true);
        expect(result.user).toEqual(mockUser);
        expect(result.session).toEqual(mockSession);
        expect(mockValidationService.validateLoginData).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(mockValidationService.recordSuccessfulAttempt).toHaveBeenCalled();
        expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('access-token');
      });

      it('should handle validation errors', async () => {
        mockValidationService.validateLoginData.mockReturnValue({
          isValid: false,
          errors: ['Invalid email format'],
        });

        const credentials: LoginCredentials = {
          email: 'invalid-email',
          password: 'password123',
        };

        const result = await authClient.login(credentials);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('Invalid email format');
      });

      it('should handle rate limiting', async () => {
        mockValidationService.checkRateLimit.mockReturnValue({
          allowed: false,
          remainingAttempts: 0,
          resetTime: Date.now() + 3600000,
          blocked: true,
        });

        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await authClient.login(credentials);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('RATE_LIMITED');
      });

      it('should handle remember me functionality', async () => {
        const mockUser: AuthUser = {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };

        const mockSession: AuthSession = {
          id: 'session-id',
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000,
          createdAt: '2023-01-01T00:00:00Z',
          lastActivityAt: '2023-01-01T00:00:00Z',
        };

        mockSupabaseAdapter.login.mockResolvedValue({
          success: true,
          user: mockUser,
          session: mockSession,
        });

        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true,
        };

        const result = await authClient.login(credentials);

        expect(result.success).toBe(true);
        expect(mockTokenStorage.storeAuthTokensWithRememberMe).toHaveBeenCalledWith(
          'access-token',
          'refresh-token',
          expect.any(Number),
          true
        );
      });

      it('should record failed attempts on authentication failure', async () => {
        mockSupabaseAdapter.login.mockResolvedValue({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
          },
        });

        const credentials: LoginCredentials = {
          email: 'test@example.com',
          password: 'wrongpassword',
        };

        const clientInfo = {
          ip: '192.168.1.1',
          userAgent: 'test-agent',
        };

        const result = await authClient.login(credentials, clientInfo);

        expect(result.success).toBe(false);
        expect(mockValidationService.recordFailedAttempt).toHaveBeenCalledWith(
          '192.168.1.1',
          'test@example.com'
        );
      });
    });

    describe('signup', () => {
      it('should signup successfully with valid data', async () => {
        const mockUser: AuthUser = {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: false,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };

        mockValidationService.validateRegistrationData.mockReturnValue({
          isValid: true,
          sanitizedData: { email: 'test@example.com', name: 'Test User' },
          errors: [],
        });

        mockSupabaseAdapter.signup.mockResolvedValue({
          success: true,
          user: mockUser,
          session: null, // Email verification required
        });

        const userData: SignupData = {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          termsAccepted: true,
        };

        const result = await authClient.signup(userData);

        expect(result.success).toBe(true);
        expect(result.user).toEqual(mockUser);
        expect(mockValidationService.validateRegistrationData).toHaveBeenCalled();
        expect(mockValidationService.recordSuccessfulAttempt).toHaveBeenCalled();
      });

      it('should handle password confirmation mismatch', async () => {
        mockValidationService.validateRegistrationData.mockReturnValue({
          isValid: true,
          sanitizedData: { email: 'test@example.com', name: 'Test User' },
          errors: [],
        });

        const userData: SignupData = {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          confirmPassword: 'DifferentPassword123!',
          termsAccepted: true,
        };

        const result = await authClient.signup(userData);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PASSWORD_MISMATCH');
      });

      it('should handle terms not accepted', async () => {
        mockValidationService.validateRegistrationData.mockReturnValue({
          isValid: true,
          sanitizedData: { email: 'test@example.com', name: 'Test User' },
          errors: [],
        });

        const userData: SignupData = {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          termsAccepted: false,
        };

        const result = await authClient.signup(userData);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('TERMS_NOT_ACCEPTED');
      });
    });

    describe('logout', () => {
      it('should logout successfully', async () => {
        mockSupabaseAdapter.logout.mockResolvedValue({
          success: true,
        });

        const result = await authClient.logout();

        expect(result.success).toBe(true);
        expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
        expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(null);
      });

      it('should clear local session even if logout fails', async () => {
        mockSupabaseAdapter.logout.mockRejectedValue(new Error('Network error'));

        const result = await authClient.logout();

        expect(result.success).toBe(false);
        expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
        expect(mockApiClient.setAuthToken).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    describe('refreshSession', () => {
      it('should refresh session successfully', async () => {
        const mockCurrentSession = {
          refreshToken: 'refresh-token',
        };

        const mockRefreshResult = {
          success: true,
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
          },
        };

        mockSupabaseAdapter.getCurrentEnhancedSession.mockReturnValue(mockCurrentSession);
        mockSupabaseAdapter.refreshToken.mockResolvedValue(mockRefreshResult);

        // Set up a current session first
        authClient['currentSession'] = {
          id: 'session-id',
          user: {} as AuthUser,
          accessToken: 'old-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now(),
          createdAt: '2023-01-01T00:00:00Z',
          lastActivityAt: '2023-01-01T00:00:00Z',
        };

        const result = await authClient.refreshSession();

        expect(result.success).toBe(true);
        expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('new-access-token');
      });

      it('should handle missing refresh token', async () => {
        mockSupabaseAdapter.getCurrentEnhancedSession.mockReturnValue(null);

        const result = await authClient.refreshSession();

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NO_REFRESH_TOKEN');
      });
    });

    describe('validateSession', () => {
      it('should validate session successfully', async () => {
        const mockUser: AuthUser = {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        };

        mockSupabaseAdapter.validateSession.mockResolvedValue({
          isValid: true,
          session: { user: mockUser },
          error: null,
        });

        const result = await authClient.validateSession();

        expect(result.isValid).toBe(true);
        expect(result.user).toEqual(mockUser);
      });

      it('should handle invalid session', async () => {
        mockSupabaseAdapter.validateSession.mockResolvedValue({
          isValid: false,
          session: null,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
        });

        const result = await authClient.validateSession();

        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('session restoration', () => {
      it('should restore session from token storage', async () => {
        mockTokenStorage.getAccessToken.mockResolvedValue('stored-token');
        mockTokenStorage.isAccessTokenExpired.mockResolvedValue(false);
        mockSupabaseAdapter.validateSession.mockResolvedValue({
          isValid: true,
          session: {
            user: { id: 'test-id', email: 'test@example.com' },
            accessToken: 'stored-token',
          },
        });

        authClient = new AuthClient(config);
        await authClient.initialize();

        expect(mockApiClient.setAuthToken).toHaveBeenCalledWith('stored-token');
      });

      it('should fallback to Supabase when token storage fails', async () => {
        mockTokenStorage.getAccessToken.mockResolvedValue(null);
        mockSupabaseAdapter.validateSession.mockResolvedValue({
          isValid: true,
          session: {
            user: { id: 'test-id', email: 'test@example.com' },
            accessToken: 'supabase-token',
          },
        });

        authClient = new AuthClient(config);
        await authClient.initialize();

        expect(mockSupabaseAdapter.validateSession).toHaveBeenCalled();
      });
    });
  });

  describe('Token Management', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    describe('TokenRefreshHandler implementation', () => {
      it('should refresh token through refreshSession', async () => {
        const mockCurrentSession = {
          refreshToken: 'refresh-token',
        };

        const mockRefreshResult = {
          success: true,
          session: {
            accessToken: 'new-access-token',
          },
        };

        mockSupabaseAdapter.getCurrentEnhancedSession.mockReturnValue(mockCurrentSession);
        mockSupabaseAdapter.refreshToken.mockResolvedValue({
          success: true,
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
          },
        });

        // Set up a current session
        authClient['currentSession'] = {
          id: 'session-id',
          user: {} as AuthUser,
          accessToken: 'old-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now(),
          createdAt: '2023-01-01T00:00:00Z',
          lastActivityAt: '2023-01-01T00:00:00Z',
        };

        const result = await authClient.refreshToken();

        expect(result).toBe('new-access-token');
      });

      it('should return null when refresh fails', async () => {
        mockSupabaseAdapter.getCurrentEnhancedSession.mockReturnValue(null);

        const result = await authClient.refreshToken();

        expect(result).toBeNull();
      });

      it('should check token expiration through token storage', async () => {
        mockTokenStorage.isAccessTokenExpired.mockResolvedValue(true);

        const isExpired = await authClient.isTokenExpired();

        expect(isExpired).toBe(true);
        expect(mockTokenStorage.isAccessTokenExpired).toHaveBeenCalledWith(5);
      });

      it('should check token expiration with custom buffer', async () => {
        mockTokenStorage.isAccessTokenExpired.mockResolvedValue(false);

        const isExpired = await authClient.isTokenExpired(10);

        expect(isExpired).toBe(false);
        expect(mockTokenStorage.isAccessTokenExpired).toHaveBeenCalledWith(10);
      });
    });
  });

  describe('Security Features', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    it('should validate CSRF tokens', () => {
      mockTokenStorage.getCSRFToken.mockReturnValue('csrf-token');
      mockTokenStorage.validateCSRFToken.mockReturnValue(true);

      const token = authClient.getCSRFToken();
      const isValid = authClient.validateCSRFToken('csrf-token');

      expect(token).toBe('csrf-token');
      expect(isValid).toBe(true);
    });

    it('should validate origins', () => {
      mockValidationService.validateOrigin.mockReturnValue(true);

      const isValid = authClient.validateOrigin('https://app.example.com');

      expect(isValid).toBe(true);
      expect(mockValidationService.validateOrigin).toHaveBeenCalledWith('https://app.example.com');
    });

    it('should validate user agents', () => {
      mockValidationService.validateUserAgent.mockReturnValue(true);

      const isValid = authClient.validateUserAgent('Mozilla/5.0...');

      expect(isValid).toBe(true);
      expect(mockValidationService.validateUserAgent).toHaveBeenCalledWith('Mozilla/5.0...');
    });

    it('should check rate limits', () => {
      const mockRateLimit = {
        allowed: true,
        remainingAttempts: 5,
        resetTime: Date.now() + 3600000,
        blocked: false,
      };

      mockValidationService.checkRateLimit.mockReturnValue(mockRateLimit);

      const result = authClient.checkRateLimit('192.168.1.1', 'test@example.com');

      expect(result).toEqual(mockRateLimit);
    });
  });

  describe('Validation Methods', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    it('should validate email', () => {
      mockValidationService.validateEmail.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = authClient.validateEmail('test@example.com');

      expect(result.isValid).toBe(true);
      expect(mockValidationService.validateEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should validate password', () => {
      mockValidationService.validatePassword.mockReturnValue({
        isValid: true,
        strength: 'strong',
        errors: [],
      });

      const result = authClient.validatePassword('Password123!');

      expect(result.isValid).toBe(true);
      expect(mockValidationService.validatePassword).toHaveBeenCalledWith('Password123!');
    });

    it('should validate name', () => {
      mockValidationService.validateName.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = authClient.validateName('John Doe');

      expect(result.isValid).toBe(true);
      expect(mockValidationService.validateName).toHaveBeenCalledWith('John Doe');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    it('should map unknown errors to AuthError format', () => {
      const error = new Error('Unknown error');
      const mappedError = authClient['mapErrorToAuthError'](error);

      expect(mappedError.code).toBe('UNKNOWN_ERROR');
      expect(mappedError.message).toBe('Unknown error');
    });

    it('should preserve existing AuthError format', () => {
      const error = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
      };

      const mappedError = authClient['mapErrorToAuthError'](error);

      expect(mappedError.code).toBe('CUSTOM_ERROR');
      expect(mappedError.message).toBe('Custom error message');
    });
  });

  describe('Cleanup and Disposal', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    it('should dispose resources properly', async () => {
      await authClient.dispose();

      expect(mockApiClient.setTokenRefreshHandler).toHaveBeenCalledWith(null);
      expect(mockSupabaseAdapter.dispose).toHaveBeenCalled();
      expect(mockTokenStorage.clearAuthTokens).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      authClient = new AuthClient(config);
      await authClient.initialize();
    });

    it('should track authentication state correctly', () => {
      expect(authClient.isAuthenticated()).toBe(false);
      expect(authClient.getCurrentUser()).toBeNull();
      expect(authClient.getCurrentSession()).toBeNull();
    });

    it('should update state after successful login', async () => {
      const mockUser: AuthUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockSession: AuthSession = {
        id: 'session-id',
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        createdAt: '2023-01-01T00:00:00Z',
        lastActivityAt: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdapter.login.mockResolvedValue({
        success: true,
        user: mockUser,
        session: mockSession,
      });

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      await authClient.login(credentials);

      expect(authClient.getCurrentUser()).toEqual(mockUser);
      expect(authClient.getCurrentSession()).toEqual(mockSession);
      expect(authClient.isAuthenticated()).toBe(true);
    });
  });
});
